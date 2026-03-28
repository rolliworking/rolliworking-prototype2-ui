import { PrismaClient } from '@prisma/client';
import { config } from '../config';

export const prisma = new PrismaClient({
  log: config.enableQueryLogging
    ? ['query', 'info', 'warn', 'error']
    : ['warn', 'error'],
});

// Connection test
prisma.$connect().catch((err) => {
  console.error('Failed to connect to database:', err);
  process.exit(1);
});
