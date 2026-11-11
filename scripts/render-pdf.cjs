const pdfjsLib = require('pdfjs-dist/legacy/build/pdf.js');
const { createCanvas } = require('canvas');
const fs = require('fs');
const path = require('path');

async function renderPDF(pdfPath, outDir) {
  const data = new Uint8Array(fs.readFileSync(pdfPath));
  const doc = await pdfjsLib.getDocument({ data }).promise;
  
  if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });
  
  for (let i = 1; i <= doc.numPages; i++) {
    const page = await doc.getPage(i);
    const scale = 1.5;
    const vp = page.getViewport({ scale });
    const canvas = createCanvas(vp.width, vp.height);
    const ctx = canvas.getContext('2d');
    
    await page.render({ canvasContext: ctx, viewport: vp }).promise;
    
    const outPath = path.join(outDir, `page_${String(i).padStart(2, '0')}.png`);
    const buf = canvas.toBuffer('image/png');
    fs.writeFileSync(outPath, buf);
    console.log(`Rendered page ${i} -> ${outPath} (${(buf.length/1024).toFixed(0)}KB)`);
  }
  console.log('Done! Total pages:', doc.numPages);
}

renderPDF(
  path.join(__dirname, '..', 'JAGAT G7 Sovereign Roadmap.pdf'),
  path.join(__dirname, '..', 'roadmap_pages')
).catch(e => console.error(e));
