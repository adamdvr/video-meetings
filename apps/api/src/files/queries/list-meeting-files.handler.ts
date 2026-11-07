import { IQueryHandler, QueryBus, QueryHandler } from '@nestjs/cqrs';
import { GetMeetingQuery } from '../../meetings/queries/get-meeting.query.js';
import { PrismaService } from '../../prisma/prisma.service.js';
import { MeetingFileView, toMeetingFileView } from '../meeting-file.view.js';
import { ListMeetingFilesQuery } from './list-meeting-files.query.js';

@QueryHandler(ListMeetingFilesQuery)
export class ListMeetingFilesHandler implements IQueryHandler<
  ListMeetingFilesQuery,
  MeetingFileView[]
> {
  constructor(
    private readonly prisma: PrismaService,
    private readonly queryBus: QueryBus,
  ) {}

  async execute({ ownerId, meetingId }: ListMeetingFilesQuery) {
    await this.queryBus.execute(new GetMeetingQuery(ownerId, meetingId));
    const files = await this.prisma.meetingFile.findMany({
      where: { meetingId },
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
    });
    return files.map(toMeetingFileView);
  }
}
