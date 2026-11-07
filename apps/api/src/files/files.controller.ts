import {
  Controller,
  Get,
  Headers,
  Param,
  Post,
  Req,
  Res,
  UnsupportedMediaTypeException,
  UseGuards,
} from '@nestjs/common';
import { CommandBus, QueryBus } from '@nestjs/cqrs';
import type { Request, Response } from 'express';
import { CurrentUser } from '../auth/current-user.decorator.js';
import { type AuthUser, JwtAuthGuard } from '../auth/jwt-auth.guard.js';
import { GetMeetingQuery } from '../meetings/queries/get-meeting.query.js';
import { CreateMeetingFileCommand } from './commands/create-meeting-file.command.js';
import { parseFileName } from './file-name.js';
import { FileStorage } from './file-storage.js';
import type { MeetingFileView } from './meeting-file.view.js';
import { GetMeetingFileQuery } from './queries/get-meeting-file.query.js';
import { ListMeetingFilesQuery } from './queries/list-meeting-files.query.js';

const UPLOAD_CONTENT_TYPE = 'application/octet-stream';

@Controller('meetings/:meetingId/files')
@UseGuards(JwtAuthGuard)
export class FilesController {
  constructor(
    private readonly commandBus: CommandBus,
    private readonly queryBus: QueryBus,
    private readonly storage: FileStorage,
  ) {}

  @Post()
  async upload(
    @CurrentUser() user: AuthUser,
    @Param('meetingId') meetingId: string,
    @Headers('content-type') contentType: string | undefined,
    @Headers('x-file-name') fileName: string | undefined,
    @Req() request: Request,
  ): Promise<MeetingFileView> {
    await this.queryBus.execute(new GetMeetingQuery(user.id, meetingId));
    if (
      contentType?.split(';')[0].trim().toLowerCase() !== UPLOAD_CONTENT_TYPE
    ) {
      throw new UnsupportedMediaTypeException(
        `Content-Type must be ${UPLOAD_CONTENT_TYPE}`,
      );
    }
    const name = parseFileName(fileName);
    const stored = await this.storage.save(meetingId, request);
    try {
      return await this.commandBus.execute(
        new CreateMeetingFileCommand(meetingId, stored.id, name, stored.size),
      );
    } catch (error) {
      await this.storage.remove(meetingId, stored.id);
      throw error;
    }
  }

  @Get()
  list(
    @CurrentUser() user: AuthUser,
    @Param('meetingId') meetingId: string,
  ): Promise<MeetingFileView[]> {
    return this.queryBus.execute(new ListMeetingFilesQuery(user.id, meetingId));
  }

  @Get(':fileId')
  async download(
    @CurrentUser() user: AuthUser,
    @Param('meetingId') meetingId: string,
    @Param('fileId') fileId: string,
    @Res() response: Response,
  ) {
    const file = await this.queryBus.execute(
      new GetMeetingFileQuery(user.id, meetingId, fileId),
    );
    response.download(file.path, file.name, {
      cacheControl: false,
      headers: {
        'Content-Type': file.mimeType,
        'Cache-Control': 'private, no-cache',
        'X-Content-Type-Options': 'nosniff',
      },
    });
  }
}
