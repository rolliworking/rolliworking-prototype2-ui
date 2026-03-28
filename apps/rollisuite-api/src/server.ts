import Fastify from 'fastify';
import cors from '@fastify/cors';
import jwt from '@fastify/jwt';
import multipart from '@fastify/multipart';
import rateLimit from '@fastify/rate-limit';
import { config } from './config';
import { prisma } from './db/client';
import { initializeCronJobs } from './cron';

// Import route modules
import apiRoutes from './routes/api';
import webhookRoutes from './routes/webhooks';
import publicRoutes from './routes/public';

const server = Fastify({
  logger: {
    level: config.logLevel,
    transport:
      config.env === 'development'
        ? {
            target: 'pino-pretty',
            options: {
              translateTime: 'HH:MM:ss Z',
              ignore: 'pid,hostname',
            },
          }
        : undefined,
  },
});

async function start() {
  try {
    // Register plugins
    await server.register(cors, {
      origin: config.webUrl,
      credentials: true,
    });

    await server.register(jwt, {
      secret: config.jwtSecret,
    });

    await server.register(multipart, {
      limits: {
        fileSize: 10 * 1024 * 1024, // 10 MB
      },
    });

    await server.register(rateLimit, {
      max: config.rateLimitMaxRequests,
      timeWindow: config.rateLimitWindowMs,
    });

    // Register routes
    await server.register(apiRoutes, { prefix: '/api' });
    await server.register(webhookRoutes, { prefix: '/webhooks' });
    await server.register(publicRoutes, { prefix: '/public' });

    // Health check
    server.get('/health', async () => {
      return { status: 'ok', timestamp: new Date().toISOString() };
    });

    // Test database connection
    await prisma.$connect();
    server.log.info('✅ Database connected');

    // Initialize cron jobs
    if (config.enableCronJobs) {
      initializeCronJobs();
      server.log.info('✅ Cron jobs initialized');
    }

    // Start server
    await server.listen({ port: config.apiPort, host: '0.0.0.0' });
    server.log.info(
      `🚀 RolliSuite API running on http://localhost:${config.apiPort}`
    );
  } catch (err) {
    server.log.error(err);
    process.exit(1);
  }
}

// Graceful shutdown
process.on('SIGINT', async () => {
  await server.close();
  await prisma.$disconnect();
  process.exit(0);
});

start();
