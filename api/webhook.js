// api/webhook.js
export default async function handler(req, res) {
  if (req.method === "POST") {
    try {
      console.log("📩 Datos recibidos en el webhook:", req.body);

      // ejemplo: reenviar el JSON a otro servicio si querés
      // import axios from "axios";
      // await axios.post("https://hookdeck.com/tu-endpoint", req.body);

      // responder OK al origen (ChatGPT, cURL, etc.)
      return res.status(200).json({
        message: "✅ Ticket recibido correctamente",
        data: req.body,
      });
    } catch (error) {
      console.error("❌ Error en el webhook:", error);
      return res.status(500).json({ error: "Error procesando el ticket" });
    }
  } else {
    res.setHeader("Allow", ["POST"]);
    return res.status(405).json({ error: `Método ${req.method} no permitido` });
  }
}