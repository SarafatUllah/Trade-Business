import PDFDocument from 'pdfkit'
import dayjs from 'dayjs'
import { round } from '../utils/money'

export interface InvoiceColumn {
  key: string
  label: string
}

export interface InvoicePdfInput {
  business: { name: string; currency: string }
  party: { name: string; phone?: string | null; address?: string | null }
  invoiceNumber: string
  periodStart?: Date | null
  periodEnd?: Date | null
  columns: InvoiceColumn[]
  rows: Record<string, unknown>[] // each row's dynamic field snapshot, keyed by column key
  summary: {
    totalAmount: number
    totalPaid: number
    totalReceived: number
    totalPayable: number
    totalReceivable: number
    outstandingBalance: number
  }
}

// PDFKit's built-in standard fonts (Helvetica etc.) only support the
// WinAnsi/Latin-1 glyph set — they have NO glyph for currency symbols
// like ৳ (Bengali Taka, U+09F3), which rendered as a broken/missing
// character box in the PDF. Rather than bundle and embed a custom
// Unicode font (a much bigger dependency for a currency symbol), PDF
// output uses the plain currency code instead — this always renders
// correctly regardless of font, and is standard practice on invoices/
// bank statements anyway (e.g. "BDT 1,234.56").
function formatMoneyForPdf(value: number, currency: string): string {
  const amount = round(value).toNumber()
  return `${currency} ${amount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}

const TABLE_TOP_MARGIN = 40
const ROW_PADDING = 6
const HEADER_ROW_HEIGHT = 22
const MIN_COL_WIDTH = 60

/** Renders an invoice to a PDF buffer. Server-side generation (rather than
 *  client-side canvas/print) keeps output byte-identical across devices. */
export function generateInvoicePdf(input: InvoicePdfInput): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ size: 'A4', margin: TABLE_TOP_MARGIN })
    const chunks: Buffer[] = []
    doc.on('data', (chunk) => chunks.push(chunk))
    doc.on('end', () => resolve(Buffer.concat(chunks)))
    doc.on('error', reject)

    const pageLeft = doc.page.margins.left
    const pageRight = doc.page.width - doc.page.margins.right
    const contentWidth = pageRight - pageLeft

    // ---------- Header ----------
    doc.rect(pageLeft, doc.y, contentWidth, 4).fill('#4361EE')
    doc.moveDown(0.8)
    doc.fillColor('#14181F').fontSize(18).font('Helvetica-Bold').text(input.business.name)
    doc.fontSize(10).font('Helvetica').fillColor('#555').text('INVOICE')
    doc.moveDown(0.6)

    doc.fillColor('#000').fontSize(11).font('Helvetica-Bold').text(`Invoice #${input.invoiceNumber}`)
    doc.font('Helvetica').fontSize(9).fillColor('#555')
    if (input.periodStart && input.periodEnd) {
      doc.text(`Period: ${dayjs(input.periodStart).format('D MMM YYYY')} - ${dayjs(input.periodEnd).format('D MMM YYYY')}`)
    }
    doc.text(`Generated: ${dayjs().format('D MMM YYYY, h:mm A')}`)
    doc.moveDown(0.6)

    doc.fillColor('#000').font('Helvetica-Bold').fontSize(10).text('Bill To')
    doc.font('Helvetica').fontSize(10).text(input.party.name)
    if (input.party.address) doc.fontSize(9).fillColor('#555').text(input.party.address)
    if (input.party.phone) doc.fontSize(9).fillColor('#555').text(input.party.phone)
    doc.fillColor('#000')
    doc.moveDown(1)

    // ---------- Table ----------
    // Columns share width unevenly rather than strictly equally: the
    // first column (usually a date/description) gets more room. With
    // many columns, MIN_COL_WIDTH floors can add up to more than the
    // page's content width — the previous version only shrank the font
    // in that case, leaving the column x-positions themselves still
    // summing wider than the page, so the table visibly ran off the
    // right edge regardless of font size. Now widths are scaled down
    // proportionally (below the "preferred" floor if truly necessary) so
    // the table always fits exactly within the page, and font size is a
    // secondary readability adjustment on top of that, not the only fix.
    const colCount = Math.max(1, input.columns.length)
    const firstColShare = colCount > 1 ? 1.4 : 1
    const totalShares = firstColShare + (colCount - 1)
    const baseUnit = contentWidth / totalShares
    const preferredWidths = input.columns.map((_, i) => Math.max(MIN_COL_WIDTH, (i === 0 ? firstColShare : 1) * baseUnit))
    const totalPreferredWidth = preferredWidths.reduce((a, b) => a + b, 0)
    const scale = totalPreferredWidth > contentWidth ? contentWidth / totalPreferredWidth : 1
    const colWidths = preferredWidths.map(w => w * scale)
    const tableFontSize = scale < 0.85 ? 7 : scale < 1 ? 7.5 : 8.5

    function colX(i: number): number {
      return pageLeft + colWidths.slice(0, i).reduce((a, b) => a + b, 0)
    }

    function drawTableHeader() {
      const y = doc.y
      doc.rect(pageLeft, y, contentWidth, HEADER_ROW_HEIGHT).fill('#F1EEE7')
      doc.fillColor('#14181F').font('Helvetica-Bold').fontSize(tableFontSize)
      input.columns.forEach((col, i) => {
        doc.text(col.label, colX(i) + 4, y + 6, { width: colWidths[i] - 8, align: i === 0 ? 'left' : 'right' })
      })
      doc.y = y + HEADER_ROW_HEIGHT
      doc.fillColor('#000')
    }

    drawTableHeader()
    doc.font('Helvetica').fontSize(tableFontSize)

    input.rows.forEach((row, rowIndex) => {
      // Measure the tallest cell in this row (accounting for text wrap)
      // BEFORE drawing, so alternating-row shading and cell text never
      // overlap the next row — the original version used a fixed row
      // height regardless of wrapped content.
      const cellHeights = input.columns.map((col, i) => {
        const raw = row[col.key]
        const display = typeof raw === 'number' ? formatMoneyForPdf(raw, input.business.currency) : String(raw ?? '—')
        return doc.heightOfString(display, { width: colWidths[i] - 8 })
      })
      const rowHeight = Math.max(...cellHeights, 14) + ROW_PADDING

      if (doc.y + rowHeight > doc.page.height - doc.page.margins.bottom - 80) {
        doc.addPage()
        doc.y = doc.page.margins.top
        drawTableHeader()
        doc.font('Helvetica').fontSize(tableFontSize)
      }

      const y = doc.y
      if (rowIndex % 2 === 1) {
        doc.rect(pageLeft, y, contentWidth, rowHeight).fill('#FBFAF7')
        doc.fillColor('#000')
      }
      input.columns.forEach((col, i) => {
        const raw = row[col.key]
        const display = typeof raw === 'number' ? formatMoneyForPdf(raw, input.business.currency) : String(raw ?? '—')
        doc.text(display, colX(i) + 4, y + 4, { width: colWidths[i] - 8, align: i === 0 ? 'left' : 'right' })
      })
      doc.y = y + rowHeight
    })

    doc.moveTo(pageLeft, doc.y).lineTo(pageRight, doc.y).strokeColor('#ccc').stroke()
    doc.moveDown(0.8)

    // ---------- Summary ----------
    const summaryLines: [string, number][] = [
      ['Total Amount', input.summary.totalAmount],
      ['Total Paid', input.summary.totalPaid],
      ['Total Received', input.summary.totalReceived],
      ['Total Payable', input.summary.totalPayable],
      ['Total Receivable', input.summary.totalReceivable],
      ['Outstanding Balance', input.summary.outstandingBalance]
    ]
    const summaryLabelWidth = 160
    doc.fontSize(10)
    for (const [label, value] of summaryLines) {
      const y = doc.y
      doc.font('Helvetica-Bold').fillColor('#555').text(label, pageLeft, y, { width: summaryLabelWidth })
      doc.font('Helvetica-Bold').fillColor('#000').text(
        formatMoneyForPdf(value, input.business.currency),
        pageRight - summaryLabelWidth, y, { width: summaryLabelWidth, align: 'right' }
      )
      doc.y = y + 18
    }

    doc.fontSize(8).fillColor('#999').text(
      `Generated by Trade Business — ${dayjs().format('D MMM YYYY')}`,
      pageLeft, doc.page.height - doc.page.margins.bottom - 20,
      { width: contentWidth, align: 'center' }
    )

    doc.end()
  })
}
