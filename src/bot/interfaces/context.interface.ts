import { Context as ContextTelegraf } from 'telegraf';
import { Update } from 'telegraf/typings/core/types/typegram';

export interface Context extends ContextTelegraf {
  session: {
    type?: 'question' | 'order';
    chatId?: number;
    isWaitingForAdmin?: boolean;
    replyToUser?: string | number;
  };
} 