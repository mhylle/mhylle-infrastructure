import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { ConfigService } from '@nestjs/config';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import { ValidationPipe } from '@nestjs/common';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  const configService = app.get(ConfigService);

  // Global validation pipe with type transformation
  app.useGlobalPipes(
    new ValidationPipe({
      transform: true,
      transformOptions: {
        enableImplicitConversion: true,
      },
    }),
  );

  // CORS configuration
  app.enableCors({
    origin: '*',
    credentials: true,
  });

  // Global prefix
  app.setGlobalPrefix('api/notes');

  // Swagger/OpenAPI Documentation
  const config = new DocumentBuilder()
    .setTitle('Notes System API')
    .setDescription('API for managing notes and tasks with AI-powered task extraction')
    .setVersion('1.0')
    .addTag('notes', 'Note management endpoints')
    .addTag('tasks', 'Task management endpoints')
    .build();
  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('api', app, document);

  // DNS resolution fix
  const dns = require('dns');
  dns.setDefaultResultOrder('ipv4first');

  const port = configService.get('port');
  await app.listen(port);
  console.log(`Application running on: http://localhost:${port}`);
  console.log(`Swagger UI available at: http://localhost:${port}/api`);
}
bootstrap();
