import { Query } from '@nestjs/cqrs';
import type { StoredMeetingFile } from '../meeting-file.view.js';

export class GetMeetingFileQuery extends Query<StoredMeetingFile> {
  constructor(
    public readonly ownerId: string,
    public readonly meetingId: string,
    public readonly fileId: string,
  ) {
    super();
  }
}
