import { Injectable, Logger, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import * as fs from 'fs';
import * as path from 'path';
import { PrismaService } from '../prisma/prisma.service';

/**
 * Trimiterea cererilor către AIONA, sistemul intern al PRIMINVESTNORD.
 *
 * Regula de bază: **o cerere depusă de partener nu are voie să eşueze pentru
 * că AIONA nu răspunde.** Partenerul stă în faţa clientului; dacă apăsarea pe
 * „Depune" ar da eroare din cauza altui sistem, munca lui se opreşte degeaba.
 * De aceea trimiterea e separată de salvare, iar eşecul se scrie în jurnal,
 * nu se ridică mai departe.
 *
 * Trimiterea se repetă la fiecare schimbare de status, iar AIONA actualizează
 * după id — deci o cerere pierdută la depunere se recuperează singură la
 * prima schimbare de status, fără intervenţie.
 */
@Injectable()
export class AionaService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(AionaService.name);
  private ceas?: NodeJS.Timeout;
  private ceasRetentie?: NodeJS.Timeout;

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Trimiterea la depunere sau la schimbarea statusului acoperă cazul obişnuit.
   * Nu acoperă cazul în care AIONA e oprit exact atunci, iar cererea nu se mai
   * atinge niciodată după — s-a întâmplat pe 07.09.2026 şi cererea a rămas
   * nevăzută până am observat-o cu ochiul.
   *
   * De aceea mai trece o dată la fiecare zece minute peste ce s-a schimbat
   * recent. Trimiterea e idempotentă — AIONA actualizează după id — deci
   * repetarea nu strică nimic, iar o pană de câteva minute se repară singură.
   */
  onModuleInit() {
    // Curăţarea actelor merge indiferent dacă integrarea cu AIONA e pornită:
    // ţine de protecţia datelor, nu de legătura dintre aplicaţii.
    this.ceasRetentie = setInterval(() => void this.curataActele(), 6 * 60 * 60 * 1000);
    setTimeout(() => void this.curataActele(), 60_000);

    if (!this.config.activ) return;
    // La pornire luăm o fereastră largă: dacă am fost opriţi o zi, o recuperăm.
    setTimeout(() => void this.recupereaza(7 * 24 * 60), 20_000);
    this.ceas = setInterval(() => void this.recupereaza(30), 10 * 60 * 1000);
  }

  onModuleDestroy() {
    if (this.ceas) clearInterval(this.ceas);
    if (this.ceasRetentie) clearInterval(this.ceasRetentie);
  }

  /**
   * Actele de identitate se şterg după cinci zile.
   *
   * Aceeaşi regulă ca în AIONA: buletinul e cerut ca să se verifice clientul la
   * depunere, nu ca să stea la noi. După ce cererea şi-a urmat cursul, poza n-are
   * de ce să rămână — iar ce nu se păstrează nu se poate pierde.
   *
   * Contractul nu intră aici: partenerul îl tipăreşte şi îl semnează, uneori
   * după mai mult de cinci zile.
   */
  private async curataActele(): Promise<void> {
    try {
      const limita = new Date(Date.now() - 5 * 24 * 60 * 60 * 1000);
      const vechi = await this.prisma.document.findMany({
        where: { createdAt: { lt: limita }, type: { in: ['ID_FRONT', 'ID_BACK', 'SELFIE'] } },
        select: { id: true, path: true },
      });
      if (!vechi.length) return;
      for (const d of vechi) {
        const cale = path.join(process.env.UPLOAD_DIR ?? './uploads', d.path);
        try { if (fs.existsSync(cale)) fs.unlinkSync(cale); } catch { /* fişierul lipseşte deja */ }
      }
      await this.prisma.document.deleteMany({ where: { id: { in: vechi.map((d) => d.id) } } });
      this.logger.log(`Retenţie: şterse ${vechi.length} acte de identitate mai vechi de 5 zile`);
    } catch (e: any) {
      this.logger.warn(`Curăţarea actelor a eşuat: ${e?.message ?? e}`);
    }

    await this.curataOrfanele();
  }

  /**
   * Fişierele rămase fără rând în bază.
   *
   * Ştergerea de mai sus scoate fişierul doar dacă are rând. Ce rămâne pe disc
   * fără rând — după o recreare de container, un import, o ştergere manuală —
   * nu se mai vede nicăieri şi nu-l mai şterge nimeni niciodată. Pe 09.09.2026
   * erau 784 de asemenea fişiere, un gigabyte de buletine de clienţi fără nicio
   * evidenţă. Pentru date de identitate, asta nu e doar dezordine.
   *
   * Se şterg doar cele mai vechi de cinci zile: un fişier apărut acum două ore
   * fără rând poate fi o încărcare în curs, nu un rest.
   */
  private async curataOrfanele(): Promise<void> {
    const radacina = path.resolve(process.env.UPLOAD_DIR ?? './uploads');
    try {
      if (!fs.existsSync(radacina)) return;
      const randuri = await this.prisma.document.findMany({ select: { path: true } });
      const cunoscute = new Set(randuri.map((d) => path.resolve(radacina, d.path)));
      const prag = Date.now() - 5 * 24 * 60 * 60 * 1000;

      let sterse = 0;
      const parcurge = (dir: string) => {
        for (const intrare of fs.readdirSync(dir, { withFileTypes: true })) {
          const cale = path.join(dir, intrare.name);
          if (intrare.isDirectory()) { parcurge(cale); continue; }
          if (cunoscute.has(cale)) continue;
          try {
            if (fs.statSync(cale).mtimeMs >= prag) continue;
            fs.unlinkSync(cale);
            sterse++;
          } catch { /* şters între timp de altcineva */ }
        }
      };
      parcurge(radacina);

      // Directoarele rămase goale n-au ce căuta acolo.
      const golesteDirectoare = (dir: string) => {
        for (const intrare of fs.readdirSync(dir, { withFileTypes: true })) {
          if (intrare.isDirectory()) golesteDirectoare(path.join(dir, intrare.name));
        }
        if (dir !== radacina && fs.readdirSync(dir).length === 0) {
          try { fs.rmdirSync(dir); } catch { /* nu e gol între timp */ }
        }
      };
      golesteDirectoare(radacina);

      if (sterse) this.logger.log(`Retenţie: şterse ${sterse} fişiere orfane mai vechi de 5 zile`);
    } catch (e: any) {
      this.logger.warn(`Curăţarea orfanelor a eşuat: ${e?.message ?? e}`);
    }
  }

  /** Retrimite cererile atinse în ultimele `minute`. */
  private async recupereaza(minute: number): Promise<void> {
    try {
      const de_la = new Date(Date.now() - minute * 60_000);
      const cereri = await this.prisma.application.findMany({
        where: { updatedAt: { gte: de_la } },
        select: { id: true },
        orderBy: { updatedAt: 'asc' },
        take: 200,
      });
      if (!cereri.length) return;
      for (const c of cereri) await this.trimite(c.id);
      this.logger.log(`Recuperare: ${cereri.length} cereri retrimise către AIONA`);
    } catch (e: any) {
      this.logger.warn(`Recuperarea a eşuat: ${e?.message ?? e}`);
    }
  }

  private get config() {
    const url = (process.env.AIONA_API_URL ?? '').replace(/\/+$/, '');
    const secret = (process.env.IONIX_SECRET ?? '').trim();
    return { url, secret, activ: !!url && !!secret };
  }

  /** Trimite cererea în AIONA. Nu aruncă niciodată — doar scrie în jurnal. */
  async trimite(applicationId: string): Promise<void> {
    const { url, secret, activ } = this.config;
    if (!activ) return; // integrarea nu e configurată — tăcere, nu eroare

    try {
      const a = await this.prisma.application.findUnique({
        where: { id: applicationId },
        include: { partner: { select: { companyName: true } } },
      });
      if (!a) return;

      const r = await fetch(`${url}/api/v1/partener/applications`, {
        method: 'POST',
        headers: { 'content-type': 'application/json', 'x-ionix-secret': secret },
        body: JSON.stringify({
          externalId: a.id,
          partnerName: a.partner?.companyName ?? 'Partener',
          firstName: a.clientFirstName,
          lastName: a.clientLastName,
          phone: a.clientPhone,
          email: a.clientEmail ?? undefined,
          address: a.clientAddress ?? undefined,
          // Coloana `clientIdnp` ţine denumirea produsului, nu un cod personal.
          // O trimitem sub numele ei adevărat, ca să nu ducem confuzia mai departe.
          productName: a.clientIdnp ?? undefined,
          creditType: a.creditType,
          amount: Number(a.amount),
          months: a.months,
          vtp: Number(a.totalAmount),
          dae: Number(a.dae),
          commissionAmount: Number(a.commissionAmount),
          status: a.status,
          comments: a.comments ?? undefined,
          statusChangedByName: a.statusChangedByName ?? undefined,
          // Porecla de Telegram a operatorului. AIONA o foloseşte ca să
          // găsească utilizatorul ei şi să arate numele adevărat, nu porecla.
          statusChangedByTelegram: a.statusChangedByTelegramUsername ?? undefined,
          contractOutcome: a.contractOutcome ?? undefined,
          contractOutcomeAt: a.contractOutcomeAt ? a.contractOutcomeAt.toISOString() : undefined,
        }),
      });

      if (!r.ok) {
        const text = await r.text().catch(() => '');
        this.logger.warn(`AIONA a respins cererea ${applicationId} (${r.status}): ${text.slice(0, 200)}`);
        return;
      }
      this.logger.log(`Cererea ${applicationId} a ajuns în AIONA`);
    } catch (e: any) {
      this.logger.warn(`AIONA nu răspunde pentru cererea ${applicationId}: ${e?.message ?? e}`);
    }
  }
}
