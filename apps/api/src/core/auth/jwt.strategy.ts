import { Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';

export interface JwtPayload {
  sub: string;
  iat?: number;
  exp?: number;
}

@Injectable()
export class JwtStrategy {
  constructor(private readonly jwt: JwtService) {}
  async verify(token: string): Promise<JwtPayload> {
    try {
      return await this.jwt.verifyAsync<JwtPayload>(token);
    } catch {
      throw new UnauthorizedException('Invalid token');
    }
  }
}
