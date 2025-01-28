import { Injectable, NotFoundException, Logger } from '@nestjs/common'
import { PrismaService } from '../prisma/prisma.service'
import { Prisma, User } from '@prisma/client'
import { PaginationDto, PaginatedResponse } from '../common/dto/pagination.dto'

@Injectable()
export class UserService {
	private readonly logger = new Logger(UserService.name);

	constructor(private readonly prisma: PrismaService) {}

	async findByTelegramId(telegramId: number) {
		return this.prisma.user.findUnique({
			where: { telegramId: telegramId.toString() },
		});
	}

	async create(telegramId: number, username?: string) {
		return this.prisma.user.create({
			data: {
				telegramId: telegramId.toString(),
				username,
			},
		});
	}

	async findAll(pagination: PaginationDto): Promise<PaginatedResponse<User>> {
		const { page = 1, limit = 10 } = pagination;
		const skip = (page - 1) * limit;

		const [total, users] = await Promise.all([
			this.prisma.user.count(),
			this.prisma.user.findMany({
				skip,
				take: limit,
				orderBy: {
					createdAt: 'desc',
				},
			}),
		]);

		return {
			data: users,
			meta: {
				total,
				page,
				lastPage: Math.ceil(total / limit),
			},
		};
	}

	async setAdmin(telegramId: number, isAdmin: boolean) {
		return this.prisma.user.update({
			where: { telegramId: telegramId.toString() },
			data: { isAdmin },
		});
	}

	async ban(telegramId: number) {
		return this.prisma.user.update({
			where: { telegramId: telegramId.toString() },
			data: { isBanned: true },
		});
	}

	async unban(telegramId: number) {
		return this.prisma.user.update({
			where: { telegramId: telegramId.toString() },
			data: { isBanned: false },
		});
	}
	async getUserById(userId: number) {
		const user = await this.prisma.user.findUnique({
			where: { id: userId }
		})

		if (!user) {
			throw new NotFoundException(`User with ID ${userId} not found`);
		}

		return user
	}

	async getAllUsers(username?: string, pagination: PaginationDto = { page: 1, limit: 10 }): Promise<PaginatedResponse<User>> {
		const where = username ? {
			username: {
				contains: username,
				mode: Prisma.QueryMode.insensitive
			}
		} : {};

		const { page = 1, limit = 10 } = pagination;
		const skip = (page - 1) * limit;

		const [items, total] = await Promise.all([
			this.prisma.user.findMany({
				where,
				orderBy: [
					{ createdAt: 'desc' }
				],
				skip,
				take: limit
			}),
			this.prisma.user.count({ where })
		]);

		return {
			data: items,
			meta: {
				total,
				page,
				lastPage: Math.ceil(total / limit),
			}
		};
	}

	async setUserIsAdmin(userId: number, isAdmin: boolean) {
		return this.prisma.user.update({
			where: { id: userId },
			data: { isAdmin }
		});
	}

	async banUser(username: string) {
		const user = await this.prisma.user.findFirst({
			where: { username }
		});

		if (!user) {
			throw new NotFoundException(`User @${username} not found`);
		}

		return this.prisma.user.update({
			where: { id: user.id },
			data: { isBanned: true }
		});
	}

	async unbanUser(username: string) {
		const user = await this.prisma.user.findFirst({
			where: { username }
		});

		if (!user) {
			throw new NotFoundException(`User @${username} not found`);
		}

		return this.prisma.user.update({
			where: { id: user.id },
			data: { isBanned: false }
		});
	}

	async findOrCreateUser(telegramId: number, username?: string) {
		const user = await this.findByTelegramId(telegramId);
		if (user) return { user };
		
		const newUser = await this.create(telegramId, username);
		return { user: newUser };
	}
}
