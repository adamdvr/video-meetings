import type { MeetingFile } from '../generated/prisma/client.js';

export interface MeetingFileView {
  id: string;
  name: string;
  size: number;
  mimeType: string;
  createdAt: Date;
}

export interface StoredMeetingFile extends MeetingFileView {
  path: string;
  contentType: string;
  viewDisposition: string;
}

export const toMeetingFileView = ({
  id,
  originalName,
  size,
  mimeType,
  createdAt,
}: MeetingFile): MeetingFileView => ({
  id,
  name: originalName,
  size: Number(size),
  mimeType,
  createdAt,
});
