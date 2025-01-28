import { ApiProperty } from '@nestjs/swagger';
import { IsOptional, IsEnum, IsString, IsNumber, IsArray } from 'class-validator';
import { Transform, Type } from 'class-transformer';
import { Gender } from '@prisma/client';

export enum SortOrder {
  ASC = 'asc',
  DESC = 'desc'
}

export class FilterShoesDto {
  @ApiProperty({ required: false, description: 'Название обуви' })
  @IsOptional()
  @IsString()
  name?: string;

  @ApiProperty({ required: false, description: 'Описание обуви' })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiProperty({ required: false, description: 'Цвета обуви (через запятую)', example: 'красный,синий,черный' })
  @IsOptional()
  @IsArray()
  @Transform(({ value }) => {
    if (typeof value === 'string') {
      return value.split(',').map(color => color.trim().toLowerCase());
    }
    return value;
  })
  colors?: string[];

  @ApiProperty({ required: false, enum: Gender, description: 'Пол (MALE/FEMALE)' })
  @IsOptional()
  @IsEnum(Gender)
  @Transform(({ value }) => value?.toUpperCase())
  gender?: Gender;

  @ApiProperty({ required: false, description: 'Размеры обуви' })
  @IsOptional()
  @IsArray()
  @Transform(({ value }) => typeof value === 'string' ? value.split(',').map(Number) : value)
  sizes?: number[];

  @ApiProperty({ required: false, description: 'Минимальная цена' })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  minPrice?: number;

  @ApiProperty({ required: false, description: 'Максимальная цена' })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  maxPrice?: number;

  @ApiProperty({ required: false, enum: SortOrder, description: 'Сортировка по цене' })
  @IsOptional()
  @IsEnum(SortOrder)
  @Transform(({ value }) => value?.toLowerCase())
  priceSort?: SortOrder;
} 