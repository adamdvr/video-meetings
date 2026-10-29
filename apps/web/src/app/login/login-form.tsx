'use client';

import Envelope from '@gravity-ui/icons/Envelope';
import Eye from '@gravity-ui/icons/Eye';
import EyeSlash from '@gravity-ui/icons/EyeSlash';
import Lock from '@gravity-ui/icons/Lock';
import {
  Alert,
  Button,
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
import { validateEmail } from '@/app/register/validation';
import { login, type LoginState } from './actions';
import { validatePassword } from './validation';

type Field = 'email' | 'password';
type FieldErrors = Partial<Record<Field, string>>;

const FIELDS: Field[] = ['email', 'password'];
const validators = { email: validateEmail, password: validatePassword };
const initialState: LoginState = {};

export function LoginForm() {
  const [state, formAction, isPending] = useActionState(login, initialState);
  const [isPasswordVisible, setIsPasswordVisible] = useState(false);
  const [errors, setErrors] = useState<FieldErrors>(state.errors ?? {});
  const [handledState, setHandledState] = useState(state);
  const [responseId, setResponseId] = useState(0);
  const emailRef = useRef<HTMLInputElement>(null);
  const passwordRef = useRef<HTMLInputElement>(null);
  const editedFields = useRef(new Set<Field>());

  if (state !== handledState) {
    setHandledState(state);
    setErrors(state.errors ?? {});
    setResponseId((id) => id + 1);
  }

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

  function handleChange(field: Field, value: string) {
    editedFields.current.add(field);
    if (errors[field]) validateField(field, value);
  }

  function handleBlur(field: Field, value: string) {
    if (value || editedFields.current.has(field)) validateField(field, value);
  }

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
            <Alert.Title>Не удалось войти</Alert.Title>
            <Alert.Description>{state.message}</Alert.Description>
          </Alert.Content>
        </Alert>
      )}

      <TextField
        fullWidth
        isRequired
        autoComplete="username"
        inputMode="email"
        isInvalid={Boolean(errors.email)}
        name="email"
        type="email"
        onBlur={(event) => handleBlur('email', event.target.value)}
        onChange={(value) => handleChange('email', value)}
      >
        <Label className="after:content-none">Email</Label>
        <InputGroup fullWidth variant="secondary">
          <InputGroup.Prefix className="border-0">
            <Envelope aria-hidden="true" className="size-4 text-muted" />
          </InputGroup.Prefix>
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
        autoComplete="current-password"
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
            placeholder="Введите пароль"
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
        {isPending ? 'Входим…' : 'Войти'}
      </Button>
    </Form>
  );
}
