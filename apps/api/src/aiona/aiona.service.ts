import { Injectable, Logger } from '@nestjs/common';
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
export class AionaService {
  private readonly logger = new Logger(AionaService.name);

  constructor(private readonly prisma: PrismaService) {}

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
