import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateShoeDto } from './dto/create-shoe.dto';
import { PaginationDto } from '../common/dto/pagination.dto';
import { Shoe } from '@prisma/client';

@Injectable()
export class ShoesService {
  constructor(private prisma: PrismaService) {}

  async create(createShoeDto: CreateShoeDto): Promise<Shoe> {
    return this.prisma.shoe.create({
      data: createShoeDto,
    });
  }

  async findAll(pagination: PaginationDto) {
    const { page = 1, limit = 10 } = pagination;
    const skip = (page - 1) * limit;

    const [total, shoes] = await Promise.all([
      this.prisma.shoe.count(),
      this.prisma.shoe.findMany({
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
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

  async update(id: number, updateShoeDto: CreateShoeDto): Promise<Shoe> {
    try {
      return await this.prisma.shoe.update({
        where: { id },
        data: updateShoeDto,
      });
    } catch (error) {
      throw new NotFoundException(`Обувь с ID ${id} не найдена`);
    }
  }

  async remove(id: number): Promise<Shoe> {
    try {
      return await this.prisma.shoe.delete({
        where: { id },
      });
    } catch (error) {
      throw new NotFoundException(`Обувь с ID ${id} не найдена`);
    }
  }
}
