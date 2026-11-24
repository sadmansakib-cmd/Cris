import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { ValidationPipe, Logger, RequestMethod } from '@nestjs/common';
import { NestExpressApplication } from '@nestjs/platform-express';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import cookieParser from 'cookie-parser';
import helmet from 'helmet';
import compression from 'compression';
import { AppModule } from './app.module';
import { AllExceptionsFilter } from './core/common/all-exceptions.filter';
import { ResponseTransformInterceptor } from './core/common/response.interceptor';
import { RequestIdMiddleware } from './core/common/request-id.middleware';

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule, {
    bufferLogs: true,
    // Trust the reverse proxy so req.ip and secure cookies work behind Nginx/Caddy.
    // Overridable via TRUST_PROXY (number of hops or "true"/"false").
  });
  const logger = new Logger('bootstrap');

  const trust = process.env.TRUST_PROXY ?? '1';
  app.set('trust proxy', /^\d+$/.test(trust) ? Number(trust) : trust === 'true');

  app.use(new RequestIdMiddleware().use.bind(new RequestIdMiddleware()));
  app.use(helmet({ contentSecurityPolicy: false }));
  app.use(compression());
  app.use(cookieParser());

  const origins = (process.env.APP_URL ?? 'http://localhost:5173')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
  app.enableCors({
    origin: origins,
    credentials: true,
    exposedHeaders: ['x-request-id'],
  });

  app.setGlobalPrefix('api', {
    exclude: [
      { path: 'health', method: RequestMethod.GET },
      { path: 'health/ready', method: RequestMethod.GET },
      { path: 'docs', method: RequestMethod.GET },
      { path: 'docs-json', method: RequestMethod.GET },
    ],
  });
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
      forbidNonWhitelisted: false,
    }),
  );
  app.useGlobalInterceptors(new ResponseTransformInterceptor());
  app.useGlobalFilters(new AllExceptionsFilter());

  if ((process.env.ENABLE_SWAGGER ?? 'true') !== 'false') {
    const config = new DocumentBuilder()
      .setTitle('HAULT API')
      .setDescription('HAULT modular AI OS backend')
      .setVersion(process.env.APP_VERSION ?? '0.1.0')
      .addBearerAuth()
      .addCookieAuth('hault_refresh')
      .build();
    const doc = SwaggerModule.createDocument(app, config);
    SwaggerModule.setup('docs', app, doc, {
      jsonDocumentUrl: 'docs-json',
      swaggerOptions: { persistAuthorization: true },
    });
  }

  const port = Number(process.env.API_PORT ?? 3000);
  await app.listen(port, '0.0.0.0');
  logger.log(`HAULT api listening on :${port} (docs: /docs)`);
}

bootstrap().catch((err) => {
  // eslint-disable-next-line no-console
  console.error(err);
  process.exit(1);
});
