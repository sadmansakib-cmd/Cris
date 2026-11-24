import { Controller, Get, Query, Redirect, Res, Req, BadRequestException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Request, Response } from 'express';
import { randomBytes, createHash } from 'node:crypto';
import { AuthService } from './auth.service';

type Provider = 'google' | 'github';

interface OAuthConfig {
  authUrl: string;
  tokenUrl: string;
  userUrl: string;
  scope: string;
  clientId: string;
  clientSecret: string;
  parseUser: (raw: any) => { email: string; name?: string; providerId: string };
}

@Controller('auth/oauth')
export class OAuthController {
  constructor(private readonly auth: AuthService, private readonly config: ConfigService) {}

  private getProviders(): Record<Provider, OAuthConfig> {
    return {
      google: {
        authUrl: 'https://accounts.google.com/o/oauth2/v2/auth',
        tokenUrl: 'https://oauth2.googleapis.com/token',
        userUrl: 'https://www.googleapis.com/oauth2/v3/userinfo',
        scope: 'openid email profile',
        clientId: this.config.get('OAUTH_GOOGLE_CLIENT_ID') || '',
        clientSecret: this.config.get('OAUTH_GOOGLE_CLIENT_SECRET') || '',
        parseUser: (u) => ({ email: u.email, name: u.name, providerId: u.sub }),
      },
      github: {
        authUrl: 'https://github.com/login/oauth/authorize',
        tokenUrl: 'https://github.com/login/oauth/access_token',
        userUrl: 'https://api.github.com/user',
        scope: 'read:user user:email',
        clientId: this.config.get('OAUTH_GITHUB_CLIENT_ID') || '',
        clientSecret: this.config.get('OAUTH_GITHUB_CLIENT_SECRET') || '',
        parseUser: (u) => ({ email: u.email, name: u.name || u.login, providerId: String(u.id) }),
      },
    };
  }

  private getApiUrl(): string {
    const url = this.config.get('API_URL');
    if (url) return url;
    return `http://localhost:${this.config.get('API_PORT') || 3000}`;
  }

  private getAppUrl(): string {
    return this.config.get('APP_URL') || 'http://localhost:5173';
  }

  @Get(':provider/start')
  @Redirect()
  start(@Query('provider') _q: string, @Req() req: Request, @Res({ passthrough: true }) res: Response) {
    const provider = req.params.provider as Provider;
    const cfg = this.getProviders()[provider];
    if (!cfg?.clientId) throw new BadRequestException('provider not configured');
    const state = randomBytes(24).toString('hex');
    const verifier = randomBytes(32).toString('base64url');
    const challenge = createHash('sha256').update(verifier).digest('base64url');
    res.cookie(`oauth_${provider}`, JSON.stringify({ state, verifier }), {
      httpOnly: true, sameSite: 'lax', secure: this.config.get('NODE_ENV') === 'production', maxAge: 600_000,
    });
    const url = new URL(cfg.authUrl);
    url.searchParams.set('client_id', cfg.clientId);
    url.searchParams.set('redirect_uri', `${this.getApiUrl()}/api/auth/oauth/${provider}/callback`);
    url.searchParams.set('response_type', 'code');
    url.searchParams.set('scope', cfg.scope);
    url.searchParams.set('state', state);
    url.searchParams.set('code_challenge', challenge);
    url.searchParams.set('code_challenge_method', 'S256');
    return { url: url.toString() };
  }

  @Get(':provider/callback')
  @Redirect()
  async callback(@Req() req: Request, @Res({ passthrough: true }) res: Response, @Query('code') code: string, @Query('state') state: string) {
    const provider = req.params.provider as Provider;
    const cfg = this.getProviders()[provider];
    const raw = req.cookies?.[`oauth_${provider}`];
    if (!raw) throw new BadRequestException('missing oauth cookie');
    const { state: expected, verifier } = JSON.parse(raw);
    if (state !== expected) throw new BadRequestException('state mismatch');
    res.clearCookie(`oauth_${provider}`);

    const tokenRes = await fetch(cfg.tokenUrl, {
      method: 'POST',
      headers: { 'content-type': 'application/x-www-form-urlencoded', accept: 'application/json' },
      body: new URLSearchParams({
        grant_type: 'authorization_code',
        code,
        client_id: cfg.clientId,
        client_secret: cfg.clientSecret,
        redirect_uri: `${this.getApiUrl()}/api/auth/oauth/${provider}/callback`,
        code_verifier: verifier,
      }),
    });
    const tokens = await tokenRes.json();
    if (!tokens.access_token) throw new BadRequestException('Failed to get access token');
    const userRes = await fetch(cfg.userUrl, { headers: { authorization: `Bearer ${tokens.access_token}`, 'user-agent': 'hault' } });
    const user = cfg.parseUser(await userRes.json());

    const { accessToken, refreshToken } = await this.auth.upsertOAuthUser({ provider, ...user });
    const isProd = this.config.get('NODE_ENV') === 'production';
    res.cookie('hault_at', accessToken, { httpOnly: true, sameSite: 'lax', secure: isProd });
    res.cookie('hault_rt', refreshToken, { httpOnly: true, sameSite: 'lax', secure: isProd, path: '/api/auth' });
    return { url: this.getAppUrl() };
  }
}
