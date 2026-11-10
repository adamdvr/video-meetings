import { randomBytes } from 'node:crypto';
import { crc32, deflateSync } from 'node:zlib';

const SIGNATURES = {
  pdf: Buffer.from('%PDF-1.7\n'),
  pptx: Buffer.from('PK\x03\x04', 'latin1'),
  mp4: Buffer.from('\x00\x00\x00\x18ftypmp42', 'latin1'),
  mov: Buffer.from('\x00\x00\x00\x14ftypqt  ', 'latin1'),
  png: Buffer.from('\x89PNG\r\n\x1a\n', 'latin1'),
};

export function fileBytes(format: keyof typeof SIGNATURES, size: number) {
  const signature = SIGNATURES[format];
  return Buffer.concat([signature, randomBytes(size - signature.length)]);
}

export function wavBytes(seconds: number) {
  const sampleRate = 8000;
  const data = Buffer.alloc(sampleRate * seconds * 2);
  for (let i = 0; i < data.length / 2; i++) {
    data.writeInt16LE(Math.round(Math.sin(i / 4) * 8000), i * 2);
  }
  const header = Buffer.alloc(44);
  header.write('RIFF', 0, 'latin1');
  header.writeUInt32LE(36 + data.length, 4);
  header.write('WAVEfmt ', 8, 'latin1');
  header.writeUInt32LE(16, 16);
  header.writeUInt16LE(1, 20);
  header.writeUInt16LE(1, 22);
  header.writeUInt32LE(sampleRate, 24);
  header.writeUInt32LE(sampleRate * 2, 28);
  header.writeUInt16LE(2, 32);
  header.writeUInt16LE(16, 34);
  header.write('data', 36, 'latin1');
  header.writeUInt32LE(data.length, 40);
  return Buffer.concat([header, data]);
}

function pngChunk(type: string, data: Buffer) {
  const length = Buffer.alloc(4);
  length.writeUInt32BE(data.length);
  const body = Buffer.concat([Buffer.from(type, 'latin1'), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(body));
  return Buffer.concat([length, body, crc]);
}

export function pngImage(width: number, height: number) {
  const header = Buffer.alloc(13);
  header.writeUInt32BE(width, 0);
  header.writeUInt32BE(height, 4);
  header.writeUInt8(8, 8);
  header.writeUInt8(2, 9);
  const row = Buffer.concat([
    Buffer.from([0]),
    Buffer.alloc(width * 3, Buffer.from([0x3b, 0x82, 0xf6])),
  ]);
  const pixels = Buffer.concat(Array.from({ length: height }, () => row));
  return Buffer.concat([
    SIGNATURES.png,
    pngChunk('IHDR', header),
    pngChunk('IDAT', deflateSync(pixels)),
    pngChunk('IEND', Buffer.alloc(0)),
  ]);
}
