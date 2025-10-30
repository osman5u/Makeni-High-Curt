import PDFDocument from 'pdfkit';
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';

export type Outcome = 'won' | 'lost';

export interface CaseOutcomePayload {
  caseId: number;
  caseTitle: string;
  clientFullName: string;
  clientEmail: string;
  lawyerName: string;
  outcome: Outcome;
  issuedBy: string; // admin full name
  issuedAt?: Date; // defaults to now
}

function tryResolveLogo(): string | null {
  const primary = path.join(process.cwd(), 'public', 'ffl-logo.png');
  const fallback = path.join(process.cwd(), 'public', 'static', 'ffl-logo.png');
  if (fs.existsSync(primary)) return primary;
  if (fs.existsSync(fallback)) return fallback;
  return null;
}

export async function generateCaseOutcomeReceipt(payload: CaseOutcomePayload, logoPath?: string): Promise<Buffer> {
  const chunks: Buffer[] = [];
  const doc = new PDFDocument({ size: 'A4', margin: 50 });
  const stream = doc as unknown as NodeJS.ReadableStream;

  const issuedAt = payload.issuedAt || new Date();
  const receiptId = crypto.randomUUID();
  const logo = logoPath || tryResolveLogo();

  // Precompute readable message text based on outcome
  const isWon = payload.outcome === 'won';
  const messageText = isWon
    ? `Congratulations, ${payload.clientFullName}. Your case "${payload.caseTitle}" has been won. Lawyer: ${payload.lawyerName}. We will contact you soon regarding next steps. Thank you for trusting FF Legal System.`
    : `We are sorry to inform you that your case "${payload.caseTitle}" was not successful. Lawyer: ${payload.lawyerName}. Please reach out to discuss next steps and potential appeals.`;

  return new Promise<Buffer>((resolve, reject) => {
    stream.on('data', (d: Buffer) => chunks.push(Buffer.from(d)));
    stream.on('end', () => resolve(Buffer.concat(chunks)));
    stream.on('error', reject);

    // Base font
    doc.font('Helvetica');

    // Header
    if (logo && fs.existsSync(logo)) {
      doc.image(logo, 50, 40, { width: 60 });
    }
    doc
      .font('Helvetica-Bold')
      .fontSize(20)
      .fillColor('#212529')
      .text('FF Legal System', 120, 40, { align: 'left' })
      .font('Helvetica')
      .fontSize(12)
      .fillColor('#6c757d')
      .text('Case Outcome Receipt', 120, 65);

    doc.moveTo(50, 100).lineTo(545, 100).stroke('#dee2e6');

    // Receipt meta
    doc
      .font('Helvetica')
      .fontSize(11)
      .fillColor('#343a40')
      .text(`Receipt ID: ${receiptId}`, 50, 115)
      .text(`Issued At: ${issuedAt.toLocaleString()}`, 50, 132)
      .text(`Issued By: ${payload.issuedBy || 'Admin'}`, 50, 149);

    // Outcome badge (pill)
    const outcomeText = (isWon ? 'WON' : 'LOST');
    const badgeColor = isWon ? '#27ae60' : '#c0392b';
    doc
      .save()
      .roundedRect(400, 115, 150, 30, 8)
      .fillOpacity(0.12)
      .fill(badgeColor)
      .stroke(badgeColor)
      .restore();
    doc
      .font('Helvetica-Bold')
      .fontSize(12)
      .fillColor(isWon ? '#1e824c' : '#96281b')
      .text(`Outcome: ${outcomeText}`, 410, 122);

    // Section: Case Details
    let y = 185;
    doc
      .font('Helvetica-Bold')
      .fontSize(14)
      .fillColor('#212529')
      .text('Case Details', 50, y);
    y += 24;

    const labelColor = '#6c757d';
    const valueColor = '#2c3e50';
    const labelX = 50;
    const valueX = 180;
    const rowGap = 20;

    const rows: Array<[string, string]> = [
      ['Case Title', payload.caseTitle],
      ['Client Name', payload.clientFullName],
      ['Client Email', payload.clientEmail],
      ['Lawyer Name', payload.lawyerName],
      ['Outcome', isWon ? 'Won' : 'Lost'],
    ];

    rows.forEach(([label, value], idx) => {
      const currentY = y + idx * rowGap;
      doc.font('Helvetica').fontSize(11).fillColor(labelColor).text(`${label}:`, labelX, currentY, { width: 120 });
      doc.font('Helvetica').fontSize(12).fillColor(valueColor).text(value, valueX, currentY, { width: 365 });
    });

    y += rows.length * rowGap + 16;

    // Section: Outcome Message
    doc
      .font('Helvetica-Bold')
      .fontSize(14)
      .fillColor('#212529')
      .text('Outcome Message', 50, y);
    y += 22;

    doc
      .font('Helvetica')
      .fontSize(12)
      .fillColor('#2c3e50')
      .text(messageText, 50, y, { width: 495, align: 'left' });

    y += 80; // space for message block

    // Section: Notes
    doc
      .font('Helvetica')
      .fontSize(10)
      .fillColor('#6c757d')
      .text('Notes', 50, y);
    y += 16;

    const notes = isWon
      ? 'This receipt confirms the successful outcome of your case. Our team or your assigned lawyer may follow up with next steps, settlement details, or additional instructions.'
      : 'This receipt records the outcome of your case for your records. Your assigned lawyer can advise on possible next steps, appeals, or alternative remedies.';

    doc
      .font('Helvetica')
      .fontSize(10)
      .fillColor('#6c757d')
      .text(notes, 50, y, { width: 495, align: 'left' });

    // Footer
    doc.moveDown();
    doc
      .font('Helvetica')
      .fontSize(9)
      .fillColor('#adb5bd')
      .text('This receipt was auto-generated by the FF Legal System. For support, contact your assigned lawyer or our support team.', { width: 495, align: 'left' });

    doc.end();
  });
}