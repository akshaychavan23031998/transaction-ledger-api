import { app } from './app';
import { connectDatabase, disconnectDatabase, initializeDatabase } from './config/database';
import { env } from './config/env';
import { logger } from './common/logger/logger';

async function start(): Promise<void> {
  await connectDatabase();
  await initializeDatabase();
  const server = app.listen(env.PORT, () => {
    logger.info({ port: env.PORT }, 'server_started');
  });

  const shutdown = async (signal: string) => {
    logger.info({ signal }, 'shutdown_started');
    server.close(async () => {
      await disconnectDatabase();
      logger.info('shutdown_complete');
      process.exit(0);
    });
  };

  process.once('SIGINT', () => void shutdown('SIGINT'));
  process.once('SIGTERM', () => void shutdown('SIGTERM'));
}

start().catch((error: unknown) => {
  logger.fatal(
    { error: error instanceof Error ? error.message : String(error) },
    'server_start_failed',
  );
  process.exit(1);
});
