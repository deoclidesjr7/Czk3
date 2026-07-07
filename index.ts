// Edge Function: enviar-push
// Recebe { role, identificador, titulo, corpo, dados } do front-end (via
// czkSupabase.functions.invoke) e envia a notificação através da API do OneSignal,
// que entrega tanto para o app Android (Kodular/FCM) quanto para o navegador (Web Push).
//
// Segredos necessários (Supabase > Edge Functions > Secrets):
//   ONESIGNAL_APP_ID
//   ONESIGNAL_REST_API_KEY

const ONESIGNAL_APP_ID = Deno.env.get("ONESIGNAL_APP_ID")!;
const ONESIGNAL_REST_API_KEY = Deno.env.get("ONESIGNAL_REST_API_KEY")!;

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

    // Filtra quem recebe a notificação pelas tags gravadas no front-end
    // (czkConfigurarOneSignal grava 'role' e, quando existe, 'identificador').
    const filters: Record<string, string>[] = [
      { field: "tag", key: "role", relation: "=", value: String(role) },
    ];
    if (identificador) {
      filters.push({ operator: "AND" });
      filters.push({ field: "tag", key: "identificador", relation: "=", value: String(identificador) });
    }

    const resposta = await fetch("https://onesignal.com/api/v1/notifications", {
      method: "POST",
      headers: {
        "Content-Type": "application/json; charset=utf-8",
        "Authorization": `Basic ${ONESIGNAL_REST_API_KEY}`,
      },
      body: JSON.stringify({
        app_id: ONESIGNAL_APP_ID,
        filters,
        headings: { en: titulo, pt: titulo },
        contents: { en: corpo || "", pt: corpo || "" },
        data: dados || {},
      }),
    });

    const resultado = await resposta.json();

    if (!resposta.ok) {
      console.error("Erro do OneSignal:", resultado);
      return new Response(JSON.stringify({ error: resultado }), {
        status: resposta.status,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify(resultado), {
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
