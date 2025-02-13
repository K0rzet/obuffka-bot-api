import { Context as TelegrafContext } from 'telegraf';
import { Update } from 'telegraf/typings/core/types/typegram';

interface SessionData {
  type?: 'question' | 'order';
  chatId?: number;
  isWaitingForAdmin?: boolean;
  replyToUser?: string | number;
  isMassSending?: boolean;
}

export interface Context extends TelegrafContext {
  session: SessionData;
}