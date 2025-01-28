import { Controller, Get, HttpStatus, Param, Post, Put, Patch, Body, Query, ParseIntPipe } from '@nestjs/common';
import { UserService } from './user.service';
import { ApiOperation, ApiResponse, ApiTags, ApiQuery, ApiBearerAuth, ApiParam } from '@nestjs/swagger';
import { UpdateBalanceDto } from './dto/update-balance.dto';
import { Auth } from '../auth/decorators/auth.decorator';
import { PaginationDto } from '../common/dto/pagination.dto';
import { User } from '@prisma/client';
import { PaginatedResponse } from '../common/interfaces/paginated-response.interface';

@ApiTags('users')
@Controller('users')
@ApiBearerAuth('access-token')
export class UserController {
  constructor(private readonly userService: UserService) {}

  @Get()
  @Auth('admin')
  @ApiOperation({ summary: 'Get all users' })
  @ApiResponse({ status: 200, description: 'Returns all users' })
  @ApiQuery({
    name: 'username',
    required: false,
    type: String,
    description: 'Фильтр по имени пользователя'
  })
  @ApiQuery({
    name: 'page',
    required: false,
    type: Number,
    description: 'Номер страницы'
  })
  @ApiQuery({
    name: 'limit',
    required: false,
    type: Number,
    description: 'Количество записей на странице'
  })
  async getAllUsers(
    @Query() pagination: PaginationDto,
    @Query('username') username?: string,
  ): Promise<PaginatedResponse<User>> {
    return this.userService.getAllUsers(username, pagination);
  }

  @Auth('admin')
  @Get(':id')
  @ApiOperation({ summary: 'Get user by ID' })
  @ApiResponse({ status: 200, description: 'Returns user by ID' })
  @ApiParam({ name: 'id', type: Number, description: 'User ID' })
  async getUserById(@Param('id', ParseIntPipe) id: number): Promise<User> {
    return this.userService.getUserById(id);
  }

  @Put("set_admin/:id")
	@ApiOperation({ summary: 'Set User isAdmin: true' })
  update(
		@Param('id') id: number
  ) {
		return this.userService.setUserIsAdmin(Number(id), true)
	}

  @Post('ban/:username')
  @Auth('admin')
  @ApiOperation({ summary: 'Ban user' })
  @ApiResponse({ status: 200, description: 'User banned successfully' })
  @ApiResponse({ status: 404, description: 'User not found' })
  @ApiResponse({ status: 403, description: 'Access denied' })
  @ApiResponse({ status: 409, description: 'User already banned' })
  banUser(@Param('username') username: string) {
    return this.userService.banUser(username)
  }

  @Post('unban/:username')
  @Auth('admin')
  @ApiOperation({ summary: 'Unban user' })
  @ApiResponse({ status: 200, description: 'User unbanned successfully' })
  @ApiResponse({ status: 404, description: 'User not found' })
  @ApiResponse({ status: 403, description: 'Access denied' })
  @ApiResponse({ status: 409, description: 'User already unbanned' })
  unbanUser(@Param('username') username: string) {
    return this.userService.unbanUser(username)
  }
}
