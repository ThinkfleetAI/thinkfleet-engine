import JSZip from "jszip";
import { detectMime } from "../media/mime.js";

export type ChatAttachment = {
  type?: string;
  mimeType?: string;
  fileName?: string;
  content?: unknown;
};

export type ChatImageContent = {
  type: "image";
  data: string;
  mimeType: string;
};

export type ParsedMessageWithImages = {
  message: string;
  images: ChatImageContent[];
};

type AttachmentLog = {
  warn: (message: string) => void;
};

function normalizeMime(mime?: string): string | undefined {
  if (!mime) return undefined;
  const cleaned = mime.split(";")[0]?.trim().toLowerCase();
  return cleaned || undefined;
}

async function sniffMimeFromBase64(base64: string): Promise<string | undefined> {
  const trimmed = base64.trim();
  if (!trimmed) return undefined;

  const take = Math.min(256, trimmed.length);
  const sliceLen = take - (take % 4);
  if (sliceLen < 8) return undefined;

  try {
    const head = Buffer.from(trimmed.slice(0, sliceLen), "base64");
    return await detectMime({ buffer: head });
  } catch {
    return undefined;
  }
}

function isImageMime(mime?: string): boolean {
  return typeof mime === "string" && mime.startsWith("image/");
}

/** MIME types that can be decoded to readable text */
const TEXT_MIME_PREFIXES = ["text/"];
const TEXT_MIME_EXACT = new Set([
  "application/json",
  "application/xml",
  "application/javascript",
  "application/typescript",
  "application/x-yaml",
  "application/yaml",
  "application/x-sh",
  "application/sql",
  "application/graphql",
  "application/ld+json",
  "application/xhtml+xml",
  "application/x-httpd-php",
]);

function isTextMime(mime?: string): boolean {
  if (!mime) return false;
  if (TEXT_MIME_PREFIXES.some((p) => mime.startsWith(p))) return true;
  if (TEXT_MIME_EXACT.has(mime)) return true;
  return false;
}

function isPdfMime(mime?: string): boolean {
  return mime === "application/pdf";
}

const DOCX_MIMES = new Set([
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/msword",
]);

function isDocxMime(mime?: string): boolean {
  return typeof mime === "string" && DOCX_MIMES.has(mime);
}

function hasDocxExtension(fileName?: string): boolean {
  if (!fileName) return false;
  const lower = fileName.toLowerCase();
  return lower.endsWith(".docx") || lower.endsWith(".doc");
}

/**
 * Extract text from a .docx file (which is a ZIP of XML).
 * Uses jszip to read word/document.xml and strips XML tags.
 */
async function extractDocxText(b64: string, maxChars = 500_000): Promise<string | null> {
  try {
    const buffer = Buffer.from(b64, "base64");
    const zip = await JSZip.loadAsync(buffer);
    const docXml = zip.file("word/document.xml");
    if (!docXml) return null;
    const xmlContent = await docXml.async("string");
    // Extract text by handling common Word XML elements
    const text = xmlContent
      .replace(/<w:br[^>]*\/?>/g, "\n")
      .replace(/<\/w:p>/g, "\n")
      .replace(/<w:tab\/>/g, "\t")
      .replace(/<[^>]+>/g, "")
      .replace(/&amp;/g, "&")
      .replace(/&lt;/g, "<")
      .replace(/&gt;/g, ">")
      .replace(/&apos;/g, "'")
      .replace(/&quot;/g, '"')
      .replace(/\n{3,}/g, "\n\n")
      .trim();
    if (text.length === 0) return null;
    if (text.length > maxChars) return text.slice(0, maxChars) + "\n\n[... truncated]";
    return text;
  } catch {
    return null;
  }
}

/**
 * Extract text from a PDF using pdfjs-dist.
 * Lazy-loads the module to avoid import overhead when not needed.
 */
async function extractPdfTextFromBuffer(b64: string, maxChars = 500_000): Promise<string | null> {
  try {
    const { getDocument } = await import("pdfjs-dist/legacy/build/pdf.mjs");
    const buffer = Buffer.from(b64, "base64");
    const pdf = await getDocument({
      data: new Uint8Array(buffer),
      disableWorker: true,
    }).promise;
    const maxPages = Math.min(pdf.numPages, 50);
    const textParts: string[] = [];
    for (let pageNum = 1; pageNum <= maxPages; pageNum++) {
      const page = await pdf.getPage(pageNum);
      const textContent = await page.getTextContent();
      const pageText = textContent.items
        .map((item) => ("str" in item ? String(item.str) : ""))
        .filter(Boolean)
        .join(" ");
      if (pageText) textParts.push(pageText);
    }
    const text = textParts.join("\n\n").trim();
    if (text.length === 0) return null;
    if (text.length > maxChars) return text.slice(0, maxChars) + "\n\n[... truncated]";
    return text;
  } catch {
    return null;
  }
}

/**
 * Try to decode base64 as UTF-8 text. Returns the text if it looks like
 * readable content (high ratio of printable characters), otherwise null.
 */
function tryDecodeAsText(b64: string, maxChars = 500_000): string | null {
  try {
    const buf = Buffer.from(b64, "base64");
    const text = buf.toString("utf-8");
    if (text.length === 0) return null;
    if (text.length > maxChars) return text.slice(0, maxChars) + "\n\n[... truncated]";
    // Check if content is mostly printable (allow newlines, tabs, etc.)
    const sample = text.slice(0, 2000);
    const printable = sample.replace(/[\x00-\x08\x0E-\x1F\x7F-\x9F]/g, "").length;
    if (printable / sample.length < 0.85) return null;
    return text;
  } catch {
    return null;
  }
}

/**
 * Parse attachments and extract images and document content.
 * - Images are returned as structured content blocks for Claude API.
 * - Text documents are decoded and injected into the message text.
 * - PDFs are returned as document content blocks for Claude API.
 */
export async function parseMessageWithAttachments(
  message: string,
  attachments: ChatAttachment[] | undefined,
  opts?: { maxBytes?: number; log?: AttachmentLog },
): Promise<ParsedMessageWithImages> {
  const maxBytes = opts?.maxBytes ?? 5_000_000; // 5 MB
  const log = opts?.log;
  if (!attachments || attachments.length === 0) {
    return { message, images: [] };
  }

  const images: ChatImageContent[] = [];
  const documentBlocks: string[] = [];

  for (const [idx, att] of attachments.entries()) {
    if (!att) continue;
    const mime = att.mimeType ?? "";
    const content = att.content;
    const label = att.fileName || att.type || `attachment-${idx + 1}`;

    if (typeof content !== "string") {
      throw new Error(`attachment ${label}: content must be base64 string`);
    }

    let sizeBytes = 0;
    let b64 = content.trim();
    // Strip data URL prefix if present (e.g., "data:image/jpeg;base64,...")
    const dataUrlMatch = /^data:[^;]+;base64,(.*)$/.exec(b64);
    if (dataUrlMatch) {
      b64 = dataUrlMatch[1];
    }
    // Basic base64 sanity: length multiple of 4 and charset check.
    if (b64.length % 4 !== 0 || /[^A-Za-z0-9+/=]/.test(b64)) {
      throw new Error(`attachment ${label}: invalid base64 content`);
    }
    try {
      sizeBytes = Buffer.from(b64, "base64").byteLength;
    } catch {
      throw new Error(`attachment ${label}: invalid base64 content`);
    }
    if (sizeBytes <= 0 || sizeBytes > maxBytes) {
      throw new Error(`attachment ${label}: exceeds size limit (${sizeBytes} > ${maxBytes} bytes)`);
    }

    const providedMime = normalizeMime(mime);
    const sniffedMime = normalizeMime(await sniffMimeFromBase64(b64));
    const effectiveMime = sniffedMime ?? providedMime;

    // Image attachments → structured image content blocks
    if (isImageMime(sniffedMime) || (!sniffedMime && isImageMime(providedMime))) {
      if (sniffedMime && providedMime && sniffedMime !== providedMime) {
        log?.warn(
          `attachment ${label}: mime mismatch (${providedMime} -> ${sniffedMime}), using sniffed`,
        );
      }
      images.push({
        type: "image",
        data: b64,
        mimeType: sniffedMime ?? providedMime ?? mime,
      });
      continue;
    }

    // Word documents (.docx/.doc) → extract text from ZIP/XML
    if (isDocxMime(effectiveMime) || isDocxMime(providedMime) || hasDocxExtension(att.fileName)) {
      const text = await extractDocxText(b64);
      if (text) {
        documentBlocks.push(`<document name="${label}" type="docx">\n${text}\n</document>`);
        continue;
      }
      documentBlocks.push(
        `<document name="${label}" type="docx">[Word document attached - ${Math.round(sizeBytes / 1024)}KB. The document content could not be extracted as text.]</document>`,
      );
      continue;
    }

    // Text-based documents → decode and inject into message
    if (isTextMime(effectiveMime) || isTextMime(providedMime)) {
      const text = tryDecodeAsText(b64);
      if (text) {
        documentBlocks.push(`<document name="${label}">\n${text}\n</document>`);
        continue;
      }
    }

    // PDF → extract text using pdfjs-dist, fall back to raw decode
    if (isPdfMime(effectiveMime) || isPdfMime(providedMime)) {
      const text = (await extractPdfTextFromBuffer(b64)) ?? tryDecodeAsText(b64);
      if (text && text.length > 50) {
        documentBlocks.push(`<document name="${label}" type="pdf">\n${text}\n</document>`);
      } else {
        documentBlocks.push(
          `<document name="${label}" type="pdf">[PDF file attached - ${Math.round(sizeBytes / 1024)}KB. The PDF content could not be extracted as text. Please let the user know you received the file but cannot read its contents directly.]</document>`,
        );
      }
      continue;
    }

    // Other non-image files → try to decode as text (best effort)
    const text = tryDecodeAsText(b64);
    if (text) {
      documentBlocks.push(`<document name="${label}">\n${text}\n</document>`);
      continue;
    }

    // Binary file we can't process
    log?.warn(`attachment ${label}: unsupported format (${effectiveMime ?? "unknown"}), dropping`);
    documentBlocks.push(
      `<document name="${label}">[File attached: ${label} (${effectiveMime ?? "unknown"}, ${Math.round(sizeBytes / 1024)}KB). This file format cannot be read directly. Please let the user know you received the file but cannot process this format.]</document>`,
    );
  }

  // Prepend document content to the message so the AI can reference it
  let finalMessage = message;
  if (documentBlocks.length > 0) {
    const docContext = documentBlocks.join("\n\n");
    finalMessage = documentBlocks.length > 0 ? `${docContext}\n\n${message}` : message;
  }

  return { message: finalMessage, images };
}

/**
 * @deprecated Use parseMessageWithAttachments instead.
 * This function converts images to markdown data URLs which Claude API cannot process as images.
 */
export function buildMessageWithAttachments(
  message: string,
  attachments: ChatAttachment[] | undefined,
  opts?: { maxBytes?: number },
): string {
  const maxBytes = opts?.maxBytes ?? 2_000_000; // 2 MB
  if (!attachments || attachments.length === 0) return message;

  const blocks: string[] = [];

  for (const [idx, att] of attachments.entries()) {
    if (!att) continue;
    const mime = att.mimeType ?? "";
    const content = att.content;
    const label = att.fileName || att.type || `attachment-${idx + 1}`;

    if (typeof content !== "string") {
      throw new Error(`attachment ${label}: content must be base64 string`);
    }
    if (!mime.startsWith("image/")) {
      throw new Error(`attachment ${label}: only image/* supported`);
    }

    let sizeBytes = 0;
    const b64 = content.trim();
    // Basic base64 sanity: length multiple of 4 and charset check.
    if (b64.length % 4 !== 0 || /[^A-Za-z0-9+/=]/.test(b64)) {
      throw new Error(`attachment ${label}: invalid base64 content`);
    }
    try {
      sizeBytes = Buffer.from(b64, "base64").byteLength;
    } catch {
      throw new Error(`attachment ${label}: invalid base64 content`);
    }
    if (sizeBytes <= 0 || sizeBytes > maxBytes) {
      throw new Error(`attachment ${label}: exceeds size limit (${sizeBytes} > ${maxBytes} bytes)`);
    }

    const safeLabel = label.replace(/\s+/g, "_");
    const dataUrl = `![${safeLabel}](data:${mime};base64,${content})`;
    blocks.push(dataUrl);
  }

  if (blocks.length === 0) return message;
  const separator = message.trim().length > 0 ? "\n\n" : "";
  return `${message}${separator}${blocks.join("\n\n")}`;
}
