import {
  WebSocketGateway,
  WebSocketServer,
  SubscribeMessage,
  OnGatewayConnection,
  OnGatewayDisconnect,
  MessageBody,
  ConnectedSocket,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { Injectable, Logger } from '@nestjs/common';
import { ChatService, CreateMessageDto } from './chat.service';

interface AuthenticatedSocket extends Socket {
  userId?: number;
  isAdmin?: boolean;
}

@Injectable()
@WebSocketGateway({
  cors: {
    origin: '*',
    methods: ['GET', 'POST'],
  },
  namespace: '/chat',
})
export class ChatGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  server: Server;

  private readonly logger = new Logger(ChatGateway.name);
  private connectedAdmins = new Map<number, string>(); // userId -> socketId

  constructor(private chatService: ChatService) {}

  async handleConnection(client: AuthenticatedSocket) {
    this.logger.log(`Client connected: ${client.id}`);
    
    // Здесь можно добавить аутентификацию через JWT токен
    // const token = client.handshake.auth.token;
    // const user = await this.validateToken(token);
    
    // Пока что для демонстрации просто помечаем как админа
    client.isAdmin = true;
    client.userId = 1; // ID админа из токена
    
    if (client.isAdmin) {
      this.connectedAdmins.set(client.userId, client.id);
      
      // Отправляем статистику при подключении
      const stats = await this.chatService.getChatStats(client.userId);
      client.emit('chatStats', stats);
      
      // Отправляем список чатов
      const chats = await this.chatService.getChats(client.userId);
      client.emit('chatList', chats);
    }
  }

  handleDisconnect(client: AuthenticatedSocket) {
    this.logger.log(`Client disconnected: ${client.id}`);
    
    if (client.userId && this.connectedAdmins.has(client.userId)) {
      this.connectedAdmins.delete(client.userId);
    }
  }

  @SubscribeMessage('joinChat')
  async handleJoinChat(
    @ConnectedSocket() client: AuthenticatedSocket,
    @MessageBody() data: { chatId: number },
  ) {
    const room = `chat_${data.chatId}`;
    await client.join(room);
    
    // Отправляем историю сообщений
    const chat = await this.chatService.getChatById(data.chatId);
    client.emit('chatHistory', chat);
    
    this.logger.log(`Client ${client.id} joined chat ${data.chatId}`);
  }

  @SubscribeMessage('leaveChat')
  async handleLeaveChat(
    @ConnectedSocket() client: AuthenticatedSocket,
    @MessageBody() data: { chatId: number },
  ) {
    const room = `chat_${data.chatId}`;
    await client.leave(room);
    
    this.logger.log(`Client ${client.id} left chat ${data.chatId}`);
  }

  @SubscribeMessage('sendMessage')
  async handleSendMessage(
    @ConnectedSocket() client: AuthenticatedSocket,
    @MessageBody() data: CreateMessageDto,
  ) {
    try {
      // Создаем сообщение в базе данных
      const message = await this.chatService.createMessage({
        ...data,
        userId: client.userId,
        isAdmin: client.isAdmin,
      });

      // Отправляем сообщение всем участникам чата
      const room = `chat_${data.chatId}`;
      this.server.to(room).emit('newMessage', message);

      // Обновляем список чатов для всех админов
      this.broadcastChatListUpdate();

      // Если это сообщение от админа, отправляем уведомление в Telegram
      if (client.isAdmin && message.chat.user.telegramId) {
        // Здесь можно добавить отправку в Telegram через bot service
        // await this.botService.sendMessageToUser(message.chat.user.telegramId, message.text);
      }

      this.logger.log(`Message sent in chat ${data.chatId} by user ${client.userId}`);
    } catch (error) {
      this.logger.error(`Error sending message: ${error.message}`);
      client.emit('error', { message: 'Ошибка отправки сообщения' });
    }
  }

  @SubscribeMessage('assignChat')
  async handleAssignChat(
    @ConnectedSocket() client: AuthenticatedSocket,
    @MessageBody() data: { chatId: number; adminId: number },
  ) {
    try {
      const updatedChat = await this.chatService.assignChatToAdmin(
        data.chatId,
        data.adminId,
      );

      // Уведомляем всех админов об изменении
      this.server.emit('chatAssigned', updatedChat);
      this.broadcastChatListUpdate();

      this.logger.log(`Chat ${data.chatId} assigned to admin ${data.adminId}`);
    } catch (error) {
      this.logger.error(`Error assigning chat: ${error.message}`);
      client.emit('error', { message: 'Ошибка назначения чата' });
    }
  }

  @SubscribeMessage('updateChatStatus')
  async handleUpdateChatStatus(
    @ConnectedSocket() client: AuthenticatedSocket,
    @MessageBody() data: { chatId: number; status: string },
  ) {
    try {
      const updatedChat = await this.chatService.updateChatStatus(
        data.chatId,
        data.status as any,
      );

      // Уведомляем всех админов об изменении
      this.server.emit('chatStatusUpdated', updatedChat);
      this.broadcastChatListUpdate();

      this.logger.log(`Chat ${data.chatId} status updated to ${data.status}`);
    } catch (error) {
      this.logger.error(`Error updating chat status: ${error.message}`);
      client.emit('error', { message: 'Ошибка обновления статуса чата' });
    }
  }

  // Метод для отправки нового сообщения от бота
  async notifyNewMessage(message: any) {
    const room = `chat_${message.chatId}`;
    this.server.to(room).emit('newMessage', message);
    this.broadcastChatListUpdate();
  }

  // Метод для уведомления о новом чате
  async notifyNewChat(chat: any) {
    this.server.emit('newChat', chat);
    this.broadcastChatListUpdate();
  }

  private async broadcastChatListUpdate() {
    // Отправляем обновленный список чатов всем подключенным админам
    for (const [userId, socketId] of this.connectedAdmins.entries()) {
      const chats = await this.chatService.getChats(userId);
      const stats = await this.chatService.getChatStats(userId);
      
      this.server.to(socketId).emit('chatList', chats);
      this.server.to(socketId).emit('chatStats', stats);
    }
  }
} 