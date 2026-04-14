import {
  IsEmail, IsString, IsEnum, IsOptional, IsNumber,
  MinLength, ValidateNested, IsObject, Min, Max,
} from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Role } from '@prisma/client';

class PartnerConfigDto {
  @ApiProperty({ example: 'iHouse' })
  @IsString()
  companyName: string;

  @ApiPropertyOptional({ example: 5.0 })
  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(100)
  commissionRate?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsObject()
  calculatorConfig?: Record<string, any>;
}

export class CreateUserDto {
  @ApiProperty({ example: 'ihouse@pin.md' })
  @IsEmail()
  email: string;

  @ApiProperty({ example: 'SecurePass123!' })
  @IsString()
  @MinLength(8)
  password: string;

  @ApiProperty({ example: 'Ion' })
  @IsString()
  firstName: string;

  @ApiProperty({ example: 'Bajerean' })
  @IsString()
  lastName: string;

  @ApiPropertyOptional({ enum: Role, default: Role.PARTNER })
  @IsOptional()
  @IsEnum(Role)
  role?: Role = Role.PARTNER;

  @ApiPropertyOptional()
  @IsOptional()
  @ValidateNested()
  @Type(() => PartnerConfigDto)
  partner?: PartnerConfigDto;
}
