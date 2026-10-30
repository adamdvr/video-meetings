import { IQueryHandler, QueryHandler } from '@nestjs/cqrs';
import { PrismaService } from '../../prisma/prisma.service.js';
import { toUserView, UserView } from '../user.view.js';
import { FindUserByEmailQuery } from './find-user-by-email.query.js';

@QueryHandler(FindUserByEmailQuery)
export class FindUserByEmailHandler implements IQueryHandler<
  FindUserByEmailQuery,
  UserView | null
> {
  constructor(private readonly prisma: PrismaService) {}

  async execute({ email }: FindUserByEmailQuery) {
    const user = await this.prisma.user.findUnique({ where: { email } });
    return user ? toUserView(user) : null;
  }
}
