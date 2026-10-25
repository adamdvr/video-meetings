import { IQueryHandler, QueryHandler } from '@nestjs/cqrs';
import { PrismaService } from '../../prisma/prisma.service.js';
import { MeetingView, toMeetingView } from '../meeting.view.js';
import { ListMeetingsQuery } from './list-meetings.query.js';

@QueryHandler(ListMeetingsQuery)
export class ListMeetingsHandler implements IQueryHandler<
  ListMeetingsQuery,
  MeetingView[]
> {
  constructor(private readonly prisma: PrismaService) {}

  async execute({ ownerId }: ListMeetingsQuery) {
    const meetings = await this.prisma.meeting.findMany({
      where: { ownerId },
      orderBy: { date: 'asc' },
    });
    return meetings.map(toMeetingView);
  }
}
