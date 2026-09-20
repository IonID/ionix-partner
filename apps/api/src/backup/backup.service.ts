import { Injectable, Logger, ForbiddenException, NotFoundException, BadRequestException } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { spawn } from 'child_process';
import * as fs from 'fs';
import * as path from 'path';
import * as zlib from 'zlib';

type CurrentUser = { id: string; role: string };

/**
 * Copiile de rezervă ale Ionix.
 *
 * Aceeaşi rânduială ca în AIONA, cu o deosebire care contează: acolo
 * documentele le arhivează o sarcină din Task Scheduler, de la 02:00, iar
 * aplicaţia doar le vede. Aici nu există aşa ceva — deci `uploads` intră în
 * arhiva noastră. Altfel ar fi singurul lucru nesalvat, şi tocmai cel care nu
 * se poate reface: un contract semnat, scanat de partener, nu mai există
 * nicăieri.
 *
 * Baza se salvează zilnic la 03:00, ora Chişinăului, şi se păstrează
 * paisprezece zile. Arhivele cu fişiere se ţin la număr, nu la zile: sunt mult
 * mai mari, iar discul e comun cu tot ce mai stă pe NAS.
 */
@Injectable()
export class BackupService {
  private readonly log = new Logger('BackupService');
  private readonly dir = process.env.BACKUP_DIR || '/app/backups';
  private readonly retentionDays = Number(process.env.BACKUP_RETENTION_DAYS || 14);
  private running = false;

  /** Rădăcina în care sunt montate volumele cu fişiere, în container. */
  private readonly radacina = process.env.APP_ROOT || '/app';

  /** Ce se arhivează pe lângă dump-ul bazei. */
  private readonly dosareDeSalvat = ['uploads'];

  /** Arhivele cu fişiere sunt mari; le ţinem la număr, nu la zile. */
  private readonly arhiveDePastrat = Number(process.env.BACKUP_FILES_KEEP || 7);

  private assertAdmin(u: CurrentUser) {
    if (u?.role !== 'ADMIN') throw new ForbiddenException('Doar Adminul poate gestiona copiile de rezervă.');
  }

  /**
   * Amprenta de timp din numele fişierelor, în ora Chişinăului.
   *
   * Containerul merge pe UTC. Fără asta, o copie făcută la 03:00 ar ieşi numită
   * „_0000", iar numele n-ar mai spune din ce zi e copia.
   */
  private amprenta(d = new Date()): string {
    const p: Record<string, string> = {};
    for (const x of new Intl.DateTimeFormat('en-GB', {
      timeZone: 'Europe/Chisinau',
      year: 'numeric', month: '2-digit', day: '2-digit',
      hour: '2-digit', minute: '2-digit', hour12: false,
    }).formatToParts(d)) p[x.type] = x.value;
    const ora = p.hour === '24' ? '00' : p.hour;
    return `${p.year}${p.month}${p.day}_${ora}${p.minute}`;
  }

  private ensureDir() {
    if (!fs.existsSync(this.dir)) fs.mkdirSync(this.dir, { recursive: true });
  }

  private felul(f: string): 'baza' | 'documente' | 'altele' {
    if (f.endsWith('.sql.gz')) return 'baza';
    if (f.startsWith('ionix_uploads_')) return 'documente';
    return 'altele';
  }

  /** Copia zilnică, la 03:00 ora Chişinăului. */
  @Cron('0 3 * * *', { timeZone: 'Europe/Chisinau' })
  async scheduled() {
    // Baza întâi: dacă arhiva cu fişiere nu încape pe disc, dump-ul e deja scris.
    try {
      await this.createBackup();
    } catch (e: any) {
      this.log.error(`Copia bazei a eşuat: ${e?.message}`);
    }
    try {
      await this.createFilesBackup();
    } catch (e: any) {
      this.log.error(`Arhiva cu fişiere a eşuat: ${e?.message}`);
    }
    this.prune();
  }

  /** `pg_dump`, comprimat direct în `.sql.gz`. */
  createBackup(): Promise<{ name: string; size: number }> {
    if (this.running) return Promise.reject(new BadRequestException('O copie este deja în curs.'));
    this.ensureDir();

    const url = process.env.DATABASE_URL;
    if (!url) return Promise.reject(new Error('DATABASE_URL lipseşte.'));
    const u = new URL(url);
    const db = decodeURIComponent(u.pathname.replace(/^\//, '')) || 'ionix_partner';

    const name = `ionix_${db}_${this.amprenta()}.sql.gz`;
    const filePath = path.join(this.dir, name);

    const args = [
      '-h', u.hostname, '-p', u.port || '5432',
      '-U', decodeURIComponent(u.username), '-d', db,
      '--no-owner', '--no-privileges',
    ];
    const env = { ...process.env, PGPASSWORD: decodeURIComponent(u.password) };

    this.running = true;
    this.log.log(`Pornesc copia bazei: ${name}`);

    return new Promise((resolve, reject) => {
      const proc = spawn('pg_dump', args, { env });
      const gzip = zlib.createGzip();
      const out = fs.createWriteStream(filePath);
      let stderr = '';

      proc.stderr.on('data', (d) => { stderr += d.toString(); });
      proc.on('error', (err) => { this.running = false; reject(new Error(`pg_dump indisponibil: ${err.message}`)); });
      out.on('error', (err) => { this.running = false; reject(err); });

      proc.stdout.pipe(gzip).pipe(out);

      out.on('finish', () => {
        this.running = false;
        if (proc.exitCode !== null && proc.exitCode !== 0) {
          fs.unlink(filePath, () => {});
          return reject(new Error(`pg_dump cod ${proc.exitCode}: ${stderr.slice(0, 300)}`));
        }
        const size = fs.existsSync(filePath) ? fs.statSync(filePath).size : 0;
        this.log.log(`Copia bazei gata: ${name} (${(size / 1048576).toFixed(2)} MB)`);
        resolve({ name, size });
      });
    });
  }

  private marimeDosar(d: string): number {
    let total = 0;
    let intrari: fs.Dirent[];
    try { intrari = fs.readdirSync(d, { withFileTypes: true }); } catch { return 0; }
    for (const e of intrari) {
      const fp = path.join(d, e.name);
      try {
        if (e.isDirectory()) total += this.marimeDosar(fp);
        else if (e.isFile()) total += fs.statSync(fp).size;
      } catch { /* fişier dispărut între timp */ }
    }
    return total;
  }

  private spatiuLiber(): number | null {
    try {
      const st = (fs as any).statfsSync?.(this.dir);
      return st ? st.bavail * st.bsize : null;
    } catch { return null; }
  }

  /** Arhivează dosarele care nu intră în `pg_dump`. */
  createFilesBackup(): Promise<{ name: string; size: number } | null> {
    this.ensureDir();

    const prezente = this.dosareDeSalvat.filter((d) => fs.existsSync(path.join(this.radacina, d)));
    if (prezente.length === 0) {
      this.log.warn(`Niciun dosar de salvat sub ${this.radacina}; sar peste arhiva cu fişiere.`);
      return Promise.resolve(null);
    }

    const brut = prezente.reduce((t, d) => t + this.marimeDosar(path.join(this.radacina, d)), 0);
    const liber = this.spatiuLiber();
    // Arhiva e comprimată, deci mai mică decât sursa; cerem totuşi sursa
    // întreagă ca margine, ca să nu rămânem fără loc tocmai în timpul scrierii.
    if (liber !== null && liber < brut) {
      this.log.error(
        `Nu pornesc arhiva cu fişiere: ${(brut / 1048576).toFixed(0)} MB de salvat, ` +
        `${(liber / 1048576).toFixed(0)} MB liberi.`,
      );
      return Promise.resolve(null);
    }

    const name = `ionix_uploads_${this.amprenta()}.tar.gz`;
    const filePath = path.join(this.dir, name);
    this.log.log(`Pornesc arhiva cu fişiere: ${name} (${(brut / 1048576).toFixed(0)} MB)`);

    return new Promise((resolve, reject) => {
      const proc = spawn('tar', ['-czf', filePath, '-C', this.radacina, ...prezente]);
      let stderr = '';
      proc.stderr.on('data', (d) => { stderr += d.toString(); });
      proc.on('error', (err) => reject(new Error(`tar indisponibil: ${err.message}`)));
      proc.on('close', (code) => {
        if (code !== 0) {
          fs.unlink(filePath, () => {});
          return reject(new Error(`tar cod ${code}: ${stderr.slice(0, 300)}`));
        }
        const size = fs.existsSync(filePath) ? fs.statSync(filePath).size : 0;
        this.log.log(`Arhiva cu fişiere gata: ${name} (${(size / 1048576).toFixed(2)} MB)`);
        resolve({ name, size });
      });
    });
  }

  /** Curăţă: dump-urile după vechime, arhivele după număr. */
  prune() {
    this.ensureDir();
    const cutoff = Date.now() - this.retentionDays * 86_400_000;
    const fisiere = fs.readdirSync(this.dir);
    let sterse = 0;

    for (const f of fisiere) {
      if (!f.endsWith('.sql.gz')) continue;
      const fp = path.join(this.dir, f);
      try {
        if (fs.statSync(fp).mtimeMs < cutoff) { fs.unlinkSync(fp); sterse++; }
      } catch { /* ignore */ }
    }
    if (sterse) this.log.log(`Curăţate ${sterse} copii ale bazei (>${this.retentionDays} zile).`);

    const arhive = fisiere
      .filter((f) => f.startsWith('ionix_uploads_') && f.endsWith('.tar.gz'))
      .map((f) => { const fp = path.join(this.dir, f); return { fp, t: fs.statSync(fp).mtimeMs }; })
      .sort((a, b) => b.t - a.t);
    let arhiveSterse = 0;
    for (const a of arhive.slice(this.arhiveDePastrat)) {
      try { fs.unlinkSync(a.fp); arhiveSterse++; } catch { /* ignore */ }
    }
    if (arhiveSterse) this.log.log(`Curăţate ${arhiveSterse} arhive (păstrăm ultimele ${this.arhiveDePastrat}).`);

    return sterse + arhiveSterse;
  }

  // ── Pentru interfaţă ────────────────────────────────────────────────
  list(u: CurrentUser) {
    this.assertAdmin(u);
    this.ensureDir();
    return fs.readdirSync(this.dir)
      .filter((f) => f.endsWith('.sql.gz') || f.endsWith('.tar.gz'))
      .map((f) => {
        const s = fs.statSync(path.join(this.dir, f));
        return { name: f, size: s.size, createdAt: s.mtime, fel: this.felul(f) };
      })
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
  }

  async runManual(u: CurrentUser) {
    this.assertAdmin(u);
    const baza = await this.createBackup();
    let fisiere: { name: string; size: number } | null = null;
    try {
      fisiere = await this.createFilesBackup();
    } catch (e: any) {
      this.log.error(`Arhiva cu fişiere a eşuat: ${e?.message}`);
    }
    this.prune();
    return { ...baza, fisiere };
  }

  config(u: CurrentUser) {
    this.assertAdmin(u);
    return {
      dir: this.dir,
      retentionDays: this.retentionDays,
      dosareSalvate: this.dosareDeSalvat,
      arhiveDePastrat: this.arhiveDePastrat,
    };
  }

  /** Calea sigură către un fişier de copie (validează numele). */
  resolveFile(u: CurrentUser, name: string): string {
    this.assertAdmin(u);
    if (!/^[\w.\-]+\.(sql|tar)\.gz$/.test(name)) throw new BadRequestException('Nume de fişier invalid.');
    const fp = path.join(this.dir, name);
    if (!fp.startsWith(path.resolve(this.dir)) && !fp.startsWith(this.dir)) {
      throw new BadRequestException('Cale invalidă.');
    }
    if (!fs.existsSync(fp)) throw new NotFoundException('Copie inexistentă.');
    return fp;
  }

  remove(u: CurrentUser, name: string) {
    const fp = this.resolveFile(u, name);
    fs.unlinkSync(fp);
    return { ok: true };
  }
}
