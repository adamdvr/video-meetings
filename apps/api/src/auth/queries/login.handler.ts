import { UnauthorizedException } from '@nestjs/common';
import { IQueryHandler, QueryHandler } from '@nestjs/cqrs';
import { PrismaService } from '../../prisma/prisma.service.js';
import { hashPassword, verifyPassword } from '../password.js';
import { AccessToken, TokenService } from '../token.service.js';
import { LoginQuery } from './login.query.js';

// Хеш для сравнения, когда пользователя нет: время ответа не выдаёт, существует ли email.
const dummyHash = await hashPassword('dummy-password');

// Логин ничего не меняет в базе (пользователь только ищется), поэтому это запрос, а не команда.
@QueryHandler(LoginQuery)
export class LoginHandler implements IQueryHandler<LoginQuery, AccessToken> {
  constructor(
    private readonly prisma: PrismaService,
    private readonly tokens: TokenService,
  ) {}

  async execute({ email, password }: LoginQuery) {
    const user = await this.prisma.user.findUnique({ where: { email } });
    const valid = await verifyPassword(
      password,
      user?.passwordHash ?? dummyHash,
    );
    if (!user || !valid) {
      throw new UnauthorizedException('Invalid credentials');
    }
    return this.tokens.issue(user);
  }
}
