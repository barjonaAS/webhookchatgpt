export default async function handler(req, res) {
  if (req.method === "POST") {
    console.log("Datos recibidos:", req.body);

    // Podés procesar, guardar en DB o reenviar a otro servicio
    return res.status(200).json({
      status: "ok",
      recibido: true,
      data: req.body
    });
  } else {
    return res.status(405).json({ error: "Método no permitido" });
  }
}
