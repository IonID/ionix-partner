import {
  IsString, IsEnum, IsNumber, IsPositive, IsInt, Min, Max, MinLength,
  IsOptional, IsDateString, Matches,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
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

  /**
   * Cerea doar două caractere, şi trecea „@." — partenerii îl săreau şi scriau
   * produsul adevărat la Comentarii, iar pe cartela din Telegram apărea
   * „Produs: @.". Acum se cer trei caractere şi cel puţin două litere, deci un
   * semn singur nu mai e de ajuns.
   */
  @ApiProperty({ example: 'Laptop Lenovo IdeaPad', description: 'Produsul pe care îl cumpără clientul' })
  @IsString()
  @MinLength(3)
  @Matches(/(\p{L}.*){2}/u, { message: 'Denumirea produsului trebuie să conţină cel puţin două litere.' })
  clientProduct: string;

  @ApiProperty({ enum: CreditType })
  @IsEnum(CreditType)
  creditType: CreditType;

  @ApiProperty({ example: 10000 })
  @IsNumber({ maxDecimalPlaces: 2 })
  @IsPositive()
  @Max(150000)
  amount: number;

  @ApiProperty({ example: 12 })
  @IsInt()
  @Min(1)
  @Max(60)
  months: number;

  @ApiPropertyOptional({ example: '2025-06-15', description: 'Data de plată aleasă de client (ISO 8601)' })
  @IsOptional()
  @IsDateString()
  paymentDate?: string;

  @ApiPropertyOptional({ example: 'Client dorește livrare urgentă', description: 'Observații opționale' })
  @IsOptional()
  @IsString()
  comments?: string;
}
