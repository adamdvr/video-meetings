import { randomUUID } from 'node:crypto';
import {
  expect,
  type APIRequestContext,
  type BrowserContext,
} from '@playwright/test';

export const API_URL = process.env.API_URL ?? 'http://localhost:4000';
export const WEB_URL = 'http://localhost:3000';

export type Meeting = {
  id: string;
  title: string;
  date: string;
  participants: string[];
};

export async function registerUser(request: APIRequestContext) {
  const response = await request.post(`${API_URL}/auth/register`, {
    data: {
      email: `user-${randomUUID()}@example.com`,
      password: 'correct-horse-battery',
    },
  });
  expect(response.status()).toBe(201);
  const { accessToken } = (await response.json()) as { accessToken: string };
  return accessToken;
}

export async function createMeeting(
  request: APIRequestContext,
  accessToken: string,
  meeting: Omit<Meeting, 'id'>,
) {
  const response = await request.post(`${API_URL}/meetings`, {
    headers: { Authorization: `Bearer ${accessToken}` },
    data: meeting,
  });
  expect(response.status()).toBe(201);
  return (await response.json()) as Meeting;
}

export async function signIn(context: BrowserContext, accessToken: string) {
  await context.addCookies([
    {
      name: 'access_token',
      value: accessToken,
      url: WEB_URL,
      httpOnly: true,
      sameSite: 'Lax',
    },
  ]);
}
