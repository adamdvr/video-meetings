import type { User } from '../generated/prisma/client.js';

export interface UserView {
  id: string;
  email: string;
  passwordHash: string;
}

export const toUserView = ({ id, email, passwordHash }: User): UserView => ({
  id,
  email,
  passwordHash,
});
