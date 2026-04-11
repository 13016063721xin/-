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

function appendAssistantBlock(container, text) {
  const wrap = document.createElement("div");
  wrap.className = "chat-msg chat-msg--assistant";

  const bodyRow = document.createElement("div");
  bodyRow.className = "chat-msg-row";
  const label = document.createElement("span");
  label.className = "chat-msg-label";
  label.textContent = "AI：";
  const body = document.createElement("div");
  body.className = "chat-msg-text";
  body.textContent = text;
  bodyRow.appendChild(label);
  bodyRow.appendChild(body);
  wrap.appendChild(bodyRow);

  const actions = document.createElement("div");
  actions.className = "chat-msg-actions";
  const btn = document.createElement("button");
  btn.type = "button";
  btn.className = "chat-send";
  btn.textContent = "导出 Word";
  btn.addEventListener("click", () => {
    exportToWord(text).catch((err) => {
      console.error(err);
      alert(`导出失败：${err.message || err}`);
    });
  });
  actions.appendChild(btn);
  wrap.appendChild(actions);

  container.appendChild(wrap);
  container.scrollTop = container.scrollHeight;
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

    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({ messages })
      });

      if (!res.ok) {
        const errText = await res.text();
        throw new Error(`HTTP ${res.status} ${errText}`);
      }

      const data = await res.json();
      const reply = data?.choices?.[0]?.message?.content || "接口返回为空。";
      appendAssistantBlock(output, reply);
      messages.push({ role: "assistant", content: reply });
    } catch (err) {
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
