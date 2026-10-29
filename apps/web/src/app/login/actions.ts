'use server';

import { redirect } from 'next/navigation';
import { validateEmail } from '@/app/register/validation';
import { apiFetch, readJson } from '@/lib/api';
import { createSession } from '@/lib/session';
import { validatePassword } from './validation';

export type LoginState = {
  errors?: Record<string, string>;
  message?: string;
};

const GENERIC_ERROR = 'Что-то пошло не так. Попробуйте ещё раз.';
const INVALID_CREDENTIALS_ERROR =
  'Неверный email или пароль. Попробуйте ещё раз.';

export async function login(
  _prevState: LoginState,
  formData: FormData,
): Promise<LoginState> {
  const email = formData.get('email');
  const password = formData.get('password');
  if (typeof email !== 'string' || typeof password !== 'string') {
    return { message: GENERIC_ERROR };
  }

  const errors: Record<string, string> = {};
  const emailError = validateEmail(email);
  if (emailError) errors.email = emailError;
  const passwordError = validatePassword(password);
  if (passwordError) errors.password = passwordError;
  if (Object.keys(errors).length > 0) return { errors };

  let response: Response;
  try {
    response = await apiFetch('/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password }),
    });
  } catch (error) {
    console.error('POST /auth/login: не удалось связаться с api', error);
    return {
      message:
        'Не удалось связаться с сервером. Попробуйте ещё раз чуть позже.',
    };
  }

  if (response.status === 400 || response.status === 401) {
    return { message: INVALID_CREDENTIALS_ERROR };
  }

  if (!response.ok) {
    console.error(`POST /auth/login: api ответил ${response.status}`);
    return { message: GENERIC_ERROR };
  }

  const { accessToken } = await readJson(response);
  if (typeof accessToken !== 'string') {
    console.error('POST /auth/login: в ответе api нет accessToken');
    return { message: GENERIC_ERROR };
  }

  await createSession(accessToken);
  redirect('/');
}
