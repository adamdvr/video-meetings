import { NotFoundException } from '@nestjs/common';
import { IQueryHandler, QueryHandler } from '@nestjs/cqrs';
import { PrismaService } from '../../prisma/prisma.service.js';
import { MeetingView, toMeetingView } from '../meeting.view.js';
import { GetMeetingQuery } from './get-meeting.query.js';

@QueryHandler(GetMeetingQuery)
export class GetMeetingHandler implements IQueryHandler<
  GetMeetingQuery,
  MeetingView
> {
  constructor(private readonly prisma: PrismaService) {}

  async execute({ ownerId, id }: GetMeetingQuery) {
    // Чужая встреча неотличима от несуществующей: не раскрываем её наличие.
    const meeting = await this.prisma.meeting.findFirst({
      where: { id, ownerId },
    });
    if (!meeting) {
      throw new NotFoundException('Meeting not found');
    }
    return toMeetingView(meeting);
  }
}
