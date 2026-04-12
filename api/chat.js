export const config = { runtime: "edge" };

export default async (req) => {
  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method Not Allowed" }), {
      status: 405,
      headers: { "Content-Type": "application/json" }
    });
  }

  try {
    const { messages, prompt, model: clientModel } = await req.json();
    const apiKey =
      process.env.DEEPSEEK_API_KEY ||
      process.env.DEEPSEEK_APIKEY ||
      process.env.IDFPSPFK_API_KEY ||
      process.env.IDFPSPFK_APIKEY;

    if (!apiKey) {
      return new Response(
        JSON.stringify({
          error:
            "Missing API key. Please set DEEPSEEK_API_KEY in Vercel Project Settings -> Environment Variables."
        }),
        {
          status: 500,
          headers: { "Content-Type": "application/json" }
        }
      );
    }

    const finalMessages =
      Array.isArray(messages) && messages.length
        ? messages
        : [{ role: "user", content: String(prompt || "") }];

    const allowed = new Set(["deepseek-chat", "deepseek-reasoner"]);
    const model =
      typeof clientModel === "string" && allowed.has(clientModel)
        ? clientModel
        : "deepseek-chat";

    const upstream = await fetch("https://api.deepseek.com/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`
      },
      body: JSON.stringify({
        model,
        messages: finalMessages,
        temperature: 0.7,
        stream: true
      })
    });

    if (!upstream.ok || !upstream.body) {
      const errText = await upstream.text();
      return new Response(
        JSON.stringify({
          error: errText || upstream.statusText,
          status: upstream.status
        }),
        {
          status: upstream.status,
          headers: { "Content-Type": "application/json" }
        }
      );
    }

    return new Response(upstream.body, {
      status: 200,
      headers: {
        "Content-Type": "text/event-stream; charset=utf-8",
        "Cache-Control": "no-cache, no-transform",
        Connection: "keep-alive",
        "X-Accel-Buffering": "no"
      }
    });
  } catch (error) {
    return new Response(JSON.stringify({ error: error.message || "Bad Request" }), {
      status: 400,
      headers: { "Content-Type": "application/json" }
    });
  }
};