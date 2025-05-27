import { Controller, Get, Post, Body, Put, Param, Delete, Query, UseInterceptors, UploadedFiles, ParseFilePipeBuilder, MaxFileSizeValidator, FileTypeValidator } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiQuery, ApiConsumes, ApiBody } from '@nestjs/swagger';
import { ShoesService } from './shoes.service';
import { CreateShoeDto } from './dto/create-shoe.dto';
import { UpdateShoeDto } from './dto/update-shoe.dto';
import { PaginationDto } from '../common/dto/pagination.dto';
import { FilterShoesDto, SortOrder } from './dto/filter-shoes.dto';
import { Auth } from '../auth/decorators/auth.decorator';
import { Transform } from 'class-transformer';
import { FilesInterceptor } from '@nestjs/platform-express';

@ApiTags('shoes')
@Controller('shoes')
export class ShoesController {
  constructor(private readonly shoesService: ShoesService) {}

  @Post()
  @Auth('admin')
  @UseInterceptors(FilesInterceptor('images', 10))
  @ApiConsumes('multipart/form-data')
  @ApiOperation({ summary: 'Создать новую обувь' })
  @ApiResponse({ status: 201, description: 'Обувь успешно создана' })
  async create(
    @Body() createShoeDto: CreateShoeDto,
    @UploadedFiles(
      new ParseFilePipeBuilder()
        .addValidator(
          new MaxFileSizeValidator({ maxSize: 1024 * 1024 * 5 })
        )
        .addValidator(
          new FileTypeValidator({ fileType: /(jpg|jpeg|png|webp)$/ })
        )
        .build({ fileIsRequired: false }),
    ) files: Express.Multer.File[] = [],
  ) {
    const transformedDto = {
      ...createShoeDto,
      price: +createShoeDto.price,
      sizes: Array.isArray(createShoeDto.sizes) 
        ? createShoeDto.sizes 
        : JSON.parse(createShoeDto.sizes as string),
    };

    return this.shoesService.create(transformedDto, files);
  }

  @Get()
  @ApiOperation({ summary: 'Получить список всей обуви' })
  @ApiResponse({ status: 200, description: 'Возвращает список обуви' })
  @ApiQuery({ type: FilterShoesDto })
  findAll(
    @Query() pagination: PaginationDto,
    @Query() filters: FilterShoesDto
  ) {
    return this.shoesService.findAll(pagination, filters);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Получить обувь по ID' })
  @ApiResponse({ status: 200, description: 'Возвращает обувь по ID' })
  findOne(@Param('id') id: string) {
    return this.shoesService.findOne(+id);
  }

  @Put(':id')
  @Auth('admin')
  @UseInterceptors(FilesInterceptor('images', 10))
  @ApiConsumes('multipart/form-data')
  @ApiOperation({ summary: 'Обновить обувь' })
  @ApiResponse({ status: 200, description: 'Обувь успешно обновлена' })
  async update(
    @Param('id') id: string,
    @Body() updateShoeDto: UpdateShoeDto,
    @UploadedFiles(
      new ParseFilePipeBuilder()
        .addValidator(
          new MaxFileSizeValidator({ maxSize: 1024 * 1024 * 5 })
        )
        .addValidator(
          new FileTypeValidator({ fileType: /(jpg|jpeg|png|webp)$/ })
        )
        .build({ fileIsRequired: false }),
    ) files: Express.Multer.File[] = [],
  ) {
    const transformedDto = {
      ...updateShoeDto,
      price: updateShoeDto.price ? +updateShoeDto.price : undefined,
      sizes: updateShoeDto.sizes 
        ? Array.isArray(updateShoeDto.sizes) 
          ? updateShoeDto.sizes 
          : JSON.parse(updateShoeDto.sizes as string)
        : undefined,
    };

    return this.shoesService.update(+id, transformedDto, files);
  }

  @Delete(':id')
  @Auth('admin')
  @ApiOperation({ summary: 'Удалить обувь' })
  @ApiResponse({ status: 200, description: 'Обувь успешно удалена' })
  remove(@Param('id') id: string) {
    return this.shoesService.remove(+id);
  }

  @Delete(':id/images')
  @Auth('admin')
  @ApiOperation({ summary: 'Удалить конкретные изображения товара' })
  @ApiResponse({ status: 200, description: 'Изображения удалены' })
  async removeImages(
    @Param('id') id: string,
    @Body() body: { imageUrls: string[] }
  ) {
    return this.shoesService.removeImages(+id, body.imageUrls);
  }
}
