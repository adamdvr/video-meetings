import { randomUUID } from 'node:crypto';
import { createWriteStream } from 'node:fs';
import { access, mkdir, rename, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { type Readable, Transform } from 'node:stream';
import { pipeline } from 'node:stream/promises';
import {
  BadRequestException,
  Injectable,
  UnsupportedMediaTypeException,
} from '@nestjs/common';
import { getConfig } from '../config/configuration.js';
import { type Signature, SIGNATURE_LENGTH } from './file-formats.js';

export interface StoredFile {
  id: string;
  size: number;
}

function signatureCheck(matches: Signature): Transform {
  let head = Buffer.alloc(0);
  let checked = false;
  const rejection = () =>
    matches(head)
      ? null
      : new UnsupportedMediaTypeException(
          'File content does not match its format',
        );
  return new Transform({
    transform(chunk: Buffer, _encoding, callback) {
      if (!checked) {
        head = Buffer.concat([head, chunk]).subarray(0, SIGNATURE_LENGTH);
        if (head.length === SIGNATURE_LENGTH) {
          checked = true;
          const error = rejection();
          if (error) return callback(error);
        }
      }
      callback(null, chunk);
    },
    flush(callback) {
      callback(checked ? null : rejection());
    },
  });
}

@Injectable()
export class FileStorage {
  private readonly dir = getConfig().filesDir;

  async save(
    meetingId: string,
    source: Readable,
    expectedSize: number,
    signature: Signature,
  ): Promise<StoredFile> {
    const id = randomUUID();
    const tempDir = join(this.dir, '.tmp');
    const tempPath = join(tempDir, `${id}.part`);
    await mkdir(tempDir, { recursive: true });
    const target = createWriteStream(tempPath, { flags: 'wx' });
    try {
      await pipeline(source, signatureCheck(signature), target);
      if (target.bytesWritten !== expectedSize) {
        throw new BadRequestException('Body is shorter than Content-Length');
      }
      await mkdir(join(this.dir, meetingId), { recursive: true });
      await rename(tempPath, this.path(meetingId, id));
    } catch (error) {
      await rm(tempPath, { force: true });
      throw error;
    }
    return { id, size: target.bytesWritten };
  }

  path(meetingId: string, fileId: string) {
    return join(this.dir, meetingId, fileId);
  }

  async exists(meetingId: string, fileId: string) {
    try {
      await access(this.path(meetingId, fileId));
      return true;
    } catch {
      return false;
    }
  }

  async remove(meetingId: string, fileId: string) {
    await rm(this.path(meetingId, fileId), { force: true });
  }
}
