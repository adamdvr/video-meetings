import { cache } from 'react';
import { apiFetch } from './api';
import { getAccessToken } from './session';

export type MeetingFile = {
  id: string;
  name: string;
  size: number;
  mimeType: string;
  createdAt: string;
};

export const getMeetingFiles = cache(
  async (meetingId: string): Promise<MeetingFile[] | null> => {
    const accessToken = await getAccessToken();
    if (!accessToken) return null;

    try {
      const response = await apiFetch(
        `/meetings/${encodeURIComponent(meetingId)}/files`,
        { headers: { Authorization: `Bearer ${accessToken}` } },
      );
      if (!response.ok) {
        console.error(
          `GET /meetings/:id/files: api ответил ${response.status}`,
        );
        return null;
      }
      const files: unknown = await response.json();
      if (!Array.isArray(files)) {
        console.error('GET /meetings/:id/files: ответ api не является списком');
        return null;
      }
      return files as MeetingFile[];
    } catch (error) {
      console.error(
        'GET /meetings/:id/files: не удалось получить файлы',
        error,
      );
      return null;
    }
  },
);

const SIZE_UNITS = ['Б', 'КБ', 'МБ', 'ГБ'];
const sizeFormat = new Intl.NumberFormat('ru-RU', { maximumFractionDigits: 1 });

export function formatFileSize(bytes: number) {
  let value = bytes;
  let unit = 0;
  while (value >= 1024 && unit < SIZE_UNITS.length - 1) {
    value /= 1024;
    unit += 1;
  }
  return `${sizeFormat.format(value)} ${SIZE_UNITS[unit]}`;
}
