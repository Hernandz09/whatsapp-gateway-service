import express, { Express, Request, Response } from 'express';
import dotenv from 'dotenv';
import { qrRouter } from './api/qr.controller';
import { sendRouter } from './api/send.controller';
import { messageWorker } from './core/queue';
import { startQueueMonitor } from './core/queueMonitor';
import { logger } from './utils/logger';

// Cargar variables de entorno
dotenv.config();

const app: Express = express();
const PORT = process.env.PORT || 8080;

// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Logger simple de requests
app.use((req: Request, res: Response, next) => {
  console.log(`[${new Date().toISOString()}] ${req.method} ${req.path}`);
  next();
});

// Rutas
app.get('/', (req: Request, res: Response) => {
  res.json({
    service: 'WhatsApp GHL Gateway',
    version: '1.0.0',
    status: 'running',
    endpoints: {
      qr: 'GET /api/wa/qr/:instanceId',
      status: 'GET /api/wa/status/:instanceId',
      instances: 'GET /api/wa/instances',
      logout: 'POST /api/wa/logout/:instanceId',
      clear: 'POST /api/wa/clear/:instanceId',
      send: 'POST /api/send',
      stats: 'GET /api/send/stats',
    },
  });
});

app.use('/api/wa', qrRouter);
app.use('/api/send', sendRouter);

// Manejo de errores 404
app.use((req: Request, res: Response) => {
  res.status(404).json({
    success: false,
    error: 'Endpoint no encontrado',
  });
});

// Iniciar servidor
app.listen(PORT, async () => {
  console.log('\n🚀 WhatsApp GHL Gateway');
  console.log(`📡 Servidor corriendo en http://localhost:${PORT}`);
  console.log(`📂 Sesiones guardadas en: ${process.env.SESSION_DIR || './data/sessions'}`);
  
  // Inicializar worker de colas
  try {
    // El worker se inicializa automáticamente al importar
    logger.info('Worker de colas inicializado', {
      event: 'queue.worker.ready',
    });
    console.log('✅ Worker de colas activo');

    startQueueMonitor();
  } catch (error: any) {
    logger.warn('No se pudo conectar a Redis, el worker puede no funcionar', {
      event: 'queue.worker.error',
      error: error.message,
    });
    console.log('⚠️  Advertencia: Redis no disponible. Algunas funciones pueden no estar disponibles.');
    console.log('   Para desarrollo sin Redis, los mensajes se encolarán pero no se procesarán.');
  }
  
  console.log('\n✅ Listo para recibir requests\n');
});

// Manejo de cierre graceful
process.on('SIGTERM', async () => {
  logger.info('Cerrando aplicación...', { event: 'app.shutdown' });
  if (messageWorker) {
    await messageWorker.close();
  }
  process.exit(0);
});

process.on('SIGINT', async () => {
  logger.info('Cerrando aplicación...', { event: 'app.shutdown' });
  if (messageWorker) {
    await messageWorker.close();
  }
  process.exit(0);
});

export default app;
