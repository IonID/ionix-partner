import { Injectable, Logger } from '@nestjs/common';
import { PDFDocument, rgb, StandardFonts } from 'pdf-lib';
import { CalculationResult } from '../calculator/calculator.service';

// Strip Romanian diacritics so pdf-lib standard fonts (WinAnsi) can encode them
const ro = (s: string) =>
  s.replace(/[ăâ]/g, 'a').replace(/[ÂĂ]/g, 'A')
   .replace(/î/g, 'i').replace(/Î/g, 'I')
   .replace(/[șş]/g, 's').replace(/[ȘŞ]/g, 'S')
   .replace(/[țţ]/g, 't').replace(/[ȚŢ]/g, 'T');

@Injectable()
export class ReportsService {
  private readonly logger = new Logger(ReportsService.name);

  // ── Generate Amortization Schedule PDF (pdf-lib — no browser needed) ──
  async generateAmortizationPdf(calc: CalculationResult, partnerName: string): Promise<Buffer> {
    const pdfDoc = await PDFDocument.create();
    const page = pdfDoc.addPage([595, 842]); // A4

    const { width, height } = page.getSize();
    const fontBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
    const fontReg = await pdfDoc.embedFont(StandardFonts.Helvetica);

    // ── Colors ────────────────────────────────────────────────────
    const darkBg = rgb(0.071, 0.075, 0.122);      // #121318
    const accentGreen = rgb(0.133, 0.859, 0.502); // #22DB80
    const white = rgb(1, 1, 1);
    const lightGray = rgb(0.9, 0.9, 0.9);
    const darkGray = rgb(0.4, 0.4, 0.4);
    const rowAlt = rgb(0.97, 0.98, 0.99);

    // ── Header background ─────────────────────────────────────────
    page.drawRectangle({ x: 0, y: height - 100, width, height: 100, color: darkBg });

    // Logo / Title
    page.drawText('IONIX PARTNER', {
      x: 40, y: height - 45,
      font: fontBold, size: 22, color: accentGreen,
    });
    page.drawText('Priminvestnord SRL -- Graf de Rambursare', {
      x: 40, y: height - 65,
      font: fontReg, size: 10, color: white,
    });
    page.drawText(ro(`Partener: ${partnerName}`), {
      x: 40, y: height - 82,
      font: fontReg, size: 9, color: lightGray,
    });
    page.drawText(new Date().toLocaleDateString('en-GB'), {
      x: width - 120, y: height - 82,
      font: fontReg, size: 9, color: lightGray,
    });

    // ── Credit summary box ────────────────────────────────────────
    const boxY = height - 185;
    page.drawRectangle({ x: 30, y: boxY, width: width - 60, height: 75, color: rowAlt, borderColor: accentGreen, borderWidth: 1.5 });

    const summaryItems = [
      ['Tip Credit', calc.creditType === 'ZERO' ? 'Credit Zero (0%)' : 'Credit Clasic'],
      ['Suma', `${calc.amount.toLocaleString('ro-MD')} MDL`],
      ['Termen', `${calc.months} luni`],
      ['Rata lunara', `${calc.monthlyPayment.toLocaleString('ro-MD')} MDL`],
      ['VTP', `${calc.totalAmount.toLocaleString('ro-MD')} MDL`],
      ['DAE', `${calc.dae}%`],
    ];

    const colW = (width - 80) / 3;
    summaryItems.forEach(([label, value], i) => {
      const col = i % 3;
      const row = Math.floor(i / 3);
      const x = 40 + col * colW;
      const y = boxY + 50 - row * 30;
      page.drawText(label, { x, y, font: fontReg, size: 8, color: darkGray });
      page.drawText(value, { x, y: y - 13, font: fontBold, size: 10, color: darkBg });
    });

    // ── Table header ──────────────────────────────────────────────
    const tableTop = boxY - 30;
    const cols = [
      { label: 'Luna', x: 35, w: 40, align: 'center' },
      { label: 'Rata Lunara', x: 80, w: 95, align: 'right' },
      { label: 'Principal', x: 180, w: 90, align: 'right' },
      { label: 'Dobanda', x: 275, w: 80, align: 'right' },
      { label: 'Sold Ramas', x: 360, w: 100, align: 'right' },
    ];

    page.drawRectangle({ x: 30, y: tableTop - 6, width: width - 60, height: 18, color: darkBg });

    cols.forEach((col) => {
      page.drawText(col.label, {
        x: col.align === 'right' ? col.x + col.w - fontBold.widthOfTextAtSize(col.label, 8) : col.x,
        y: tableTop - 1,
        font: fontBold, size: 8, color: white,
      });
    });

    // ── Table rows ────────────────────────────────────────────────
    const rowH = 16;
    let currentY = tableTop - rowH;
    let currentPage = page;

    const formatMDL = (n: number) => n.toLocaleString('ro-MD', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

    for (const row of calc.schedule) {
      // Add new page if needed
      if (currentY < 60) {
        currentPage = pdfDoc.addPage([595, 842]);
        currentY = height - 40;
      }

      if (row.month % 2 === 0) {
        currentPage.drawRectangle({ x: 30, y: currentY - 4, width: width - 60, height: rowH, color: rowAlt });
      }

      const rowData = [
        { text: String(row.month), x: cols[0].x + 15, align: 'center' },
        { text: formatMDL(row.payment), x: cols[1].x + cols[1].w, align: 'right' },
        { text: formatMDL(row.principal), x: cols[2].x + cols[2].w, align: 'right' },
        { text: formatMDL(row.interest), x: cols[3].x + cols[3].w, align: 'right' },
        { text: formatMDL(row.balance), x: cols[4].x + cols[4].w, align: 'right' },
      ];

      rowData.forEach((cell) => {
        const textW = fontReg.widthOfTextAtSize(cell.text, 8);
        currentPage.drawText(cell.text, {
          x: cell.align === 'right' ? cell.x - textW : cell.x,
          y: currentY,
          font: fontReg, size: 8, color: darkBg,
        });
      });

      currentY -= rowH;
    }

    // ── Footer ────────────────────────────────────────────────────
    const lastPage = pdfDoc.getPages()[pdfDoc.getPageCount() - 1];
    lastPage.drawLine({ start: { x: 30, y: 45 }, end: { x: width - 30, y: 45 }, thickness: 0.5, color: lightGray });
    lastPage.drawText('Elaborat de @Bajerean Ion -- Ionix Partner Platform', {
      x: 30, y: 32,
      font: fontReg, size: 7, color: darkGray,
    });
    lastPage.drawText('Document generat automat. Nu are valoare juridica fara semnatura unui reprezentant autorizat.', {
      x: 30, y: 22,
      font: fontReg, size: 6.5, color: darkGray,
    });

    const pdfBytes = await pdfDoc.save();
    return Buffer.from(pdfBytes);
  }
}
