import { Controller, Get, Post, Body, Put, Param, Delete, Query } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { ShoesService } from './shoes.service';
import { CreateShoeDto } from './dto/create-shoe.dto';
import { PaginationDto } from '../common/dto/pagination.dto';
import { Auth } from '../auth/decorators/auth.decorator';

@ApiTags('shoes')
@Controller('shoes')
export class ShoesController {
  constructor(private readonly shoesService: ShoesService) {}

  @Post()
  @Auth('admin')
  @ApiOperation({ summary: 'Создать новую обувь' })
  @ApiResponse({ status: 201, description: 'Обувь успешно создана' })
  create(@Body() createShoeDto: CreateShoeDto) {
    return this.shoesService.create(createShoeDto);
  }

  @Get()
  @ApiOperation({ summary: 'Получить список всей обуви' })
  @ApiResponse({ status: 200, description: 'Возвращает список обуви' })
  findAll(@Query() pagination: PaginationDto) {
    return this.shoesService.findAll(pagination);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Получить обувь по ID' })
  @ApiResponse({ status: 200, description: 'Возвращает обувь по ID' })
  findOne(@Param('id') id: string) {
    return this.shoesService.findOne(+id);
  }

  @Put(':id')
  @Auth('admin')
  @ApiOperation({ summary: 'Обновить обувь' })
  @ApiResponse({ status: 200, description: 'Обувь успешно обновлена' })
  update(@Param('id') id: string, @Body() updateShoeDto: CreateShoeDto) {
    return this.shoesService.update(+id, updateShoeDto);
  }

  @Delete(':id')
  @Auth('admin')
  @ApiOperation({ summary: 'Удалить обувь' })
  @ApiResponse({ status: 200, description: 'Обувь успешно удалена' })
  remove(@Param('id') id: string) {
    return this.shoesService.remove(+id);
  }
}
