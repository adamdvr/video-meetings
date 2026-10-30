import { Module } from '@nestjs/common';
import { CqrsModule } from '@nestjs/cqrs';
import { CreateUserHandler } from './commands/create-user.handler.js';
import { FindUserByEmailHandler } from './queries/find-user-by-email.handler.js';

@Module({
  imports: [CqrsModule],
  providers: [CreateUserHandler, FindUserByEmailHandler],
})
export class UsersModule {}
