import {
  IsString, IsEmail, IsOptional, IsEnum,
  IsNumber, IsPositive, IsInt, Min, Max, Length,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { CreditType } from '@prisma/client';

export class CreateApplicationDto {
  // ── Client data ──────────────────────────────────────────────────
  @ApiProperty({ example: 'Ion' })
  @IsString()
  clientFirstName: string;

  @ApiProperty({ example: 'Popescu' })
  @IsString()
  clientLastName: string;

  @ApiProperty({ example: '2001234567890', description: 'IDNP — 13 cifre' })
  @IsString()
  @Length(13, 13, { message: 'IDNP trebuie să aibă exact 13 cifre' })
  clientIdnp: string;

  @ApiProperty({ example: '+37369000000' })
  @IsString()
  clientPhone: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsEmail()
  clientEmail?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  clientAddress?: string;

  // ── Credit parameters ────────────────────────────────────────────
  @ApiProperty({ enum: CreditType })
  @IsEnum(CreditType)
  creditType: CreditType;

  @ApiProperty({ example: 10000 })
  @IsNumber({ maxDecimalPlaces: 2 })
  @IsPositive()
  @Max(100000)
  amount: number;

  @ApiProperty({ example: 12 })
  @IsInt()
  @Min(1)
  @Max(60)
  months: number;
}
