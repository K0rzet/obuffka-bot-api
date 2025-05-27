import { PartialType } from '@nestjs/swagger';
import { CreateShoeDto } from './create-shoe.dto';
import { IsOptional, IsArray, IsString } from 'class-validator';
import { Transform } from 'class-transformer';

export class UpdateShoeDto extends PartialType(CreateShoeDto) {
  @IsOptional()
  @Transform(({ value }) => {
    if (typeof value === 'string') {
      try {
        return JSON.parse(value);
      } catch {
        return [];
      }
    }
    return Array.isArray(value) ? value : [];
  })
  @IsArray()
  @IsString({ each: true })
  existingImages?: string[]; // URL существующих изображений, которые нужно сохранить

  @IsOptional()
  @Transform(({ value }) => {
    if (typeof value === 'string') {
      try {
        return JSON.parse(value);
      } catch {
        return [];
      }
    }
    return Array.isArray(value) ? value : [];
  })
  @IsArray()
  @IsString({ each: true })
  imagesToDelete?: string[]; // URL изображений, которые нужно удалить
} 