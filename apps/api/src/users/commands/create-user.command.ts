import { Command } from '@nestjs/cqrs';
import type { UserView } from '../user.view.js';

export class CreateUserCommand extends Command<UserView> {
  constructor(
    public readonly email: string,
    public readonly passwordHash: string,
  ) {
    super();
  }
}
