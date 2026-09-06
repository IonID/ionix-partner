import { Injectable, Logger, OnApplicationBootstrap } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../prisma/prisma.service';
import TelegramBot = require('node-telegram-bot-api');
import * as fs from 'fs';

interface PartnerTelegram {
  token?: string | null;
  chatId?: string | null;
  enabled?: boolean;
}

interface FileAttachment {
  path: string;
  label: string;
}

interface ApplicationInfo {
  applicationId: string;
  clientFirstName: string;
  clientLastName: string;
  clientProduct: string;
  clientPhone: string;
  creditType: string;
  amount: number;
  months: number;
  monthlyPayment: number;
  totalAmount: number;
  dae: number;
  paymentDate?: string | null;
  comments?: string | null;
}

@Injectable()
export class TelegramService implements OnApplicationBootstrap {
  private readonly logger = new Logger(TelegramService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
  ) {}

  onApplicationBootstrap() {
    const baseUrl = this.config.get<string>('NGROK_BASE_URL');
    if (!baseUrl) return;
    // Delay 12s to give ngrok time to establish tunnel before registering
    setTimeout(() => {
      this.registerAllWebhooks(baseUrl)
        .then(({ registered, failed }) => {
          if (registered > 0) this.logger.log(`Auto-registered ${registered} Telegram webhook(s)`);
          if (failed > 0) this.logger.warn(`Failed to auto-register ${failed} webhook(s)`);
        })
        .catch((err) => this.logger.warn(`Auto-register webhooks skipped: ${err.message}`));
    }, 12000);
  }

  // ── Config helpers ────────────────────────────────────────────────

  private resolveConfig(partner?: PartnerTelegram): { bot: TelegramBot; chatId: string } | null {
    if (!partner?.token || !partner?.chatId) return null;
    if (partner.enabled === false) return null;
    return { bot: new TelegramBot(partner.token, { polling: false }), chatId: partner.chatId };
  }

  /** Escape caractere speciale HTML — previne stricarea mesajului când datele
   *  clientului conțin <, > sau & (ex: produs "5<6", nume cu &, etc.) */
  private esc(v: unknown): string {
    return String(v ?? '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;');
  }

  private formatDate(d: Date): string {
    const pad = (n: number) => String(n).padStart(2, '0');
    const local = new Date(d.toLocaleString('en-US', { timeZone: 'Europe/Chisinau' }));
    return `${pad(local.getDate())}.${pad(local.getMonth() + 1)}.${local.getFullYear()}, ${pad(local.getHours())}:${pad(local.getMinutes())}:${pad(local.getSeconds())}`;
  }

  private statusEmoji(status: string): string {
    const map: Record<string, string> = {
      APPROVED: '✅', REJECTED: '❌', PROCESSING: '⚙️', CANCELLED: '🚫', PENDING: '🕐',
    };
    return map[status] ?? '📋';
  }

  private statusLabel(status: string): string {
    const map: Record<string, string> = {
      PENDING: 'În Așteptare', PROCESSING: 'În Analiză',
      APPROVED: 'Aprobată', REJECTED: 'Respinsă', CANCELLED: 'Anulată',
    };
    return map[status] ?? status;
  }

  // ── Message builders ──────────────────────────────────────────────

  /** Mesaj principal cu detaliile cererii (fără butoane) */
  private buildApplicationText(info: Omit<ApplicationInfo, 'applicationId'>): string {
    const fmt = (n: number) =>
      n.toLocaleString('ro-MD', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

    const creditLabel = info.creditType === 'ZERO' ? 'ZERO' : 'CLASIC';
    const div = '━━━━━━━━━━━━━━━━';

    const lines = [
      `🔔 <b>CERERE NOUĂ · Credit ${creditLabel}</b>`,
      div,
      `• <b>Client:</b>  <code>${this.esc(info.clientFirstName)} ${this.esc(info.clientLastName)}</code>`,
      `• <b>Produs:</b>  <code>${this.esc(info.clientProduct)}</code>`,
      `• <b>Telefon:</b> <code>${this.esc(info.clientPhone)}</code>`,
      `• <b>Sumă:</b>    <code>${fmt(info.amount)} MDL</code>`,
      `• <b>Termen:</b>  <code>${info.months} luni</code>`,
      `• <b>Rată/lună:</b> <code>${fmt(info.monthlyPayment)} MDL</code>`,
      `• <b>VTP:</b>     <code>${fmt(info.totalAmount)} MDL</code>`,
      `• <b>DAE:</b>     <code>${info.dae}%</code>`,
    ];

    if (info.paymentDate) {
      const d   = new Date(info.paymentDate);
      const pad = (n: number) => String(n).padStart(2, '0');
      lines.push(`• <b>Data plată:</b> <code>${pad(d.getDate())}.${pad(d.getMonth() + 1)}.${d.getFullYear()}</code>`);
    }

    if (info.comments?.trim()) {
      lines.push(`• <b>Comentarii:</b> <i>${this.esc(info.comments.trim())}</i>`);
    }

    lines.push(`• <b>Ora:</b>     <code>${this.formatDate(new Date())}</code>`);
    lines.push(div);

    return lines.join('\n');
  }

  /** Mesaj compact de acțiuni — se editează la fiecare schimbare de status */
  private buildActionText(status: string, notes?: string, processorName?: string): string {
    const emoji = this.statusEmoji(status);
    const label = this.statusLabel(status);
    const processorLine = processorName ? `\n👤 Preluat de: <b>${this.esc(processorName)}</b>` : '';
    const notesLine = notes ? `\n📝 <i>${this.esc(notes)}</i>` : '';
    return `${emoji} <b>Status: ${label}</b>${processorLine}${notesLine}`;
  }

  // ── Keyboard builder ──────────────────────────────────────────────

  private buildKeyboard(status: string, appId: string, processorId?: number): TelegramBot.InlineKeyboardMarkup | undefined {
    if (status === 'PENDING') {
      return {
        inline_keyboard: [[
          { text: '⚙️ Marchează în procesare', callback_data: `proc:${appId}` },
        ]],
      };
    }
    if (status === 'PROCESSING') {
      // Codăm processorId în callback_data — doar el poate aproba/respinge
      const sfx = processorId ? `:${processorId}` : '';
      return {
        inline_keyboard: [
          [
            { text: '✅ Aprobă cererea',   callback_data: `aprv:${appId}${sfx}` },
            { text: '❌ Respinge cererea', callback_data: `rejt:${appId}${sfx}` },
          ],
          [
            { text: '🚫 Anulează cererea', callback_data: `cncl:${appId}${sfx}` },
          ],
        ],
      };
    }
    return undefined;
  }

  private buildConfirmationMessage(status: string, byName: string, clientName: string, amount: number): string {
    const div = '━━━━━━━━━━━━━━━━';
    const title = status === 'APPROVED' ? '✅  CERERE APROBATĂ' : '❌  CERERE RESPINSĂ';
    const fmt = (n: number) => n.toLocaleString('ro-MD', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    return [
      div,
      `🔔 <b>${title}</b>`,
      `👤 Client: <b>${this.esc(clientName)}</b> · <code>${fmt(amount)} MDL</code>`,
      `👤 Decis de: <b>${this.esc(byName)}</b>`,
      div,
    ].join('\n');
  }

  /** Mesaj trimis în grup când managerul anunță rezultatul final al contractului */
  private buildContractOutcomeMessage(
    outcome: 'SIGNED' | 'REFUSED',
    byName: string,
    clientName: string,
    clientProduct: string,
    amount: number,
  ): string {
    const div = '━━━━━━━━━━━━━━━━';
    const fmt = (n: number) => n.toLocaleString('ro-MD', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    const title = outcome === 'SIGNED' ? '✍️  CONTRACT SEMNAT' : '🚫  CLIENT A REFUZAT';
    return [
      div,
      `🔔 <b>${title}</b>`,
      `👤 Client: <b>${this.esc(clientName)}</b> · <code>${fmt(amount)} MDL</code>`,
      `📦 Produs: <code>${this.esc(clientProduct)}</code>`,
      `👤 Manager: <b>${this.esc(byName)}</b>`,
      `🕐 ${this.formatDate(new Date())}`,
      div,
    ].join('\n');
  }

  // ── Public methods ────────────────────────────────────────────────

  async sendContractOutcome(
    applicationId: string,
    outcome: 'SIGNED' | 'REFUSED',
    byName: string,
    clientName: string,
    clientProduct: string,
    amount: number,
    partnerTelegram?: PartnerTelegram,
  ): Promise<boolean> {
    const cfg = this.resolveConfig(partnerTelegram);
    if (!cfg) return false;

    const app = await this.prisma.application.findUnique({
      where: { id: applicationId },
      select: { telegramMessageId: true },
    });

    try {
      await cfg.bot.sendMessage(
        cfg.chatId,
        this.buildContractOutcomeMessage(outcome, byName, clientName, clientProduct, amount),
        {
          parse_mode: 'HTML',
          // Reply la mesajul de acțiuni al cererii, dacă există — păstrează contextul în grup
          ...(app?.telegramMessageId ? { reply_to_message_id: Number(app.telegramMessageId) } : {}),
        },
      );
      return true;
    } catch (err: any) {
      // reply_to poate eșua dacă mesajul original a fost șters — reîncearcă fără reply
      try {
        await cfg.bot.sendMessage(
          cfg.chatId,
          this.buildContractOutcomeMessage(outcome, byName, clientName, clientProduct, amount),
          { parse_mode: 'HTML' },
        );
        return true;
      } catch (retryErr: any) {
        this.logger.error(`Telegram sendContractOutcome failed: ${retryErr.message}`);
        return false;
      }
    }
  }

  async sendApplication(
    application: ApplicationInfo,
    partnerTelegram?: PartnerTelegram,
    attachments: FileAttachment[] = [],
  ): Promise<string | null> {
    const cfg = this.resolveConfig(partnerTelegram);
    if (!cfg) return null;

    try {
      // 1. Trimite mesajul cu detaliile cererii (fără butoane)
      await cfg.bot.sendMessage(cfg.chatId, this.buildApplicationText(application), {
        parse_mode: 'HTML',
      });

      // 2. Trimite pozele / documentele
      for (const att of attachments) {
        if (!fs.existsSync(att.path)) continue;
        try {
          await cfg.bot.sendDocument(cfg.chatId, fs.createReadStream(att.path), { caption: att.label });
        } catch (photoErr: any) {
          this.logger.warn(`Photo send failed (${att.label}): ${photoErr.message}`);
        }
      }

      // 3. Trimite mesajul de acțiuni cu butoanele — DUPĂ poze
      const keyboard = this.buildKeyboard('PENDING', application.applicationId);
      const actionMsg = await cfg.bot.sendMessage(
        cfg.chatId,
        this.buildActionText('PENDING'),
        { parse_mode: 'HTML', reply_markup: keyboard },
      );

      return String(actionMsg.message_id);
    } catch (err: any) {
      this.logger.error(`Telegram sendApplication failed: ${err.message}`);
      return null;
    }
  }

  async sendStatusUpdate(
    applicationId: string,
    status: string,
    notes?: string,
    partnerTelegram?: PartnerTelegram,
  ): Promise<void> {
    const cfg = this.resolveConfig(partnerTelegram);
    if (!cfg) return;

    const app = await this.prisma.application.findUnique({
      where: { id: applicationId },
      select: { telegramMessageId: true },
    });

    // Editează mesajul de acțiuni (cel cu butoanele) — fără mesaj nou
    if (app?.telegramMessageId) {
      try {
        const keyboard = this.buildKeyboard(status, applicationId);
        await cfg.bot.editMessageText(this.buildActionText(status, notes), {
          chat_id:      cfg.chatId,
          message_id:   Number(app.telegramMessageId),
          parse_mode:   'HTML',
          reply_markup: keyboard ?? { inline_keyboard: [] },
        });
      } catch (editErr: any) {
        this.logger.warn(`Edit action message failed: ${editErr.message}`);
      }
    }
  }

  async processWebhookUpdate(token: string, update: any): Promise<void> {
    if (!update?.callback_query) return;

    const { id: queryId, message, data, from } = update.callback_query as {
      id: string;
      message?: { chat: { id: number }; message_id: number };
      data?: string;
      from: { id: number; first_name: string; last_name?: string };
    };

    if (!data || !message) return;

    // Format: "action:appId" sau "action:appId:processorTelegramId"
    const parts       = data.split(':');
    const action      = parts[0];
    const appId       = parts[1];
    const processorId = parts[2] ? parseInt(parts[2]) : null;

    if (!appId) return;

    const actionMap: Record<string, { status: string; answerText: string; sendConfirmation: boolean }> = {
      proc: { status: 'PROCESSING', answerText: '⚙️ Preluat în analiză', sendConfirmation: false },
      aprv: { status: 'APPROVED',   answerText: '✅ Cerere aprobată',     sendConfirmation: true },
      rejt: { status: 'REJECTED',   answerText: '❌ Cerere respinsă',     sendConfirmation: true },
      cncl: { status: 'CANCELLED',  answerText: '🚫 Cerere anulată',      sendConfirmation: false },
    };

    const bot    = new TelegramBot(token, { polling: false });
    const mapped = actionMap[action];

    if (!mapped) {
      await bot.answerCallbackQuery(queryId, { text: 'Acțiune necunoscută' }).catch(() => {});
      return;
    }

    // ── Verificare ownership post-proc ────────────────────────────────────
    // Dacă processorId e codificat în buton, doar el poate continua
    if (processorId && from.id !== processorId) {
      const appInfo = await this.prisma.application.findUnique({
        where:  { id: appId },
        select: { statusChangedByName: true },
      });
      const name = appInfo?.statusChangedByName ?? 'alt coleg';
      await bot.answerCallbackQuery(queryId, {
        text: `⛔ Cererea este prelucrată de ${name}`,
        show_alert: true,
      }).catch(() => {});
      return;
    }

    // ── Verificare autorizare pentru „Marchează în procesare" ─────────────
    // Dacă partenerul are o listă de user ID-uri autorizate, verificăm
    if (action === 'proc') {
      const partner = await this.prisma.partner.findFirst({
        where:  { applications: { some: { id: appId } } },
        select: { telegramAllowedUserIds: true },
      });
      if (partner?.telegramAllowedUserIds) {
        const allowed = partner.telegramAllowedUserIds
          .split(',')
          .map(s => parseInt(s.trim()))
          .filter(n => !isNaN(n));
        if (allowed.length > 0 && !allowed.includes(from.id)) {
          await bot.answerCallbackQuery(queryId, {
            text: '⛔ Nu ai permisiunea să preiei această cerere',
            show_alert: true,
          }).catch(() => {});
          return;
        }
      }
    }

    const app = await this.prisma.application.findUnique({
      where:  { id: appId },
      select: { status: true, clientFirstName: true, clientLastName: true, amount: true },
    });

    if (!app) {
      await bot.answerCallbackQuery(queryId, { text: '❗ Cererea nu a fost găsită' }).catch(() => {});
      return;
    }

    if (['APPROVED', 'REJECTED', 'CANCELLED'].includes(app.status)) {
      await bot.answerCallbackQuery(queryId, {
        text: `Cererea este deja ${this.statusLabel(app.status)}`,
        show_alert: true,
      }).catch(() => {});
      return;
    }

    const operatorName = [from.first_name, from.last_name].filter(Boolean).join(' ');

    // ── Update atomic (previne race condition la proc) ────────────────────
    let updated = false;
    if (action === 'proc') {
      const result = await this.prisma.application.updateMany({
        where: { id: appId, status: 'PENDING' },
        data:  { status: 'PROCESSING', statusChangedByName: operatorName },
      });
      updated = result.count > 0;
    } else {
      await this.prisma.application.update({
        where: { id: appId },
        data:  { status: mapped.status as any, statusChangedByName: operatorName },
      });
      updated = true;
    }

    if (!updated) {
      await bot.answerCallbackQuery(queryId, {
        text: '⚡ Cererea a fost deja preluată de altcineva',
        show_alert: true,
      }).catch(() => {});
      return;
    }

    await bot.answerCallbackQuery(queryId, { text: mapped.answerText }).catch(() => {});

    // La proc: from.id devine processorId și se codifică în butoanele noi
    const nextProcessorId = action === 'proc' ? from.id : (processorId ?? undefined);
    const keyboard = this.buildKeyboard(mapped.status, appId, nextProcessorId);

    // La PROCESSING — afișăm numele operatorului în mesajul de acțiuni
    const processorNameInMsg = mapped.status === 'PROCESSING' ? operatorName : undefined;

    try {
      await bot.editMessageText(this.buildActionText(mapped.status, undefined, processorNameInMsg), {
        chat_id:      message.chat.id,
        message_id:   message.message_id,
        parse_mode:   'HTML',
        reply_markup: keyboard ?? { inline_keyboard: [] },
      });
    } catch (editErr: any) {
      this.logger.warn(`Callback edit action message failed: ${editErr.message}`);
    }

    // Mesaj de confirmare vizibil doar pentru decizii finale (Aprobat / Respins)
    if (mapped.sendConfirmation) {
      try {
        const byName     = [from.first_name, from.last_name].filter(Boolean).join(' ');
        const clientName = [app.clientFirstName, app.clientLastName].filter(Boolean).join(' ');
        await bot.sendMessage(
          message.chat.id,
          this.buildConfirmationMessage(mapped.status, byName, clientName, Number(app.amount)),
          { parse_mode: 'HTML', reply_to_message_id: message.message_id },
        );
      } catch (err: any) {
        this.logger.warn(`Confirmation message failed: ${err.message}`);
      }
    }
  }

  // ── Webhook registration ──────────────────────────────────────────

  async registerWebhook(token: string, webhookUrl: string): Promise<void> {
    const bot = new TelegramBot(token, { polling: false });
    try {
      await (bot as any).setWebHook(webhookUrl, {
        allowed_updates: ['message', 'callback_query'],
      });
      this.logger.log(`Webhook set for bot ...${token.slice(-6)} → ${webhookUrl}`);
    } catch (err: any) {
      if (err?.message?.includes('429')) {
        // Rate-limited — wait 1s and retry once
        await new Promise((r) => setTimeout(r, 1200));
        await (bot as any).setWebHook(webhookUrl, {
          allowed_updates: ['message', 'callback_query'],
        });
        this.logger.log(`Webhook set (retry) for bot ...${token.slice(-6)} → ${webhookUrl}`);
      } else {
        throw err;
      }
    }
  }

  async registerPartnerWebhook(partnerId: string, baseUrl: string): Promise<{ ok: boolean; message: string }> {
    const partner = await this.prisma.partner.findUnique({
      where: { id: partnerId },
      select: { telegramBotToken: true, telegramEnabled: true },
    });
    if (!partner?.telegramBotToken) {
      return { ok: false, message: 'Partner has no bot token configured' };
    }
    if (!partner.telegramEnabled) {
      return { ok: false, message: 'Telegram is disabled for this partner' };
    }
    try {
      const url = `${baseUrl}/api/v1/telegram/webhook/${encodeURIComponent(partner.telegramBotToken)}`;
      await this.registerWebhook(partner.telegramBotToken, url);
      return { ok: true, message: `Webhook registered → ${url}` };
    } catch (err: any) {
      return { ok: false, message: err.message };
    }
  }

  async registerAllWebhooks(baseUrl: string): Promise<{ registered: number; failed: number }> {
    const partners = await this.prisma.partner.findMany({
      where: { telegramBotToken: { not: null }, telegramEnabled: true },
      select: { telegramBotToken: true },
    });

    let registered = 0;
    let failed     = 0;

    for (const p of partners) {
      if (!p.telegramBotToken) continue;
      try {
        const url = `${baseUrl}/api/v1/telegram/webhook/${encodeURIComponent(p.telegramBotToken)}`;
        await this.registerWebhook(p.telegramBotToken, url);
        registered++;
      } catch (err: any) {
        this.logger.error(`Failed to register webhook: ${err.message}`);
        failed++;
      }
    }

    return { registered, failed };
  }
}
