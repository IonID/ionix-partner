import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import TelegramBot from 'node-telegram-bot-api';
import * as fs from 'fs';
import * as path from 'path';

@Injectable()
export class TelegramService implements OnModuleInit {
  private readonly logger = new Logger(TelegramService.name);
  private bot: TelegramBot | null = null;
  private chatId: string;
  private enabled: boolean;

  constructor(private readonly config: ConfigService) {}

  onModuleInit() {
    const token = this.config.get<string>('TELEGRAM_BOT_TOKEN');
    this.chatId = this.config.get<string>('TELEGRAM_CHAT_ID', '');
    this.enabled = !!(token && this.chatId);

    if (this.enabled && token) {
      this.bot = new TelegramBot(token, { polling: false });
      this.logger.log('Telegram bot initialized');
    } else {
      this.logger.warn('Telegram bot disabled (missing token or chat ID)');
    }
  }

  async sendApplication(application: {
    id: string;
    clientFirstName: string;
    clientLastName: string;
    clientIdnp: string;
    clientPhone: string;
    creditType: string;
    amount: number;
    months: number;
    monthlyPayment: number;
    totalAmount: number;
    dae: number;
    partnerCompany: string;
    partnerEmail: string;
  }): Promise<string | null> {
    if (!this.bot || !this.enabled) return null;

    const emoji = application.creditType === 'ZERO' ? '🟢' : '🔵';
    const message = [
      `${emoji} *CERERE NOUĂ — Credit ${application.creditType}*`,
      ``,
      `👤 *Client:* ${application.clientFirstName} ${application.clientLastName}`,
      `🪪 *IDNP:* \`${application.clientIdnp}\``,
      `📞 *Telefon:* ${application.clientPhone}`,
      ``,
      `💰 *Sumă:* ${application.amount.toLocaleString('ro-MD')} MDL`,
      `📅 *Termen:* ${application.months} luni`,
      `📊 *Rată lunară:* ${application.monthlyPayment.toLocaleString('ro-MD')} MDL`,
      `💳 *VTP:* ${application.totalAmount.toLocaleString('ro-MD')} MDL`,
      `📈 *DAE:* ${application.dae}%`,
      ``,
      `🏢 *Partener:* ${application.partnerCompany}`,
      `📧 *Email partener:* ${application.partnerEmail}`,
      ``,
      `🔑 *ID Cerere:* \`${application.id}\``,
      `⏰ *Data:* ${new Date().toLocaleString('ro-MD', { timeZone: 'Europe/Chisinau' })}`,
    ].join('\n');

    try {
      const sent = await this.bot.sendMessage(this.chatId, message, {
        parse_mode: 'Markdown',
      });
      return String(sent.message_id);
    } catch (err) {
      this.logger.error(`Telegram send failed: ${err.message}`);
      return null;
    }
  }

  async sendDocument(filePath: string, caption: string): Promise<void> {
    if (!this.bot || !this.enabled) return;

    try {
      await this.bot.sendDocument(
        this.chatId,
        fs.createReadStream(filePath),
        { caption },
      );
    } catch (err) {
      this.logger.error(`Telegram sendDocument failed: ${err.message}`);
    }
  }

  async sendStatusUpdate(applicationId: string, status: string, notes?: string): Promise<void> {
    if (!this.bot || !this.enabled) return;

    const statusEmoji = {
      APPROVED: '✅',
      REJECTED: '❌',
      PROCESSING: '⚙️',
      CANCELLED: '🚫',
    }[status] ?? '📋';

    const message = [
      `${statusEmoji} *Actualizare cerere \`${applicationId}\`*`,
      `📋 *Status nou:* ${status}`,
      notes ? `📝 *Note:* ${notes}` : '',
    ].filter(Boolean).join('\n');

    try {
      await this.bot.sendMessage(this.chatId, message, { parse_mode: 'Markdown' });
    } catch (err) {
      this.logger.error(`Telegram status update failed: ${err.message}`);
    }
  }
}
