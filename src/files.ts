import { MAX_TEXT_CHARS } from "./storage";

const MAX_PLAIN = 2_000_000;
const MAX_ARCHIVE = 15_000_000;
const MAX_PDF = 25_000_000;
const MAX_PDF_PAGES = 150;
/** Cap on unpacked size, so a crafted file cannot swell in memory. */
const MAX_UNPACKED = 12_000_000;

export class FileProblem extends Error {}

/** Shown in the file picker. Dropping accepts anything, and unknown files are checked for readable text. */
export const ACCEPT = ".docx,.pdf,.pptx,.odt,.rtf,.html,.htm,.txt,.md,.csv,.json,.xml,.tex";

const TEXT_EXT = new Set(["txt", "md", "markdown", "csv", "tsv", "json", "xml", "tex", "log", "text", "srt", "yaml", "yml", "ini", "rst", "org"]);

export const SUPPORTED_LABEL = "Word (.docx), PDF, PowerPoint (.pptx), OpenDocument (.odt), RTF, HTML, and plain text such as .txt, .md and .csv";

/** Reads a dropped or chosen file and returns its text. Throws FileProblem with a message fit to show. */
export async function readFileText(file: File): Promise<string> {
  const ext = (file.name.split(".").pop() ?? "").toLowerCase();
  const mime = file.type;
  const limit = (max: number, what: string): void => {
    if (file.size > max) throw new FileProblem("That " + what + " file is over " + Math.round(max / 1_000_000) + " MB. Paste in the part you want checked.");
  };

  if (ext === "docx") {
    limit(MAX_ARCHIVE, "Word");
    return finish(await docxText(await file.arrayBuffer()));
  }
  if (ext === "pptx") {
    limit(MAX_ARCHIVE, "PowerPoint");
    return finish(await pptxText(await file.arrayBuffer()));
  }
  if (ext === "odt") {
    limit(MAX_ARCHIVE, "OpenDocument");
    return finish(await odtText(await file.arrayBuffer()));
  }
  if (ext === "pdf" || mime === "application/pdf") {
    limit(MAX_PDF, "PDF");
    return finish(await pdfText(await file.arrayBuffer()));
  }
  if (ext === "rtf" || mime === "application/rtf" || mime === "text/rtf") {
    limit(MAX_PLAIN, "RTF");
    return finish(rtfText(await file.text()));
  }
  if (ext === "html" || ext === "htm" || mime === "text/html") {
    limit(MAX_PLAIN, "HTML");
    return finish(htmlText(await file.text()));
  }
  if (TEXT_EXT.has(ext) || mime.startsWith("text/")) {
    limit(MAX_PLAIN, "text");
    return finish(await file.text());
  }

  // Unknown type: if it is a Word-style zip we know, otherwise accept it only when it holds readable text.
  limit(MAX_PLAIN, "");
  const buf = await file.arrayBuffer();
  const head = new Uint8Array(buf, 0, Math.min(buf.byteLength, 8192));
  if (head[0] === 0x25 && head[1] === 0x50 && head[2] === 0x44 && head[3] === 0x46) return finish(await pdfText(buf));
  if (head[0] === 0x50 && head[1] === 0x4b) throw new FileProblem("That archive is not a file type Plainhand can open. Word (.docx), PowerPoint (.pptx) and OpenDocument (.odt) work.");
  if (looksLikeText(head)) return finish(new TextDecoder("utf-8", { fatal: false }).decode(buf));
  throw new FileProblem(
    "Plainhand cannot read that kind of file. It opens " + SUPPORTED_LABEL + ". For images or scans, a text copy is needed, so paste the text in.",
  );
}

function looksLikeText(bytes: Uint8Array): boolean {
  if (!bytes.length) return false;
  let odd = 0;
  for (const b of bytes) {
    if (b === 0) return false;
    if (b < 9 || (b > 13 && b < 32)) odd++;
  }
  return odd / bytes.length < 0.02;
}

function finish(text: string): string {
  const t = text.replace(/\r\n?/g, "\n").replace(/\u0000/g, "").replace(/[ \t ]+\n/g, "\n").replace(/\n{3,}/g, "\n\n");
  if (!t.trim()) {
    throw new FileProblem("No readable text was found in that file. If it is a scan or a photo of a page, paste the text in instead.");
  }
  return t.trim().slice(0, MAX_TEXT_CHARS);
}

/* ---------------- RTF and HTML ---------------- */

function rtfText(rtf: string): string {
  if (!/^\s*\{\\rtf/.test(rtf)) throw new FileProblem("That does not look like a valid RTF file.");
  let out = "";
  let depth = 0;
  let skipDepth = -1;
  const SKIP = new Set(["fonttbl", "colortbl", "stylesheet", "info", "pict", "header", "footer", "footnote", "object", "themedata", "datastore", "latentstyles", "listtable", "listoverridetable", "generator"]);
  for (let i = 0; i < rtf.length; i++) {
    const ch = rtf[i]!;
    if (ch === "{") {
      depth++;
    } else if (ch === "}") {
      if (depth === skipDepth) skipDepth = -1;
      depth--;
    } else if (ch === "\\") {
      const next = rtf[i + 1] ?? "";
      if ("\\{}".includes(next)) {
        if (skipDepth < 0) out += next;
        i++;
      } else if (next === "*") {
        if (skipDepth < 0) skipDepth = depth;
        i++;
      } else if (next === "'") {
        const hex = rtf.slice(i + 2, i + 4);
        if (skipDepth < 0 && /^[0-9a-f]{2}$/i.test(hex)) out += String.fromCharCode(parseInt(hex, 16));
        i += 3;
      } else {
        const m = /^\\([a-z]+)(-?\d+)? ?/i.exec(rtf.slice(i, i + 40));
        if (!m) continue;
        const word = m[1]!;
        if (SKIP.has(word) && skipDepth < 0) skipDepth = depth;
        if (skipDepth < 0) {
          if (word === "par" || word === "line" || word === "sect" || word === "page") out += "\n";
          else if (word === "tab") out += " ";
          else if (word === "emdash") out += "—";
          else if (word === "endash") out += "–";
          else if (word === "lquote") out += "‘";
          else if (word === "rquote") out += "’";
          else if (word === "ldblquote") out += "“";
          else if (word === "rdblquote") out += "”";
          else if (word === "u" && m[2]) {
            const code = parseInt(m[2], 10);
            out += String.fromCharCode(code < 0 ? code + 65536 : code);
            // a replacement character follows \uN, drop it
            const after = rtf[i + m[0].length];
            if (after && after !== "\\" && after !== "{" && after !== "}") i++;
          }
        }
        i += m[0].length - 1;
      }
    } else if (skipDepth < 0 && ch !== "\n" && ch !== "\r") {
      out += ch;
    }
  }
  return out.replace(/\n[ \t]*/g, "\n").replace(/\n(?!\n)/g, "\n\n");
}

function htmlText(html: string): string {
  const doc = new DOMParser().parseFromString(html, "text/html");
  doc.querySelectorAll("script, style, noscript, template, svg, head").forEach((n) => n.remove());
  const blocks = "p,div,li,h1,h2,h3,h4,h5,h6,tr,blockquote,section,article,br";
  doc.querySelectorAll(blocks).forEach((n) => n.append(doc.createTextNode("\n\n")));
  return (doc.body?.textContent ?? "").replace(/[ \t]+/g, " ");
}

/* ---------------- Zip based formats ---------------- */

interface ZipEntry {
  name: string;
  method: number;
  compSize: number;
  localOff: number;
}

function listZip(buf: ArrayBuffer): ZipEntry[] {
  const v = new DataView(buf);
  const bytes = new Uint8Array(buf);
  const bad = (): never => {
    throw new FileProblem("That file looks damaged or is not the format its name says.");
  };
  if (buf.byteLength < 22 || v.getUint32(0, true) !== 0x04034b50) bad();

  let eocd = -1;
  for (let i = buf.byteLength - 22; i >= Math.max(0, buf.byteLength - 65_557); i--) {
    if (v.getUint32(i, true) === 0x06054b50) {
      eocd = i;
      break;
    }
  }
  if (eocd < 0) bad();
  const count = v.getUint16(eocd + 10, true);
  let p = v.getUint32(eocd + 16, true);
  const dec = new TextDecoder();
  const entries: ZipEntry[] = [];
  for (let n = 0; n < count && p + 46 <= buf.byteLength; n++) {
    if (v.getUint32(p, true) !== 0x02014b50) bad();
    const nameLen = v.getUint16(p + 28, true);
    const extraLen = v.getUint16(p + 30, true);
    const commentLen = v.getUint16(p + 32, true);
    entries.push({
      name: dec.decode(bytes.subarray(p + 46, p + 46 + nameLen)),
      method: v.getUint16(p + 10, true),
      compSize: v.getUint32(p + 20, true),
      localOff: v.getUint32(p + 42, true),
    });
    p += 46 + nameLen + extraLen + commentLen;
  }
  return entries;
}

async function readEntry(buf: ArrayBuffer, e: ZipEntry): Promise<string> {
  const v = new DataView(buf);
  const bytes = new Uint8Array(buf);
  const dec = new TextDecoder();
  if (e.localOff + 30 > buf.byteLength || v.getUint32(e.localOff, true) !== 0x04034b50) {
    throw new FileProblem("That file looks damaged.");
  }
  const start = e.localOff + 30 + v.getUint16(e.localOff + 26, true) + v.getUint16(e.localOff + 28, true);
  if (start + e.compSize > buf.byteLength) throw new FileProblem("That file looks damaged.");
  const data = bytes.subarray(start, start + e.compSize);
  if (e.method === 0) return dec.decode(data);
  if (e.method !== 8) throw new FileProblem("That file uses a compression Plainhand cannot open.");
  if (typeof DecompressionStream === "undefined") {
    throw new FileProblem("This browser cannot open that kind of file. Copy the text and paste it in instead.");
  }
  const reader = new Blob([data as BlobPart]).stream().pipeThrough(new DecompressionStream("deflate-raw")).getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    total += value.length;
    if (total > MAX_UNPACKED) {
      await reader.cancel();
      throw new FileProblem("That file is too large once opened. Paste in the part you want checked.");
    }
    chunks.push(value);
  }
  const out = new Uint8Array(total);
  let o = 0;
  chunks.forEach((c) => {
    out.set(c, o);
    o += c.length;
  });
  return dec.decode(out);
}

function parseXml(xml: string): Document {
  const doc = new DOMParser().parseFromString(xml, "application/xml");
  if (doc.getElementsByTagName("parsererror").length) throw new FileProblem("That file could not be read. Try saving it again, or paste the text in.");
  return doc;
}

const NS_W = "http://schemas.openxmlformats.org/wordprocessingml/2006/main";
const NS_A = "http://schemas.openxmlformats.org/drawingml/2006/main";
const NS_TEXT = "urn:oasis:names:tc:opendocument:xmlns:text:1.0";

/** Collects the text inside each paragraph element, in order. */
function paragraphs(doc: Document, ns: string, para: string, textTags: string[], gapTags: string[], skipTags: string[]): string[] {
  const out: string[] = [];
  Array.from(doc.getElementsByTagNameNS(ns, para)).forEach((p) => {
    let line = "";
    const walk = (node: Element): void => {
      Array.from(node.childNodes).forEach((c) => {
        if (c.nodeType === 3 && textTags.includes("#text")) {
          line += c.textContent ?? "";
          return;
        }
        if (c.nodeType !== 1) return;
        const el = c as Element;
        if (skipTags.includes(el.localName)) return;
        if (textTags.includes(el.localName)) line += el.textContent ?? "";
        else if (gapTags.includes(el.localName)) line += " ";
        else walk(el);
      });
    };
    walk(p);
    if (line.trim()) out.push(line.trim());
  });
  return out;
}

async function docxText(buf: ArrayBuffer): Promise<string> {
  const entry = listZip(buf).find((e) => e.name === "word/document.xml");
  if (!entry) throw new FileProblem("That does not look like a Word .docx file.");
  const doc = parseXml(await readEntry(buf, entry));
  return paragraphs(doc, NS_W, "p", ["t"], ["tab", "br", "cr"], ["delText", "instrText"]).join("\n\n");
}

async function odtText(buf: ArrayBuffer): Promise<string> {
  const entry = listZip(buf).find((e) => e.name === "content.xml");
  if (!entry) throw new FileProblem("That does not look like an OpenDocument text file.");
  const doc = parseXml(await readEntry(buf, entry));
  const lines = paragraphs(doc, NS_TEXT, "p", ["#text"], ["tab", "line-break", "s"], []);
  const heads = paragraphs(doc, NS_TEXT, "h", ["#text"], ["tab", "line-break", "s"], []);
  // Keep document order by re-walking body children.
  const ordered: string[] = [];
  const body = doc.getElementsByTagNameNS("urn:oasis:names:tc:opendocument:xmlns:office:1.0", "text")[0];
  if (body) {
    const pick = (el: Element): void => {
      Array.from(el.children).forEach((c) => {
        if (c.namespaceURI === NS_TEXT && (c.localName === "p" || c.localName === "h")) {
          const t = (c.textContent ?? "").trim();
          if (t) ordered.push(t);
        } else pick(c);
      });
    };
    pick(body);
  }
  return (ordered.length ? ordered : [...heads, ...lines]).join("\n\n");
}

async function pptxText(buf: ArrayBuffer): Promise<string> {
  const slides = listZip(buf)
    .filter((e) => /^ppt\/slides\/slide\d+\.xml$/.test(e.name))
    .sort((a, b) => Number(a.name.match(/\d+/)![0]) - Number(b.name.match(/\d+/)![0]));
  if (!slides.length) throw new FileProblem("That does not look like a PowerPoint .pptx file.");
  const out: string[] = [];
  for (const s of slides) {
    const doc = parseXml(await readEntry(buf, s));
    out.push(...paragraphs(doc, NS_A, "p", ["t"], ["br"], []));
  }
  return out.join("\n\n");
}

/* ---------------- PDF ---------------- */

async function pdfText(buf: ArrayBuffer): Promise<string> {
  // The worker is bundled in and runs on the page, so no extra file or network request is needed.
  await import("pdfjs-dist/legacy/build/pdf.worker.mjs");
  const pdfjs = await import("pdfjs-dist/legacy/build/pdf.mjs");
  const task = pdfjs.getDocument({ data: new Uint8Array(buf), disableFontFace: true, useSystemFonts: false });
  let doc;
  try {
    doc = await task.promise;
  } catch (err) {
    const name = (err as { name?: string }).name ?? "";
    if (name === "PasswordException") throw new FileProblem("That PDF is password protected. Open it, copy the text, and paste it in.");
    throw new FileProblem("That PDF could not be opened. It may be damaged. Try pasting the text in instead.");
  }
  const pages = Math.min(doc.numPages, MAX_PDF_PAGES);
  const parts: string[] = [];
  let size = 0;
  for (let n = 1; n <= pages; n++) {
    const page = await doc.getPage(n);
    const content = await page.getTextContent();
    let line = "";
    let text = "";
    let lastY: number | null = null;
    for (const item of content.items) {
      if (!("str" in item)) continue;
      const y = item.transform[5] as number;
      const h = Math.max(item.height || 0, 8);
      if (lastY !== null && Math.abs(y - lastY) > 2) {
        // a gap well beyond one line of text is a paragraph break
        text += line.trim() + (Math.abs(y - lastY) > h * 1.9 ? "\n\n" : "\n");
        line = "";
      }
      line += item.str + (item.hasEOL ? "\n" : "");
      lastY = y;
    }
    text += line.trim();
    parts.push(text);
    size += text.length;
    page.cleanup();
    if (size > MAX_TEXT_CHARS * 2) break;
  }
  await task.destroy();
  // Lines inside a paragraph are joined, blank-line gaps stay as paragraph breaks.
  return parts
    .join("\n\n")
    .split(/\n{2,}/)
    .map((block) => block.replace(/-\n(?=[a-z])/g, "").replace(/\n+/g, " ").trim())
    .filter(Boolean)
    .join("\n\n");
}
