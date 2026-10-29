import { Card } from '@heroui/react';
import type { Metadata } from 'next';
import Link from 'next/link';
import { BrandPanel } from '@/components/brand-panel';
import { Logo } from '@/components/logo';
import { LoginForm } from './login-form';

export const metadata: Metadata = {
  title: 'Вход',
  description: 'Войдите в аккаунт Video meetings по email и паролю.',
};

export default function LoginPage() {
  return (
    <main className="grid min-h-dvh bg-background text-foreground lg:grid-cols-2">
      <section className="relative flex items-start justify-center overflow-hidden px-4 pt-[max(2.5rem,calc((100dvh_-_34rem)/2))] pb-10 sm:px-8 lg:pt-[max(2.5rem,calc((100dvh_-_25.5rem)/2))]">
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
            Войдите в аккаунт
          </h1>
          <p className="mt-2 text-muted">
            Введите email и пароль, чтобы продолжить.
          </p>
          <Card className="mt-8 p-6 shadow-xl shadow-black/5 sm:p-8">
            <LoginForm />
          </Card>
          <p className="mt-6 text-center text-sm text-muted">
            Нет аккаунта?{' '}
            <Link className="link text-accent underline" href="/register">
              Зарегистрироваться
            </Link>
          </p>
        </div>
      </section>

      <BrandPanel />
    </main>
  );
}
