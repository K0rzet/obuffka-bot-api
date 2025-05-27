import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateShoeDto } from './dto/create-shoe.dto';
import { UpdateShoeDto } from './dto/update-shoe.dto';
import { PaginationDto } from '../common/dto/pagination.dto';
import { FilterShoesDto, SortOrder } from './dto/filter-shoes.dto';
import { Prisma, Shoe } from '@prisma/client';
import { FileUploadService } from '../common/services/file-upload.service';

@Injectable()
export class ShoesService {
  constructor(
    private prisma: PrismaService,
    private fileUploadService: FileUploadService
  ) {}

  async create(createShoeDto: CreateShoeDto, files: Express.Multer.File[]): Promise<Shoe> {
    const imageUrls = await Promise.all(
      files.map(file => this.fileUploadService.uploadFile(file))
    );

    return this.prisma.shoe.create({
      data: {
        ...createShoeDto,
        images: imageUrls,
      },
    });
  }

  async findAll(pagination: PaginationDto, filters: FilterShoesDto) {
    const { page = 1, limit = 10 } = pagination;
    const skip = (page - 1) * limit;

    const where: Prisma.ShoeWhereInput = {};

    if (filters.name) {
      where.name = {
        contains: filters.name,
        mode: 'insensitive'
      };
    }

    if (filters.description) {
      where.description = {
        contains: filters.description,
        mode: 'insensitive'
      };
    }

    if (filters.colors?.length) {
      where.OR = filters.colors.map(color => ({
        color: {
          contains: color,
          mode: 'insensitive'
        }
      }));
    }

    if (filters.gender) {
      where.gender = filters.gender;
    }

    if (filters.sizes?.length) {
      where.sizes = {
        hasSome: filters.sizes
      };
    }

    if (filters.minPrice !== undefined || filters.maxPrice !== undefined) {
      where.price = {};
      if (filters.minPrice !== undefined) {
        where.price.gte = filters.minPrice;
      }
      if (filters.maxPrice !== undefined) {
        where.price.lte = filters.maxPrice;
      }
    }

    const orderBy: Prisma.ShoeOrderByWithRelationInput[] = [
      { createdAt: 'desc' }
    ];

    if (filters.priceSort) {
      orderBy.unshift({ price: filters.priceSort });
    }

    const [total, shoes] = await Promise.all([
      this.prisma.shoe.count({ where }),
      this.prisma.shoe.findMany({
        where,
        orderBy,
        skip,
        take: limit,
      }),
    ]);

    return {
      data: shoes,
      meta: {
        total,
        page,
        lastPage: Math.ceil(total / limit),
      },
    };
  }

  async findOne(id: number): Promise<Shoe> {
    const shoe = await this.prisma.shoe.findUnique({
      where: { id },
    });

    if (!shoe) {
      throw new NotFoundException(`Обувь с ID ${id} не найдена`);
    }

    return shoe;
  }

  async update(id: number, updateShoeDto: UpdateShoeDto, files?: Express.Multer.File[]): Promise<Shoe> {
    const shoe = await this.prisma.shoe.findUnique({ where: { id } });
    if (!shoe) {
      throw new NotFoundException(`Обувь с ID ${id} не найдена`);
    }

    let finalImages = [...shoe.images];

    // Удаляем указанные изображения
    if (updateShoeDto.imagesToDelete?.length) {
      for (const imageUrl of updateShoeDto.imagesToDelete) {
        await this.fileUploadService.deleteFile(imageUrl);
        finalImages = finalImages.filter(url => url !== imageUrl);
      }
    }

    // Если указаны существующие изображения, используем только их
    if (updateShoeDto.existingImages) {
      finalImages = updateShoeDto.existingImages;
    }

    // Добавляем новые изображения
    if (files?.length) {
      const newImageUrls = await Promise.all(
        files.map(file => this.fileUploadService.uploadFile(file))
      );
      finalImages = [...finalImages, ...newImageUrls];
    }

    // Подготавливаем данные для обновления
    const updateData: any = {};
    
    if (updateShoeDto.name !== undefined) updateData.name = updateShoeDto.name;
    if (updateShoeDto.description !== undefined) updateData.description = updateShoeDto.description;
    if (updateShoeDto.color !== undefined) updateData.color = updateShoeDto.color;
    if (updateShoeDto.gender !== undefined) updateData.gender = updateShoeDto.gender;
    if (updateShoeDto.sizes !== undefined) updateData.sizes = updateShoeDto.sizes;
    if (updateShoeDto.price !== undefined) updateData.price = updateShoeDto.price;
    
    updateData.images = finalImages;

    return this.prisma.shoe.update({
      where: { id },
      data: updateData,
    });
  }

  async remove(id: number): Promise<Shoe> {
    const shoe = await this.prisma.shoe.findUnique({ where: { id } });
    if (!shoe) {
      throw new NotFoundException(`Обувь с ID ${id} не найдена`);
    }

    // Удаляем изображения перед удалением записи
    await Promise.all(
      shoe.images.map(url => this.fileUploadService.deleteFile(url))
    );

    return this.prisma.shoe.delete({ where: { id } });
  }

  async removeImages(id: number, imageUrls: string[]): Promise<Shoe> {
    const shoe = await this.prisma.shoe.findUnique({ where: { id } });
    if (!shoe) {
      throw new NotFoundException(`Обувь с ID ${id} не найдена`);
    }

    // Удаляем файлы
    await Promise.all(
      imageUrls.map(url => this.fileUploadService.deleteFile(url))
    );

    // Обновляем список изображений в базе данных
    const updatedImages = shoe.images.filter(url => !imageUrls.includes(url));

    return this.prisma.shoe.update({
      where: { id },
      data: { images: updatedImages },
    });
  }

  async addImages(id: number, files: Express.Multer.File[]): Promise<Shoe> {
    const shoe = await this.prisma.shoe.findUnique({ where: { id } });
    if (!shoe) {
      throw new NotFoundException(`Обувь с ID ${id} не найдена`);
    }

    const newImageUrls = await Promise.all(
      files.map(file => this.fileUploadService.uploadFile(file))
    );

    const updatedImages = [...shoe.images, ...newImageUrls];

    return this.prisma.shoe.update({
      where: { id },
      data: { images: updatedImages },
    });
  }
}
