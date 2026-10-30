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

export function sortByDateDesc(meetings: Meeting[]) {
  return [...meetings].sort((a, b) => Date.parse(b.date) - Date.parse(a.date));
}
