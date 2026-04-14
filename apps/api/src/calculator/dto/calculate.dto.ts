import { IsEnum, IsNumber, IsPositive, IsInt, Min, Max } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { CreditType } from '@prisma/client';

export class CalculateDto {
  @ApiProperty({ enum: CreditType, example: 'CLASSIC' })
  @IsEnum(CreditType, { message: 'Tip credit invalid. Valori acceptate: ZERO, CLASSIC' })
  creditType: CreditType;

  @ApiProperty({ example: 10000, description: 'Suma creditului în MDL' })
  @IsNumber({ maxDecimalPlaces: 2 }, { message: 'Suma trebuie să fie un număr valid' })
  @IsPositive({ message: 'Suma trebuie să fie pozitivă' })
  @Max(100000)
  amount: number;

  @ApiProperty({ example: 12, description: 'Termenul în luni' })
  @IsInt({ message: 'Termenul trebuie să fie un număr întreg' })
  @Min(1)
  @Max(60)
  months: number;
}
