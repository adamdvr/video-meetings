export function validatePassword(value: string) {
  return value ? null : 'Введите пароль';
}
