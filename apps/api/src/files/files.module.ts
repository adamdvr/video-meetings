import type { Server } from 'node:http';
import { Module, OnApplicationBootstrap } from '@nestjs/common';
import { HttpAdapterHost } from '@nestjs/core';
import { CqrsModule } from '@nestjs/cqrs';
import { MeetingsModule } from '../meetings/meetings.module.js';
import { CreateMeetingFileHandler } from './commands/create-meeting-file.handler.js';
import { FileStorage } from './file-storage.js';
import { FilesController } from './files.controller.js';
import { GetMeetingFileHandler } from './queries/get-meeting-file.handler.js';
import { ListMeetingFilesHandler } from './queries/list-meeting-files.handler.js';

const REQUEST_TIMEOUT_MS = 60 * 60 * 1000;

@Module({
  imports: [CqrsModule, MeetingsModule],
  controllers: [FilesController],
  providers: [
    FileStorage,
    CreateMeetingFileHandler,
    ListMeetingFilesHandler,
    GetMeetingFileHandler,
  ],
})
export class FilesModule implements OnApplicationBootstrap {
  constructor(private readonly adapterHost: HttpAdapterHost) {}

  onApplicationBootstrap() {
    const server = this.adapterHost.httpAdapter.getHttpServer() as Server;
    server.requestTimeout = REQUEST_TIMEOUT_MS;
  }
}
