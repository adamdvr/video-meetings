import { randomUUID } from 'node:crypto';
import { createWriteStream } from 'node:fs';
import { mkdir, rename, rm } from 'node:fs/promises';
import { join } from 'node:path';
import type { Readable } from 'node:stream';
import { pipeline } from 'node:stream/promises';
import { Injectable } from '@nestjs/common';
import { getConfig } from '../config/configuration.js';

export interface StoredFile {
  id: string;
  size: number;
}

@Injectable()
export class FileStorage {
  private readonly dir = getConfig().filesDir;

  async save(meetingId: string, source: Readable): Promise<StoredFile> {
    const id = randomUUID();
    const tempDir = join(this.dir, '.tmp');
    const tempPath = join(tempDir, `${id}.part`);
    await mkdir(tempDir, { recursive: true });
    const target = createWriteStream(tempPath, { flags: 'wx' });
    try {
      await pipeline(source, target);
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

  async remove(meetingId: string, fileId: string) {
    await rm(this.path(meetingId, fileId), { force: true });
  }
}
