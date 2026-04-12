import {
  Document,
  Packer,
  Paragraph,
  TextRun,
  ImageRun,
  AlignmentType
} from "docx";
import { saveAs } from "file-saver";

/** 12pt；docx 中 size 为半磅 */
const BODY_SIZE_HALF_POINTS = 24;
const CJK_FONT = "Microsoft YaHei";

/**
 * 统一维护“整段图文导出”的顺序数组
 * text:  { type: "text", role: "user" | "assistant" | "system", content: string }
 * image: { type: "image", role: "user", file: File, name: string, mimeType: string }
 */
const exportSequence = [];

function exportFilenameWithTimestamp(prefix = "AI回复") {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  const hh = String(d.getHours()).padStart(2, "0");
  const mm = String(d.getMinutes()).padStart(2, "0");
  const ss = String(d.getSeconds()).padStart(2, "0");
  return `${prefix}_${y}${m}${day}_${hh}${mm}${ss}.docx`;
}

/**
 * 单条纯文本导出 Word
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
  saveAs(blob, exportFilenameWithTimestamp("AI回复"));
}

function pushExportText(role, content) {
  const text = String(content ?? "").trim();
  if (!text) return;
  exportSequence.push({
    type: "text",
    role,
    content: text
  });
}

function pushExportImage(file) {
  if (!file) return;
  exportSequence.push({
    type: "image",
    role: "user",
    file,
    name: file.name || "image",
    mimeType: file.type || "image/*"
  });
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

function appendSystemLine(container, text, { record = false } = {}) {
  const row = document.createElement("div");
  row.className = "chat-msg chat-msg--plain";
  row.textContent = `系统：${text}`;
  container.appendChild(row);
  container.scrollTop = container.scrollHeight;

  if (record) {
    pushExportText("system", `系统：${text}`);
  }
}

function appendUserLine(container, text) {
  const row = document.createElement("div");
  row.className = "chat-msg chat-msg--plain";
  row.textContent = `你：${text}`;
  container.appendChild(row);
  container.scrollTop = container.scrollHeight;
}

function appendUserImage(container, file, previewUrl) {
  const row = document.createElement("div");
  row.className = "chat-msg chat-msg--plain chat-image-msg";

  const label = document.createElement("div");
  label.textContent = "你：";

  const img = document.createElement("img");
  img.src = previewUrl;
  img.alt = file.name || "uploaded-image";

  const name = document.createElement("div");
  name.className = "chat-image-name";
  name.textContent = file.name || "图片";

  row.appendChild(label);
  row.appendChild(img);
  row.appendChild(name);

  container.appendChild(row);
  container.scrollTop = container.scrollHeight;
}

/**
 * @param {boolean} docMode 文档（思考）模式：Reasoner 模型、展示思考过程、结束后可导出 Word
 * @returns {{ wrap: HTMLDivElement, appendDelta: (p: { content?: string, reasoning_content?: string }) => void, finish: () => void, getFullText: () => string }}
 */
function createStreamingAssistantBlock(container, docMode) {
  const wrap = document.createElement("div");
  wrap.className = "chat-msg chat-msg--assistant";

  const bodyRow = document.createElement("div");
  bodyRow.className = "chat-msg-row";

  const label = document.createElement("span");
  label.className = "chat-msg-label";
  label.textContent = "AI：";

  let fullText = "";
  let reasoningText = "";
  let answerText = "";

  const bodySingle = document.createElement("div");
  bodySingle.className = "chat-msg-text";
  bodySingle.textContent = "";

  const stack = document.createElement("div");
  stack.className = "chat-msg-text chat-msg-text--stack";

  const reasoningEl = document.createElement("div");
  reasoningEl.className = "chat-msg-reasoning";

  const answerEl = document.createElement("div");
  answerEl.className = "chat-msg-answer";

  stack.appendChild(reasoningEl);
  stack.appendChild(answerEl);

  bodyRow.appendChild(label);
  bodyRow.appendChild(docMode ? stack : bodySingle);
  wrap.appendChild(bodyRow);

  let wordBtn = null;
  let pdfBtn = null;

  if (docMode) {
    const actions = document.createElement("div");
    actions.className = "chat-msg-actions";

    wordBtn = document.createElement("button");
    wordBtn.type = "button";
    wordBtn.className = "chat-send";
    wordBtn.textContent = "导出 Word";
    wordBtn.disabled = true;
    wordBtn.title = "导出当前回复为 Word（需等待生成结束）";
    wordBtn.addEventListener("click", () => {
      const out = answerText.trim() || reasoningText.trim() || fullText;
      exportToWord(out).catch((err) => {
        console.error(err);
        alert(`导出失败：${err.message || err}`);
      });
    });

    pdfBtn = document.createElement("button");
    pdfBtn.type = "button";
    pdfBtn.className = "chat-send";
    pdfBtn.textContent = "导出 PDF";
    pdfBtn.disabled = true;
    pdfBtn.title = "将当前页面打印为 PDF（需等待生成结束）";
    pdfBtn.addEventListener("click", () => {
      window.print();
    });

    actions.appendChild(wordBtn);
    actions.appendChild(pdfBtn);
    wrap.appendChild(actions);
  }

  container.appendChild(wrap);
  container.scrollTop = container.scrollHeight;

  function scroll() {
    container.scrollTop = container.scrollHeight;
  }

  return {
    wrap,
    appendDelta(part) {
      if (!docMode) {
        const c = part.content;
        if (typeof c === "string" && c.length) {
          fullText += c;
          bodySingle.textContent = fullText;
          scroll();
        }
        return;
      }

      if (typeof part.reasoning_content === "string" && part.reasoning_content.length) {
        reasoningText += part.reasoning_content;
        reasoningEl.textContent = reasoningText;
        scroll();
      }

      if (typeof part.content === "string" && part.content.length) {
        answerText += part.content;
        answerEl.textContent = answerText;
        scroll();
      }
    },
    finish() {
      if (wordBtn) wordBtn.disabled = false;
      if (pdfBtn) pdfBtn.disabled = false;
    },
    getFullText() {
      if (docMode) {
        const a = answerText.trim();
        const r = reasoningText.trim();
        return a || r || fullText;
      }
      return fullText;
    }
  };
}

/**
 * 读取 OpenAI 兼容 SSE
 * @param {ReadableStreamDefaultReader<Uint8Array>} reader
 * @param {(chunk: { content?: string, reasoning_content?: string }) => void} onDelta
 */
async function readOpenAICompatibleSSEStream(reader, onDelta) {
  const decoder = new TextDecoder();
  let buffer = "";

  function emitFromJson(json) {
    const d = json?.choices?.[0]?.delta;
    if (!d || typeof d !== "object") return;

    const out = {};
    if (typeof d.reasoning_content === "string" && d.reasoning_content.length) {
      out.reasoning_content = d.reasoning_content;
    }
    if (typeof d.content === "string" && d.content.length) {
      out.content = d.content;
    }

    if (Object.keys(out).length) onDelta(out);
  }

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    buffer += decoder.decode(value, { stream: true });

    let nl;
    while ((nl = buffer.indexOf("\n")) >= 0) {
      const rawLine = buffer.slice(0, nl);
      buffer = buffer.slice(nl + 1);

      const line = rawLine.replace(/\r$/, "").trim();
      if (!line.startsWith("data:")) continue;

      const payload = line.slice(5).trimStart();
      if (payload === "[DONE]") return;

      try {
        const json = JSON.parse(payload);
        emitFromJson(json);
      } catch {
        // ignore
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
        emitFromJson(json);
      } catch {
        // ignore
      }
    }
  }
}

/**
 * File -> ArrayBuffer
 * 纯前端 Word 插图核心逻辑
 * @param {File} file
 * @returns {Promise<ArrayBuffer>}
 */
function readFileAsArrayBuffer(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = () => reject(new Error(`读取图片失败：${file.name}`));
    reader.readAsArrayBuffer(file);
  });
}

/**
 * 获取图片尺寸并做缩放
 * @param {File} file
 * @param {number} maxWidth
 * @returns {Promise<{ width: number, height: number }>}
 */
function getImageSize(file, maxWidth = 520) {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();

    img.onload = () => {
      let width = img.naturalWidth;
      let height = img.naturalHeight;

      if (width > maxWidth) {
        const ratio = maxWidth / width;
        width = Math.round(width * ratio);
        height = Math.round(height * ratio);
      }

      URL.revokeObjectURL(url);
      resolve({ width, height });
    };

    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error(`无法读取图片尺寸：${file.name}`));
    };

    img.src = url;
  });
}

function buildTextParagraph(text) {
  return new Paragraph({
    spacing: { after: 180 },
    children: [
      new TextRun({
        text: text || " ",
        font: {
          ascii: CJK_FONT,
          eastAsia: CJK_FONT,
          hAnsi: CJK_FONT,
          cs: CJK_FONT
        },
        size: BODY_SIZE_HALF_POINTS
      })
    ]
  });
}

async function buildImageParagraph(file) {
  const [buffer, size] = await Promise.all([
    readFileAsArrayBuffer(file),
    getImageSize(file)
  ]);

  return new Paragraph({
    alignment: AlignmentType.CENTER,
    spacing: { after: 220 },
    children: [
      new ImageRun({
        data: buffer,
        transformation: {
          width: size.width,
          height: size.height
        }
      })
    ]
  });
}

async function exportMixedContentToWord() {
  if (!exportSequence.length) {
    throw new Error("当前没有可导出的图文内容");
  }

  const children = [];

  for (const item of exportSequence) {
    if (item.type === "text") {
      children.push(buildTextParagraph(item.content));
    } else if (item.type === "image") {
      const paragraph = await buildImageParagraph(item.file);
      children.push(paragraph);
    }
  }

  const doc = new Document({
    sections: [
      {
        properties: {},
        children
      }
    ]
  });

  const blob = await Packer.toBlob(doc);
  saveAs(blob, exportFilenameWithTimestamp("聊天图文导出"));
}

function initMixedExport(output) {
  const uploadInput = document.getElementById("imageUploadInput");
  const uploadBtn = document.getElementById("imageUploadBtn");
  const exportMixedWordBtn = document.getElementById("exportMixedWordBtn");
  const printPdfBtn = document.getElementById("printPdfBtn");

  uploadBtn.addEventListener("click", () => {
    uploadInput.click();
  });

  uploadInput.addEventListener("change", () => {
    const file = uploadInput.files?.[0];
    if (!file) return;

    if (!file.type.startsWith("image/")) {
      alert("请选择图片文件");
      uploadInput.value = "";
      return;
    }

    const previewUrl = URL.createObjectURL(file);
    appendUserImage(output, file, previewUrl);
    pushExportImage(file);

    uploadInput.value = "";
  });

  exportMixedWordBtn.addEventListener("click", async () => {
    const oldText = exportMixedWordBtn.textContent;
    exportMixedWordBtn.disabled = true;
    exportMixedWordBtn.textContent = "导出中...";

    try {
      await exportMixedContentToWord();
    } catch (err) {
      console.error(err);
      alert(`导出失败：${err.message || err}`);
    } finally {
      exportMixedWordBtn.disabled = false;
      exportMixedWordBtn.textContent = oldText;
    }
  });

  printPdfBtn.addEventListener("click", () => {
    window.print();
  });
}

function initChat() {
  const userInput = document.getElementById("user-input");
  const sendBtn = document.getElementById("sendBtn");
  const output = document.getElementById("output");
  const modeChat = document.getElementById("modeChat");
  const modeDoc = document.getElementById("modeDoc");

  const messages = [{ role: "system", content: "你是一个简洁、友好的中文助手。" }];
  let docMode = false;

  function syncModeUI() {
    modeChat.classList.toggle("mode-btn--active", !docMode);
    modeDoc.classList.toggle("mode-btn--active", docMode);
    modeChat.setAttribute("aria-selected", String(!docMode));
    modeDoc.setAttribute("aria-selected", String(docMode));
  }

  modeChat.addEventListener("click", () => {
    docMode = false;
    syncModeUI();
  });

  modeDoc.addEventListener("click", () => {
    docMode = true;
    syncModeUI();
  });

  syncModeUI();

  appendSystemLine(
    output,
    "你好：请先选上方「聊天」或「文档（思考）」。聊天用 Chat 模型；写长文/导出 Word 请选文档模式并等待回复结束后再点「导出 Word」。"
  );

  initMixedExport(output);

  async function sendMessage() {
    const prompt = userInput.value.trim();
    if (!prompt) return;

    sendBtn.disabled = true;
    sendBtn.textContent = "发送中...";

    appendUserLine(output, prompt);
    pushExportText("user", `你：${prompt}`);

    userInput.value = "";
    messages.push({ role: "user", content: prompt });

    const model = docMode ? "deepseek-reasoner" : "deepseek-chat";
    const streamBlock = createStreamingAssistantBlock(output, docMode);

    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Accept: "text/event-stream"
        },
        body: JSON.stringify({ messages, model })
      });

      if (!res.ok) {
        output.removeChild(streamBlock.wrap);
        const errText = await res.text();
        let detail = errText;
        try {
          const j = JSON.parse(errText);
          detail = j.error || j.message || errText;
        } catch {
          // 保持原文
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
        streamBlock.appendDelta({ content: "接口返回为空。" });
        reply = streamBlock.getFullText();
      }

      messages.push({ role: "assistant", content: reply });
      pushExportText("assistant", `AI：${reply}`);
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