import { ConflictException } from '@nestjs/common';
import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { Prisma } from '../../generated/prisma/client.js';
import { PrismaService } from '../../prisma/prisma.service.js';
import { hashPassword } from '../password.js';
import { AccessToken, TokenService } from '../token.service.js';
import { RegisterUserCommand } from './register-user.command.js';

@CommandHandler(RegisterUserCommand)
export class RegisterUserHandler implements ICommandHandler<
  RegisterUserCommand,
  AccessToken
> {
  constructor(
    private readonly prisma: PrismaService,
    private readonly tokens: TokenService,
  ) {}

  async execute({ email, password }: RegisterUserCommand) {
    try {
      const user = await this.prisma.user.create({
        data: { email, passwordHash: await hashPassword(password) },
      });
      return await this.tokens.issue(user);
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002'
      ) {
        throw new ConflictException('Email already registered');
      }
      throw error;
    }
  }
}
