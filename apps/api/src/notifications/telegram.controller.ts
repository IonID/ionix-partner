import { Controller, Post, Param, Body, HttpCode, HttpStatus, UseGuards } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { Role } from '@prisma/client';
import { TelegramService } from './telegram.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';

@ApiTags('Telegram')
@Controller('telegram')
export class TelegramController {
  constructor(
    private readonly telegramService: TelegramService,
    private readonly config: ConfigService,
  ) {}

  @Post('webhook/:token')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Telegram webhook receiver (per-partner bot token in URL)' })
  async handleWebhook(@Param('token') token: string, @Body() body: any) {
    await this.telegramService.processWebhookUpdate(token, body);
    return { ok: true };
  }

  @Post('register-webhooks')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN)
  @ApiBearerAuth()
  @ApiOperation({ summary: '[ADMIN] Register Telegram webhooks for all enabled partners' })
  registerWebhooks(@Body() body: { baseUrl?: string }) {
    const baseUrl = body.baseUrl ?? this.config.get<string>('NGROK_BASE_URL') ?? '';
    return this.telegramService.registerAllWebhooks(baseUrl);
  }

  @Post('register-webhook/:partnerId')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN)
  @ApiBearerAuth()
  @ApiOperation({ summary: '[ADMIN] Register Telegram webhook for a specific partner' })
  async registerPartnerWebhook(
    @Param('partnerId') partnerId: string,
    @Body() body: { baseUrl?: string },
  ) {
    const baseUrl = body.baseUrl ?? this.config.get<string>('NGROK_BASE_URL') ?? '';
    return this.telegramService.registerPartnerWebhook(partnerId, baseUrl);
  }
}
