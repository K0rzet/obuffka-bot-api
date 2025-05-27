import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { ChatType, ChatStatus, MessageType, Prisma } from '@prisma/client';

export interface CreateMessageDto {
  chatId: number;
  userId: number;
  text?: string;
  isAdmin: boolean;
  messageType?: MessageType;
  mediaUrl?: string;
  mediaType?: string;
  fileName?: string;
  fileSize?: number;
}

@Injectable()
export class ChatService {
  constructor(private prisma: PrismaService) {}

  async getChats(adminId?: number, status?: ChatStatus) {
    const where: Prisma.ChatWhereInput = {};
    
    if (status) {
      where.status = status;
    }

    return this.prisma.chat.findMany({
      where,
      include: {
        user: {
          select: {
            id: true,
            telegramId: true,
            username: true,
            firstName: true,
            lastName: true,
          },
        },
        assignedAdmin: {
          select: {
            id: true,
            username: true,
            firstName: true,
            lastName: true,
          },
        },
        messages: {
          orderBy: { createdAt: 'desc' },
          take: 1,
          include: {
            user: {
              select: {
                id: true,
                username: true,
                firstName: true,
                lastName: true,
                isAdmin: true,
              },
            },
          },
        },
        _count: {
          select: {
            messages: true,
          },
        },
      },
      orderBy: { updatedAt: 'desc' },
    });
  }

  async getChatById(chatId: number) {
    return this.prisma.chat.findUnique({
      where: { id: chatId },
      include: {
        user: {
          select: {
            id: true,
            telegramId: true,
            username: true,
            firstName: true,
            lastName: true,
          },
        },
        assignedAdmin: {
          select: {
            id: true,
            username: true,
            firstName: true,
            lastName: true,
          },
        },
        messages: {
          orderBy: { createdAt: 'asc' },
          include: {
            user: {
              select: {
                id: true,
                username: true,
                firstName: true,
                lastName: true,
                isAdmin: true,
              },
            },
          },
        },
      },
    });
  }

  async createMessage(data: CreateMessageDto) {
    const message = await this.prisma.message.create({
      data: {
        chatId: data.chatId,
        userId: data.userId,
        text: data.text,
        isAdmin: data.isAdmin,
        messageType: data.messageType || MessageType.TEXT,
        mediaUrl: data.mediaUrl,
        mediaType: data.mediaType,
        fileName: data.fileName,
        fileSize: data.fileSize,
      },
      include: {
        user: {
          select: {
            id: true,
            username: true,
            firstName: true,
            lastName: true,
            isAdmin: true,
          },
        },
        chat: {
          include: {
            user: true,
          },
        },
      },
    });

    // Обновляем время последнего обновления чата
    await this.prisma.chat.update({
      where: { id: data.chatId },
      data: { updatedAt: new Date() },
    });

    return message;
  }

  async assignChatToAdmin(chatId: number, adminId: number) {
    return this.prisma.chat.update({
      where: { id: chatId },
      data: { 
        assignedTo: adminId,
        status: ChatStatus.ACTIVE,
      },
      include: {
        user: true,
        assignedAdmin: true,
      },
    });
  }

  async updateChatStatus(chatId: number, status: ChatStatus) {
    return this.prisma.chat.update({
      where: { id: chatId },
      data: { status },
      include: {
        user: true,
        assignedAdmin: true,
      },
    });
  }

  async getAdmins() {
    return this.prisma.user.findMany({
      where: { isAdmin: true },
      select: {
        id: true,
        telegramId: true,
        username: true,
        firstName: true,
        lastName: true,
      },
    });
  }

  async getChatStats(adminId?: number) {
    // Убираем фильтрацию по adminId - показываем статистику по всем чатам
    const where: Prisma.ChatWhereInput = {};

    const [total, active, pending, closed] = await Promise.all([
      this.prisma.chat.count({ where }),
      this.prisma.chat.count({ where: { ...where, status: ChatStatus.ACTIVE } }),
      this.prisma.chat.count({ where: { ...where, status: ChatStatus.PENDING } }),
      this.prisma.chat.count({ where: { ...where, status: ChatStatus.CLOSED } }),
    ]);

    return { total, active, pending, closed };
  }
} 