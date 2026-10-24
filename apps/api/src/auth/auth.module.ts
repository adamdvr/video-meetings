import { Module } from '@nestjs/common';
import { CqrsModule } from '@nestjs/cqrs';
import { JwtModule } from '@nestjs/jwt';
import { getConfig } from '../config/configuration.js';
import { AuthController } from './auth.controller.js';
import { RegisterUserHandler } from './commands/register-user.handler.js';
import { LoginHandler } from './queries/login.handler.js';
import { TokenService } from './token.service.js';

@Module({
  imports: [
    CqrsModule,
    JwtModule.register({
      global: true,
      secret: getConfig().jwtSecret,
      signOptions: { expiresIn: getConfig().jwtExpiresInSeconds },
    }),
  ],
  controllers: [AuthController],
  providers: [TokenService, RegisterUserHandler, LoginHandler],
})
export class AuthModule {}
