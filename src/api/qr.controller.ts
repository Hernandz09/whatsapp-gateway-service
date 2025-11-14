import { Router, Request, Response } from 'express';
import {
  initInstance,
  getQRCode,
  getConnectionStatus,
  logoutInstance,
  listInstances,
} from '../core/baileys';
import QRCode from 'qrcode-terminal';
import path from 'path';
import fs from 'fs';

export const qrRouter = Router();

/**
 * GET /api/wa/qr/:instanceId
 * Genera y devuelve el QR code para escanear
 */
qrRouter.get('/qr/:instanceId', async (req: Request, res: Response) => {
  try {
    const { instanceId } = req.params;

    // Verificar estado primero
    const currentStatus = getConnectionStatus(instanceId);
    if (currentStatus === 'connected') {
      return res.json({
        success: true,
        instanceId,
        status: 'connected',
        message: 'Ya está conectado',
      });
    }

    // SIEMPRE forzar reinicio si no hay QR para garantizar generación
    const hasQR = getQRCode(instanceId);
    const shouldForce = !hasQR; // Forzar SIEMPRE que no haya QR
    
    console.log(`[${instanceId}] 🔄 Iniciando generación de QR (force=${shouldForce})...`);
    
    // Iniciar instancia (forzar si es necesario)
    await initInstance(instanceId, shouldForce);

    // Esperar hasta 15 segundos para que se genere el QR (polling cada 500ms)
    let qr: string | undefined;
    let status: string;
    let attempts = 0;
    const maxAttempts = 30; // 30 * 500ms = 15 segundos máximo

    console.log(`[${instanceId}] Esperando generación de QR...`);

    while (attempts < maxAttempts) {
      await new Promise(resolve => setTimeout(resolve, 500));
      
      qr = getQRCode(instanceId);
      status = getConnectionStatus(instanceId);

      // Si ya está conectado, retornar
      if (status === 'connected') {
        return res.json({
          success: true,
          instanceId,
          status: 'connected',
          message: 'Ya está conectado',
        });
      }

      // Si tenemos QR, salir del loop
      if (qr) {
        console.log(`[${instanceId}] ✅ QR encontrado después de ${attempts * 500}ms`);
        break;
      }

      // Log cada 2 segundos para debugging
      if (attempts % 4 === 0 && attempts > 0) {
        console.log(`[${instanceId}] ⏳ Esperando QR... (${attempts * 500}ms)`);
      }

      attempts++;
    }

    // Verificar estado final
    status = getConnectionStatus(instanceId);
    if (status === 'connected') {
      return res.json({
        success: true,
        instanceId,
        status: 'connected',
        message: 'Ya está conectado',
      });
    }

    if (!qr) {
      // Log detallado del estado actual
      console.log(`[${instanceId}] ❌ QR no encontrado después de ${attempts * 500}ms`);
      console.log(`[${instanceId}] Estado final:`, {
        status,
        hasQR: false,
        attempts,
        totalWaitTime: `${attempts * 500}ms`
      });
      
      return res.json({
        success: false,
        instanceId,
        status,
        message: `QR no disponible después de ${attempts * 500}ms. Revisa los logs del servidor para ver los eventos de conexión. Intenta limpiar la sesión con POST /api/wa/clear/${instanceId} y vuelve a intentar.`,
        debug: {
          attempts,
          waitTimeMs: attempts * 500,
          suggestion: 'Revisa la consola del servidor para ver los eventos connection.update'
        }
      });
    }

    // Mostrar QR en terminal para pruebas locales
    console.log(`\n🔷 QR Code para ${instanceId}:`);
    QRCode.generate(qr, { small: true });

    res.json({
      success: true,
      instanceId,
      status,
      qr,
      message: 'Escanea el QR con WhatsApp',
    });
  } catch (error: any) {
    console.error(`[ERROR] Error generando QR para ${req.params.instanceId}:`, error);
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

/**
 * GET /api/wa/status/:instanceId
 * Obtiene el estado de conexión
 */
qrRouter.get('/status/:instanceId', (req: Request, res: Response) => {
  const { instanceId } = req.params;
  const status = getConnectionStatus(instanceId);

  res.json({
    success: true,
    instanceId,
    status,
  });
});

/**
 * POST /api/wa/logout/:instanceId
 * Cierra la sesión de una instancia
 */
qrRouter.post('/logout/:instanceId', async (req: Request, res: Response) => {
  try {
    const { instanceId } = req.params;
    await logoutInstance(instanceId);

    res.json({
      success: true,
      message: `Instancia ${instanceId} desconectada`,
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

/**
 * POST /api/wa/clear/:instanceId
 * Limpia la sesión de una instancia para forzar nuevo QR
 */
qrRouter.post('/clear/:instanceId', async (req: Request, res: Response) => {
  try {
    const { instanceId } = req.params;
    
    // Cerrar sesión si está activa
    await logoutInstance(instanceId);
    
    // Eliminar directorio de sesión
    const sessionDir = path.join(process.env.SESSION_DIR || './data/sessions', instanceId);
    if (fs.existsSync(sessionDir)) {
      fs.rmSync(sessionDir, { recursive: true, force: true });
      console.log(`[${instanceId}] Sesión eliminada: ${sessionDir}`);
    }

    res.json({
      success: true,
      message: `Sesión de ${instanceId} eliminada. Puedes generar un nuevo QR ahora.`,
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

/**
 * GET /api/wa/instances
 * Lista todas las instancias
 */
qrRouter.get('/instances', (req: Request, res: Response) => {
  const instances = listInstances();

  res.json({
    success: true,
    instances,
  });
});
