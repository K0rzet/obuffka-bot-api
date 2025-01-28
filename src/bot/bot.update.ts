import { Update, Start, Ctx, On, Action, Command } from 'nestjs-telegraf';
import { Context } from './interfaces/context.interface';
import { Markup } from 'telegraf';
import { ConfigService } from '@nestjs/config';
import { Injectable } from '@nestjs/common';
import { Message } from 'telegraf/typings/core/types/typegram';
import { BotService } from './bot.service';
import { ChatType, ChatStatus } from '@prisma/client';

@Injectable()
@Update()
export class BotUpdate {
  constructor(
    private configService: ConfigService,
    private botService: BotService,
  ) {}

  @Start()
  async startCommand(@Ctx() ctx: Context) {
    const user = await this.botService.createUser(ctx.from.id, ctx.from.username);
    const isAdmin = user.isAdmin;

    if (isAdmin) {
      await ctx.reply('Панель администратора', Markup.keyboard([
        ['📋 Показать активные чаты', '📊 Статистика'],
        ['📨 Рассылка', '⚙️ Настройки']
      ]).resize());
      return;
    }

    await ctx.reply('Выберите действие:', Markup.keyboard([
      ['❓ Как сделать заказ?', '📞 Сделать заказ или задать вопрос']
    ]).resize());
  }

  @On('text')
  async handleMessage(@Ctx() ctx: Context) {
    const user = await this.botService.getUserByTelegramId(ctx.from.id);
    const isAdmin = user?.isAdmin;
    const text = (ctx.message as Message.TextMessage).text;

    if (isAdmin) {
      if (text === '/cancel') {
        return this.cancelReply(ctx);
      }
      if (text === '📋 Показать активные чаты') {
        return this.showActiveChats(ctx);
      }
      if (ctx.session.replyToUser) {
        const userId = BigInt(ctx.session.replyToUser);
        await ctx.telegram.sendMessage(Number(userId), text);
        await ctx.reply('Сообщение отправлено. Продолжайте писать или используйте /cancel для завершения');
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
  }

  private async showActiveChats(ctx: Context) {
    const chats = await this.botService.getActiveChats();
    
    if (chats.length === 0) {
      await ctx.reply('Нет активных чатов');
      return;
    }

    for (const chat of chats) {
      const lastMessage = chat.messages[0];
      const messageText = `
Тип: ${chat.type === ChatType.QUESTION ? '❓ Вопрос' : '🛍 Заказ'}
От пользователя: ${chat.user.username || chat.user.telegramId}
Последнее сообщение: ${lastMessage?.text || 'Нет сообщений'}
`;
      await ctx.reply(messageText, {
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

    const messageText = `
Новое ${ctx.session.type === 'question' ? 'обращение' : 'заказ'}
От: ${ctx.from.username ? '@' + ctx.from.username : 'Пользователь'}
ID: ${ctx.from.id}
Сообщение: ${message.text}
`;

    await this.botService.createMessage(ctx.session.chatId, ctx.from.id, message.text, false);
    
    for (const admin of admins) {
      await ctx.telegram.sendMessage(Number(admin.telegramId), messageText, {
        ...Markup.inlineKeyboard([
          Markup.button.callback('✍️ Ответить', `reply_${ctx.session.chatId}`)
        ])
      });
    }
    
    await ctx.reply('Ваше сообщение отправлено. Ожидайте ответа администратора.');
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
} 