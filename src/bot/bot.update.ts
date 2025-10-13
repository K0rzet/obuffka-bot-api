import { Update, Start, Ctx, On, Action, Command } from 'nestjs-telegraf';
import { Context } from './interfaces/context.interface';
import { Markup } from 'telegraf';
import { ConfigService } from '@nestjs/config';
import { Injectable } from '@nestjs/common';
import { Message } from 'telegraf/typings/core/types/typegram';
import { BotService } from './bot.service';
import { ChatType, ChatStatus } from '@prisma/client';
import { join } from 'path';

@Injectable()
@Update()
export class BotUpdate {
  constructor(
    private configService: ConfigService,
    private botService: BotService,
  ) {}

  @Start()
  async startCommand(@Ctx() ctx: Context) {
    const user = await this.botService.createUser(
      ctx.from.id, 
      ctx.from.username, 
      ctx.from.first_name, 
      ctx.from.last_name
    );
    const isAdmin = user.isAdmin;

    if (isAdmin) {
      await ctx.reply('Панель администратора', Markup.keyboard([
        ['📋 Показать активные чаты', '📊 Статистика'],
        ['📨 Рассылка', '⚙️ Настройки']
      ]).resize());
      return;
    }

    // Проверяем, согласился ли пользователь с условиями
    if (!ctx.session.agreedToTerms) {
      await this.sendPrivacyPolicyDocuments(ctx);
      return;
    }

    await ctx.reply('Напишите ваше сообщение, и администратор ответит вам в ближайшее время', Markup.keyboard([
      ['❓ Как сделать заказ?']
    ]).resize());
  }

  @On('text')
  async handleMessage(@Ctx() ctx: Context) {
    const user = await this.botService.getUserByTelegramId(ctx.from.id);
    const isAdmin = user?.isAdmin;
    const text = (ctx.message as Message.TextMessage).text;

    // Проверка согласия с условиями для обычных пользователей
    if (!isAdmin && !ctx.session.agreedToTerms) {
      await this.sendPrivacyPolicyDocuments(ctx);
      return;
    }

    if (isAdmin) {
      if (text === '/cancel') {
        return this.cancelReply(ctx);
      }
      if (text === '📋 Показать активные чаты') {
        return this.showActiveChats(ctx);
      }
      if (text === '📨 Рассылка') {
        ctx.session.isMassSending = true;
        await ctx.reply('Отправьте сообщение для массовой рассылки (можно с фото или файлами). Для отмены используйте /cancel');
        return;
      }
      if (ctx.session.replyToUser) {
        const userId = BigInt(ctx.session.replyToUser);
        await ctx.telegram.sendMessage(Number(userId), text);
        await ctx.reply('Сообщение отправлено. Продолжайте писать или используйте /cancel для завершения');
        return;
      }
      if (ctx.session.isMassSending) {
        const users = await this.botService.getAllUsers();
        let successCount = 0;
        let errorCount = 0;
        
        const message = ctx.message as Message.TextMessage;
        
        for (const user of users) {
          try {
            if (user.telegramId) {
              await ctx.telegram.sendMessage(Number(user.telegramId), message.text);
              successCount++;
            }
          } catch (error) {
            errorCount++;
            console.error(`Failed to send message to user ${user.telegramId}: ${error.message}`);
          }
        }

        delete ctx.session.isMassSending;
        await ctx.reply(`Рассылка завершена!\nУспешно отправлено: ${successCount}\nОшибок отправки: ${errorCount}`);
        return;
      }

      return this.handleAdminMessage(ctx);
    }

    if (text === '❓ Как сделать заказ?') {
      await ctx.reply(`Инструкция по оформлению заказа:

1. Доставка Яндекс
   - Укажите точный адрес доставки
   - ФИО получателя
   - Контактный телефон

2. СДЭК
   - Адрес ПВЗ или точный адрес доставки
   - ФИО получателя
   - Контактный телефон

3. Почта России
   - Полный почтовый адрес с индексом
   - ФИО получателя
   - Контактный телефон

Для оформления заказа нажмите кнопку "🛍 Сделать заказ" и предоставьте информацию следуя инструкции`);
      return;
    }

    if (text === '📞 Сделать заказ или задать вопрос') {
      return this.handleStartChat(ctx, 'order');
    }

    if (ctx.session.chatId) {
      const chat = await this.botService.getChat(ctx.session.chatId);
      if (chat?.status === ChatStatus.CLOSED) {
        delete ctx.session.chatId;
        delete ctx.session.isWaitingForAdmin;
        await ctx.reply('Этот чат был закрыт. Нажмите кнопку ниже, чтобы начать новый чат.');
        return;
      }
    }

    if (ctx.session.isWaitingForAdmin) {
      return this.forwardToAdmin(ctx);
    }

    // Упрощенная логика для обычных пользователей
    if (!ctx.session.chatId) {
      // Создаем новый чат для каждого сообщения
      const chat = await this.botService.createChat(ctx.from.id, ChatType.QUESTION);
      ctx.session.chatId = chat.id;
    }

    // Пересылаем сообщение администраторам
    return this.forwardToAdmin(ctx);
  }

  @On(['photo', 'document', 'voice', 'video_note', 'video'])
  async handleMedia(@Ctx() ctx: Context) {
    const user = await this.botService.getUserByTelegramId(ctx.from.id);
    const isAdmin = user?.isAdmin;

    // Проверка согласия с условиями для обычных пользователей
    if (!isAdmin && !ctx.session.agreedToTerms) {
      await this.sendPrivacyPolicyDocuments(ctx);
      return;
    }

    if (isAdmin && ctx.session.isMassSending) {
      const users = await this.botService.getAllUsers();
      let successCount = 0;
      let errorCount = 0;

      const message = ctx.message as Message.PhotoMessage | Message.DocumentMessage | Message.VoiceMessage | Message.VideoNoteMessage | Message.VideoMessage;
      
      for (const user of users) {
        try {
          if (user.telegramId) {
            if ('photo' in message) {
              const photo = message.photo[message.photo.length - 1];
              await ctx.telegram.sendPhoto(Number(user.telegramId), photo.file_id, {
                caption: message.caption
              });
            } else if ('document' in message) {
              await ctx.telegram.sendDocument(Number(user.telegramId), message.document.file_id, {
                caption: message.caption
              });
            } else if ('voice' in message) {
              await ctx.telegram.sendVoice(Number(user.telegramId), message.voice.file_id, {
                caption: message.caption
              });
            } else if ('video_note' in message) {
              await ctx.telegram.sendVideoNote(Number(user.telegramId), message.video_note.file_id);
            } else if ('video' in message) {
              await ctx.telegram.sendVideo(Number(user.telegramId), message.video.file_id, {
                caption: message.caption
              });
            }
            successCount++;
          }
        } catch (error) {
          errorCount++;
          console.error(`Failed to send message to user ${user.telegramId}: ${error.message}`);
        }
      }

      delete ctx.session.isMassSending;
      await ctx.reply(`Рассылка завершена!\nУспешно отправлено: ${successCount}\nОшибок отправки: ${errorCount}`);
      return;
    }

    // Если это админ и он отвечает пользователю
    if (isAdmin && ctx.session.replyToUser) {
      const userId = BigInt(ctx.session.replyToUser);
      const message = ctx.message as Message.PhotoMessage | Message.DocumentMessage | Message.VoiceMessage | Message.VideoNoteMessage | Message.VideoMessage;

      if ('photo' in message) {
        const photo = message.photo[message.photo.length - 1];
        await ctx.telegram.sendPhoto(Number(userId), photo.file_id, {
          caption: message.caption
        });
      } else if ('document' in message) {
        await ctx.telegram.sendDocument(Number(userId), message.document.file_id, {
          caption: message.caption
        });
      } else if ('voice' in message) {
        await ctx.telegram.sendVoice(Number(userId), message.voice.file_id, {
          caption: message.caption
        });
      } else if ('video_note' in message) {
        await ctx.telegram.sendVideoNote(Number(userId), message.video_note.file_id);
      } else if ('video' in message) {
        await ctx.telegram.sendVideo(Number(userId), message.video.file_id, {
          caption: message.caption
        });
      }
      
      await ctx.reply('Медиа сообщение отправлено. Продолжайте писать или используйте /cancel для завершения');
      return;
    }

    // Обычный пользователь отправляет медиа
    if (!ctx.session.chatId) {
      const chat = await this.botService.createChat(ctx.from.id, ChatType.QUESTION);
      ctx.session.chatId = chat.id;
    }

    // Сохраняем медиа сообщение в базу данных
    const message = ctx.message as Message.PhotoMessage | Message.DocumentMessage | Message.VoiceMessage | Message.VideoNoteMessage | Message.VideoMessage;
    let messageText = '';
    let mediaUrl = '';
    let messageType = 'TEXT';
    let fileName = '';
    let fileSize = 0;

    if ('photo' in message) {
      const photo = message.photo[message.photo.length - 1];
      mediaUrl = photo.file_id;
      messageType = 'PHOTO';
      messageText = message.caption || '';
    } else if ('document' in message) {
      mediaUrl = message.document.file_id;
      messageType = 'DOCUMENT';
      fileName = message.document.file_name || 'document';
      fileSize = message.document.file_size || 0;
      messageText = message.caption || '';
    } else if ('voice' in message) {
      mediaUrl = message.voice.file_id;
      messageType = 'VOICE';
      fileSize = message.voice.file_size || 0;
    } else if ('video_note' in message) {
      mediaUrl = message.video_note.file_id;
      messageType = 'VIDEO';
      fileSize = message.video_note.file_size || 0;
    } else if ('video' in message) {
      mediaUrl = message.video.file_id;
      messageType = 'VIDEO';
      fileName = message.video.file_name || 'video';
      fileSize = message.video.file_size || 0;
      messageText = message.caption || '';
    }

    // Сохраняем сообщение в базу данных
    await this.botService.createMediaMessage(
      ctx.session.chatId,
      ctx.from.id,
      messageText,
      false,
      messageType as any,
      mediaUrl,
      fileName,
      fileSize
    );

    // Пересылаем медиа администраторам
    return this.forwardMediaToAdmin(ctx);
  }

  private async showActiveChats(ctx: Context) {
    const chats = await this.botService.getActiveChats();
    
    if (chats.length === 0) {
      await ctx.reply('Нет активных чатов');
      return;
    }

    for (const chat of chats) {
      // Берем только последнее сообщение
      const lastMessage = chat.messages.length > 0 ? chat.messages[chat.messages.length - 1] : null;
      // Создаем ссылку на диалог с пользователем
      const userLink = `tg://user?id=${chat.user.telegramId}`;
      
      const messageText = `
Тип: ${chat.type === ChatType.QUESTION ? '❓ Вопрос' : '🛍 Заказ'}
От пользователя: ${this.escapeMarkdown(this.formatUserInfo(chat.user))}
[Открыть диалог](${userLink})
Последнее сообщение: ${this.escapeMarkdown(lastMessage?.text || 'Нет сообщений')}
`;
      await ctx.reply(messageText, {
        parse_mode: 'Markdown',
        ...Markup.inlineKeyboard([
          [
            Markup.button.callback('✍️ Ответить', `reply_${chat.id}`),
            Markup.button.callback('❌ Закрыть чат', `close_${chat.id}`)
          ]
        ])
      });
    }
  }

  private async handleStartChat(ctx: Context, type: 'question' | 'order') {
    const userId = ctx.from.id;
    
    // Закрываем предыдущий активный чат пользователя
    const activeChats = await this.botService.getActiveChats();
    const userActiveChat = activeChats.find(chat => chat.user.telegramId === userId.toString());
    if (userActiveChat) {
      await this.botService.closeChat(userActiveChat.id);
    }
    
    const chatType = type === 'order' ? ChatType.ORDER : ChatType.QUESTION;
    const chat = await this.botService.createChat(userId, chatType);
    
    ctx.session.type = type;
    ctx.session.chatId = chat.id;
    ctx.session.isWaitingForAdmin = true;
    
    const message = type === 'question' ? 
      'Опишите ваш вопрос' : 
      'Опишите ваш заказ или вопрос';
    await ctx.reply(message);
  }

  private async forwardToAdmin(ctx: Context) {
    if (!ctx.session.chatId) {
      await ctx.reply('Ошибка: чат не найден. Пожалуйста, начните заново.');
      return;
    }

    const admins = await this.botService.getAdmins();
    const message = ctx.message as Message.TextMessage;
    
    // Форматируем информацию о пользователе
    const userInfo = this.escapeMarkdown(this.formatUserInfo(ctx.from));
    // Создаем ссылку на диалог с пользователем
    const userLink = `tg://user?id=${ctx.from.id}`;

    const messageText = `
Новое ${ctx.session.type === 'question' ? 'обращение' : 'заказ'}
От: ${userInfo}
ID: ${ctx.from.id}
[Открыть диалог](${userLink})
Сообщение: ${this.escapeMarkdown(message.text)}
`;

    await this.botService.createMessage(ctx.session.chatId, ctx.from.id, message.text, false);
    
    for (const admin of admins) {
      await ctx.telegram.sendMessage(Number(admin.telegramId), messageText, {
        parse_mode: 'Markdown',
        ...Markup.inlineKeyboard([
          Markup.button.callback('✍️ Ответить', `reply_${ctx.session.chatId}`)
        ])
      });
    }
    
    await ctx.reply('Ваше сообщение отправлено. Ожидайте ответа администратора.');
  }

  @Action('agree_to_terms')
  async handleAgreeToTerms(@Ctx() ctx: Context) {
    ctx.session.agreedToTerms = true;
    
    await ctx.answerCbQuery();
    await ctx.editMessageText('Спасибо! Вы согласились с условиями обработки персональных данных.');
    
    await ctx.reply('Напишите ваше сообщение, и администратор ответит вам в ближайшее время', Markup.keyboard([
      ['❓ Как сделать заказ?']
    ]).resize());
  }

  @Action(/reply_(\d+)/)
  async handleReplyButton(@Ctx() ctx: Context) {
    const callbackQuery = ctx.callbackQuery as { data: string };
    const match = callbackQuery.data.match(/reply_(\d+)/);
    if (!match) return;

    const chatId = parseInt(match[1]);
    const chat = await this.botService.getChat(chatId);
    
    ctx.session.replyToUser = String(chat.user.telegramId);
    await ctx.reply('Введите ваш ответ пользователю (или /cancel для завершения)');
  }

  @Action(/close_(\d+)/)
  async handleCloseChat(@Ctx() ctx: Context) {
    const callbackQuery = ctx.callbackQuery as { data: string };
    const match = callbackQuery.data.match(/close_(\d+)/);
    if (!match) return;

    const chatId = parseInt(match[1]);
    const chat = await this.botService.getChat(chatId);
    await this.botService.closeChat(chatId);
    
    await ctx.telegram.sendMessage(Number(chat.user.telegramId), 'Ваш чат был закрыт администратором');
    await ctx.reply('Чат закрыт');
  }

  @Command('cancel')
  async cancelReply(@Ctx() ctx: Context) {
    if (ctx.session.replyToUser) {
      const userId = ctx.session.replyToUser;
      delete ctx.session.replyToUser;
      await ctx.reply('Диалог с пользователем завершен');
      await ctx.telegram.sendMessage(Number(userId), 'Администратор завершил диалог');
      return;
    }
  }

  private async handleAdminMessage(ctx: Context) {
    const message = ctx.message as Message.TextMessage;
    if (!message?.reply_to_message) {
      return;
    }

    const replyMsg = message.reply_to_message as Message.TextMessage;
    const match = replyMsg.text?.match(/ID: (\d+)/);
    if (!match) return;

    const userId = parseInt(match[1]);
    const chat = await this.botService.getActiveChats();
    const userChat = chat.find(c => c.user.telegramId === userId.toString());
    
    if (!userChat) {
      await ctx.reply('Ошибка: чат с пользователем не найден или закрыт');
      return;
    }

    await this.botService.createMessage(userChat.id, ctx.from.id, message.text, true);
    await ctx.telegram.sendMessage(userId, message.text);
    await ctx.reply('Сообщение отправлено. Продолжайте писать или используйте /cancel для завершения');
    
    ctx.session.replyToUser = String(userId);
  }

  private async sendPrivacyPolicyDocuments(ctx: Context) {
    try {
      const documentsPath = join(process.cwd(), 'documents');
      
      // Отправляем политику обработки персональных данных
      const policyPath = join(documentsPath, 'политика.pdf');
      await ctx.replyWithDocument({ source: policyPath, filename: 'Политика обработки персональных данных.pdf' });
      
      // Отправляем согласие на обработку
      const consentPath = join(documentsPath, 'согласие на обработку.pdf');
      await ctx.replyWithDocument({ source: consentPath, filename: 'Согласие на обработку персональных данных.pdf' });
      
      // Отправляем согласие на рекламу
      const adConsentPath = join(documentsPath, 'согласие на рекламу.pdf');
      await ctx.replyWithDocument({ source: adConsentPath, filename: 'Согласие на получение рекламы.pdf' });
      
      // Отправляем сообщение с кнопкой
      await ctx.reply(
        'Нажимая кнопку продолжить, вы соглашаетесь с тем, что ознакомлены с Политикой обработки персональных данных и даете Согласие на обработку персональных данных и согласие на получение рекламы',
        Markup.inlineKeyboard([
          [Markup.button.callback('Продолжить', 'agree_to_terms')]
        ])
      );
    } catch (error) {
      console.error('Error sending privacy policy documents:', error);
      // Если не удалось отправить документы, отправляем хотя бы текст
      await ctx.reply(
        'Нажимая кнопку продолжить, вы соглашаетесь с тем, что ознакомлены с Политикой обработки персональных данных и даете Согласие на обработку персональных данных и согласие на получение рекламы',
        Markup.inlineKeyboard([
          [Markup.button.callback('Продолжить', 'agree_to_terms')]
        ])
      );
    }
  }

  private escapeMarkdown(text: string): string {
    // Экранируем специальные символы Markdown
    return text.replace(/([_*\[\]()~`>#+=|{}.!-])/g, '\\$1');
  }

  private formatUserInfo(user: any): string {
    const parts = [];
    
    if (user.first_name) parts.push(user.first_name);
    if (user.last_name) parts.push(user.last_name);
    
    const fullName = parts.length > 0 ? parts.join(' ') : 'Неизвестный пользователь';
    const username = user.username ? `@${user.username}` : '';
    
    return username ? `${fullName} (${username})` : fullName;
  }

  private async forwardMediaToAdmin(ctx: Context) {
    const admins = await this.botService.getAdmins();
    const message = ctx.message as Message.PhotoMessage | Message.DocumentMessage | Message.VoiceMessage | Message.VideoNoteMessage | Message.VideoMessage;
    
    // Создаем ссылку на диалог с пользователем
    const userLink = `tg://user?id=${ctx.from.id}`;

    const messageText = `
Новое сообщение с медиа
От: ${this.escapeMarkdown(this.formatUserInfo(ctx.from))}
ID: ${ctx.from.id}
[Открыть диалог](${userLink})
${'caption' in message && message.caption ? `Текст: ${this.escapeMarkdown(message.caption)}` : ''}
`;

    for (const admin of admins) {
      try {
        if ('photo' in message) {
          const photo = message.photo[message.photo.length - 1];
          await ctx.telegram.sendPhoto(Number(admin.telegramId), photo.file_id, {
            caption: messageText,
            parse_mode: 'Markdown',
            ...Markup.inlineKeyboard([
              Markup.button.callback('✍️ Ответить', `reply_${ctx.session.chatId}`)
            ])
          });
        } else if ('document' in message) {
          await ctx.telegram.sendDocument(Number(admin.telegramId), message.document.file_id, {
            caption: messageText,
            parse_mode: 'Markdown',
            ...Markup.inlineKeyboard([
              Markup.button.callback('✍️ Ответить', `reply_${ctx.session.chatId}`)
            ])
          });
        } else if ('voice' in message) {
          await ctx.telegram.sendVoice(Number(admin.telegramId), message.voice.file_id, {
            caption: messageText,
            parse_mode: 'Markdown',
            ...Markup.inlineKeyboard([
              Markup.button.callback('✍️ Ответить', `reply_${ctx.session.chatId}`)
            ])
          });
        } else if ('video_note' in message) {
          await ctx.telegram.sendVideoNote(Number(admin.telegramId), message.video_note.file_id, {
            ...Markup.inlineKeyboard([
              Markup.button.callback('✍️ Ответить', `reply_${ctx.session.chatId}`)
            ])
          });
          // Отправляем текст отдельно для video_note
          await ctx.telegram.sendMessage(Number(admin.telegramId), messageText, {
            parse_mode: 'Markdown',
            ...Markup.inlineKeyboard([
              Markup.button.callback('✍️ Ответить', `reply_${ctx.session.chatId}`)
            ])
          });
        } else if ('video' in message) {
          await ctx.telegram.sendVideo(Number(admin.telegramId), message.video.file_id, {
            caption: messageText,
            parse_mode: 'Markdown',
            ...Markup.inlineKeyboard([
              Markup.button.callback('✍️ Ответить', `reply_${ctx.session.chatId}`)
            ])
          });
        }
      } catch (error) {
        console.error(`Failed to send media to admin ${admin.telegramId}: ${error.message}`);
      }
    }

    await ctx.reply('Ваше медиа-сообщение отправлено. Ожидайте ответа администратора.');
  }
} 