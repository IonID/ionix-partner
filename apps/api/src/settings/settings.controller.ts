import { Controller, Get, Put, Body, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { IsArray, ValidateNested, IsString } from 'class-validator';
import { Type } from 'class-transformer';
import { Role } from '@prisma/client';
import { SettingsService } from './settings.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';

class SettingUpdateItem {
  @IsString() key: string;
  @IsString() value: string;
}
class UpdateSettingsDto {
  @IsArray() @ValidateNested({ each: true }) @Type(() => SettingUpdateItem)
  settings: SettingUpdateItem[];
}

const CALCULATOR_KEYS = [
  'ZERO_MIN_AMOUNT', 'ZERO_MAX_AMOUNT', 'ZERO_MIN_MONTHS', 'ZERO_MAX_MONTHS',
  'CLASSIC_MIN_AMOUNT', 'CLASSIC_MAX_AMOUNT', 'CLASSIC_MIN_MONTHS', 'CLASSIC_MAX_MONTHS',
  'ZERO_COMMISSION_TABLE', 'ALLOWED_CREDIT_TYPES',
];

@ApiTags('Settings')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('settings')
export class SettingsController {
  constructor(private readonly settingsService: SettingsService) {}

  // [ALL] Calculator limits — global settings merged with partner overrides
  @Get('calculator')
  @ApiOperation({ summary: '[ALL] Limitele calculatorului cu override-uri per partener' })
  async getCalculator(@CurrentUser() user: any) {
    const all = await this.settingsService.getAll();

    const result: Record<string, string> = {};
    for (const key of CALCULATOR_KEYS) {
      if (key in all) result[key] = all[key];
    }

    // Override with partner-specific config if present (already in JWT, no extra DB query)
    const partnerConfig = user?.partner?.calculatorConfig;
    if (partnerConfig && typeof partnerConfig === 'object') {
      for (const key of CALCULATOR_KEYS) {
        const val = (partnerConfig as any)[key];
        if (val !== undefined) {
          result[key] = (val !== null && typeof val === 'object') ? JSON.stringify(val) : String(val);
        }
      }
    }

    return CALCULATOR_KEYS.filter((k) => k in result).map((k) => ({ key: k, value: result[k] }));
  }

  // [ADMIN] Full settings list with metadata
  @Get()
  @UseGuards(RolesGuard)
  @Roles(Role.ADMIN)
  @ApiOperation({ summary: '[ADMIN] Toate setările globale' })
  getAll() {
    return this.settingsService.getAllDetailed();
  }

  // [ADMIN] Update settings
  @Put()
  @UseGuards(RolesGuard)
  @Roles(Role.ADMIN)
  @ApiOperation({ summary: '[ADMIN] Actualizează mai multe setări simultan' })
  updateMany(@Body() dto: UpdateSettingsDto, @CurrentUser('id') userId: string) {
    return this.settingsService.updateMany(dto.settings, userId);
  }
}
