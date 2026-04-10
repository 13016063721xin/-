export const config = { runtime: 'edge' };

export default async (req) => {
  const { prompt } = await req.json();
  const apiKey = process.env.DEEPSEEK_API_KEY; // 这里就是从保险柜取钱

  const response = await fetch("https://api.deepseek.com/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${apiKey}`
    },
    body: JSON.stringify({
      model: "deepseek-chat",
      messages: [{ role: "user", content: prompt }]
    })
  });

  const data = await response.json();
  return new Response(JSON.stringify(data));
};