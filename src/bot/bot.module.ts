import { Module } from '@nestjs/common';
import { BotUpdate } from './bot.update';
import { ConfigModule } from '@nestjs/config';
import { BotService } from './bot.service';
import { PrismaModule } from '../prisma/prisma.module';

@Module({
  imports: [ConfigModule, PrismaModule],
  providers: [BotUpdate, BotService],
})
export class BotModule {}
