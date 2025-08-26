export default function handler(req, res) {
  if (req.method === "POST") {
    console.log("✅ Ticket recibido:", req.body);
    return res.status(200).json({ message: "Ticket recibido correctamente" });
  }

  // Respuesta por GET
  if (req.method === "GET") {
    return res.status(200).json({ message: "Webhook activo, use POST para enviar datos" });
  }

  return res.status(405).json({ error: "Método no permitido" });
}