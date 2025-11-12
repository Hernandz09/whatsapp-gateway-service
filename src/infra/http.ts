import express from "express";
import { router as qrRouter } from "../api/qr.controller";
// Importaremos el router de 'send' en H2
// import { router as sendRouter } from '../api/send.controller'

const app = express();
const port = process.env.PORT || 8080;

// Middlewares
app.use(express.json()); // Para leer JSON en el body

// Rutas
app.use(qrRouter);
// app.use(sendRouter) // La usaremos en H2

app.get("/", (req, res) => {
  res.send("WhatsApp Gateway API Running");
});

app.listen(port, () => {
  console.log(`API Server running on http://localhost:${port}`);
});
