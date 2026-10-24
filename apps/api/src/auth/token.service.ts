import { Injectable } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';

export interface AccessToken {
  accessToken: string;
}

@Injectable()
export class TokenService {
  constructor(private readonly jwt: JwtService) {}

  async issue(user: { id: string; email: string }): Promise<AccessToken> {
    return {
      accessToken: await this.jwt.signAsync({
        sub: user.id,
        email: user.email,
      }),
    };
  }
}
