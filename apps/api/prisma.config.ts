import { defineConfig } from 'prisma/config';
// Импорт подгружает корневой .env. DATABASE_URL нужен только командам миграций,
// для `prisma generate` он не обязателен.
import './src/config/configuration.js';

export default defineConfig({
  schema: 'prisma/schema.prisma',
  migrations: { path: 'prisma/migrations' },
  datasource: { url: process.env.DATABASE_URL ?? '' },
});
