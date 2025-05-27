import {
	Injectable,
	NotFoundException,
	UnauthorizedException,
	Logger
} from '@nestjs/common'
import { JwtService } from '@nestjs/jwt'
import { parse, validate } from '@telegram-apps/init-data-node'
import { UserService } from 'src/user/user.service'

@Injectable()
export class AuthService {
	private readonly logger = new Logger(AuthService.name);

	constructor(
		private readonly userService: UserService,
		private readonly jwtService: JwtService
	) {}

	async login(initData: string) {
		const botToken = process.env.TELEGRAM_TOKEN;

		if (!botToken) {
			this.logger.error('TELEGRAM_TOKEN не установлен в переменных окружения');
			throw new UnauthorizedException('Ошибка конфигурации сервера');
		}

		// В режиме разработки можем пропустить валидацию для тестирования
		if (process.env.NODE_ENV === 'development' && initData === 'test-init-data') {
			this.logger.warn('Используется тестовый режим авторизации');
			const testUser = await this.createTestUser();
			const payload = { id: testUser.id };
			
			return {
				user: testUser,
				token: await this.jwtService.signAsync(payload)
			};
		}

		try {
			// Валидируем данные от Telegram
			validate(initData, botToken, {
				expiresIn: 60 * 60 * 24 // 24 часа
			});

			const parsedData = parse(initData);
			
			if (!parsedData.user) {
				throw new UnauthorizedException('Отсутствуют данные пользователя в initData');
			}

			this.logger.log(`Авторизация пользователя: ${parsedData.user.id} (${parsedData.user.username})`);

			const { user } = await this.userService.findOrCreateUser(
				parsedData.user.id,
				parsedData.user.username,
				parsedData.user.first_name,
				parsedData.user.last_name
			);

			const payload = { id: user.id };

			return {
				user: user,
				token: await this.jwtService.signAsync(payload)
			};
		} catch (error) {
			this.logger.error(`Ошибка авторизации: ${error.message}`);
			
			if (error.message.includes('expired')) {
				throw new UnauthorizedException('Данные авторизации устарели. Перезапустите приложение.');
			}
			
			if (error.message.includes('invalid')) {
				throw new UnauthorizedException('Недействительные данные авторизации');
			}

			throw new UnauthorizedException(`Ошибка авторизации: ${error.message}`);
		}
	}

	private async createTestUser() {
		// Создаем или находим тестового пользователя
		const testTelegramId = 123456789;
		let user = await this.userService.findByTelegramId(testTelegramId);
		
		if (!user) {
			user = await this.userService.create(
				testTelegramId,
				'testuser',
				'Test',
				'User'
			);
			
			// Делаем тестового пользователя админом
			user = await this.userService.setUserIsAdmin(user.id, true);
		}
		
		return user;
	}

	async getUserById(id: number) {
		const user = await this.userService.getUserById(id);

		if (!user) {
			throw new NotFoundException('Пользователь не найден');
		}

		return user;
	}
}
