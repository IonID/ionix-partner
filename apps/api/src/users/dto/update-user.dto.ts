import { IsBoolean, IsOptional, IsString, MinLength, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';

class UpdatePartnerDto {
  @IsOptional() @IsString() companyName?: string;
  @IsOptional() calculatorConfig?: Record<string, any>;
}

export class UpdateUserDto {
  @IsOptional() @IsString() firstName?: string;
  @IsOptional() @IsString() lastName?: string;
  @IsOptional() @IsString() @MinLength(8) password?: string;
  @IsOptional() @IsBoolean() isActive?: boolean;

  @IsOptional()
  @ValidateNested()
  @Type(() => UpdatePartnerDto)
  partner?: UpdatePartnerDto;
}
