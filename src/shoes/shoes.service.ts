import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateShoeDto } from './dto/create-shoe.dto';
import { PaginationDto } from '../common/dto/pagination.dto';
import { FilterShoesDto, SortOrder } from './dto/filter-shoes.dto';
import { Prisma, Shoe } from '@prisma/client';

@Injectable()
export class ShoesService {
  constructor(private prisma: PrismaService) {}

  async create(createShoeDto: CreateShoeDto): Promise<Shoe> {
    return this.prisma.shoe.create({
      data: createShoeDto,
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
