// Edge Function: enviar-push
// Recebe { role, identificador, titulo, corpo, dados } do front-end (via
// czkSupabase.functions.invoke) e envia um Web Push de verdade para todos os
// dispositivos inscritos que combinem com o role/identificador.
//
// Deploy (com a Supabase CLI, dentro da pasta do projeto):
//   supabase functions deploy enviar-push
//
// Segredos necessários (rodar uma vez cada, veja instruções completas no chat):
//   supabase secrets set VAPID_PUBLIC_KEY=...
//   supabase secrets set VAPID_PRIVATE_KEY=...
//   supabase secrets set VAPID_SUBJECT=mailto:seuemail@exemplo.com

import { createClient } from "npm:@supabase/supabase-js@2";
import webpush from "npm:web-push@3.6.7";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const VAPID_PUBLIC_KEY = Deno.env.get("VAPID_PUBLIC_KEY")!;
const VAPID_PRIVATE_KEY = Deno.env.get("VAPID_PRIVATE_KEY")!;
const VAPID_SUBJECT = Deno.env.get("VAPID_SUBJECT") || "mailto:contato@example.com";

webpush.setVapidDetails(VAPID_SUBJECT, VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY);

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const { role, identificador, titulo, corpo, dados } = await req.json();

    if (!role || !titulo) {
      return new Response(JSON.stringify({ error: "role e titulo são obrigatórios" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    let query = supabase.from("czk_push_subscriptions").select("*").eq("role", role);
    if (identificador) query = query.eq("identificador", identificador);

    const { data: inscricoes, error } = await query;
    if (error) throw error;

    const payload = JSON.stringify({ titulo, corpo, dados: dados || {} });

    let enviados = 0;
    const expiradas: string[] = [];

    await Promise.all(
      (inscricoes || []).map(async (inscricao) => {
        try {
          await webpush.sendNotification(inscricao.subscription, payload);
          enviados++;
        } catch (err) {
          // 404/410 = inscrição expirada ou revogada pelo navegador; limpamos do banco.
          if (err?.statusCode === 404 || err?.statusCode === 410) {
            expiradas.push(inscricao.endpoint);
          } else {
            console.warn("Erro ao enviar push:", err);
          }
        }
      })
    );

    if (expiradas.length > 0) {
      await supabase.from("czk_push_subscriptions").delete().in("endpoint", expiradas);
    }

    return new Response(JSON.stringify({ enviados, expiradas: expiradas.length }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error(e);
    return new Response(JSON.stringify({ error: String(e) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
