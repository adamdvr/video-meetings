import { redirect } from 'next/navigation';
import type { NextRequest } from 'next/server';
import { API_URL, authHeader } from './api';
import { getApiToken } from './session';

const FORWARDED_REQUEST_HEADERS = ['range', 'if-range'];

const FORWARDED_RESPONSE_HEADERS = [
  'content-type',
  'content-length',
  'content-range',
  'accept-ranges',
  'content-disposition',
  'etag',
  'last-modified',
  'cache-control',
  'x-content-type-options',
];

function copyHeaders(from: Headers, to: Headers, names: string[]) {
  for (const name of names) {
    const value = from.get(name);
    if (value) to.set(name, value);
  }
  return to;
}

const textResponse = (text: string, status: number) =>
  new Response(text, {
    status,
    headers: { 'content-type': 'text/plain; charset=utf-8' },
  });

export async function proxyFile(
  request: NextRequest,
  apiPath: string,
  failureText: string,
) {
  const token = await getApiToken();
  if (!token) redirect('/login');

  const headers = copyHeaders(
    request.headers,
    new Headers(authHeader(token)),
    FORWARDED_REQUEST_HEADERS,
  );

  let upstream: Response;
  try {
    upstream = await fetch(`${API_URL}${apiPath}`, {
      headers,
      signal: request.signal,
      cache: 'no-store',
    });
  } catch (error) {
    if (!request.signal.aborted) {
      console.error(`GET ${apiPath}: api недоступен`, error);
    }
    return textResponse(failureText, 502);
  }

  if (upstream.status === 404) return textResponse('Файл не найден', 404);
  if (!upstream.ok) {
    console.error(`GET ${apiPath}: api ответил ${upstream.status}`);
    return textResponse(failureText, upstream.status);
  }

  return new Response(upstream.body, {
    status: upstream.status,
    headers: copyHeaders(
      upstream.headers,
      new Headers(),
      FORWARDED_RESPONSE_HEADERS,
    ),
  });
}

export const filePath = (meetingId: string, fileId: string) =>
  `/meetings/${encodeURIComponent(meetingId)}/files/${encodeURIComponent(fileId)}`;
