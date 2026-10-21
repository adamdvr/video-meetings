import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module.js';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  // Порт 3000 занимает Next.js (apps/web), поэтому API по умолчанию слушает 4000.
  await app.listen(process.env.PORT ?? 4000);
}
await bootstrap();
