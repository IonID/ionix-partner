import { IsString, MinLength, MaxLength } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class LoginDto {
  @ApiProperty({ example: 'admin@pin.md sau ihouse_admin', description: 'Email (ADMIN/VIEWER) sau username (Partener)' })
  @IsString()
  @MinLength(2)
  credential: string;

  @ApiProperty({ example: 'SecurePass123!' })
  @IsString()
  @MinLength(6, { message: 'Parola trebuie să aibă cel puțin 6 caractere' })
  @MaxLength(128)
  password: string;
}
