import type { NextRequest } from 'next/server';
import { filePath, proxyFile } from '@/lib/file-proxy';

export async function GET(
  request: NextRequest,
  { params }: RouteContext<'/meetings/[id]/files/[fileId]/view'>,
) {
  const { id, fileId } = await params;
  return proxyFile(
    request,
    `${filePath(id, fileId)}/view`,
    'Не удалось открыть файл',
  );
}
