import { redirect } from 'next/navigation';
import type { NextRequest } from 'next/server';
import { ACCESS_TOKEN_COOKIE, readSession } from '@/lib/access-token';
import { API_URL } from '@/lib/api';

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

export async function GET(
  request: NextRequest,
  { params }: RouteContext<'/meetings/[id]/files/[fileId]'>,
) {
  const token = request.cookies.get(ACCESS_TOKEN_COOKIE)?.value;
  if (!readSession(token)) redirect('/login');
  const { id, fileId } = await params;

  const headers = copyHeaders(
    request.headers,
    new Headers({ authorization: `Bearer ${token}` }),
    FORWARDED_REQUEST_HEADERS,
  );

  let upstream: Response;
  try {
    upstream = await fetch(
      `${API_URL}/meetings/${encodeURIComponent(id)}/files/${encodeURIComponent(fileId)}`,
      { headers, signal: request.signal, cache: 'no-store' },
    );
  } catch (error) {
    if (!request.signal.aborted) {
      console.error('GET /meetings/:id/files/:fileId: api недоступен', error);
    }
    return textResponse('Не удалось скачать файл', 502);
  }

  if (upstream.status === 404) return textResponse('Файл не найден', 404);
  if (!upstream.ok) {
    console.error(
      `GET /meetings/:id/files/:fileId: api ответил ${upstream.status}`,
    );
    return textResponse('Не удалось скачать файл', upstream.status);
  }

  const responseHeaders = copyHeaders(
    upstream.headers,
    new Headers(),
    FORWARDED_RESPONSE_HEADERS,
  );
  return new Response(upstream.body, {
    status: upstream.status,
    headers: responseHeaders,
  });
}
