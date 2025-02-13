import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { ChatType, ChatStatus } from '@prisma/client';

@Injectable()
export class BotService {
  constructor(private prisma: PrismaService) {}

  async createUser(telegramId: number, username?: string) {
    return this.prisma.user.upsert({
      where: { telegramId: telegramId.toString() },
      update: { username },
      create: { telegramId: telegramId.toString(), username },
    });
  }

  async createChat(telegramId: number, type: ChatType) {
    const user = await this.prisma.user.upsert({
      where: { telegramId: telegramId.toString() },
      create: { telegramId: telegramId.toString() },
      update: {},
    });

    return this.prisma.chat.create({
      data: {
        userId: user.id,
        type,
        status: ChatStatus.ACTIVE,
      },
    });
  }

  async createMessage(chatId: number, telegramId: number, text: string, isAdmin: boolean) {
    const user = await this.prisma.user.upsert({
      where: { telegramId: telegramId.toString() },
      create: { telegramId: telegramId.toString() },
      update: {},
    });

    return this.prisma.message.create({
      data: {
        chatId,
        userId: user.id,
        text,
        isAdmin,
      },
    });
  }

  async getActiveChats() {
    return this.prisma.chat.findMany({
      where: { status: ChatStatus.ACTIVE },
      include: {
        user: true,
        messages: {
          orderBy: { createdAt: 'desc' },
          take: 1,
        },
      },
    });
  }

  async closeChat(chatId: number) {
    return this.prisma.chat.update({
      where: { id: chatId },
      data: { status: ChatStatus.CLOSED },
    });
  }

  async getUserByTelegramId(telegramId: number) {
    return this.prisma.user.findUnique({
      where: { telegramId: telegramId.toString() },
    });
  }

  async getAdmins() {
    return this.prisma.user.findMany({
      where: { isAdmin: true }
    });
  }

  async getChat(chatId: number) {
    return this.prisma.chat.findUnique({
      where: { id: chatId },
      include: { user: true }
    });
  }

  async getAllUsers() {
    return this.prisma.user.findMany();
  }
}
