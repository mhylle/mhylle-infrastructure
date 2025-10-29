import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { ConfigService } from '@nestjs/config';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  const configService = app.get(ConfigService);

  // CORS configuration
  app.enableCors({
    origin: '*',
    credentials: true,
  });

  // Global prefix
  app.setGlobalPrefix('api/notes');

  // DNS resolution fix
  const dns = require('dns');
  dns.setDefaultResultOrder('ipv4first');

  const port = configService.get('port');
  await app.listen(port);
  console.log(`Application running on: http://localhost:${port}`);
}
bootstrap();
