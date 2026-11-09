import { randomBytes } from 'node:crypto';

const SIGNATURES = {
  pdf: Buffer.from('%PDF-1.7\n'),
  pptx: Buffer.from('PK\x03\x04', 'latin1'),
  mp4: Buffer.from('\x00\x00\x00\x18ftypmp42', 'latin1'),
  png: Buffer.from('\x89PNG\r\n\x1a\n', 'latin1'),
};

export function fileBytes(format: keyof typeof SIGNATURES, size: number) {
  const signature = SIGNATURES[format];
  return Buffer.concat([signature, randomBytes(size - signature.length)]);
}
