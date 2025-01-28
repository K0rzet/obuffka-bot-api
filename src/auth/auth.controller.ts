import { AuthService } from './auth.service'
import { Body, Controller, Get, HttpStatus, Post, Req } from '@nestjs/common'
import { ApiOperation, ApiResponse } from '@nestjs/swagger'
import { Auth } from './decorators/auth.decorator'
import { User } from '@prisma/client'
import { UserService } from 'src/user/user.service'
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger'
@ApiTags('auth')
@ApiBearerAuth('access-token')
@Controller('auth')
export class AuthController {
	constructor(
		private readonly authService: AuthService,
		private readonly userService: UserService
	) {}

	@Post('login')
	async login(@Body() body: { initData: string }) {
		const response = await this.authService.login(body.initData)
		return response
	}

	@Get('me')
	@ApiOperation({ summary: 'Get the current user' })
	@ApiResponse({
		status: HttpStatus.OK,
		description: 'Returns the current user'
	})
	@ApiResponse({ status: HttpStatus.UNAUTHORIZED, description: 'Unauthorized' })
	@ApiResponse({
		status: HttpStatus.INTERNAL_SERVER_ERROR,
		description: 'Internal server error'
	})
	@Auth('user')
	async getCurrentUser(@Req() req: Request): Promise<User> {
		return this.userService.getUserById(req['user'].id)
	}
}
