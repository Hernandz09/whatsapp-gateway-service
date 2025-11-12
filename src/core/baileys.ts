import makeWASocket, {
  useMultiFileAuthState,
  DisconnectReason,
  WASocket,
} from "@whiskeysockets/baileys";
import path from "path";
import qrcode from "qrcode-terminal";

// --- Almacén simple en memoria para los QRs y Sockets ---
const qrCache = new Map<string, string>();
const sockCache = new Map<string, WASocket>();

// --- Funciones auxiliares que tu código necesita ---
function cacheQR(instanceId: string, qr: string) {
  qrCache.set(instanceId, qr);
  console.log(`[${instanceId}] QR Code:`);
  qrcode.generate(qr, { small: true }); // Muestra el QR en la terminal
}

function markOnline(instanceId: string) {
  console.log(`[${instanceId}] Connection OPEN`);
  qrCache.delete(instanceId); // Borramos el QR
}

function markOffline(instanceId: string) {
  console.log(`[${instanceId}] Connection CLOSE`);
  sockCache.delete(instanceId);
}

export function getLastQR(instanceId: string): string | undefined {
  return qrCache.get(instanceId);
}

export function getSock(instanceId: string): WASocket {
  const sock = sockCache.get(instanceId);
  if (!sock) throw new Error(`Socket not found for instance: ${instanceId}`);
  return sock;
}
// --- Fin de funciones auxiliares ---

export async function initInstance(instanceId: string) {
  // Si ya existe un socket, lo retornamos
  if (sockCache.get(instanceId)) return getSock(instanceId);

  const sessionPath = path.join(process.env.SESSION_DIR!, instanceId);
  const { state, saveCreds } = await useMultiFileAuthState(sessionPath);

  // --- 🔥 ESTA ES LA MODIFICACIÓN ---
  // Añadimos el logger para ver los logs de 'trace'
  const sock = makeWASocket({
    auth: state,
    printQRInTerminal: false,
  });
  // --- 🔥 FIN DE LA MODIFICACIÓN ---

  sockCache.set(instanceId, sock); // Guardamos el socket en caché

  sock.ev.on("creds.update", saveCreds);

  sock.ev.on("connection.update", (u) => {
    const { connection, lastDisconnect, qr } = u;

    if (qr) cacheQR(instanceId, qr);

    if (connection === "open") markOnline(instanceId);

    if (connection === "close") {
      // --- 🔥 ESTA ES LA MODIFICACIÓN ---
      // Borramos el socket de la caché *siempre* que se cierre.
      // Esto fuerza a initInstance a crear una conexión *nueva*
      // en lugar de reusar la vieja y cerrada.
      sockCache.delete(instanceId);
      // --- 🔥 FIN DE LA MODIFICACIÓN ---

      const shouldReconnect =
        (lastDisconnect?.error as any)?.output?.statusCode !==
        DisconnectReason.loggedOut;

      if (shouldReconnect) {
        console.log(`[${instanceId}] Reconnecting (5s delay)...`);
        // Mantenemos el timeout de 5s que pusimos antes
        setTimeout(() => initInstance(instanceId), 5000);
      } else {
        console.log(`[${instanceId}] Logged out. Removing session.`);
        markOffline(instanceId); // markOffline también borra de sockCache
      }
    }
  });

  // Aquí conectamos el router de mensajes del H1
  sock.ev.on("messages.upsert", onInboundMessage(instanceId));

  return sock;
}

// Importamos el router de mensajes (debe estar en este archivo o importado)
// Lo traemos de message-router.ts
import { onInboundMessage } from "./message-router";
