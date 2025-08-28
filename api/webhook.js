// /api/webhook.js
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { persistSession: false } }
);

export default async function handler(req, res) {
  if (req.method === "GET") {
    // Healthcheck rápido
    return res.status(200).json({
      ok: true,
      env: {
        hasUrl: !!process.env.SUPABASE_URL,
        hasServiceKey: !!process.env.SUPABASE_SERVICE_ROLE_KEY,
      },
    });
  }

  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    // Protegido opcionalmente con API key
    if (process.env.API_KEY) {
      const key = req.headers["x-api-key"];
      if (key !== process.env.API_KEY) return res.status(401).json({ error: "Unauthorized" });
    }

    // Garantizar JSON
    const body = typeof req.body === "string" ? JSON.parse(req.body || "{}") : (req.body || {});
    if (!body.vendor || body.total == null) {
      return res.status(400).json({ error: "Missing fields: vendor/total", got: body });
    }

    // Idempotencia opcional
    const idemKey = Buffer.from(`${body.source_filename || "nofile"}|${body.processed_at || ""}`)
      .toString("base64")
      .slice(0, 200);

    // 1) Insert ticket
    let { data: ticketData, error: ticketErr } = await supabase
      .from("tickets")
      .insert({
        // idempotency_key: idemKey, // descomenta si creaste la columna UNIQUE
        source_filename: body.source_filename ?? null,
        vendor: body.vendor,
        purchase_date: body.purchase_date ?? null, // 'YYYY-MM-DD'
        purchase_time: body.purchase_time ?? null, // 'HH:MM:SS'
        currency: body.currency ?? "ARS",
        total: Number(body.total) || 0,
        processed_at: body.processed_at ?? new Date().toISOString(),
      })
      .select("id")
      .single();

    if (ticketErr) {
      // Si tenés idempotency_key UNIQUE y chocaste con 23505
      if (ticketErr.code === "23505") {
        const { data: existing, error: findErr } = await supabase
          .from("tickets")
          .select("id")
          .eq("idempotency_key", idemKey)
          .single();
        if (findErr) {
          return res.status(500).json({ where: "lookup-existing-ticket", error: findErr.message, code: findErr.code });
        }
        ticketData = existing;
      } else {
        return res.status(500).json({ where: "insert-ticket", error: ticketErr.message, code: ticketErr.code });
      }
    }

    const ticketId = ticketData.id;

    // 2) Insert items
    const items = Array.isArray(body.items) ? body.items : [];
    if (items.length) {
      const rows = items.map((it) => ({
        ticket_id: ticketId,
        product: String(it.product ?? ""),
        quantity: it.quantity != null ? Number(it.quantity) : 1,
        unit_price: it.unit_price != null ? Number(it.unit_price) : null,
        total: it.total != null ? Number(it.total) : (it.unit_price != null ? Number(it.unit_price) : 0),
      }));
      const { error: itemsErr } = await supabase.from("ticket_items").insert(rows);
      if (itemsErr) {
        return res.status(500).json({ where: "insert-items", error: itemsErr.message, code: itemsErr.code, rows });
      }
    }

    // 3) Insert discounts
    const discounts = Array.isArray(body.discounts) ? body.discounts : [];
    if (discounts.length) {
      const drows = discounts
        .map((d) => ({
          ticket_id: ticketId,
          concepto: String(d.concepto ?? d.concept ?? d.reason ?? ""),
          monto: Number(d.monto ?? d.amount ?? 0),
        }))
        .filter((d) => d.concepto && Number.isFinite(d.monto) && d.monto > 0);

      if (drows.length) {
        const { error: discErr } = await supabase.from("ticket_discounts").insert(drows);
        if (discErr) {
          return res.status(500).json({ where: "insert-discounts", error: discErr.message, code: discErr.code, drows });
        }
      }
    }

    return res.status(201).json({
      ok: true,
      ticket_id: ticketId,
      items_inserted: items.length,
      discounts_inserted: discounts.length,
    });
  } catch (e) {
    return res.status(500).json({ where: "unhandled", error: String(e?.message || e) });
  }
}
