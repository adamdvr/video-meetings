'use server';

import { refresh } from 'next/cache';
import { redirect } from 'next/navigation';
import { apiFetch, authHeader } from '@/lib/api';
import { filePath } from '@/lib/file-proxy';
import { deleteSession, getApiToken } from '@/lib/session';

export type DeleteFileResult = { error: string } | null;

async function toLogin(): Promise<never> {
  await deleteSession();
  redirect('/login');
}

export async function deleteMeetingFile(
  meetingId: string,
  fileId: string,
): Promise<DeleteFileResult> {
  const token = await getApiToken();
  if (!token) return toLogin();

  let response: Response;
  try {
    response = await apiFetch(filePath(meetingId, fileId), {
      method: 'DELETE',
      headers: authHeader(token),
    });
  } catch (error) {
    console.error('DELETE /meetings/:id/files/:fileId: api недоступен', error);
    return { error: 'Сервер недоступен, попробуйте ещё раз' };
  }

  if (response.status === 401) return toLogin();
  if (!response.ok && response.status !== 404) {
    console.error(
      `DELETE /meetings/:id/files/:fileId: api ответил ${response.status}`,
    );
    return { error: 'Не удалось удалить файл' };
  }

  refresh();
  return null;
}
