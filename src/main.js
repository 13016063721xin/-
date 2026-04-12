import {
  Document,
  Packer,
  Paragraph,
  TextRun,
  ImageRun,
  AlignmentType
} from "docx";
import { saveAs } from "file-saver";
import html2canvas from "html2canvas";
import jsPDF from "jspdf";

/** 12pt；docx 中 size 为半磅 */
const BODY_SIZE_HALF_POINTS = 24;
const CJK_FONT = "Microsoft YaHei";

/**
 * 用于整段对话导出的统一数据源
 * item:
 * - { type: "text", role: "user" | "assistant" | "system", content: string }
 * - { type: "image", role: "user", file: File, name: string }
 */
const conversationForExport = [];

function exportFilenameWithTimestamp(prefix = "AI回复", ext = "docx") {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  const hh = String(d.getHours()).padStart(2, "0");
  const mm = String(d.getMinutes()).padStart(2, "0");
  const ss = String(d.getSeconds()).padStart(2, "0");
  return `${prefix}_${y}${m}${day}_${hh}${mm}${ss}.${ext}`;
}

function pushConversationText(role, content) {
  const text = String(content ?? "").trim();
  if (!text) return;
  conversationForExport.push({
    type: "text",
    role,
    content: text
  });
}

function pushConversationImages(files) {
  files.forEach((file) => {
    conversationForExport.push({
      type: "image",
      role: "user",
      file,
      name: file.name || "图片"
    });
  });
}

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
  saveAs(blob, exportFilenameWithTimestamp("AI回复", "docx"));
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

function appendUserMixedMessage(container, text, stagedImages) {
  const row = document.createElement("div");
  row.className = "chat-msg chat-msg--plain";

  const label = document.createElement("div");
  label.textContent = "你：";
  row.appendChild(label);

  if (text) {
    const textEl = document.createElement("div");
    textEl.textContent = text;
    textEl.style.marginTop = "4px";
    row.appendChild(textEl);
  }

  if (stagedImages.length) {
    const grid = document.createElement("div");
    grid.className = "chat-image-grid";

    stagedImages.forEach((item) => {
      const card = document.createElement("div");
      card.className = "chat-image-card";

      const img = document.createElement("img");
      img.src = item.previewUrl;
      img.alt = item.file.name || "uploaded-image";

      const name = document.createElement("div");
      name.className = "chat-image-name";
      name.textContent = item.file.name || "图片";

      card.appendChild(img);
      card.appendChild(name);
      grid.appendChild(card);
    });

    row.appendChild(grid);
  }

  container.appendChild(row);
  container.scrollTop = container.scrollHeight;
}

function createPdfTextContainer(title, lines) {
  const wrap = document.createElement("div");
  wrap.style.position = "fixed";
  wrap.style.left = "-99999px";
  wrap.style.top = "0";
  wrap.style.width = "794px";
  wrap.style.background = "#ffffff";
  wrap.style.color = "#111111";
  wrap.style.padding = "40px";
  wrap.style.fontFamily = '"Microsoft YaHei", Arial, sans-serif';
  wrap.style.lineHeight = "1.8";
  wrap.style.boxSizing = "border-box";

  const heading = document.createElement("div");
  heading.textContent = title;
  heading.style.fontSize = "22px";
  heading.style.fontWeight = "700";
  heading.style.marginBottom = "20px";
  wrap.appendChild(heading);

  lines.forEach((line) => {
    const p = document.createElement("div");
    p.textContent = line || " ";
    p.style.fontSize = "14px";
    p.style.marginBottom = "10px";
    p.style.whiteSpace = "pre-wrap";
    p.style.wordBreak = "break-word";
    wrap.appendChild(p);
  });

  document.body.appendChild(wrap);
  return wrap;
}

async function exportElementToPdf(element, fileName) {
  const canvas = await html2canvas(element, {
    scale: 2,
    useCORS: true,
    backgroundColor: "#ffffff"
  });

  const imgData = canvas.toDataURL("image/png");
  const pdf = new jsPDF("p", "mm", "a4");

  const pageWidth = pdf.internal.pageSize.getWidth();
  const pageHeight = pdf.internal.pageSize.getHeight();
  const imgWidth = pageWidth;
  const imgHeight = (canvas.height * imgWidth) / canvas.width;

  let heightLeft = imgHeight;
  let position = 0;

  pdf.addImage(imgData, "PNG", 0, position, imgWidth, imgHeight);
  heightLeft -= pageHeight;

  while (heightLeft > 0) {
    position = heightLeft - imgHeight;
    pdf.addPage();
    pdf.addImage(imgData, "PNG", 0, position, imgWidth, imgHeight);
    heightLeft -= pageHeight;
  }

  pdf.save(fileName);
}

async function exportSingleReplyToPdf(text) {
  const normalized = String(text ?? "").replace(/\r\n/g, "\n");
  const lines = normalized.split("\n");
  const container = createPdfTextContainer("AI 回复导出", lines);

  try {
    await exportElementToPdf(container, exportFilenameWithTimestamp("AI回复", "pdf"));
  } finally {
    container.remove();
  }
}

function readFileAsArrayBuffer(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = () => reject(new Error(`读取图片失败：${file.name}`));
    reader.readAsArrayBuffer(file);
  });
}

function getImageSize(file, maxWidth = 420) {
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

async function exportConversationToWord() {
  if (!conversationForExport.length) {
    throw new Error("当前没有可导出的对话内容");
  }

  const children = [];

  for (const item of conversationForExport) {
    if (item.type === "text") {
      children.push(buildTextParagraph(item.content));
    } else if (item.type === "image") {
      children.push(await buildImageParagraph(item.file));
      if (item.name) {
        children.push(buildTextParagraph(item.name));
      }
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
  saveAs(blob, exportFilenameWithTimestamp("当前对话", "docx"));
}

/**
 * @param {boolean} docMode 文档（思考）模式
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
    pdfBtn.title = "导出当前回复为 PDF（需等待生成结束）";
    pdfBtn.addEventListener("click", async () => {
      const out = answerText.trim() || reasoningText.trim() || fullText;
      try {
        pdfBtn.disabled = true;
        pdfBtn.textContent = "导出中...";
        await exportSingleReplyToPdf(out);
      } catch (err) {
        console.error(err);
        alert(`导出 PDF 失败：${err.message || err}`);
      } finally {
        pdfBtn.disabled = false;
        pdfBtn.textContent = "导出 PDF";
      }
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

function initChat() {
  const userInput = document.getElementById("user-input");
  const sendBtn = document.getElementById("sendBtn");
  const output = document.getElementById("output");
  const modeChat = document.getElementById("modeChat");
  const modeDoc = document.getElementById("modeDoc");

  const uploadInput = document.getElementById("imageUploadInput");
  const uploadBtn = document.getElementById("imageUploadBtn");
  const stagingArea = document.getElementById("stagingArea");
  const exportConversationWordBtn = document.getElementById("exportConversationWordBtn");

  const messages = [{ role: "system", content: "你是一个简洁、友好的中文助手。" }];
  let docMode = false;

  /** @type {{ file: File, previewUrl: string }[]} */
  let stagedImages = [];

  function syncModeUI() {
    modeChat.classList.toggle("mode-btn--active", !docMode);
    modeDoc.classList.toggle("mode-btn--active", docMode);
    modeChat.setAttribute("aria-selected", String(!docMode));
    modeDoc.setAttribute("aria-selected", String(docMode));
  }

  function renderStagingArea() {
    stagingArea.innerHTML = "";
    stagingArea.classList.toggle("staging--active", stagedImages.length > 0);

    stagedImages.forEach((item, index) => {
      const box = document.createElement("div");
      box.className = "staging-item";

      const img = document.createElement("img");
      img.src = item.previewUrl;
      img.alt = item.file.name || "staged-image";

      const removeBtn = document.createElement("button");
      removeBtn.className = "staging-remove";
      removeBtn.type = "button";
      removeBtn.textContent = "×";
      removeBtn.title = "移除这张图片";
      removeBtn.addEventListener("click", () => {
        URL.revokeObjectURL(stagedImages[index].previewUrl);
        stagedImages.splice(index, 1);
        renderStagingArea();
      });

      box.appendChild(img);
      box.appendChild(removeBtn);
      stagingArea.appendChild(box);
    });
  }

  function clearStagingArea() {
    stagedImages.forEach((item) => {
      URL.revokeObjectURL(item.previewUrl);
    });
    stagedImages = [];
    renderStagingArea();
  }

  modeChat.addEventListener("click", () => {
    docMode = false;
    syncModeUI();
  });

  modeDoc.addEventListener("click", () => {
    docMode = true;
    syncModeUI();
  });

  uploadBtn.addEventListener("click", () => {
    uploadInput.click();
  });

  uploadInput.addEventListener("change", () => {
    const files = Array.from(uploadInput.files || []);
    if (!files.length) return;

    for (const file of files) {
      if (!file.type.startsWith("image/")) continue;
      stagedImages.push({
        file,
        previewUrl: URL.createObjectURL(file)
      });
    }

    renderStagingArea();
    uploadInput.value = "";
  });

  exportConversationWordBtn.addEventListener("click", async () => {
    const oldText = exportConversationWordBtn.textContent;
    exportConversationWordBtn.disabled = true;
    exportConversationWordBtn.textContent = "导出中...";

    try {
      await exportConversationToWord();
    } catch (err) {
      console.error(err);
      alert(`导出失败：${err.message || err}`);
    } finally {
      exportConversationWordBtn.disabled = false;
      exportConversationWordBtn.textContent = oldText;
    }
  });

  syncModeUI();

  appendSystemLine(
    output,
    "你好：请先选上方「聊天」或「文档（思考）」。聊天用 Chat 模型；写长文/导出 Word 请选文档模式并等待回复结束后再点「导出 Word」。"
  );

  async function sendMessage() {
    const prompt = userInput.value.trim();
    const hasText = Boolean(prompt);
    const hasImages = stagedImages.length > 0;

    if (!hasText && !hasImages) return;

    const sendingImages = stagedImages.map((item) => ({
      file: item.file,
      previewUrl: item.previewUrl
    }));

    sendBtn.disabled = true;
    uploadBtn.disabled = true;
    sendBtn.textContent = "发送中...";

    appendUserMixedMessage(output, prompt, sendingImages);

    if (hasText) {
      pushConversationText("user", `你：${prompt}`);
    }
    if (hasImages) {
      pushConversationImages(sendingImages.map((item) => item.file));
    }

    userInput.value = "";
    clearStagingArea();

    if (hasText) {
      messages.push({ role: "user", content: prompt });
    } else {
      messages.push({ role: "user", content: "[用户发送了图片]" });
    }

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
      pushConversationText("assistant", `AI：${reply}`);
    } catch (err) {
      if (streamBlock.wrap.parentNode === output) {
        output.removeChild(streamBlock.wrap);
      }
      appendSystemLine(output, `失败了: ${err.message}`);
    } finally {
      sendBtn.disabled = false;
      uploadBtn.disabled = false;
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