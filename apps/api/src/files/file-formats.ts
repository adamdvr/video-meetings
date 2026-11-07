import { extname } from 'node:path';

const MIME_TYPES = new Map([
  ['.mp4', 'video/mp4'],
  ['.webm', 'video/webm'],
  ['.mov', 'video/quicktime'],
  ['.mp3', 'audio/mpeg'],
  ['.m4a', 'audio/mp4'],
  ['.wav', 'audio/wav'],
  ['.ogg', 'audio/ogg'],
  ['.pdf', 'application/pdf'],
  [
    '.docx',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  ],
  [
    '.pptx',
    'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  ],
  [
    '.xlsx',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  ],
  ['.txt', 'text/plain; charset=utf-8'],
  ['.png', 'image/png'],
  ['.jpg', 'image/jpeg'],
  ['.jpeg', 'image/jpeg'],
  ['.webp', 'image/webp'],
  ['.gif', 'image/gif'],
]);

export const mimeTypeOf = (fileName: string) =>
  MIME_TYPES.get(extname(fileName).toLowerCase()) ?? 'application/octet-stream';
