import { CommandBus, CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { CreateUserCommand } from '../../users/commands/create-user.command.js';
import { hashPassword } from '../password.js';
import { AccessToken, TokenService } from '../token.service.js';
import { RegisterUserCommand } from './register-user.command.js';

@CommandHandler(RegisterUserCommand)
export class RegisterUserHandler implements ICommandHandler<
  RegisterUserCommand,
  AccessToken
> {
  constructor(
    private readonly commandBus: CommandBus,
    private readonly tokens: TokenService,
  ) {}

  async execute({ email, password }: RegisterUserCommand) {
    const user = await this.commandBus.execute(
      new CreateUserCommand(email, await hashPassword(password)),
    );
    return this.tokens.issue(user);
  }
}
