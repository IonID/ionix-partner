import { PartialType, OmitType } from '@nestjs/mapped-types';
import { IsBoolean, IsOptional, IsString, MinLength, ValidateNested, IsNumber, Min, Max } from 'class-validator';
import { Type } from 'class-transformer';
import { CreateUserDto } from './create-user.dto';

class UpdatePartnerDto {
  @IsOptional() @IsString() companyName?: string;
  @IsOptional() @IsNumber() @Min(0) @Max(100) commissionRate?: number;
  @IsOptional() calculatorConfig?: Record<string, any>;
}

export class UpdateUserDto extends PartialType(OmitType(CreateUserDto, ['partner'] as const)) {
  @IsOptional() @IsBoolean() isActive?: boolean;
  @IsOptional() @IsString() @MinLength(8) password?: string;

  @IsOptional()
  @ValidateNested()
  @Type(() => UpdatePartnerDto)
  partner?: UpdatePartnerDto;
}
