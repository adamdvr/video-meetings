import { Logger, NotFoundException } from '@nestjs/common';
import { CommandHandler, ICommandHandler, QueryBus } from '@nestjs/cqrs';
import { GetMeetingQuery } from '../../meetings/queries/get-meeting.query.js';
import { PrismaService } from '../../prisma/prisma.service.js';
import { FileStorage } from '../file-storage.js';
import { DeleteMeetingFileCommand } from './delete-meeting-file.command.js';

@CommandHandler(DeleteMeetingFileCommand)
export class DeleteMeetingFileHandler implements ICommandHandler<
  DeleteMeetingFileCommand,
  void
> {
  private readonly logger = new Logger(DeleteMeetingFileHandler.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly queryBus: QueryBus,
    private readonly storage: FileStorage,
  ) {}

  async execute({ ownerId, meetingId, fileId }: DeleteMeetingFileCommand) {
    await this.queryBus.execute(new GetMeetingQuery(ownerId, meetingId));
    const { count } = await this.prisma.meetingFile.deleteMany({
      where: { id: fileId, meetingId },
    });
    if (count === 0) {
      throw new NotFoundException('File not found');
    }
    try {
      await this.storage.remove(meetingId, fileId);
    } catch (error) {
      this.logger.error(
        `Failed to remove file ${fileId} of meeting ${meetingId} from disk`,
        error instanceof Error ? error.stack : String(error),
      );
    }
  }
}
