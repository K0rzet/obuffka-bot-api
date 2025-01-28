import {
	CanActivate,
	ExecutionContext,
	ForbiddenException,
	Injectable
} from '@nestjs/common'
import { PrismaService } from 'src/prisma/prisma.service'

@Injectable()
export class OnlyAdminGuard implements CanActivate {
	constructor(private prisma: PrismaService) {}

	async canActivate(context: ExecutionContext): Promise<boolean> {
		const request = context.switchToHttp().getRequest()
		const userId = request.user.id

		const user = await this.prisma.user.findUnique({
			where: { id: userId },
			select: { isAdmin: true }
		})

		if (!user || !user.isAdmin) {
			throw new ForbiddenException('You have no rights!')
		}

		return user.isAdmin
	}
}
