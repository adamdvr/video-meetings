import { randomUUID } from 'node:crypto';
import { ConflictException, INestApplication } from '@nestjs/common';
import { CommandBus, QueryBus } from '@nestjs/cqrs';
import { Test, TestingModule } from '@nestjs/testing';
import { AppModule } from './../src/app.module.js';
import { CreateUserCommand } from './../src/users/commands/create-user.command.js';
import { FindUserByEmailQuery } from './../src/users/queries/find-user-by-email.query.js';

const PASSWORD_HASH = 'scrypt$00$11';

const uniqueEmail = () => `user-${randomUUID()}@example.com`;

describe('Users (e2e)', () => {
  let app: INestApplication;
  let commandBus: CommandBus;
  let queryBus: QueryBus;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    await app.init();
    commandBus = app.get(CommandBus);
    queryBus = app.get(QueryBus);
  });

  afterAll(async () => {
    await app.close();
  });

  const createUser = (email = uniqueEmail(), passwordHash = PASSWORD_HASH) =>
    commandBus.execute(new CreateUserCommand(email, passwordHash));
  const findUser = (email: string) =>
    queryBus.execute(new FindUserByEmailQuery(email));

  describe('CreateUserCommand', () => {
    it('создаёт пользователя и возвращает id, email и хеш пароля', async () => {
      const email = uniqueEmail();

      const user = await createUser(email);

      expect(user.id).toEqual(expect.any(String));
      expect(user.email).toBe(email);
      expect(user.passwordHash).toBe(PASSWORD_HASH);
      expect(Object.keys(user).sort()).toEqual(['email', 'id', 'passwordHash']);
    });

    it('бросает ConflictException при повторном email и не меняет пользователя', async () => {
      const email = uniqueEmail();
      const created = await createUser(email);

      await expect(createUser(email, 'scrypt$22$33')).rejects.toBeInstanceOf(
        ConflictException,
      );

      expect(await findUser(email)).toEqual(created);
    });
  });

  describe('FindUserByEmailQuery', () => {
    it('находит созданного пользователя по email', async () => {
      const created = await createUser();

      const found = await findUser(created.email);

      expect(found).toEqual(created);
    });

    it('находит именно того пользователя, чей email передан', async () => {
      const first = await createUser();
      const second = await createUser();

      const found = await findUser(second.email);

      expect(found?.id).toBe(second.id);
      expect(found?.id).not.toBe(first.id);
    });

    it('возвращает null, если пользователя с таким email нет', async () => {
      expect(await findUser(uniqueEmail())).toBeNull();
    });
  });
});
