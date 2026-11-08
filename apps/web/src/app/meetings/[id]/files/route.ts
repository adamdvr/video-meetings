import { request as httpRequest, type IncomingMessage } from 'node:http';
import { request as httpsRequest } from 'node:https';
import { Readable } from 'node:stream';
import { pipeline } from 'node:stream/promises';
import type { ReadableStream as NodeReadableStream } from 'node:stream/web';
import type { NextRequest } from 'next/server';
import { ACCESS_TOKEN_COOKIE, readSession } from '@/lib/access-token';
import { API_URL } from '@/lib/api';

const FORWARDED_RESPONSE_HEADERS = ['content-type', 'location'];

const jsonError = (message: string, status: number) =>
  Response.json({ message }, { status });

function isCrossOrigin(request: NextRequest) {
  const origin = request.headers.get('origin');
  if (!origin) return false;
  try {
    return new URL(origin).host !== request.headers.get('host');
  } catch {
    return true;
  }
}

function sendToApi(
  url: URL,
  headers: Record<string, string>,
  body: Readable,
  signal: AbortSignal,
) {
  const send = url.protocol === 'https:' ? httpsRequest : httpRequest;
  return new Promise<IncomingMessage>((resolve, reject) => {
    const outgoing = send(url, { method: 'POST', headers, signal }, resolve);
    outgoing.on('error', reject);
    pipeline(body, outgoing).catch(reject);
  });
}

export async function POST(
  request: NextRequest,
  { params }: RouteContext<'/meetings/[id]/files'>,
) {
  const token = request.cookies.get(ACCESS_TOKEN_COOKIE)?.value;
  if (!readSession(token)) {
    return jsonError('Unauthorized', 401);
  }
  if (isCrossOrigin(request)) return jsonError('Forbidden', 403);

  const length = request.headers.get('content-length');
  if (!length || !request.body) return jsonError('Length Required', 411);
  const { id } = await params;

  let upstream: IncomingMessage;
  try {
    upstream = await sendToApi(
      new URL(`${API_URL}/meetings/${encodeURIComponent(id)}/files`),
      {
        authorization: `Bearer ${token}`,
        'content-type': 'application/octet-stream',
        'content-length': length,
        'x-file-name': request.headers.get('x-file-name') ?? '',
      },
      Readable.fromWeb(request.body as NodeReadableStream),
      request.signal,
    );
  } catch (error) {
    if (!request.signal.aborted) {
      console.error('POST /meetings/:id/files: api недоступен', error);
    }
    return jsonError('Bad Gateway', 502);
  }

  const headers = new Headers();
  for (const name of FORWARDED_RESPONSE_HEADERS) {
    const value = upstream.headers[name];
    if (typeof value === 'string') headers.set(name, value);
  }
  return new Response(Readable.toWeb(upstream) as ReadableStream, {
    status: upstream.statusCode,
    headers,
  });
}
