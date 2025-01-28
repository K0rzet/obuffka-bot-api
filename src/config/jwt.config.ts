import { JwtModuleOptions } from '@nestjs/jwt';

export const getJWTConfig = (): JwtModuleOptions => ({
  secret: process.env.JWT_SECRET,
  signOptions: { expiresIn: '30d' },
}); 