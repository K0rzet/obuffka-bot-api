import { PartialType } from '@nestjs/swagger';
import { CreateShoeDto } from './create-shoe.dto';
import { IsOptional, IsArray, IsString } from 'class-validator';

export class UpdateShoeDto extends PartialType(CreateShoeDto) {
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  existingImages?: string[]; // URL существующих изображений, которые нужно сохранить

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  imagesToDelete?: string[]; // URL изображений, которые нужно удалить
} 