import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { PrismaService } from '../../prisma/prisma.service.js';
import { mimeTypeOf } from '../file-formats.js';
import { MeetingFileView, toMeetingFileView } from '../meeting-file.view.js';
import { CreateMeetingFileCommand } from './create-meeting-file.command.js';

@CommandHandler(CreateMeetingFileCommand)
export class CreateMeetingFileHandler implements ICommandHandler<
  CreateMeetingFileCommand,
  MeetingFileView
> {
  constructor(private readonly prisma: PrismaService) {}

  async execute({ meetingId, fileId, name, size }: CreateMeetingFileCommand) {
    const file = await this.prisma.meetingFile.create({
      data: {
        id: fileId,
        meetingId,
        originalName: name,
        mimeType: mimeTypeOf(name),
        size,
      },
    });
    return toMeetingFileView(file);
  }
}
