import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  IsArray,
  IsDate,
  IsString,
  MaxLength,
  MinLength,
} from 'class-validator';

export class CreateMeetingDto {
  @IsString()
  @MinLength(1)
  @MaxLength(200)
  title: string;

  @Type(() => Date)
  @IsDate()
  date: Date;

  @IsArray()
  @ArrayMaxSize(100)
  @IsString({ each: true })
  participants: string[];
}
