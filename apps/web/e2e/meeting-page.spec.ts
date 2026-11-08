import { randomUUID } from 'node:crypto';
import { expect, test, type Page } from '@playwright/test';
import { createMeeting, registerUser, signIn, type Meeting } from './api';

const TIME_ZONE = 'Asia/Vladivostok';

test.use({ locale: 'ru-RU', timezoneId: TIME_ZONE });

const localDate = (iso: string) =>
  new Intl.DateTimeFormat('ru-RU', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    timeZone: TIME_ZONE,
  }).format(new Date(iso));

const newMeeting = (date: string, participants: string[] = []) => ({
  title: `Планёрка ${randomUUID()}`,
  date,
  participants,
});

async function expectMeetingPage(page: Page, meeting: Meeting) {
  await expect(page).toHaveURL(`/meetings/${meeting.id}`);
  await expect(
    page.getByRole('heading', { level: 1, name: meeting.title }),
  ).toBeVisible();
  await expect(page.locator('main:visible time')).toHaveText(
    localDate(meeting.date),
  );

  const participants = page.getByRole('list', { name: 'Участники' });
  if (meeting.participants.length === 0) {
    await expect(page.getByText('Участников нет')).toBeVisible();
  } else {
    await expect(participants.getByRole('listitem')).toHaveText(
      meeting.participants,
    );
  }
}

async function expectNotFound(page: Page, id: string) {
  await page.goto(`/meetings/${id}`);
  await expect(page).toHaveURL(`/meetings/${id}`);
  await expect(
    page.getByRole('heading', { level: 1, name: 'Встреча не найдена' }),
  ).toBeVisible();
}

test.describe('Страница встречи', () => {
  let newest: Meeting;
  let oldest: Meeting;
  let accessToken: string;

  test.beforeAll(async ({ request }) => {
    accessToken = await registerUser(request);
    oldest = await createMeeting(
      request,
      accessToken,
      newMeeting('2030-01-10T23:30:00.000Z'),
    );
    for (const date of [
      '2030-01-11T10:00:00.000Z',
      '2030-01-12T10:00:00.000Z',
    ]) {
      await createMeeting(request, accessToken, newMeeting(date));
    }
    newest = await createMeeting(
      request,
      accessToken,
      newMeeting('2030-01-13T21:15:00.000Z', [
        'alice@example.com',
        'Боб Петров',
      ]),
    );
  });

  test.beforeEach(async ({ context }) => {
    await signIn(context, accessToken);
  });

  test('карточка в «Последних встречах» открывает встречу', async ({
    page,
  }) => {
    await page.goto('/');
    await page
      .getByRole('region', { name: 'Последние встречи' })
      .getByRole('link', { name: newest.title })
      .click();

    await expectMeetingPage(page, newest);
  });

  test('строка во «Всех встречах» открывает встречу', async ({ page }) => {
    await page.goto('/');
    await page
      .getByRole('region', { name: /Все встречи/ })
      .getByRole('link', { name: oldest.title })
      .click();

    await expectMeetingPage(page, oldest);
  });

  test('ссылка «Все встречи» возвращает на главную', async ({ page }) => {
    await page.goto(`/meetings/${newest.id}`);
    await page.getByRole('link', { name: 'Все встречи' }).click();

    await expect(page).toHaveURL('/');
    await expect(
      page.getByRole('heading', { level: 1, name: 'Ваши встречи' }),
    ).toBeVisible();
  });

  test('чужая встреча — «не найдено»', async ({ page, request }) => {
    const stranger = await registerUser(request);
    const foreign = await createMeeting(
      request,
      stranger,
      newMeeting('2030-02-01T10:00:00.000Z'),
    );

    await page.goto(`/meetings/${newest.id}`);
    await expectMeetingPage(page, newest);
    await expectNotFound(page, foreign.id);
    await expect(page.getByText(foreign.title)).toHaveCount(0);
  });

  test('несуществующая встреча — «не найдено»', async ({ page }) => {
    await expectNotFound(page, randomUUID());
    await expectNotFound(page, 'not-a-uuid');
  });
});

for (const suffix of ['', '/files']) {
  test(`без входа /meetings/<id>${suffix} ведёт на /login`, async ({
    page,
  }) => {
    await page.goto(`/meetings/${randomUUID()}${suffix}`);

    await expect(page).toHaveURL('/login');
  });
}
