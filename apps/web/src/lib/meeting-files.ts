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
