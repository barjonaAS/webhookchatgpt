// api/webhook.js

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Método no permitido" });
  }

  try {
    const data = req.body;

    console.log("✅ Ticket recibido en webhook:", data);

    // Aquí podrías guardar en base de datos, enviar a otro servicio, etc.
    // Ejemplo: guardar en Firestore, Supabase, etc.

    return res.status(200).json({ message: "Ticket recibido correctamente", data });
  } catch (error) {
    console.error("❌ Error procesando ticket:", error);
    return res.status(500).json({ error: "Error procesando ticket" });
  }
}
