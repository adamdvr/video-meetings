import type { Meeting } from '../generated/prisma/client.js';

export interface MeetingView {
  id: string;
  title: string;
  date: Date;
  participants: string[];
}

export const toMeetingView = ({
  id,
  title,
  date,
  participants,
}: Meeting): MeetingView => ({ id, title, date, participants });
