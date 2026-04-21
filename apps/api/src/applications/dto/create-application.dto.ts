import {
  IsString, IsEnum, IsNumber, IsPositive, IsInt, Min, Max, MinLength,
} from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { CreditType } from '@prisma/client';

export class CreateApplicationDto {
  @ApiProperty({ example: 'Ion' })
  @IsString()
  @MinLength(2)
  clientFirstName: string;

  @ApiProperty({ example: 'Popescu' })
  @IsString()
  @MinLength(2)
  clientLastName: string;

  @ApiProperty({ example: '+37369000000' })
  @IsString()
  @MinLength(8)
  clientPhone: string;

  @ApiProperty({ example: 'Laptop Lenovo IdeaPad', description: 'Produsul pe care îl cumpără clientul' })
  @IsString()
  @MinLength(2)
  clientProduct: string;

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
