'use server';

import { redirect } from 'next/navigation';
import { apiFetch, readJson } from '@/lib/api';
import { createSession } from '@/lib/session';
import {
  EMAIL_ERROR,
  PASSWORD_ERROR,
  validateEmail,
  validatePassword,
} from './validation';

export type RegisterState = {
  // Ошибки по имени поля формы: показываются под соответствующим полем.
  errors?: Record<string, string>;
  // Общая ошибка, не относящаяся к конкретному полю.
  message?: string;
};

const GENERIC_ERROR = 'Что-то пошло не так. Попробуйте ещё раз.';

export async function register(
  _prevState: RegisterState,
  formData: FormData,
): Promise<RegisterState> {
  const email = formData.get('email');
  const password = formData.get('password');
  if (typeof email !== 'string' || typeof password !== 'string') {
    return { message: GENERIC_ERROR };
  }

  // Server Action доступен любому POST-запросу, поэтому поля проверяем и здесь, а не только в браузере.
  const errors: Record<string, string> = {};
  const emailError = validateEmail(email);
  if (emailError) errors.email = emailError;
  const passwordError = validatePassword(password);
  if (passwordError) errors.password = passwordError;
  if (Object.keys(errors).length > 0) return { errors };

  let response: Response;
  try {
    response = await apiFetch('/auth/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password }),
    });
  } catch (error) {
    console.error('POST /auth/register: не удалось связаться с api', error);
    return {
      message:
        'Не удалось связаться с сервером. Попробуйте ещё раз чуть позже.',
    };
  }

  if (response.status === 409) {
    return { errors: { email: 'Этот email уже зарегистрирован' } };
  }

  if (response.status === 400) {
    const apiErrors = getApiFieldErrors((await readJson(response)).message);
    if (Object.keys(apiErrors).length > 0) return { errors: apiErrors };
  }

  if (!response.ok) {
    console.error(`POST /auth/register: api ответил ${response.status}`);
    return { message: GENERIC_ERROR };
  }

  const { accessToken } = await readJson(response);
  if (typeof accessToken !== 'string') {
    console.error('POST /auth/register: в ответе api нет accessToken');
    return { message: GENERIC_ERROR };
  }

  await createSession(accessToken);
  // redirect() бросает исключение, поэтому вызывается вне try/catch и последним.
  redirect('/');
}

// На невалидное тело api отвечает 400 и списком сообщений class-validator вида «email must be an email».
function getApiFieldErrors(messages: unknown) {
  const errors: Record<string, string> = {};
  if (!Array.isArray(messages)) return errors;
  for (const message of messages) {
    if (typeof message !== 'string') continue;
    if (message.startsWith('email')) errors.email = EMAIL_ERROR;
    if (message.startsWith('password')) errors.password = PASSWORD_ERROR;
  }
  return errors;
}
