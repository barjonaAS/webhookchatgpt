import { Pool } from "pg";

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
});

export default async function handler(req, res) {
  if (req.method === "POST") {
    try {
      const data = req.body;
      console.log("Recibido:", data);

      // Insertar ticket
      const result = await pool.query(
        `INSERT INTO tickets 
         (source_filename, vendor, purchase_date, purchase_time, currency, total, processed_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7)
         RETURNING id`,
        [
          data.source_filename,
          data.vendor,
          data.purchase_date,
          data.purchase_time,
          data.currency,
          data.total,
          data.processed_at,
        ]
      );

      const ticketId = result.rows[0].id;

      // Insertar items
      for (const item of data.items) {
        await pool.query(
          `INSERT INTO ticket_items 
           (ticket_id, product, quantity, unit_price, total)
           VALUES ($1, $2, $3, $4, $5)`,
          [ticketId, item.product, item.quantity, item.unit_price, item.total]
        );
      }

      // Insertar descuentos (si existen)
      if (data.discounts) {
        for (const d of data.discounts) {
          await pool.query(
            `INSERT INTO ticket_discounts 
             (ticket_id, concepto, monto)
             VALUES ($1, $2, $3)`,
            [ticketId, d.concepto, d.monto]
          );
        }
      }

      res.status(200).json({ success: true, ticketId });
    } catch (err) {
      console.error("Error guardando en DB:", err);
      res.status(500).json({ error: "DB insert failed" });
    }
  } else {
    res.status(405).json({ error: "Method not allowed" });
  }
}
