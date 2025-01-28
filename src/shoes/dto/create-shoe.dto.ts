import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsEnum, IsArray, IsNumber, IsNotEmpty } from 'class-validator';
import { Gender } from '@prisma/client';

export class CreateShoeDto {
  @ApiProperty({ description: 'Название обуви' })
  @IsString()
  @IsNotEmpty()
  name: string;

  @ApiProperty({ description: 'Описание обуви' })
  @IsString()
  @IsNotEmpty()
  description: string;

  @ApiProperty({ description: 'Цвет обуви' })
  @IsString()
  @IsNotEmpty()
  color: string;

  @ApiProperty({ enum: Gender, description: 'Пол (MALE/FEMALE)' })
  @IsEnum(Gender)
  gender: Gender;

  @ApiProperty({ description: 'Массив доступных размеров' })
  @IsArray()
  @IsNumber({}, { each: true })
  sizes: number[];

  @ApiProperty({ description: 'Цена' })
  @IsNumber()
  @IsNotEmpty()
  price: number;
} 