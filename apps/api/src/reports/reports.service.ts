import { Injectable, Logger } from '@nestjs/common';
import { PDFDocument, rgb, StandardFonts } from 'pdf-lib';
import { CalculationResult } from '../calculator/calculator.service';

const ro = (s: string) =>
  s.replace(/[ăâ]/g, 'a').replace(/[ÂĂ]/g, 'A')
   .replace(/î/g, 'i').replace(/Î/g, 'I')
   .replace(/[șş]/g, 's').replace(/[ȘŞ]/g, 'S')
   .replace(/[țţ]/g, 't').replace(/[ȚŢ]/g, 'T');

@Injectable()
export class ReportsService {
  private readonly logger = new Logger(ReportsService.name);

  async generateAmortizationPdf(calc: CalculationResult, partnerName: string): Promise<Buffer> {
    const pdfDoc = await PDFDocument.create();
    const page   = pdfDoc.addPage([595, 842]); // A4 portrait
    const { width, height } = page.getSize();

    const fontBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
    const fontReg  = await pdfDoc.embedFont(StandardFonts.Helvetica);

    // ── Professional white palette ────────────────────────────────
    const black      = rgb(0.08, 0.08, 0.10);   // near-black text
    const navy       = rgb(0.10, 0.18, 0.36);   // deep navy for header bar
    const accentBlue = rgb(0.13, 0.44, 0.78);   // professional blue accent
    const white      = rgb(1, 1, 1);
    const gray50     = rgb(0.97, 0.97, 0.98);   // alternating row bg
    const gray200    = rgb(0.88, 0.88, 0.90);   // table border lines
    const gray500    = rgb(0.45, 0.45, 0.50);   // secondary text

    // ── Header bar (navy, full width) ─────────────────────────────
    page.drawRectangle({ x: 0, y: height - 72, width, height: 72, color: navy });

    page.drawText('IONIX PARTNER', {
      x: 36, y: height - 32,
      font: fontBold, size: 18, color: white,
    });
    page.drawText('Priminvestnord SRL', {
      x: 36, y: height - 48,
      font: fontReg, size: 9, color: rgb(0.75, 0.82, 0.94),
    });
    page.drawText(ro(`Graf de Rambursare — Partener: ${partnerName}`), {
      x: 36, y: height - 62,
      font: fontReg, size: 8, color: rgb(0.65, 0.72, 0.88),
    });

    // Date top-right
    const dateStr = new Date().toLocaleDateString('ro-MD', { day: '2-digit', month: 'long', year: 'numeric' });
    const dateW = fontReg.widthOfTextAtSize(dateStr, 8);
    page.drawText(dateStr, {
      x: width - dateW - 36, y: height - 48,
      font: fontReg, size: 8, color: rgb(0.65, 0.72, 0.88),
    });

    // ── Summary box ───────────────────────────────────────────────
    const boxY = height - 72 - 70;
    page.drawRectangle({ x: 30, y: boxY, width: width - 60, height: 58,
      color: gray50, borderColor: gray200, borderWidth: 0.5 });

    // Blue left accent bar
    page.drawRectangle({ x: 30, y: boxY, width: 3, height: 58, color: accentBlue });

    const summaryItems = [
      ['Tip Credit',      calc.creditType === 'ZERO' ? 'Credit Zero (0%)' : 'Credit Clasic'],
      ['Suma acordata',   `${calc.amount.toLocaleString('ro-MD')} MDL`],
      ['Termen',          `${calc.months} luni`],
      ['Rata lunara',     `${calc.monthlyPayment.toLocaleString('ro-MD')} MDL`],
      ['Total de plata',  `${calc.totalAmount.toLocaleString('ro-MD')} MDL`],
      ['DAE',             `${calc.dae}%`],
    ];

    const colW = (width - 80) / 3;
    summaryItems.forEach(([label, value], i) => {
      const col = i % 3;
      const row = Math.floor(i / 3);
      const x = 40 + col * colW;
      const y = boxY + 42 - row * 26;
      page.drawText(label, { x, y, font: fontReg, size: 7, color: gray500 });
      page.drawText(ro(value), { x, y: y - 11, font: fontBold, size: 9, color: black });
    });

    // ── Section title ─────────────────────────────────────────────
    const titleY = boxY - 22;
    page.drawText('GRAFIC DE RAMBURSARE', {
      x: 36, y: titleY,
      font: fontBold, size: 8, color: accentBlue,
    });
    // Underline
    page.drawLine({
      start: { x: 36, y: titleY - 3 },
      end:   { x: width - 36, y: titleY - 3 },
      thickness: 0.5, color: accentBlue,
    });

    // ── Table header ──────────────────────────────────────────────
    const tableTop = titleY - 18;
    const cols = [
      { label: '#',           x: 36,  w: 28,  align: 'center' },
      { label: 'Data',        x: 68,  w: 68,  align: 'center' },
      { label: 'Principal',   x: 140, w: 100, align: 'right'  },
      { label: 'Comision',    x: 244, w: 100, align: 'right'  },
      { label: 'Total Lunar', x: 348, w: 116, align: 'right'  },
    ] as const;

    // Header row bg
    page.drawRectangle({ x: 30, y: tableTop - 5, width: width - 60, height: 16, color: navy });

    cols.forEach((col) => {
      const tw = fontBold.widthOfTextAtSize(col.label, 7.5);
      const tx = col.align === 'right' ? col.x + col.w - tw : col.x + (col.w - tw) / 2;
      page.drawText(col.label, { x: tx, y: tableTop - 1, font: fontBold, size: 7.5, color: white });
    });

    // ── Table rows ────────────────────────────────────────────────
    const rowH = 14;
    let curY = tableTop - rowH;
    let curPage = page;

    const fmt = (n: number) => n.toLocaleString('ro-MD', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

    const startDate = new Date();
    const payDate = (idx: number) => {
      const d = new Date(startDate.getFullYear(), startDate.getMonth() + idx, startDate.getDate());
      return `${String(d.getDate()).padStart(2, '0')}.${String(d.getMonth() + 1).padStart(2, '0')}.${d.getFullYear()}`;
    };

    for (const row of calc.schedule) {
      if (curY < 60) {
        curPage = pdfDoc.addPage([595, 842]);
        curY = height - 40;
      }

      if (row.month % 2 === 0) {
        curPage.drawRectangle({ x: 30, y: curY - 3, width: width - 60, height: rowH, color: gray50 });
      }

      // Bottom border per row
      curPage.drawLine({
        start: { x: 30, y: curY - 3 }, end: { x: width - 30, y: curY - 3 },
        thickness: 0.25, color: gray200,
      });

      const commission = Math.max(0, Math.round((row.payment - row.principal - row.interest) * 100) / 100);
      const cells = [
        { text: String(row.month),       col: cols[0] },
        { text: payDate(row.month),      col: cols[1] },
        { text: fmt(row.principal),      col: cols[2] },
        { text: commission > 0 ? fmt(commission) : '—', col: cols[3] },
        { text: fmt(row.payment),        col: cols[4] },
      ];

      cells.forEach(({ text, col }) => {
        const tw = fontReg.widthOfTextAtSize(text, 7.5);
        const tx = col.align === 'right'
          ? col.x + col.w - tw
          : col.x + (col.w - tw) / 2;
        curPage.drawText(text, { x: tx, y: curY, font: fontReg, size: 7.5, color: black });
      });

      curY -= rowH;
    }

    // ── Footer ────────────────────────────────────────────────────
    const lastPage = pdfDoc.getPages()[pdfDoc.getPageCount() - 1];
    lastPage.drawLine({
      start: { x: 30, y: 40 }, end: { x: width - 30, y: 40 },
      thickness: 0.5, color: gray200,
    });
    lastPage.drawText('Elaborat de @Bajerean Ion — Ionix Partner Platform | Priminvestnord SRL', {
      x: 30, y: 28, font: fontReg, size: 7, color: gray500,
    });
    lastPage.drawText('Document generat automat. Nu are valoare juridica fara semnatura unui reprezentant autorizat.', {
      x: 30, y: 18, font: fontReg, size: 6.5, color: gray200,
    });

    return Buffer.from(await pdfDoc.save());
  }
}
