import {
  IsEmail, IsString, IsEnum, IsOptional,
  MinLength, MaxLength, ValidateNested, IsObject,
} from 'class-validator';
import { Type } from 'class-transformer';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { Role } from '@prisma/client';

class PartnerConfigDto {
  @IsString()
  companyName: string;

  @IsOptional()
  @IsObject()
  calculatorConfig?: Record<string, any>;
}

export class CreateUserDto {
  // ── Autentificare ─────────────────────────────────────────────────
  // Email — obligatoriu pentru ADMIN/VIEWER, opțional pentru parteneri
  @ApiPropertyOptional({ example: 'admin@pin.md' })
  @IsOptional()
  @IsEmail({}, { message: 'Email invalid' })
  email?: string;

  // Username — pentru conturi Partener (login fără email)
  @ApiPropertyOptional({ example: 'ihouse_admin' })
  @IsOptional()
  @IsString()
  @MinLength(3, { message: 'Username minim 3 caractere' })
  @MaxLength(40, { message: 'Username max 40 caractere' })
  username?: string;

  @IsString()
  @MinLength(8, { message: 'Parola minim 8 caractere' })
  password: string;

  @IsString()
  firstName: string;

  @IsString()
  lastName: string;

  @ApiPropertyOptional({ enum: Role })
  @IsOptional()
  @IsEnum(Role)
  role?: Role;

  // Creare Partener nou odată cu primul utilizator
  @ApiPropertyOptional()
  @IsOptional()
  @ValidateNested()
  @Type(() => PartnerConfigDto)
  partner?: PartnerConfigDto;

  // SAU legare la un Partener existent
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  partnerId?: string;
}
