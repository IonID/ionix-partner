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

@ApiTags('Settings')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(Role.ADMIN)
@Controller('settings')
export class SettingsController {
  constructor(private readonly settingsService: SettingsService) {}

  @Get()
  @ApiOperation({ summary: '[ADMIN] Toate setările globale' })
  getAll() {
    return this.settingsService.getAllDetailed();
  }

  @Put()
  @ApiOperation({ summary: '[ADMIN] Actualizează mai multe setări simultan' })
  updateMany(@Body() dto: UpdateSettingsDto, @CurrentUser('id') userId: string) {
    return this.settingsService.updateMany(dto.settings, userId);
  }
}
