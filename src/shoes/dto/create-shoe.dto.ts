import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsEnum, IsArray, IsNumber, IsNotEmpty } from 'class-validator';
import { Gender } from '@prisma/client';
import { Transform, Type } from 'class-transformer';

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
  @Transform(({ value }) => value?.toUpperCase())
  gender: Gender;

  @ApiProperty({ description: 'Массив доступных размеров' })
  @Transform(({ value }) => {
    if (typeof value === 'string') {
      return JSON.parse(value);
    }
    return value;
  })
  @IsArray()
  @IsNumber({}, { each: true })
  sizes: number[];

  @ApiProperty({ description: 'Цена' })
  @Type(() => Number)
  @IsNumber()
  @IsNotEmpty()
  price: number;

  @ApiProperty({ type: 'array', items: { type: 'string', format: 'binary' }, required: false })
  images?: any[];
} 