import { Document, Packer, Paragraph, TextRun } from "docx";
import { saveAs } from "file-saver";

/** 12pt；docx 中 size 为半磅 */
const BODY_SIZE_HALF_POINTS = 24;

const CJK_FONT = "Microsoft YaHei";

function exportFilenameWithTimestamp() {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `AI回复_${y}${m}${day}.docx`;
}

/**
 * 将文本按换行拆成多个段落，生成 Word 并下载。
 * @param {string} text
 */
export async function exportToWord(text) {
  const normalized = String(text ?? "").replace(/\r\n/g, "\n");
  const lines = normalized.split("\n");

  const children = lines.map(
    (line) =>
      new Paragraph({
        spacing: { after: 140 },
        children: [
          new TextRun({
            text: line.length ? line : " ",
            font: {
              ascii: CJK_FONT,
              eastAsia: CJK_FONT,
              cs: CJK_FONT,
              hAnsi: CJK_FONT
            },
            size: BODY_SIZE_HALF_POINTS
          })
        ]
      })
  );

  const doc = new Document({
    sections: [
      {
        properties: {},
        children
      }
    ]
  });

  const blob = await Packer.toBlob(doc);
  saveAs(blob, exportFilenameWithTimestamp());
}

function initStarfield() {
  const canvas = document.getElementById("starfield");
  const ctx = canvas.getContext("2d");
  let stars = [];
  let width = 0;
  let height = 0;

  function resize() {
    const dpr = window.devicePixelRatio || 1;
    width = window.innerWidth;
    height = window.innerHeight;
    canvas.width = Math.floor(width * dpr);
    canvas.height = Math.floor(height * dpr);
    canvas.style.width = `${width}px`;
    canvas.style.height = `${height}px`;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    const count = Math.min(220, Math.floor((width * height) / 8000));
    stars = Array.from({ length: count }, () => ({
      x: Math.random() * width,
      y: Math.random() * height,
      r: Math.random() * 1.5 + 0.3,
      a: Math.random() * 0.8 + 0.2,
      twinkle: Math.random() * 0.02 + 0.004,
      drift: Math.random() * 0.08 + 0.02
    }));
  }

  function drawGradient() {
    const g = ctx.createRadialGradient(
      width * 0.5,
      height * 0.15,
      20,
      width * 0.5,
      height * 0.2,
      Math.max(width, height) * 0.9
    );
    g.addColorStop(0, "rgba(28, 44, 92, 0.35)");
    g.addColorStop(1, "rgba(2, 4, 10, 0.96)");
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, width, height);
  }

  function animate() {
    drawGradient();
    for (const star of stars) {
      star.a += (Math.random() - 0.5) * star.twinkle;
      if (star.a < 0.15) star.a = 0.15;
      if (star.a > 1) star.a = 1;
      star.y += star.drift;
      if (star.y > height + 2) {
        star.y = -2;
        star.x = Math.random() * width;
      }

      ctx.beginPath();
      ctx.fillStyle = `rgba(255, 255, 255, ${star.a})`;
      ctx.arc(star.x, star.y, star.r, 0, Math.PI * 2);
      ctx.fill();
    }
    requestAnimationFrame(animate);
  }

  resize();
  animate();
  window.addEventListener("resize", resize);
}

function updateClock() {
  const now = new Date();
  const h = String(now.getHours()).padStart(2, "0");
  const m = String(now.getMinutes()).padStart(2, "0");
  const s = String(now.getSeconds()).padStart(2, "0");
  document.getElementById("clock").textContent = `${h}:${m}:${s}`;
}

function appendSystemLine(container, text) {
  const row = document.createElement("div");
  row.className = "chat-msg chat-msg--plain";
  row.textContent = `系统：${text}`;
  container.appendChild(row);
  container.scrollTop = container.scrollHeight;
}

function appendUserLine(container, text) {
  const row = document.createElement("div");
  row.className = "chat-msg chat-msg--plain";
  row.textContent = `你：${text}`;
  container.appendChild(row);
  container.scrollTop = container.scrollHeight;
}

/**
 * 创建一条可流式更新的 AI 消息块；流结束后启用「导出 Word」，内容为完整拼接结果。
 * @returns {{ wrap: HTMLDivElement, appendDelta: (s: string) => void, finish: () => void, getFullText: () => string }}
 */
function createStreamingAssistantBlock(container) {
  const wrap = document.createElement("div");
  wrap.className = "chat-msg chat-msg--assistant";

  const bodyRow = document.createElement("div");
  bodyRow.className = "chat-msg-row";
  const label = document.createElement("span");
  label.className = "chat-msg-label";
  label.textContent = "AI：";
  const body = document.createElement("div");
  body.className = "chat-msg-text";
  body.textContent = "";
  bodyRow.appendChild(label);
  bodyRow.appendChild(body);
  wrap.appendChild(bodyRow);

  const actions = document.createElement("div");
  actions.className = "chat-msg-actions";
  const btn = document.createElement("button");
  btn.type = "button";
  btn.className = "chat-send";
  btn.textContent = "导出 Word";
  btn.disabled = true;

  let fullText = "";
  btn.addEventListener("click", () => {
    exportToWord(fullText).catch((err) => {
      console.error(err);
      alert(`导出失败：${err.message || err}`);
    });
  });
  actions.appendChild(btn);
  wrap.appendChild(actions);

  container.appendChild(wrap);
  container.scrollTop = container.scrollHeight;

  return {
    wrap,
    appendDelta(delta) {
      fullText += delta;
      body.textContent = fullText;
      container.scrollTop = container.scrollHeight;
    },
    finish() {
      btn.disabled = false;
    },
    getFullText() {
      return fullText;
    }
  };
}

/**
 * 使用 ReadableStreamDefaultReader 读取 OpenAI 兼容的 SSE，逐块解析 delta.content。
 * @param {ReadableStreamDefaultReader<Uint8Array>} reader
 * @param {(chunk: string) => void} onDelta
 */
async function readOpenAICompatibleSSEStream(reader, onDelta) {
  const decoder = new TextDecoder();
  let buffer = "";

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });

    let nl;
    while ((nl = buffer.indexOf("\n")) >= 0) {
      const rawLine = buffer.slice(0, nl);
      buffer = buffer.slice(nl + 1);
      const line = rawLine.replace(/\r$/, "");
      const trimmed = line.trim();
      if (!trimmed.startsWith("data:")) continue;
      const payload = trimmed.slice(5).trimStart();
      if (payload === "[DONE]") return;
      try {
        const json = JSON.parse(payload);
        const delta = json?.choices?.[0]?.delta?.content;
        if (typeof delta === "string" && delta.length) onDelta(delta);
      } catch {
        /* 忽略非 JSON 行 */
      }
    }
  }

  const tail = buffer.trim();
  if (tail.startsWith("data:")) {
    const payload = tail.slice(5).trimStart();
    if (payload === "[DONE]") return;
    if (payload) {
      try {
        const json = JSON.parse(payload);
        const delta = json?.choices?.[0]?.delta?.content;
        if (typeof delta === "string" && delta.length) onDelta(delta);
      } catch {
        /* ignore */
      }
    }
  }
}

function initChat() {
  const userInput = document.getElementById("user-input");
  const sendBtn = document.getElementById("sendBtn");
  const output = document.getElementById("output");
  const messages = [{ role: "system", content: "你是一个简洁、友好的中文助手。" }];

  appendSystemLine(output, "你好，这里是 DeepSeek 聊天模式，直接输入问题即可。");

  async function sendMessage() {
    const prompt = userInput.value.trim();
    if (!prompt) return;

    sendBtn.disabled = true;
    sendBtn.textContent = "发送中...";
    appendUserLine(output, prompt);
    userInput.value = "";
    messages.push({ role: "user", content: prompt });

    const streamBlock = createStreamingAssistantBlock(output);

    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Accept: "text/event-stream"
        },
        body: JSON.stringify({ messages })
      });

      if (!res.ok) {
        output.removeChild(streamBlock.wrap);
        const errText = await res.text();
        let detail = errText;
        try {
          const j = JSON.parse(errText);
          detail = j.error || j.message || errText;
        } catch {
          /* 保持原文 */
        }
        throw new Error(`HTTP ${res.status} ${detail}`);
      }

      const body = res.body;
      if (!body) {
        throw new Error("响应无 body，无法读取流。");
      }

      const reader = body.getReader();
      await readOpenAICompatibleSSEStream(reader, (delta) => {
        streamBlock.appendDelta(delta);
      });

      streamBlock.finish();
      let reply = streamBlock.getFullText();
      if (!reply.trim()) {
        streamBlock.appendDelta("接口返回为空。");
        reply = streamBlock.getFullText();
      }
      messages.push({ role: "assistant", content: reply });
    } catch (err) {
      if (streamBlock.wrap.parentNode === output) {
        output.removeChild(streamBlock.wrap);
      }
      appendSystemLine(output, `失败了: ${err.message}`);
    } finally {
      sendBtn.disabled = false;
      sendBtn.textContent = "发送";
    }
  }

  sendBtn.addEventListener("click", sendMessage);
  userInput.addEventListener("keydown", (e) => {
    if (e.key === "Enter") {
      e.preventDefault();
      sendMessage();
    }
  });
}

initStarfield();
initChat();
updateClock();
setInterval(updateClock, 1000);
