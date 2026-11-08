import { randomUUID } from 'node:crypto';
import { createWriteStream } from 'node:fs';
import { access, mkdir, rename, rm } from 'node:fs/promises';
import { join } from 'node:path';
import type { Readable } from 'node:stream';
import { pipeline } from 'node:stream/promises';
import { BadRequestException, Injectable } from '@nestjs/common';
import { getConfig } from '../config/configuration.js';

export interface StoredFile {
  id: string;
  size: number;
}

@Injectable()
export class FileStorage {
  private readonly dir = getConfig().filesDir;

  async save(
    meetingId: string,
    source: Readable,
    expectedSize: number,
  ): Promise<StoredFile> {
    const id = randomUUID();
    const tempDir = join(this.dir, '.tmp');
    const tempPath = join(tempDir, `${id}.part`);
    await mkdir(tempDir, { recursive: true });
    const target = createWriteStream(tempPath, { flags: 'wx' });
    try {
      await pipeline(source, target);
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
