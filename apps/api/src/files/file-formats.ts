import { extname } from 'node:path';

export const MAX_FILE_SIZE = 1024 ** 3;

export const SIGNATURE_LENGTH = 12;

export type Signature = (head: Buffer) => boolean;

const bytes = (expected: string, offset = 0): Signature => {
  const pattern = Buffer.from(expected, 'latin1');
  return (head) =>
    head.subarray(offset, offset + pattern.length).equals(pattern);
};

const anyOf =
  (...signatures: Signature[]): Signature =>
  (head) =>
    signatures.some((matches) => matches(head));

const allOf =
  (...signatures: Signature[]): Signature =>
  (head) =>
    signatures.every((matches) => matches(head));

const MP3_FRAME: Signature = (head) =>
  head.length >= 2 && head[0] === 0xff && (head[1] & 0xe0) === 0xe0;

const ISO_MEDIA = bytes('ftyp', 4);
const ZIP = bytes('PK\x03\x04');

interface FileFormat {
  mimeType: string;
  signature: Signature;
}

const FORMATS = new Map<string, FileFormat>([
  ['.mp4', { mimeType: 'video/mp4', signature: ISO_MEDIA }],
  ['.webm', { mimeType: 'video/webm', signature: bytes('\x1a\x45\xdf\xa3') }],
  [
    '.mov',
    {
      mimeType: 'video/quicktime',
      signature: anyOf(
        ...['ftyp', 'moov', 'mdat', 'free', 'wide', 'skip'].map((atom) =>
          bytes(atom, 4),
        ),
      ),
    },
  ],
  [
    '.mp3',
    { mimeType: 'audio/mpeg', signature: anyOf(bytes('ID3'), MP3_FRAME) },
  ],
  ['.m4a', { mimeType: 'audio/mp4', signature: ISO_MEDIA }],
  [
    '.wav',
    {
      mimeType: 'audio/wav',
      signature: allOf(bytes('RIFF'), bytes('WAVE', 8)),
    },
  ],
  ['.ogg', { mimeType: 'audio/ogg', signature: bytes('OggS') }],
  ['.pdf', { mimeType: 'application/pdf', signature: bytes('%PDF-') }],
  [
    '.docx',
    {
      mimeType:
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      signature: ZIP,
    },
  ],
  [
    '.pptx',
    {
      mimeType:
        'application/vnd.openxmlformats-officedocument.presentationml.presentation',
      signature: ZIP,
    },
  ],
  [
    '.xlsx',
    {
      mimeType:
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      signature: ZIP,
    },
  ],
  ['.txt', { mimeType: 'text/plain', signature: () => true }],
  ['.png', { mimeType: 'image/png', signature: bytes('\x89PNG\r\n\x1a\n') }],
  ['.jpg', { mimeType: 'image/jpeg', signature: bytes('\xff\xd8\xff') }],
  ['.jpeg', { mimeType: 'image/jpeg', signature: bytes('\xff\xd8\xff') }],
  [
    '.webp',
    {
      mimeType: 'image/webp',
      signature: allOf(bytes('RIFF'), bytes('WEBP', 8)),
    },
  ],
  [
    '.gif',
    {
      mimeType: 'image/gif',
      signature: anyOf(bytes('GIF87a'), bytes('GIF89a')),
    },
  ],
]);

export const formatOf = (fileName: string) =>
  FORMATS.get(extname(fileName).toLowerCase());

export const mimeTypeOf = (fileName: string) =>
  formatOf(fileName)?.mimeType ?? 'application/octet-stream';

const VIEWABLE_TYPES = /^(video|audio|image)\/|^application\/pdf$/;

export const isViewable = (mimeType: string) => VIEWABLE_TYPES.test(mimeType);

export const contentTypeOf = (mimeType: string) =>
  mimeType.startsWith('text/') ? `${mimeType}; charset=utf-8` : mimeType;
