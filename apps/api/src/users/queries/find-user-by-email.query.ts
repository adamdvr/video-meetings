import { Query } from '@nestjs/cqrs';
import type { UserView } from '../user.view.js';

export class FindUserByEmailQuery extends Query<UserView | null> {
  constructor(public readonly email: string) {
    super();
  }
}
