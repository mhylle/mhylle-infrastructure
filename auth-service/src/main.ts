import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as cookieParser from 'cookie-parser';
import helmet from 'helmet';
import { AppModule } from './app.module';

// Add globalThis crypto fix for Node.js compatibility
if (!globalThis.crypto) {
  const { webcrypto } = require('crypto');
  globalThis.crypto = webcrypto as any;
}

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  const configService = app.get(ConfigService);

  // Security middleware
  app.use(helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        styleSrc: ["'self'", "'unsafe-inline'"],
        scriptSrc: ["'self'"],
        imgSrc: ["'self'", "data:", "https:"],
      },
    },
  }));

  // Cookie parser middleware
  app.use(cookieParser());

  // CORS configuration
  app.enableCors({
    origin: [
      'https://mhylle.com',
      'https://*.mhylle.com',
      configService.get('NODE_ENV') === 'development' ? 'http://localhost:4200' : '',
      configService.get('NODE_ENV') === 'development' ? 'http://localhost:4201' : '',
    ].filter(Boolean),
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
  });

  // Global validation pipe
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );

  // Global prefix for API routes
  app.setGlobalPrefix('api');

  const port = configService.get('PORT', 3000);
  await app.listen(port);
  
  console.log(`🚀 Auth service running on port ${port}`);
  console.log(`🔐 Environment: ${configService.get('NODE_ENV', 'development')}`);
}

bootstrap().catch((error) => {
  console.error('❌ Failed to start auth service:', error);
  process.exit(1);
});
