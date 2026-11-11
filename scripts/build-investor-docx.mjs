#!/usr/bin/env node
import fs from "node:fs/promises";
import path from "node:path";
import { execFileSync } from "node:child_process";

const ROOT = process.cwd();
const inputPath = path.join(ROOT, "ops", "investor", "JAGAT_G7_INVESTOR_PITCH_DECK_WORD_2026-06-30.md");
const outputPath = path.join(ROOT, "ops", "investor", "JAGAT_G7_INVESTOR_PITCH_DECK_WORD_2026-06-30.docx");
const tempRoot = path.join(ROOT, "ops", "investor", ".docx-build");

function escapeXml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

function cleanInline(value) {
  return String(value ?? "")
    .replace(/\*\*(.*?)\*\*/g, "$1")
    .replace(/\*(.*?)\*/g, "$1")
    .replace(/`([^`]+)`/g, "$1")
    .trim();
}

function run(text, opts = {}) {
  const size = opts.size ?? 24;
  const bold = opts.bold ? "<w:b/>" : "";
  return `<w:r><w:rPr>${bold}<w:sz w:val="${size}"/><w:szCs w:val="${size}"/></w:rPr><w:t xml:space="preserve">${escapeXml(text)}</w:t></w:r>`;
}

function paragraph(text, opts = {}) {
  const style = opts.style ? `<w:pStyle w:val="${opts.style}"/>` : "";
  const spacing = opts.tight ? "<w:spacing w:after=\"80\"/>" : "<w:spacing w:after=\"180\"/>";
  const indent = opts.indent ? `<w:ind w:left="${opts.indent}"/>` : "";
  return `<w:p><w:pPr>${style}${spacing}${indent}</w:pPr>${run(text, opts)}</w:p>`;
}

function pageBreak() {
  return "<w:p><w:r><w:br w:type=\"page\"/></w:r></w:p>";
}

function tableParagraph(line) {
  const cells = line
    .split("|")
    .map((cell) => cleanInline(cell))
    .filter(Boolean);
  if (!cells.length) return "";
  return paragraph(cells.join("    |    "), { size: 20, tight: true, indent: 360 });
}

function markdownToDocumentXml(markdown) {
  const blocks = [];
  const lines = markdown.split(/\r?\n/);

  for (let i = 0; i < lines.length; i += 1) {
    const raw = lines[i];
    const line = raw.trim();

    if (!line) {
      blocks.push(paragraph("", { tight: true, size: 16 }));
      continue;
    }

    if (line === "---") {
      blocks.push(pageBreak());
      continue;
    }

    if (/^\|[\s\S]*\|$/.test(line)) {
      if (/^\|\s*-+/.test(line)) continue;
      blocks.push(tableParagraph(line));
      continue;
    }

    const heading = line.match(/^(#{1,4})\s+(.+)$/);
    if (heading) {
      const level = heading[1].length;
      const text = cleanInline(heading[2]);
      const style = level === 1 ? "Heading1" : level === 2 ? "Heading2" : "Heading3";
      const size = level === 1 ? 36 : level === 2 ? 30 : 24;
      blocks.push(paragraph(text, { style, size, bold: true }));
      continue;
    }

    if (/^[-*]\s+/.test(line)) {
      blocks.push(paragraph(`- ${cleanInline(line.replace(/^[-*]\s+/, ""))}`, { size: 22, indent: 360 }));
      continue;
    }

    if (/^\d+\.\s+/.test(line)) {
      blocks.push(paragraph(cleanInline(line), { size: 22, indent: 360 }));
      continue;
    }

    if (/^>/.test(line)) {
      blocks.push(paragraph(cleanInline(line.replace(/^>\s*/, "")), { size: 22, bold: true, indent: 360 }));
      continue;
    }

    blocks.push(paragraph(cleanInline(line), { size: 22 }));
  }

  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
  <w:body>
    ${blocks.join("\n")}
    <w:sectPr>
      <w:pgSz w:w="12240" w:h="15840"/>
      <w:pgMar w:top="1080" w:right="1080" w:bottom="1080" w:left="1080" w:header="720" w:footer="720" w:gutter="0"/>
    </w:sectPr>
  </w:body>
</w:document>`;
}

async function writeFile(filePath, content) {
  await fs.mkdir(path.dirname(filePath), { recursive: true });
  await fs.writeFile(filePath, content, "utf8");
}

async function main() {
  const markdown = await fs.readFile(inputPath, "utf8");
  await fs.rm(tempRoot, { recursive: true, force: true });
  await fs.mkdir(path.join(tempRoot, "_rels"), { recursive: true });
  await fs.mkdir(path.join(tempRoot, "word", "_rels"), { recursive: true });

  await writeFile(path.join(tempRoot, "[Content_Types].xml"), `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
  <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
  <Default Extension="xml" ContentType="application/xml"/>
  <Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/>
  <Override PartName="/word/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.styles+xml"/>
</Types>`);

  await writeFile(path.join(tempRoot, "_rels", ".rels"), `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/>
</Relationships>`);

  await writeFile(path.join(tempRoot, "word", "_rels", "document.xml.rels"), `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"/>`);

  await writeFile(path.join(tempRoot, "word", "styles.xml"), `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:styles xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
  <w:style w:type="paragraph" w:default="1" w:styleId="Normal"><w:name w:val="Normal"/><w:rPr><w:rFonts w:ascii="Aptos" w:hAnsi="Aptos"/></w:rPr></w:style>
  <w:style w:type="paragraph" w:styleId="Heading1"><w:name w:val="heading 1"/><w:basedOn w:val="Normal"/><w:next w:val="Normal"/><w:qFormat/><w:rPr><w:b/><w:color w:val="0F766E"/></w:rPr></w:style>
  <w:style w:type="paragraph" w:styleId="Heading2"><w:name w:val="heading 2"/><w:basedOn w:val="Normal"/><w:next w:val="Normal"/><w:qFormat/><w:rPr><w:b/><w:color w:val="0F172A"/></w:rPr></w:style>
  <w:style w:type="paragraph" w:styleId="Heading3"><w:name w:val="heading 3"/><w:basedOn w:val="Normal"/><w:next w:val="Normal"/><w:qFormat/><w:rPr><w:b/><w:color w:val="334155"/></w:rPr></w:style>
</w:styles>`);

  await writeFile(path.join(tempRoot, "word", "document.xml"), markdownToDocumentXml(markdown));
  await fs.rm(outputPath, { force: true });
  const zipPath = outputPath.replace(/\.docx$/i, ".zip");
  await fs.rm(zipPath, { force: true });

  execFileSync("powershell", [
    "-NoProfile",
    "-ExecutionPolicy",
    "Bypass",
    "-Command",
    `Compress-Archive -Path '${tempRoot}\\*' -DestinationPath '${zipPath}' -Force`,
  ], { stdio: "inherit" });

  await fs.rename(zipPath, outputPath);
  await fs.rm(tempRoot, { recursive: true, force: true });
  console.log(`DOCX=${outputPath}`);
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : String(err));
  process.exitCode = 1;
});
