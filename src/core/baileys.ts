import makeWASocket, {
  useMultiFileAuthState,
  DisconnectReason,
  WASocket,
  proto,
  delay,
  fetchLatestBaileysVersion
} from '@whiskeysockets/baileys';
import { Boom } from '@hapi/boom';
import path from 'path';
import fs from 'fs';
import pino from 'pino';
import { logger, logMessage } from '../utils/logger';
import { notifyConnectionAlert } from '../utils/monitoring';
import { addPendingImageMessage, addPendingTextMessage, consumePendingMessages } from './pendingMessages';

// Store de sockets y QR codes
const activeSockets: Map<string, WASocket> = new Map();
const qrCodes: Map<string, string> = new Map();
const connectionStatus: Map<string, 'disconnected' | 'connecting' | 'connected'> = new Map();
const normalizeText = (value: string) =>
  value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^\p{L}\p{N}\s]/gu, '')
    .trim()
    .toLowerCase();

const normalizePhoneInput = (value: string): string => {
  const cleanNumber = value.replace(/[\s\-\(\)]/g, '');
  if (!cleanNumber.startsWith('+')) {
    throw new Error(`El número debe tener formato internacional con +. Recibido: ${value}`);
  }

  const digitsOnly = cleanNumber.replace(/^\+/, '');
  if (!/^\d+$/.test(digitsOnly)) {
    throw new Error(`El número ${value} contiene caracteres no válidos`);
  }
  return digitsOnly;
};

const jidToNormalizedNumber = (jid?: string | null): string | null => {
  if (!jid) return null;
  if (!jid.endsWith('@s.whatsapp.net')) return null;
  const raw = jid.split('@')[0];
  const digits = raw.replace(/[^\d]/g, '');
  return digits || null;
};

class WaitingForContactError extends Error {
  public code = 'WAITING_CONTACT';
  public data: {
    pendingId: string;
    instanceId: string;
    to: string;
    normalizedNumber: string;
    type: 'text' | 'image';
  };

  constructor(
    message: string,
    data: { pendingId: string; instanceId: string; to: string; normalizedNumber: string; type: 'text' | 'image' }
  ) {
    super(message);
    this.name = 'WaitingForContactError';
    this.data = data;
    Object.setPrototypeOf(this, WaitingForContactError.prototype);
  }
}

async function downloadImageBuffer(mediaUrl: string): Promise<Buffer> {
  const response = await fetch(mediaUrl);
  if (!response.ok) {
    throw new Error(`Error al descargar imagen: ${response.status} - ${response.statusText}`);
  }
  return Buffer.from(await response.arrayBuffer());
}

async function processPendingMessagesForContact(instanceId: string, sock: WASocket, from: string) {
  const normalizedNumber = jidToNormalizedNumber(from);
  if (!normalizedNumber) {
    return;
  }

  const pending = await consumePendingMessages(instanceId, normalizedNumber);
  if (!pending.length) {
    return;
  }

  console.log(`[${instanceId}] 🔁 Encontrados ${pending.length} mensajes pendientes para ${from}. Enviando...`);

  for (const pendingMessage of pending) {
    try {
      logMessage.send(instanceId, pendingMessage.type, pendingMessage.to, 'deferred', {
        pendingId: pendingMessage.id,
        trigger: 'contact_reply',
      });

      await delay(500);
      if (pendingMessage.type === 'text') {
        await sock.sendMessage(from, { text: pendingMessage.message });
      } else if (pendingMessage.type === 'image') {
        const buffer = await downloadImageBuffer(pendingMessage.mediaUrl);
        await sock.sendMessage(from, { image: buffer });
      }

      logMessage.send(instanceId, pendingMessage.type, pendingMessage.to, 'sent', {
        pendingId: pendingMessage.id,
        trigger: 'contact_reply',
      });

      console.log(`[${instanceId}] ✅ Mensaje pendiente ${pendingMessage.id} enviado tras respuesta del contacto`);
    } catch (error: any) {
      logger.error('Error al enviar mensaje pendiente', {
        event: 'message.pending.error',
        instanceId,
        to: pendingMessage.to,
        pendingId: pendingMessage.id,
        error: error.message,
      });
      logMessage.send(instanceId, pendingMessage.type, pendingMessage.to, 'failed', {
        pendingId: pendingMessage.id,
        trigger: 'contact_reply',
        error: error.message,
      });
    }
  }
}

export interface MessagePayload {
  instanceId: string;
  to: string;
  type: 'text' | 'image';
  message?: string;
  mediaUrl?: string;
}

/**
 * Inicializa una instancia de WhatsApp
 */
export async function initInstance(instanceId: string, force: boolean = false): Promise<void> {
  // Si la instancia ya existe y no estamos forzando, verificar si tiene QR
  if (activeSockets.has(instanceId) && !force) {
    const existingQR = qrCodes.get(instanceId);
    const existingStatus = connectionStatus.get(instanceId);
    
    // Si no tiene QR y está desconectado, forzar reinicio
    if (!existingQR && existingStatus === 'disconnected') {
      logger.info(`[${instanceId}] Instancia existe pero sin QR, reiniciando...`);
      force = true;
    } else {
      logger.info(`[${instanceId}] Instancia ya existe`);
      return;
    }
  }
  
  // Si estamos forzando, limpiar la instancia existente
  if (force && activeSockets.has(instanceId)) {
    const oldSock = activeSockets.get(instanceId);
    if (oldSock) {
      try {
        await oldSock.logout();
      } catch (e) {
        // Ignorar errores al hacer logout
      }
    }
    activeSockets.delete(instanceId);
    qrCodes.delete(instanceId);
    connectionStatus.delete(instanceId);
    logger.info(`[${instanceId}] Instancia anterior limpiada`);
  }

  const sessionDir = path.join(process.env.SESSION_DIR || './data/sessions', instanceId);
  
  // Crear directorio si no existe
  if (!fs.existsSync(sessionDir)) {
    fs.mkdirSync(sessionDir, { recursive: true });
  }

  logger.info(`[${instanceId}] Iniciando instancia...`);
  connectionStatus.set(instanceId, 'connecting');

  let { state, saveCreds } = await useMultiFileAuthState(sessionDir);
  const { version } = await fetchLatestBaileysVersion();

  // Verificar si hay credenciales guardadas
  const hasCredentials = state.creds.registered;
  const hasMe = !!state.creds.me?.id;
  
  console.log(`[${instanceId}] Estado de autenticación:`, {
    hasCredentials,
    me: state.creds.me?.id || 'no me',
    registered: state.creds.registered,
    hasMe
  });

  // SIEMPRE limpiar sesión si estamos forzando para garantizar QR nuevo
  if (force) {
    console.log(`[${instanceId}] 🔄 FORZANDO LIMPIEZA COMPLETA DE SESIÓN...`);
    try {
      // Eliminar TODO el directorio de sesión
      if (fs.existsSync(sessionDir)) {
        console.log(`[${instanceId}] Eliminando directorio completo: ${sessionDir}`);
        fs.rmSync(sessionDir, { recursive: true, force: true });
        console.log(`[${instanceId}] ✅ Directorio eliminado completamente`);
      }
      // Crear directorio nuevo
      fs.mkdirSync(sessionDir, { recursive: true });
      // Recargar estado SIN credenciales (sesión nueva)
      const reloaded = await useMultiFileAuthState(sessionDir);
      state = reloaded.state;
      saveCreds = reloaded.saveCreds;
      console.log(`[${instanceId}] ✅ Sesión completamente nueva creada, forzando QR`);
    } catch (e) {
      console.error(`[${instanceId}] ❌ Error limpiando sesión:`, e);
      throw e; // Lanzar error para que se vea
    }
  }

  // Crear socket con configuración optimizada para QR
  // Logger de pino para Baileys (silent para evitar spam, pero funcional)
  const baileysLogger = pino({ level: 'silent' });
  
  const sock = makeWASocket({
    auth: state,
    logger: baileysLogger, // Logger de pino válido
    version,
    markOnlineOnConnect: true,
    connectTimeoutMs: 60_000,
    defaultQueryTimeoutMs: 60_000,
    keepAliveIntervalMs: 10_000,
    // Configuración mínima para forzar QR
    browser: ['WhatsApp GHL Gateway', 'Chrome', '1.0.0'],
  });

  // IMPORTANTE: Registrar eventos INMEDIATAMENTE después de crear el socket
  // Guardar credenciales
  sock.ev.on('creds.update', saveCreds);

  // Manejar actualizaciones de conexión - DEBE estar registrado ANTES de cualquier conexión
  sock.ev.on('connection.update', async (update) => {
    const { connection, lastDisconnect, qr, isNewLogin, isOnline } = update;

    // Log detallado para debugging - mostrar TODO
    console.log(`\n[${instanceId}] ========== connection.update ==========`);
    console.log(`[${instanceId}] connection:`, connection || 'undefined');
    console.log(`[${instanceId}] hasQR:`, !!qr);
    console.log(`[${instanceId}] qrLength:`, qr ? qr.length : 0);
    console.log(`[${instanceId}] isNewLogin:`, isNewLogin);
    console.log(`[${instanceId}] isOnline:`, isOnline);
    if (lastDisconnect) {
      const statusCode = (lastDisconnect.error as Boom)?.output?.statusCode;
      console.log(`[${instanceId}] ❌ Disconnect - StatusCode:`, statusCode);
      console.log(`[${instanceId}] ❌ Error:`, lastDisconnect.error);
    }
    console.log(`[${instanceId}] =========================================\n`);

    // Si hay QR, guardarlo inmediatamente y mostrar
    if (qr) {
      const qrString = String(qr);
      logger.info(`[${instanceId}] 🔷 QR generado: ${qrString.substring(0, 20)}... (longitud: ${qrString.length})`);
      qrCodes.set(instanceId, qrString);
      connectionStatus.set(instanceId, 'connecting'); // Asegurar estado
      console.log(`\n${'='.repeat(50)}`);
      console.log(`[${instanceId}] ✅✅✅ QR DISPONIBLE PARA ESCANEAR ✅✅✅`);
      console.log(`[${instanceId}] QR completo: ${qrString}`);
      console.log(`[${instanceId}] QR guardado: ${qrCodes.has(instanceId)}`);
      console.log(`${'='.repeat(50)}\n`);
    }

    if (connection === 'open') {
      logMessage.connection(instanceId, 'connected');
      connectionStatus.set(instanceId, 'connected');
      qrCodes.delete(instanceId); // Limpiar QR después de conectar
      console.log(`[${instanceId}] ✅ Socket abierto y listo para enviar mensajes`);
      console.log(`[${instanceId}] Usuario autenticado:`, sock.user ? 'Sí' : 'No');
      if (sock.user) {
        console.log(`[${instanceId}] ID de usuario:`, sock.user.id);
      }

      await notifyConnectionAlert({
        instanceId,
        status: 'connected',
        details: {
          isNewLogin,
          isOnline,
        },
      });
    }

    if (connection === 'close') {
      const statusCode = (lastDisconnect?.error as Boom)?.output?.statusCode;
      const shouldReconnect = statusCode !== DisconnectReason.loggedOut;

      logger.warn(`[${instanceId}] Conexión cerrada. StatusCode: ${statusCode}`);

      if (shouldReconnect) {
        logger.info(`[${instanceId}] Reconectando en 3s...`);
        connectionStatus.set(instanceId, 'connecting');
        activeSockets.delete(instanceId);
        setTimeout(() => initInstance(instanceId), 3000);
      } else {
        logMessage.connection(instanceId, 'disconnected', { reason: 'logged_out' });
        connectionStatus.set(instanceId, 'disconnected');
        activeSockets.delete(instanceId);
      }

      await notifyConnectionAlert({
        instanceId,
        status: shouldReconnect ? 'connecting' : 'disconnected',
        reason: shouldReconnect ? 'lost_connection' : 'logged_out',
        details: {
          statusCode,
        },
      });
    }

    // Si está conectando pero no hay QR y no está conectado, puede ser que necesite QR
    if (connection === 'connecting' && !qr && !activeSockets.get(instanceId)) {
      console.log(`[${instanceId}] ⏳ Esperando QR...`);
      await notifyConnectionAlert({
        instanceId,
        status: 'connecting',
      });
    }
  });

  // Manejar mensajes entrantes
  sock.ev.on('messages.upsert', async (m) => {
    const autoReplyEnabled = process.env.AUTO_REPLY_ENABLED !== 'false';
    const autoReplyMessage = process.env.AUTO_REPLY_MESSAGE || '¡Hola! 👋';
    const autoReplyKeywords = (process.env.AUTO_REPLY_KEYWORDS || 'hola')
      .split(',')
      .map((keyword) => keyword.trim())
      .filter(Boolean);
    const normalizedKeywords = autoReplyKeywords
      .map((keyword) => normalizeText(keyword))
      .filter(Boolean);

    for (const msg of m.messages) {
      if (!msg.message || msg.key.fromMe) continue;

      const text = msg.message.conversation || msg.message.extendedTextMessage?.text;
      const from = msg.key.remoteJid;

      if (text && from) {
        const normalizedText = normalizeText(text);

        // Log del mensaje recibido
        console.log(`\n[${instanceId}] 📩 MENSAJE RECIBIDO:`);
        console.log(`[${instanceId}] De: ${from}`);
        console.log(`[${instanceId}] Texto: ${text}`);
        console.log(`[${instanceId}] Normalizado: ${normalizedText || '(vacío)'}`);
        console.log(`[${instanceId}] =========================\n`);
        
        logMessage.receive(instanceId, from, text);
        
        if (autoReplyEnabled && normalizedText) {
          const shouldAutoReply = normalizedKeywords.some((keyword) => {
            if (!keyword) return false;
            const words = normalizedText.split(/\s+/);
            return words.includes(keyword);
          });

          if (shouldAutoReply) {
            console.log(`[${instanceId}] 🤖 Enviando auto-respuesta a ${from}...`);
            await delay(1000);
            try {
              await sock.sendMessage(from, { text: autoReplyMessage });
              console.log(`[${instanceId}] ✅ Auto-respuesta enviada exitosamente`);
              logger.info('Respuesta automática enviada', {
                event: 'message.auto_reply',
                instanceId,
                to: from,
                received: text,
                reply: autoReplyMessage,
              });
            } catch (error: any) {
              console.error(`[${instanceId}] ❌ Error al enviar auto-respuesta:`, error.message);
              logger.error('Error al enviar auto-respuesta', {
                event: 'message.auto_reply.error',
                instanceId,
                to: from,
                error: error.message,
              });
            }
          }
        }

        await processPendingMessagesForContact(instanceId, sock, from);
      }
    }
  });

  activeSockets.set(instanceId, sock);
  logger.info(`[${instanceId}] Socket registrado y eventos configurados`);
  
  // Log adicional para verificar que el socket está listo
  console.log(`[${instanceId}] ✅ Socket creado y listo. Esperando eventos de conexión...`);
  
  // Verificar después de un segundo si hay QR (para debugging)
  setTimeout(() => {
    const hasQR = qrCodes.has(instanceId);
    const status = connectionStatus.get(instanceId);
    console.log(`[${instanceId}] 📊 Estado después de 1s:`, {
      hasQR,
      status,
      socketExists: activeSockets.has(instanceId)
    });
  }, 1000);
}

/**
 * Obtiene el QR code de una instancia
 */
export function getQRCode(instanceId: string): string | undefined {
  return qrCodes.get(instanceId);
}

/**
 * Obtiene el estado de conexión
 */
export function getConnectionStatus(instanceId: string): string {
  return connectionStatus.get(instanceId) || 'disconnected';
}

/**
 * Obtiene el socket activo
 */
export function getSocket(instanceId: string): WASocket | undefined {
  return activeSockets.get(instanceId);
}

/**
 * Envía un mensaje de texto
 */
export async function sendTextMessage(instanceId: string, to: string, message: string): Promise<void> {
  const sock = activeSockets.get(instanceId);
  if (!sock) {
    throw new Error(`Instancia ${instanceId} no está conectada - socket no encontrado`);
  }

  // Verificar estado de conexión
  const status = connectionStatus.get(instanceId);
  if (status !== 'connected') {
    throw new Error(`Instancia ${instanceId} no está conectada. Estado: ${status}`);
  }

  // Verificar que el socket esté realmente conectado y autenticado
  if (sock.user === undefined) {
    logger.error('Socket no autenticado', {
      event: 'message.send.not_authenticated',
      instanceId,
      to,
    });
    throw new Error(`Socket de ${instanceId} no está autenticado (user es undefined)`);
  }

  // Verificar que el socket tenga las propiedades necesarias
  console.log(`[${instanceId}] Verificando socket:`, {
    hasUser: !!sock.user,
    userId: sock.user?.id,
    userJid: sock.user?.jid,
  });

  logger.info('Preparando envío de mensaje', {
    event: 'message.send.preparing',
    instanceId,
    to,
    messageLength: message.length,
    userExists: !!sock.user,
  });

  // Formatear JID correctamente usando onWhatsApp para normalizar
  let jid: string;
  if (to.includes('@')) {
    jid = to;
  } else {
    const digitsOnly = normalizePhoneInput(to);

    const normalizedNumber = `${digitsOnly}@s.whatsapp.net`;
    console.log(`[${instanceId}] 🔍 Normalizando número ${digitsOnly} -> ${normalizedNumber}`);
    const lookup = await sock.onWhatsApp(normalizedNumber);
    console.log(`[${instanceId}] 🔍 Resultado onWhatsApp:`, lookup);

    if (!lookup || lookup.length === 0 || !lookup[0].jid || lookup[0].exists === false) {
      const pending = await addPendingTextMessage(instanceId, to, digitsOnly, message, 'contact_inactive');
      logMessage.send(instanceId, 'text', to, 'waiting_contact', {
        pendingId: pending.id,
        reason: 'contact_inactive',
      });
      console.warn(
        `[${instanceId}] ⏳ No podemos escribir a ${to} todavía. El envío se realizará automáticamente cuando la persona nos hable.`
      );
      throw new WaitingForContactError(
        `El número ${to} no ha iniciado una conversación. Se enviará automáticamente cuando nos escriba.`,
        {
          pendingId: pending.id,
          instanceId,
          to,
          normalizedNumber: digitsOnly,
          type: 'text',
        }
      );
    }
    
    const contact = lookup[0];
    jid = contact.jid;
  }
 
  console.log(`[${instanceId}] 📤 Preparando envío:`, {
    to,
    jid,
    messageLength: message.length,
  });
  
  logger.info('Iniciando envío', {
    event: 'message.send.starting',
    instanceId,
    jid,
    originalTo: to,
  });
  
  // Enviar mensaje con logging detallado y timeout
  try {
    console.log(`[${instanceId}] 📤 Llamando a sendMessage(${jid}, "${message.substring(0, 30)}...")`);
    
    logger.info('Llamando a sendMessage...', {
      event: 'message.send.calling',
      instanceId,
      jid,
      messageLength: message.length,
    });
    
    // Verificar que el socket tenga la función sendMessage
    if (typeof sock.sendMessage !== 'function') {
      throw new Error(`Socket de ${instanceId} no tiene la función sendMessage`);
    }
    
    console.log(`[${instanceId}] Socket verificado, tiene sendMessage:`, typeof sock.sendMessage === 'function');
    
    // Crear promise con timeout de 15 segundos (más corto para detectar problemas rápido)
    const startTime = Date.now();
    
    console.log(`[${instanceId}] ⏳ Iniciando envío (timeout: 15s)...`);
    
    const sendPromise = sock.sendMessage(jid, { text: message });
    const timeoutPromise = new Promise((_, reject) => {
      setTimeout(() => {
        console.error(`\n[${instanceId}] ⏱️ TIMEOUT después de 15 segundos`);
        console.error(`[${instanceId}] ⚠️  El mensaje se está quedando colgado`);
        console.error(`[${instanceId}] Posibles causas:`);
        console.error(`[${instanceId}]   1. El número ${to} no tiene WhatsApp activo`);
        console.error(`[${instanceId}]   2. El número necesita estar en tus contactos de WhatsApp primero`);
        console.error(`[${instanceId}]   3. El número bloqueó tu cuenta`);
        console.error(`[${instanceId}]   4. Problema de conexión con los servidores de WhatsApp`);
        console.error(`[${instanceId}] 💡 SOLUCIÓN: Guarda el número ${to} en tus contactos de WhatsApp y vuelve a intentar\n`);
        reject(new Error(`Timeout: No se pudo enviar el mensaje a ${to} en 15 segundos. Guarda el número en tus contactos de WhatsApp y vuelve a intentar.`));
      }, 15000);
    });
    
    // Intentar enviar el mensaje con timeout
    console.log(`[${instanceId}] Ejecutando sock.sendMessage()...`);
    const result = await Promise.race([sendPromise, timeoutPromise]);
    const duration = Date.now() - startTime;
    
    console.log(`[${instanceId}] ✅ Mensaje enviado exitosamente en ${duration}ms`);
    console.log(`[${instanceId}] Resultado:`, result ? 'OK' : 'Sin resultado');
    
    logger.info('Mensaje enviado exitosamente', {
      event: 'message.send.success',
      instanceId,
      to,
      jid,
      duration,
      hasResult: !!result,
    });
    logMessage.send(instanceId, 'text', to, 'sent', { messageLength: message.length });
  } catch (error: any) {
    console.error(`[${instanceId}] ❌ Error al enviar mensaje:`, error.message);
    console.error(`[${instanceId}] Stack:`, error.stack);
    logger.error('Error al enviar mensaje de texto', {
      event: 'message.send.error',
      instanceId,
      to,
      jid,
      error: error.message,
      errorStack: error.stack,
    });
    throw error;
  }
}

/**
 * Envía una imagen
 */
export async function sendImageMessage(instanceId: string, to: string, imageUrl: string): Promise<void> {
  const sock = activeSockets.get(instanceId);
  if (!sock) {
    throw new Error(`Instancia ${instanceId} no está conectada`);
  }

  // Verificar que el socket esté realmente conectado
  if (sock.user === undefined) {
    throw new Error(`Socket de ${instanceId} no está autenticado`);
  }

  let jid: string;
  if (to.includes('@')) {
    jid = to;
  } else {
    const digitsOnly = normalizePhoneInput(to);

    const normalizedNumber = `${digitsOnly}@s.whatsapp.net`;
    console.log(`[${instanceId}] 🔍 Normalizando número ${digitsOnly} -> ${normalizedNumber}`);
    const lookup = await sock.onWhatsApp(normalizedNumber);
    console.log(`[${instanceId}] 🔍 Resultado onWhatsApp:`, lookup);

    if (!lookup || lookup.length === 0 || !lookup[0].jid || lookup[0].exists === false) {
      const pending = await addPendingImageMessage(instanceId, to, digitsOnly, imageUrl, 'contact_inactive');
      logMessage.send(instanceId, 'image', to, 'waiting_contact', {
        pendingId: pending.id,
        reason: 'contact_inactive',
      });
      console.warn(
        `[${instanceId}] ⏳ No podemos enviar imagen a ${to} todavía. Se enviará automáticamente cuando la persona nos hable.`
      );
      throw new WaitingForContactError(
        `El número ${to} no ha iniciado una conversación. La imagen se enviará automáticamente cuando nos escriba.`,
        {
          pendingId: pending.id,
          instanceId,
          to,
          normalizedNumber: digitsOnly,
          type: 'image',
        }
      );
    }
    
    const contact = lookup[0];
    jid = contact.jid;
  }

  const response = await fetch(imageUrl);
  if (!response.ok) {
    throw new Error(`Error al descargar imagen: ${response.statusText}`);
  }
  
  const buffer = Buffer.from(await response.arrayBuffer());
  
  // Enviar con timeout de 30 segundos (las imágenes pueden tardar más)
  const sendPromise = sock.sendMessage(jid, { image: buffer });
  const timeoutPromise = new Promise((_, reject) => 
    setTimeout(() => reject(new Error('Timeout: El envío de imagen tomó más de 30 segundos')), 30000)
  );

  try {
    await Promise.race([sendPromise, timeoutPromise]);
    logMessage.send(instanceId, 'image', to, 'sent', { 
      imageUrl, 
      imageSize: buffer.length 
    });
  } catch (error: any) {
    logger.error('Error al enviar imagen', {
      event: 'message.send.error',
      instanceId,
      to,
      error: error.message,
    });
    throw error;
  }
}

/**
 * Logout de una instancia
 */
export async function logoutInstance(instanceId: string): Promise<void> {
  const sock = activeSockets.get(instanceId);
  if (sock) {
    await sock.logout();
    activeSockets.delete(instanceId);
    qrCodes.delete(instanceId);
    connectionStatus.set(instanceId, 'disconnected');
    logger.info(`[${instanceId}] Logout ejecutado`);
  }
}

/**
 * Lista todas las instancias
 */
export function listInstances() {
  return Array.from(activeSockets.keys()).map(id => ({
    instanceId: id,
    status: connectionStatus.get(id) || 'disconnected',
    hasQR: qrCodes.has(id),
  }));
}
