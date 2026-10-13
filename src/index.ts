import { buildApp, prisma } from './app';
import { env } from './config/env';
import { startTrialClaimMonitor } from './modules/account/trial-monitor.service';

async function main() {
  const app = await buildApp();

  try {
    await prisma.$connect();
    app.log.info('Database connected');

    await app.listen({
      port: env.PORT,
      host: '0.0.0.0',
    });
    app.log.info(
      `Agent Layer running on port ${env.PORT}`
    );
    const stopTrialClaimMonitor = startTrialClaimMonitor(app.log);

    app.addHook('onClose', async () => {
      stopTrialClaimMonitor();
    });
  } catch (err) {
    app.log.fatal(err, 'Failed to start server');
    process.exit(1);
  }

  const shutdown = async () => {
    app.log.info('Shutting down...');
    await app.close();
    await prisma.$disconnect();
    process.exit(0);
  };

  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);
}

main();
