// /api/webhook.js
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { persistSession: false } }
);

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  // (Opcional) protección simple por API key propia
  if (process.env.API_KEY) {
    const key = req.headers["x-api-key"];
    if (key !== process.env.API_KEY) return res.status(401).json({ error: "Unauthorized" });
  }

  try {
    const b = req.body || {};

    // Validación mínima: ajustá a tu esquema real
    if (!b.vendor || b.total == null) {
      return res.status(400).json({ error: "Missing fields: vendor/total" });
    }

    // Idempotencia básica (opcional): filename + processed_at
    const idemKey = Buffer.from(`${b.source_filename || "nofile"}|${b.processed_at || ""}`)
      .toString("base64")
      .slice(0, 200);

    // 1) Insert en tickets
    // Si agregaste la columna idempotency_key UNIQUE, descomenta la línea
    // idempotency_key: idemKey,
    let { data: ticketData, error: ticketErr } = await supabase
      .from("tickets")
      .insert({
        // idempotency_key: idemKey,        // <--- opcional si creaste la columna única
        source_filename: b.source_filename ?? null,
        vendor: b.vendor,
        purchase_date: b.purchase_date ?? null, // 'YYYY-MM-DD'
        purchase_time: b.purchase_time ?? null, // 'HH:MM:SS'
        currency: b.currency ?? "ARS",
        total: Number(b.total) || 0,
        processed_at: b.processed_at ?? new Date().toISOString()
      })
      .select("id")
      .single();

    // Si tenés UNIQUE por idempotency_key y chocó, buscá el id existente
    if (ticketErr && ticketErr.code === "23505") {
      const { data: existing, error: findErr } = await supabase
        .from("tickets")
        .select("id")
        .eq("idempotency_key", idemKey)
        .single();
      if (findErr) return res.status(500).json({ error: "Lookup failed", details: findErr.message });
      ticketData = existing;
      ticketErr = null;
    }
    if (ticketErr) {
      return res.status(500).json({ error: "Insert ticket failed", details: ticketErr.message });
    }

    const ticketId = ticketData.id;

    // 2) Insert en ticket_items
    const items = Array.isArray(b.items) ? b.items : [];
    if (items.length) {
      const rows = items.map((it) => ({
        ticket_id: ticketId,
        product: String(it.product ?? ""),
        quantity: it.quantity != null ? Number(it.quantity) : 1,
        unit_price: it.unit_price != null ? Number(it.unit_price) : null,
        total: it.total != null ? Number(it.total) : (it.unit_price != null ? Number(it.unit_price) : 0)
      }));
      const { error: itemsErr } = await supabase.from("ticket_items").insert(rows);
      if (itemsErr) {
        return res.status(500).json({ error: "Insert items failed", details: itemsErr.message });
      }
    }

    // 3) Insert en ticket_discounts
    // Espera un array b.discounts con objetos { concepto, monto }
    const discounts = Array.isArray(b.discounts) ? b.discounts : [];
    if (discounts.length) {
      const drows = discounts.map((d) => ({
        ticket_id: ticketId,
        concepto: String(d.concepto ?? d.concept ?? d.reason ?? ""),
        monto: Number(d.monto ?? d.amount ?? 0)
      }));
      // filtra vacíos o montos inválidos
      const clean = drows.filter((d) => d.concepto && Number.isFinite(d.monto) && d.monto > 0);
      if (clean.length) {
        const { error: discErr } = await supabase.from("ticket_discounts").insert(clean);
        if (discErr) {
          return res.status(500).json({ error: "Insert discounts failed", details: discErr.message });
        }
      }
    }

    return res.status(201).json({
      ok: true,
      ticket_id: ticketId,
      items_inserted: items.length,
      discounts_inserted: discounts.length
    });
  } catch (e) {
    console.error(e);
    return res.status(500).json({ error: "Internal error", details: String(e?.message || e) });
  }
}
