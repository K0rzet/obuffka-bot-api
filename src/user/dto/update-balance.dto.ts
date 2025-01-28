import { ApiProperty } from '@nestjs/swagger';
import { IsNumber, IsNotEmpty } from 'class-validator';

export class UpdateBalanceDto {
  @ApiProperty({ description: 'Новый баланс пользователя' })
  @IsNumber()
  @IsNotEmpty()
  balance: number;
} 