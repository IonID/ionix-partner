import {
  Controller, Get, Post, Patch, Delete, Body, Param,
  UseGuards, HttpCode, HttpStatus, UseInterceptors, UploadedFile,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { memoryStorage } from 'multer';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiConsumes } from '@nestjs/swagger';
import { Role } from '@prisma/client';
import { UsersService } from './users.service';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';

@ApiTags('Users')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('users')
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Get()
  @Roles(Role.ADMIN)
  @ApiOperation({ summary: '[ADMIN] Lista tuturor utilizatorilor' })
  findAll() {
    return this.usersService.findAll();
  }

  @Get(':id')
  @Roles(Role.ADMIN)
  @ApiOperation({ summary: '[ADMIN] Detalii utilizator' })
  findOne(@Param('id') id: string) {
    return this.usersService.findById(id);
  }

  @Post()
  @Roles(Role.ADMIN)
  @ApiOperation({ summary: '[ADMIN] Creează utilizator/partener nou' })
  create(@Body() dto: CreateUserDto) {
    return this.usersService.create(dto);
  }

  @Patch(':id')
  @Roles(Role.ADMIN)
  @ApiOperation({ summary: '[ADMIN] Actualizează utilizator' })
  update(@Param('id') id: string, @Body() dto: UpdateUserDto) {
    return this.usersService.update(id, dto);
  }

  @Patch('partners/:partnerId/telegram')
  @Roles(Role.ADMIN)
  @ApiOperation({ summary: '[ADMIN] Configurează Telegram per partener' })
  updatePartnerTelegram(
    @Param('partnerId') partnerId: string,
    @Body() body: { telegramBotToken?: string; telegramChatId?: string; telegramEnabled?: boolean },
  ) {
    return this.usersService.updatePartnerTelegram(partnerId, body);
  }

  @Post('partners/:partnerId/logo')
  @Roles(Role.ADMIN)
  @ApiOperation({ summary: '[ADMIN] Încarcă logo partener (PNG/SVG, max 2 MB)' })
  @ApiConsumes('multipart/form-data')
  @UseInterceptors(FileInterceptor('logo', { storage: memoryStorage() }))
  uploadLogo(
    @Param('partnerId') partnerId: string,
    @UploadedFile() file: Express.Multer.File,
  ) {
    return this.usersService.uploadLogo(partnerId, file);
  }

  @Delete(':id')
  @Roles(Role.ADMIN)
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: '[ADMIN] Șterge utilizator' })
  remove(@Param('id') id: string) {
    return this.usersService.remove(id);
  }
}
