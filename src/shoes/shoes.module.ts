import { Module } from '@nestjs/common';
import { ShoesService } from './shoes.service';
import { ShoesController } from './shoes.controller';
import { PrismaModule } from '../prisma/prisma.module';
import { FileUploadService } from '../common/services/file-upload.service';
import { ConfigModule } from '@nestjs/config';

@Module({
  imports: [PrismaModule, ConfigModule],
  controllers: [ShoesController],
  providers: [ShoesService, FileUploadService],
})
export class ShoesModule {}
