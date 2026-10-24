import { Body, Controller, HttpCode, HttpStatus, Post } from '@nestjs/common';
import { CommandBus, QueryBus } from '@nestjs/cqrs';
import { RegisterUserCommand } from './commands/register-user.command.js';
import { LoginDto } from './dto/login.dto.js';
import { RegisterDto } from './dto/register.dto.js';
import { AccessToken } from './token.service.js';
import { LoginQuery } from './queries/login.query.js';

@Controller('auth')
export class AuthController {
  constructor(
    private readonly commandBus: CommandBus,
    private readonly queryBus: QueryBus,
  ) {}

  @Post('register')
  register(@Body() { email, password }: RegisterDto): Promise<AccessToken> {
    return this.commandBus.execute(new RegisterUserCommand(email, password));
  }

  @Post('login')
  @HttpCode(HttpStatus.OK)
  login(@Body() { email, password }: LoginDto): Promise<AccessToken> {
    return this.queryBus.execute(new LoginQuery(email, password));
  }
}
