import { NotFoundException } from '@nestjs/common';
import { IQueryHandler, QueryBus, QueryHandler } from '@nestjs/cqrs';
import { GetMeetingQuery } from '../../meetings/queries/get-meeting.query.js';
import { PrismaService } from '../../prisma/prisma.service.js';
import { FileStorage } from '../file-storage.js';
import { StoredMeetingFile, toMeetingFileView } from '../meeting-file.view.js';
import { GetMeetingFileQuery } from './get-meeting-file.query.js';

@QueryHandler(GetMeetingFileQuery)
export class GetMeetingFileHandler implements IQueryHandler<
  GetMeetingFileQuery,
  StoredMeetingFile
> {
  constructor(
    private readonly prisma: PrismaService,
    private readonly queryBus: QueryBus,
    private readonly storage: FileStorage,
  ) {}

  async execute({ ownerId, meetingId, fileId }: GetMeetingFileQuery) {
    await this.queryBus.execute(new GetMeetingQuery(ownerId, meetingId));
    const file = await this.prisma.meetingFile.findFirst({
      where: { id: fileId, meetingId },
    });
    if (!file) {
      throw new NotFoundException('File not found');
    }
    return {
      ...toMeetingFileView(file),
      path: this.storage.path(meetingId, fileId),
    };
  }
}
