// api/webhook.js

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Método no permitido" });
  }

  try {
    // Datos recibidos
    const data = req.body;
    console.log("📩 Datos recibidos:", data);

    // Aquí podés hacer lo que quieras con el JSON (guardar en DB, enviar a otro endpoint, etc.)
    // Ejemplo: validar que exista el campo "vendor"
    if (!data.vendor) {
      return res.status(400).json({ error: "Falta el campo 'vendor'" });
    }

    // Respuesta al cliente
    return res.status(200).json({
      success: true,
      received: data,
      message: "Webhook procesado correctamente ✅",
    });

  } catch (error) {
    console.error("❌ Error en el webhook:", error);
    return res.status(500).json({ error: "Error interno en el webhook" });
  }
}
