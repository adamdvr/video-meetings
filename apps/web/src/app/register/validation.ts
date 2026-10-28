// Правила повторяют RegisterDto в api (apps/api/src/auth/dto/register.dto.ts).
export const PASSWORD_MIN_LENGTH = 8;
const PASSWORD_MAX_LENGTH = 128;

export const EMAIL_ERROR =
  'Введите корректный email, например name@example.com';
export const PASSWORD_ERROR = `Пароль должен содержать от ${PASSWORD_MIN_LENGTH} до ${PASSWORD_MAX_LENGTH} символов`;

// Строже, чем type="email" в браузере (он пропускает name@host): нужна точка в домене, как у @IsEmail() в api.
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

export function validateEmail(value: string) {
  const email = value.trim();
  if (!email) return 'Введите email';
  return EMAIL_PATTERN.test(email) ? null : EMAIL_ERROR;
}

export function validatePassword(value: string) {
  // Подсказка «Минимум 8 символов» под полем при ошибке скрыта, поэтому правило повторяем здесь.
  if (!value) return `Введите пароль: минимум ${PASSWORD_MIN_LENGTH} символов`;
  // Длину считаем в символах Unicode, как api, а не в единицах UTF-16.
  const length = [...value].length;
  return length >= PASSWORD_MIN_LENGTH && length <= PASSWORD_MAX_LENGTH
    ? null
    : PASSWORD_ERROR;
}
