import { getSock } from "./baileys"; // Importamos nuestro getSock

export const onInboundMessage = (instanceId: string) => async (m: any) => {
  for (const msg of m.messages) {
    // Ignorar mensajes sin texto o de grupos
    if (msg.key.remoteJid.endsWith("@g.us")) continue;

    const text =
      msg.message?.conversation || msg.message?.extendedTextMessage?.text;
    if (!text) continue;

    console.log(`[${instanceId}] Inbound from ${msg.key.remoteJid}: ${text}`);

    // La prueba de "eco" del H1
    if (/^hola/i.test(text)) {
      await getSock(instanceId).sendMessage(msg.key.remoteJid!, {
        text: `eco: ${text}`,
      });
    }
  }
};
