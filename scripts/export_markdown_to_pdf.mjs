import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';

function escapeHtml(value) {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

function parseInline(text) {
  let html = escapeHtml(text);
  html = html.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
  html = html.replace(/`([^`]+)`/g, '<code>$1</code>');
  return html;
}

function splitTableRow(line) {
  return line
    .trim()
    .replace(/^\|/, '')
    .replace(/\|$/, '')
    .split('|')
    .map((cell) => cell.trim());
}

function markdownToHtml(markdown) {
  const lines = markdown.replace(/\r\n/g, '\n').split('\n');
  let html = '';
  let inCode = false;
  let inUl = false;
  let inOl = false;
  let inTable = false;
  let paragraph = [];

  function closeParagraph() {
    if (!paragraph.length) return;
    html += `<p>${parseInline(paragraph.join(' '))}</p>\n`;
    paragraph = [];
  }

  function closeLists() {
    if (inUl) {
      html += '</ul>\n';
      inUl = false;
    }
    if (inOl) {
      html += '</ol>\n';
      inOl = false;
    }
  }

  function closeTable() {
    if (inTable) {
      html += '</tbody></table>\n';
      inTable = false;
    }
  }

  for (let i = 0; i < lines.length; i += 1) {
    const line = lines[i];
    const trimmed = line.trim();

    if (trimmed.startsWith('```')) {
      closeParagraph();
      closeLists();
      closeTable();
      if (!inCode) {
        inCode = true;
        html += '<pre><code>';
      } else {
        inCode = false;
        html += '</code></pre>\n';
      }
      continue;
    }

    if (inCode) {
      html += `${escapeHtml(line)}\n`;
      continue;
    }

    if (!trimmed) {
      closeParagraph();
      closeLists();
      closeTable();
      continue;
    }

    const headingMatch = trimmed.match(/^(#{1,6})\s+(.*)$/);
    if (headingMatch) {
      closeParagraph();
      closeLists();
      closeTable();
      const level = headingMatch[1].length;
      html += `<h${level}>${parseInline(headingMatch[2])}</h${level}>\n`;
      continue;
    }

    if (/^\|.+\|$/.test(trimmed)) {
      const next = lines[i + 1]?.trim() ?? '';
      if (!inTable) {
        closeParagraph();
        closeLists();
        const headerCells = splitTableRow(trimmed);
        if (/^\|?[\s:-]+\|[\s|:-]*$/.test(next)) {
          inTable = true;
          html += '<table>\n<thead><tr>';
          for (const cell of headerCells) {
            html += `<th>${parseInline(cell)}</th>`;
          }
          html += '</tr></thead>\n<tbody>\n';
          i += 1;
          continue;
        }
      }
      if (inTable) {
        const cells = splitTableRow(trimmed);
        html += '<tr>';
        for (const cell of cells) {
          html += `<td>${parseInline(cell)}</td>`;
        }
        html += '</tr>\n';
        continue;
      }
    } else {
      closeTable();
    }

    const ulMatch = trimmed.match(/^[-*]\s+(.*)$/);
    if (ulMatch) {
      closeParagraph();
      closeTable();
      if (inOl) {
        html += '</ol>\n';
        inOl = false;
      }
      if (!inUl) {
        html += '<ul>\n';
        inUl = true;
      }
      html += `<li>${parseInline(ulMatch[1])}</li>\n`;
      continue;
    }

    const olMatch = trimmed.match(/^\d+\.\s+(.*)$/);
    if (olMatch) {
      closeParagraph();
      closeTable();
      if (inUl) {
        html += '</ul>\n';
        inUl = false;
      }
      if (!inOl) {
        html += '<ol>\n';
        inOl = true;
      }
      html += `<li>${parseInline(olMatch[1])}</li>\n`;
      continue;
    }

    closeLists();
    closeTable();
    paragraph.push(trimmed);
  }

  closeParagraph();
  closeLists();
  closeTable();

  return `<!doctype html>
<html lang="id">
<head>
  <meta charset="utf-8" />
  <title>JAGAT Document Export</title>
  <style>
    @page { size: A4; margin: 18mm 16mm 18mm 16mm; }
    body {
      font-family: "Segoe UI", Arial, sans-serif;
      color: #0f172a;
      line-height: 1.55;
      font-size: 11pt;
      background: #ffffff;
    }
    h1, h2, h3, h4, h5, h6 {
      color: #111827;
      margin: 1.1em 0 0.45em;
      line-height: 1.25;
    }
    h1 { font-size: 22pt; border-bottom: 2px solid #d1d5db; padding-bottom: 8px; }
    h2 { font-size: 16pt; margin-top: 1.5em; }
    h3 { font-size: 13pt; }
    p { margin: 0.45em 0; }
    ul, ol { margin: 0.45em 0 0.75em 1.25em; }
    li { margin: 0.2em 0; }
    code {
      font-family: Consolas, "Courier New", monospace;
      background: #f3f4f6;
      padding: 1px 4px;
      border-radius: 4px;
      font-size: 0.95em;
    }
    pre {
      background: #0f172a;
      color: #e5e7eb;
      padding: 12px 14px;
      border-radius: 8px;
      overflow: hidden;
      white-space: pre-wrap;
      word-break: break-word;
      font-size: 9.5pt;
    }
    table {
      width: 100%;
      border-collapse: collapse;
      margin: 0.9em 0 1.1em;
      font-size: 10pt;
    }
    th, td {
      border: 1px solid #d1d5db;
      padding: 8px 10px;
      text-align: left;
      vertical-align: top;
    }
    th {
      background: #f3f4f6;
      font-weight: 600;
    }
    strong { color: #111827; }
  </style>
</head>
<body>
${html}
</body>
</html>`;
}

const [, , inputArg, outputArg] = process.argv;

if (!inputArg) {
  console.error('Usage: node scripts/export_markdown_to_pdf.mjs <input.md> [output.pdf]');
  process.exit(1);
}

const inputPath = path.resolve(inputArg);
const outputPath = path.resolve(outputArg || inputPath.replace(/\.md$/i, '.pdf'));
const htmlPath = outputPath.replace(/\.pdf$/i, '.html');

const chromeCandidates = [
  'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
  'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
  'C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe',
  'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
];

const browserPath = chromeCandidates.find((candidate) => fs.existsSync(candidate));

if (!browserPath) {
  console.error('Chrome or Edge executable not found.');
  process.exit(1);
}

const markdown = fs.readFileSync(inputPath, 'utf8');
const html = markdownToHtml(markdown);
fs.writeFileSync(htmlPath, html, 'utf8');

const tempUserDataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'jagat-pdf-'));
const result = spawnSync(
  browserPath,
  [
    '--headless=new',
    `--user-data-dir=${tempUserDataDir}`,
    '--disable-gpu',
    '--no-first-run',
    '--no-default-browser-check',
    `--print-to-pdf=${outputPath}`,
    htmlPath,
  ],
  { stdio: 'pipe', encoding: 'utf8' },
);

if (result.status !== 0) {
  console.error(result.stderr || result.stdout || 'Browser PDF export failed.');
  process.exit(result.status ?? 1);
}

console.log(`PDF exported to ${outputPath}`);
console.log(`HTML preview saved to ${htmlPath}`);
