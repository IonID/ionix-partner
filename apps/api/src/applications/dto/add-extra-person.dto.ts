import { IsEnum, IsOptional, IsString, MaxLength, MinLength } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { ExtraPersonRole } from '@prisma/client';

/**
 * Fidejusorul sau codebitorul adăugat pe o cerere existentă.
 *
 * Ce cere analiza, nimic în plus: rolul, telefonul şi buletinul (vine ca fişier,
 * nu aici). Numele e opţional — e scris pe buletin, iar partenerul din faţa
 * clientului n-are de ce să-l mai bată o dată de mână.
 */
export class AddExtraPersonDto {
  @ApiProperty({ enum: ExtraPersonRole, description: 'GUARANTOR = fidejusor, CODEBTOR = codebitor' })
  @IsEnum(ExtraPersonRole)
  role: ExtraPersonRole;

  @ApiProperty({ example: '+37369000000' })
  @IsString()
  @MinLength(8)
  @MaxLength(40)
  phone: string;

  @ApiPropertyOptional({ example: 'Ion' })
  @IsOptional()
  @IsString()
  @MaxLength(80)
  firstName?: string;

  @ApiPropertyOptional({ example: 'Popescu' })
  @IsOptional()
  @IsString()
  @MaxLength(80)
  lastName?: string;
}
