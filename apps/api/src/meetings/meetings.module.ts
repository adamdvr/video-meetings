import { Module } from '@nestjs/common';
import { CqrsModule } from '@nestjs/cqrs';
import { CreateMeetingHandler } from './commands/create-meeting.handler.js';
import { MeetingsController } from './meetings.controller.js';
import { GetMeetingHandler } from './queries/get-meeting.handler.js';
import { ListMeetingsHandler } from './queries/list-meetings.handler.js';

@Module({
  imports: [CqrsModule],
  controllers: [MeetingsController],
  providers: [CreateMeetingHandler, ListMeetingsHandler, GetMeetingHandler],
})
export class MeetingsModule {}
