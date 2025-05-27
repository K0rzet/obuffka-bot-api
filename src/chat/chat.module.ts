import { Module } from '@nestjs/common';
import { TelegrafModule } from 'nestjs-telegraf';
import { ChatController } from './chat.controller';
import { ChatService } from './chat.service';
import { ChatGateway } from './chat.gateway';
import { PrismaModule } from '../prisma/prisma.module';
import { BotModule } from '../bot/bot.module';
import { FileUploadService } from '../common/services/file-upload.service';

@Module({
  imports: [PrismaModule, BotModule, TelegrafModule],
  controllers: [ChatController],
  providers: [ChatService, ChatGateway, FileUploadService],
  exports: [ChatService],
})
export class ChatModule {} 