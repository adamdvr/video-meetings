'use client';

import Envelope from '@gravity-ui/icons/Envelope';
import Eye from '@gravity-ui/icons/Eye';
import EyeSlash from '@gravity-ui/icons/EyeSlash';
import Lock from '@gravity-ui/icons/Lock';
import {
  Alert,
  Button,
  Description,
  FieldError,
  Form,
  InputGroup,
  Label,
  Spinner,
  TextField,
} from '@heroui/react';
import {
  startTransition,
  useActionState,
  useEffect,
  useRef,
  useState,
  type SyntheticEvent,
} from 'react';
import { register, type RegisterState } from './actions';
import {
  PASSWORD_MIN_LENGTH,
  validateEmail,
  validatePassword,
} from './validation';

type Field = 'email' | 'password';
type FieldErrors = Partial<Record<Field, string>>;

const FIELDS: Field[] = ['email', 'password'];
const validators = { email: validateEmail, password: validatePassword };
const initialState: RegisterState = {};

export function RegisterForm() {
  const [state, formAction, isPending] = useActionState(register, initialState);
  const [isPasswordVisible, setIsPasswordVisible] = useState(false);
  // Ошибки на экране: клиентские (появляются, когда пользователь уходит с поля или отправляет форму)
  // и ответ сервера. Своё состояние нужно, чтобы ошибка пропадала сразу, как значение стало верным:
  // встроенная валидация HeroUI обновляет её только при уходе с поля.
  const [errors, setErrors] = useState<FieldErrors>(state.errors ?? {});
  const [handledState, setHandledState] = useState(state);
  // Номер ответа сервера: Alert пересоздаётся на каждый ответ, поэтому скринридер озвучит и повторную ошибку.
  const [responseId, setResponseId] = useState(0);
  const emailRef = useRef<HTMLInputElement>(null);
  const passwordRef = useRef<HTMLInputElement>(null);
  // Поля, в которые уже что-то вводили: пустое поле, мимо которого просто прошли по Tab, ошибкой не считаем.
  const editedFields = useRef(new Set<Field>());

  // Ответ сервера заменяет ошибки на экране: клиентские к этому моменту уже пройдены.
  if (state !== handledState) {
    setHandledState(state);
    setErrors(state.errors ?? {});
    setResponseId((id) => id + 1);
  }

  // Ошибки сервера приходят уже после отправки, поэтому фокус на первое поле с ошибкой переводим здесь:
  // так её услышит и пользователь скринридера.
  useEffect(() => {
    if (state.errors?.email) emailRef.current?.focus();
    else if (state.errors?.password) passwordRef.current?.focus();
  }, [state]);

  function validateField(field: Field, value: string) {
    setErrors((current) => ({
      ...current,
      [field]: validators[field](value) ?? undefined,
    }));
  }

  // Показанную ошибку пересчитываем на каждый ввод: она пропадает, как только значение стало верным
  // (серверная тоже: она относилась к старому значению). Новую ошибку до ухода с поля не показываем,
  // чтобы она не мигала, пока адрес ещё набирают.
  function handleChange(field: Field, value: string) {
    editedFields.current.add(field);
    if (errors[field]) validateField(field, value);
  }

  function handleBlur(field: Field, value: string) {
    if (value || editedFields.current.has(field)) validateField(field, value);
  }

  // Основной путь отправки — onSubmit: после <form action> React сбрасывает поля,
  // и при каждой ошибке сервера пользователю пришлось бы вводить всё заново.
  // action остаётся на случай отправки до гидрации или без JS: тогда это обычный POST,
  // и пароль не попадает в URL, как было бы при GET по умолчанию.
  function handleSubmit(event: SyntheticEvent<HTMLFormElement>) {
    event.preventDefault();
    if (isPending) return;
    const formData = new FormData(event.currentTarget);
    const found: FieldErrors = {};
    for (const field of FIELDS) {
      const error = validators[field](formData.get(field)?.toString() ?? '');
      if (error) found[field] = error;
    }
    const firstInvalid = FIELDS.find((field) => found[field]);
    if (firstInvalid) {
      setErrors(found);
      (firstInvalid === 'email' ? emailRef : passwordRef).current?.focus();
      return;
    }
    startTransition(() => formAction(formData));
  }

  return (
    <Form
      action={formAction}
      className="flex flex-col gap-5"
      validationBehavior="aria"
      onSubmit={handleSubmit}
    >
      {state.message && (
        <Alert
          key={responseId}
          className={`transition-opacity duration-300 starting:opacity-0 motion-reduce:transition-none ${isPending ? 'opacity-50' : ''}`}
          role="alert"
          status="danger"
        >
          <Alert.Indicator />
          <Alert.Content>
            <Alert.Title>Не удалось создать аккаунт</Alert.Title>
            <Alert.Description>{state.message}</Alert.Description>
          </Alert.Content>
        </Alert>
      )}

      <TextField
        fullWidth
        isRequired
        autoComplete="email"
        inputMode="email"
        isInvalid={Boolean(errors.email)}
        name="email"
        type="email"
        onBlur={(event) => handleBlur('email', event.target.value)}
        onChange={(value) => handleChange('email', value)}
      >
        {/* Оба поля обязательны, поэтому звёздочку HeroUI убираем: она входит в имя поля («Email*»). */}
        <Label className="after:content-none">Email</Label>
        <InputGroup fullWidth variant="secondary">
          {/* border-0: при рамке полей HeroUI рисует разделитель между иконкой и текстом. */}
          <InputGroup.Prefix className="border-0">
            <Envelope aria-hidden="true" className="size-4 text-muted" />
          </InputGroup.Prefix>
          {/* min-w-0: у input по умолчанию min-width: auto (size=20, ~197 px), и на экранах уже ~370 px
              иконка, поле и кнопка не помещаются, а «глаз» вылезает за край поля. */}
          <InputGroup.Input
            ref={emailRef}
            autoCapitalize="none"
            className="min-w-0 text-ellipsis"
            placeholder="name@example.com"
            spellCheck={false}
          />
        </InputGroup>
        <FieldError>{errors.email}</FieldError>
      </TextField>

      <TextField
        fullWidth
        isRequired
        autoComplete="new-password"
        isInvalid={Boolean(errors.password)}
        name="password"
        type={isPasswordVisible ? 'text' : 'password'}
        onBlur={(event) => handleBlur('password', event.target.value)}
        onChange={(value) => handleChange('password', value)}
      >
        <Label className="after:content-none">Пароль</Label>
        <InputGroup fullWidth variant="secondary">
          <InputGroup.Prefix className="border-0">
            <Lock aria-hidden="true" className="size-4 text-muted" />
          </InputGroup.Prefix>
          <InputGroup.Input
            ref={passwordRef}
            className="min-w-0 text-ellipsis"
            placeholder="Придумайте пароль"
          />
          <InputGroup.Suffix className="border-0 pe-1">
            <Button
              isIconOnly
              preventFocusOnPress
              aria-label={
                isPasswordVisible ? 'Скрыть пароль' : 'Показать пароль'
              }
              size="sm"
              variant="ghost"
              onPress={() => setIsPasswordVisible((visible) => !visible)}
            >
              {isPasswordVisible ? (
                <EyeSlash aria-hidden="true" className="size-4" />
              ) : (
                <Eye aria-hidden="true" className="size-4" />
              )}
            </Button>
          </InputGroup.Suffix>
        </InputGroup>
        <Description>Минимум {PASSWORD_MIN_LENGTH} символов</Description>
        <FieldError>{errors.password}</FieldError>
      </TextField>

      <Button
        fullWidth
        preventFocusOnPress
        isPending={isPending}
        size="lg"
        type="submit"
      >
        {isPending && <Spinner color="current" size="sm" />}
        {isPending ? 'Создаём аккаунт…' : 'Создать аккаунт'}
      </Button>
    </Form>
  );
}
