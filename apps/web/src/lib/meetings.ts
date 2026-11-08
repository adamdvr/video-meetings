import { cache } from 'react';
import { apiFetch } from './api';
import { getAccessToken } from './session';

export type Meeting = {
  id: string;
  title: string;
  date: string;
  participants: string[];
};

export const LATEST_MEETINGS_COUNT = 3;

export async function getMeetings(): Promise<Meeting[] | null> {
  const accessToken = await getAccessToken();
  if (!accessToken) return null;

  try {
    const response = await apiFetch('/meetings', {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    if (!response.ok) {
      console.error(`GET /meetings: api ответил ${response.status}`);
      return null;
    }
    const meetings: unknown = await response.json();
    if (!Array.isArray(meetings)) {
      console.error('GET /meetings: ответ api не является списком');
      return null;
    }
    return meetings as Meeting[];
  } catch (error) {
    console.error('GET /meetings: не удалось получить встречи', error);
    return null;
  }
}

export const getMeeting = cache(
  async (id: string): Promise<Meeting | 'not-found' | null> => {
    const accessToken = await getAccessToken();
    if (!accessToken) return null;

    try {
      const response = await apiFetch(`/meetings/${encodeURIComponent(id)}`, {
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      if (response.status === 404) return 'not-found';
      if (!response.ok) {
        console.error(`GET /meetings/:id: api ответил ${response.status}`);
        return null;
      }
      const meeting: unknown = await response.json();
      if (typeof meeting !== 'object' || meeting === null) {
        console.error('GET /meetings/:id: ответ api не является встречей');
        return null;
      }
      return meeting as Meeting;
    } catch (error) {
      console.error('GET /meetings/:id: не удалось получить встречу', error);
      return null;
    }
  },
);

export function sortByDateDesc(meetings: Meeting[]) {
  return [...meetings].sort((a, b) => Date.parse(b.date) - Date.parse(a.date));
}
