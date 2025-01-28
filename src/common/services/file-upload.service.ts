import { Injectable } from '@nestjs/common';
import { existsSync, mkdirSync, unlinkSync } from 'fs';
import { join } from 'path';
import { v4 as uuid } from 'uuid';

@Injectable()
export class FileUploadService {
  private readonly uploadPath = join(process.cwd(), 'uploads', 'shoes');

  constructor() {
    // Создаем директорию для загрузок, если она не существует
    if (!existsSync(this.uploadPath)) {
      mkdirSync(this.uploadPath, { recursive: true });
    }
  }

  async uploadFile(file: Express.Multer.File): Promise<string> {
    const fileExtension = file.originalname.split('.').pop();
    const fileName = `${uuid()}.${fileExtension}`;
    const filePath = join(this.uploadPath, fileName);

    // Сохраняем файл
    await require('fs').promises.writeFile(filePath, file.buffer);

    // Возвращаем путь к файлу относительно /uploads/shoes
    return `/uploads/shoes/${fileName}`;
  }

  async deleteFile(fileUrl: string): Promise<void> {
    if (!fileUrl) return;

    const fileName = fileUrl.split('/').pop();
    if (!fileName) return;

    const filePath = join(this.uploadPath, fileName);

    // Проверяем существование файла перед удалением
    if (existsSync(filePath)) {
      unlinkSync(filePath);
    }
  }
} 