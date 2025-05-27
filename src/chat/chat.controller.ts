import {
  Controller,
  Get,
  Post,
  Put,
  Body,
  Param,
  Query,
  UseInterceptors,
  UploadedFile,
  ParseFilePipeBuilder,
  MaxFileSizeValidator,
  FileTypeValidator,
  Inject,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiConsumes } from '@nestjs/swagger';
import { FileInterceptor } from '@nestjs/platform-express';
import { ChatService, CreateMessageDto } from './chat.service';
import { Auth } from '../auth/decorators/auth.decorator';
import { ChatStatus, MessageType } from '@prisma/client';
import { FileUploadService } from '../common/services/file-upload.service';
import { Telegraf } from 'telegraf';

@ApiTags('chat')
@Controller('chat')
export class ChatController {
  constructor(
    private readonly chatService: ChatService,
    private readonly fileUploadService: FileUploadService,
    @Inject('TELEGRAM_BOT') private readonly bot: Telegraf,
  ) {}

  @Get()
  @Auth('admin')
  @ApiOperation({ summary: 'Получить список чатов' })
  @ApiResponse({ status: 200, description: 'Возвращает список чатов' })
  async getChats(
    @Query('adminId') adminId?: string,
    @Query('status') status?: ChatStatus,
  ) {
    return this.chatService.getChats(
      adminId ? parseInt(adminId) : undefined,
      status,
    );
  }

  @Get('stats')
  @Auth('admin')
  @ApiOperation({ summary: 'Получить статистику чатов' })
  @ApiResponse({ status: 200, description: 'Возвращает статистику чатов' })
  async getChatStats(@Query('adminId') adminId?: string) {
    return this.chatService.getChatStats(
      adminId ? parseInt(adminId) : undefined,
    );
  }

  @Get('admins')
  @Auth('admin')
  @ApiOperation({ summary: 'Получить список администраторов' })
  @ApiResponse({ status: 200, description: 'Возвращает список администраторов' })
  async getAdmins() {
    return this.chatService.getAdmins();
  }

  @Get(':id')
  @Auth('admin')
  @ApiOperation({ summary: 'Получить чат по ID' })
  @ApiResponse({ status: 200, description: 'Возвращает чат с сообщениями' })
  async getChatById(@Param('id') id: string) {
    return this.chatService.getChatById(parseInt(id));
  }

  @Post(':id/messages')
  @Auth('admin')
  @UseInterceptors(FileInterceptor('file'))
  @ApiConsumes('multipart/form-data')
  @ApiOperation({ summary: 'Отправить сообщение в чат' })
  @ApiResponse({ status: 201, description: 'Сообщение отправлено' })
  async sendMessage(
    @Param('id') chatId: string,
    @Body() body: { text?: string; userId: string },
    @UploadedFile(
      new ParseFilePipeBuilder()
        .addValidator(new MaxFileSizeValidator({ maxSize: 1024 * 1024 * 10 }))
        .addValidator(
          new FileTypeValidator({
            fileType: /(jpg|jpeg|png|gif|pdf|doc|docx|txt|mp3|mp4|avi|mov)$/,
          }),
        )
        .build({ fileIsRequired: false }),
    )
    file?: Express.Multer.File,
  ) {
    let messageData: CreateMessageDto = {
      chatId: parseInt(chatId),
      userId: parseInt(body.userId),
      text: body.text,
      isAdmin: true,
    };

    if (file) {
      const mediaUrl = await this.fileUploadService.uploadFile(file);
      messageData = {
        ...messageData,
        messageType: this.getMessageTypeFromFile(file),
        mediaUrl,
        mediaType: file.mimetype,
        fileName: file.originalname,
        fileSize: file.size,
      };
    }

    const createdMessage = await this.chatService.createMessage(messageData);

    // Отправляем сообщение пользователю в Telegram
    try {
      await this.bot.telegram.sendMessage(
        Number(createdMessage.chat.user.telegramId),
        messageData.text || 'Медиа сообщение'
      );
    } catch (error) {
      console.error('Ошибка отправки сообщения в Telegram:', error);
    }

    return createdMessage;
  }

  @Put(':id/assign')
  @Auth('admin')
  @ApiOperation({ summary: 'Назначить чат администратору' })
  @ApiResponse({ status: 200, description: 'Чат назначен администратору' })
  async assignChat(
    @Param('id') chatId: string,
    @Body() body: { adminId: number },
  ) {
    return this.chatService.assignChatToAdmin(parseInt(chatId), body.adminId);
  }

  @Put(':id/status')
  @Auth('admin')
  @ApiOperation({ summary: 'Изменить статус чата' })
  @ApiResponse({ status: 200, description: 'Статус чата изменен' })
  async updateChatStatus(
    @Param('id') chatId: string,
    @Body() body: { status: ChatStatus },
  ) {
    return this.chatService.updateChatStatus(parseInt(chatId), body.status);
  }

  private getMessageTypeFromFile(file: Express.Multer.File): MessageType {
    const mimeType = file.mimetype;
    
    if (mimeType.startsWith('image/')) {
      return MessageType.PHOTO;
    } else if (mimeType.startsWith('video/')) {
      return MessageType.VIDEO;
    } else if (mimeType.startsWith('audio/')) {
      return MessageType.VOICE;
    } else {
      return MessageType.DOCUMENT;
    }
  }
} 