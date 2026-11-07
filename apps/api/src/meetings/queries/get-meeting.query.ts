import { Query } from '@nestjs/cqrs';
import type { MeetingView } from '../meeting.view.js';

export class GetMeetingQuery extends Query<MeetingView> {
  constructor(
    public readonly ownerId: string,
    public readonly id: string,
  ) {
    super();
  }
}
