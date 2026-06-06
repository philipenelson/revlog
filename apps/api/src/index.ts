import 'dotenv/config';
import { createApp } from './app.js';
import { logger } from './lib/logger';

const PORT = Number(process.env['PORT'] ?? 3001);

const app = createApp();

app.listen(PORT, () => {
  logger.info({ port: PORT }, 'API server started');
});
