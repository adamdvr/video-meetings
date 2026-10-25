export class CreateMeetingCommand {
  constructor(
    public readonly ownerId: string,
    public readonly title: string,
    public readonly date: Date,
    public readonly participants: string[],
  ) {}
}
