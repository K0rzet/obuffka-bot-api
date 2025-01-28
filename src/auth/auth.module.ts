import { Module } from '@nestjs/common'
import { PassportModule } from '@nestjs/passport'
import { JwtModule } from '@nestjs/jwt'
import { ConfigModule, ConfigService } from '@nestjs/config'
import { AuthService } from './auth.service'
import { AuthController } from './auth.controller'
import { UserModule } from '../user/user.module'
import { JwtStrategy } from '../strategies/jwt.strategy'
import { getJWTConfig } from '../config/jwt.config'
import { PrismaService } from 'src/prisma/prisma.service'

@Module({
	imports: [
		UserModule,
		PassportModule.register({ defaultStrategy: 'jwt' }),
		JwtModule.registerAsync({
			imports: [ConfigModule],
			inject: [ConfigService],
			useFactory: getJWTConfig
		})
	],
	controllers: [AuthController],
	providers: [AuthService, JwtStrategy, ConfigService, PrismaService],
	exports: [AuthService]
})
export class AuthModule {}
