import { Query } from '@nestjs/cqrs';
import type { MeetingFileView } from '../meeting-file.view.js';

export class ListMeetingFilesQuery extends Query<MeetingFileView[]> {
  constructor(
    public readonly ownerId: string,
    public readonly meetingId: string,
  ) {
    super();
  }
}
