import { BadRequestException } from '@nestjs/common';

const MAX_LENGTH = 255;
const FORBIDDEN_CHARACTERS = /[\p{Cc}/\\]/u;

export function parseFileName(header: string | undefined): string {
  let name: string;
  try {
    name = decodeURIComponent(header ?? '')
      .normalize('NFC')
      .trim();
  } catch {
    name = '';
  }
  if (!name || name.length > MAX_LENGTH || FORBIDDEN_CHARACTERS.test(name)) {
    throw new BadRequestException(
      'X-File-Name must be a URI-encoded file name',
    );
  }
  return name;
}
