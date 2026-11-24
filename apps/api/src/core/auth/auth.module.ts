import { Global, Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { AuthService } from './auth.service';
import { AuthController } from './auth.controller';
import { OAuthController } from './oauth.controller';
import { WebAuthnController } from './webauthn.controller';
import { TotpService } from './totp.service';
import { JwtStrategy } from './jwt.strategy';
import { UsersModule } from '../users/users.module';

@Global()
@Module({
  imports: [
    UsersModule,
    JwtModule.registerAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        secret: config.getOrThrow<string>('JWT_SECRET'),
        signOptions: { expiresIn: Number(config.get('JWT_ACCESS_TTL') ?? 600) },
      }),
    }),
  ],
  controllers: [AuthController, OAuthController, WebAuthnController],
  providers: [AuthService, TotpService, JwtStrategy],
  exports: [AuthService, JwtStrategy],
})
export class AuthModule {}
