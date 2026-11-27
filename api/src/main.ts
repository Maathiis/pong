import { Logger, ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import type { NestExpressApplication } from '@nestjs/platform-express';
import { AppModule } from './app.module.js';
import { corsOrigin } from './cors.js';

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule);
  app.setGlobalPrefix('api');
  // Derrière Caddy (réseau Docker privé) : la vraie adresse du client est dans X-Forwarded-For.
  // Indispensable pour que la limite de débit compte par joueur et pas pour « Caddy ».
  app.set('trust proxy', 'loopback, linklocal, uniquelocal');
  app.disable('x-powered-by'); // ne pas annoncer le framework (R4)
  app.enableCors({ origin: corsOrigin }); // R3 : appli mobile (pas d'Origin) et borne virtuelle locale
  app.enableShutdownHooks();
  app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
  const port = Number(process.env.PORT ?? 3000);
  await app.listen(port, '0.0.0.0');
  new Logger('Api').log(`API prête sur http://localhost:${port}/api`);
}
await bootstrap();
