import { Router } from "express";
// Importamos nuestras funciones de baileys.ts
import { initInstance, getLastQR } from "../core/baileys";

export const router = Router();

router.get("/api/wa/qr/:instanceId", async (req, res) => {
  const { instanceId } = req.params;
  try {
    await initInstance(instanceId);
    const qr = getLastQR(instanceId);

    // No Content: El QR aún no está listo, reintenta
    if (!qr) return res.status(204).end();

    res.json({ instanceId, qr });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Failed to init instance" });
  }
});
