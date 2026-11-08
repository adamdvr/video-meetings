import {
  Controller,
  Get,
  Headers,
  HttpException,
  HttpStatus,
  BadRequestException,
  Param,
  PayloadTooLargeException,
  Post,
  Req,
  Res,
  UnsupportedMediaTypeException,
  UseFilters,
  UseGuards,
} from '@nestjs/common';
import { CommandBus, QueryBus } from '@nestjs/cqrs';
import type { Request, Response } from 'express';
import { CurrentUser } from '../auth/current-user.decorator.js';
import { getConfig } from '../config/configuration.js';
import { type AuthUser, JwtAuthGuard } from '../auth/jwt-auth.guard.js';
import { GetMeetingQuery } from '../meetings/queries/get-meeting.query.js';
import { CreateMeetingFileCommand } from './commands/create-meeting-file.command.js';
import { formatOf, MAX_FILE_SIZE } from './file-formats.js';
import { parseFileName } from './file-name.js';
import { FileStorage } from './file-storage.js';
import type { MeetingFileView } from './meeting-file.view.js';
import { GetMeetingFileQuery } from './queries/get-meeting-file.query.js';
import { ListMeetingFilesQuery } from './queries/list-meeting-files.query.js';
import { UploadExceptionFilter } from './upload-exception.filter.js';

const UPLOAD_CONTENT_TYPE = 'application/octet-stream';

@Controller('meetings/:meetingId/files')
@UseGuards(JwtAuthGuard)
export class FilesController {
  private readonly idleTimeoutMs = getConfig().uploadIdleTimeoutMs;

  constructor(
    private readonly commandBus: CommandBus,
    private readonly queryBus: QueryBus,
    private readonly storage: FileStorage,
  ) {}

  @Post()
  @UseFilters(UploadExceptionFilter)
  async upload(
    @CurrentUser() user: AuthUser,
    @Param('meetingId') meetingId: string,
    @Headers('content-type') contentType: string | undefined,
    @Headers('x-file-name') fileName: string | undefined,
    @Headers('content-length') contentLength: string | undefined,
    @Req() request: Request,
    @Res({ passthrough: true }) response: Response,
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
    if (contentLength === undefined) {
      throw new HttpException(
        'Content-Length is required',
        HttpStatus.LENGTH_REQUIRED,
      );
    }
    const size = Number(contentLength);
    if (size === 0) {
      throw new BadRequestException('File is empty');
    }
    if (size > MAX_FILE_SIZE) {
      throw new PayloadTooLargeException('File is larger than 1 GiB');
    }
    const format = formatOf(name);
    if (!format) {
      throw new UnsupportedMediaTypeException('File format is not allowed');
    }
    request.setTimeout(this.idleTimeoutMs, () => request.destroy());
    const stored = await this.storage.save(
      meetingId,
      request,
      size,
      format.signature,
    );
    try {
      const file = await this.commandBus.execute(
        new CreateMeetingFileCommand(meetingId, stored.id, name, stored.size),
      );
      response.location(`/meetings/${meetingId}/files/${file.id}`);
      return file;
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
      dotfiles: 'allow',
      headers: {
        'Content-Type': file.contentType,
        'Cache-Control': 'private, no-cache',
        'X-Content-Type-Options': 'nosniff',
      },
    });
  }
}
