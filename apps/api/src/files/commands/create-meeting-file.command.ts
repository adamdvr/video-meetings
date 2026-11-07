import { Command } from '@nestjs/cqrs';
import type { MeetingFileView } from '../meeting-file.view.js';

export class CreateMeetingFileCommand extends Command<MeetingFileView> {
  constructor(
    public readonly meetingId: string,
    public readonly fileId: string,
    public readonly name: string,
    public readonly size: number,
  ) {
    super();
  }
}
