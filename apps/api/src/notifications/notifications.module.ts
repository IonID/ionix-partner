import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { TelegramService } from './telegram.service';
import { TelegramController } from './telegram.controller';
import { AionaCoreModule } from '../aiona/aiona-core.module';

@Module({
  imports: [ConfigModule, AionaCoreModule],
  controllers: [TelegramController],
  providers: [TelegramService],
  exports: [TelegramService],
})
export class NotificationsModule {}
