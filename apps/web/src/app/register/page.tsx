import { Card } from '@heroui/react';
import type { Metadata } from 'next';
import Link from 'next/link';
import { BrandPanel } from '@/components/brand-panel';
import { Logo } from '@/components/logo';
import { RegisterForm } from './register-form';

export const metadata: Metadata = {
  title: 'Регистрация',
  description: 'Создайте аккаунт в Video meetings: достаточно email и пароля.',
};

export default function RegisterPage() {
  return (
    <main className="grid min-h-dvh bg-background text-foreground lg:grid-cols-2">
      {/* Верхний отступ равен половине свободной высоты при начальном размере блока: форма стоит по центру,
          но не прыгает, когда появляются ошибки. Блок с логотипом считаем как 36,75rem (на деле 33,25rem плюс запас
          на общую ошибку, чтобы на телефоне она не вызывала прокрутку), без логотипа на широком экране — 28,25rem. */}
      <section className="relative flex items-start justify-center overflow-hidden px-4 pt-[max(2.5rem,calc((100dvh_-_36.75rem)/2))] pb-10 sm:px-8 lg:pt-[max(2.5rem,calc((100dvh_-_28.25rem)/2))]">
        <div
          aria-hidden="true"
          className="pointer-events-none absolute -top-40 -right-32 size-96 rounded-full bg-accent/15 blur-3xl"
        />
        <div
          aria-hidden="true"
          className="pointer-events-none absolute -bottom-40 -left-32 size-96 rounded-full bg-accent/10 blur-3xl"
        />

        <div className="relative w-full max-w-md transition duration-700 ease-out starting:translate-y-3 starting:opacity-0 motion-reduce:transition-none">
          <Logo className="mb-10 lg:hidden" />
          <h1 className="text-3xl font-semibold tracking-tight">
            Создайте аккаунт
          </h1>
          <p className="mt-2 text-muted">
            Введите email и придумайте пароль — этого достаточно, чтобы начать.
          </p>
          <Card className="mt-8 p-6 shadow-xl shadow-black/5 sm:p-8">
            <RegisterForm />
          </Card>
          <p className="mt-6 text-center text-sm text-muted">
            Уже есть аккаунт?{' '}
            <Link className="link text-accent underline" href="/login">
              Войти
            </Link>
          </p>
        </div>
      </section>

      <BrandPanel />
    </main>
  );
}
