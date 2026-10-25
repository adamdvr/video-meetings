import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { PrismaService } from '../../prisma/prisma.service.js';
import { MeetingView, toMeetingView } from '../meeting.view.js';
import { CreateMeetingCommand } from './create-meeting.command.js';

@CommandHandler(CreateMeetingCommand)
export class CreateMeetingHandler implements ICommandHandler<
  CreateMeetingCommand,
  MeetingView
> {
  constructor(private readonly prisma: PrismaService) {}

  async execute({ ownerId, title, date, participants }: CreateMeetingCommand) {
    const meeting = await this.prisma.meeting.create({
      data: { ownerId, title, date, participants },
    });
    return toMeetingView(meeting);
  }
}
