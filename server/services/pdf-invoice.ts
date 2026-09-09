import PDFDocument from 'pdfkit'
import dayjs from 'dayjs'
import { formatCurrency } from '../utils/money'

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

/** Renders an invoice to a PDF buffer. Server-side generation (rather than
 *  client-side canvas/print) keeps output byte-identical across devices. */
export function generateInvoicePdf(input: InvoicePdfInput): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ size: 'A4', margin: 40 })
    const chunks: Buffer[] = []
    doc.on('data', (chunk) => chunks.push(chunk))
    doc.on('end', () => resolve(Buffer.concat(chunks)))
    doc.on('error', reject)

    doc.fontSize(18).font('Helvetica-Bold').text(input.business.name, { continued: false })
    doc.fontSize(10).font('Helvetica').fillColor('#555').text('Invoice')
    doc.moveDown(0.5)

    doc.fillColor('#000').fontSize(11).font('Helvetica-Bold').text(`Invoice #${input.invoiceNumber}`)
    doc.font('Helvetica').fontSize(10)
    if (input.periodStart && input.periodEnd) {
      doc.text(`Period: ${dayjs(input.periodStart).format('D MMM YYYY')} - ${dayjs(input.periodEnd).format('D MMM YYYY')}`)
    }
    doc.text(`Generated: ${dayjs().format('D MMM YYYY, h:mm A')}`)
    doc.moveDown(0.5)

    doc.font('Helvetica-Bold').text('Bill To')
    doc.font('Helvetica').text(input.party.name)
    if (input.party.address) doc.text(input.party.address)
    if (input.party.phone) doc.text(input.party.phone)
    doc.moveDown(1)

    // Table header
    const startX = doc.x
    const colWidth = (doc.page.width - doc.page.margins.left - doc.page.margins.right) / Math.max(1, input.columns.length)
    let y = doc.y
    doc.font('Helvetica-Bold').fontSize(9)
    input.columns.forEach((col, i) => {
      doc.text(col.label, startX + i * colWidth, y, { width: colWidth, align: i === 0 ? 'left' : 'right' })
    })
    y += 16
    doc.moveTo(startX, y).lineTo(doc.page.width - doc.page.margins.right, y).strokeColor('#ccc').stroke()
    y += 6

    doc.font('Helvetica').fontSize(9)
    for (const row of input.rows) {
      if (y > doc.page.height - doc.page.margins.bottom - 60) {
        doc.addPage()
        y = doc.page.margins.top
      }
      input.columns.forEach((col, i) => {
        const raw = row[col.key]
        const display = typeof raw === 'number' ? formatCurrency(raw, input.business.currency) : String(raw ?? '')
        doc.text(display, startX + i * colWidth, y, { width: colWidth, align: i === 0 ? 'left' : 'right' })
      })
      y += 16
    }

    y += 10
    doc.moveTo(startX, y).lineTo(doc.page.width - doc.page.margins.right, y).strokeColor('#ccc').stroke()
    y += 12

    const summaryLines: [string, number][] = [
      ['Total Amount', input.summary.totalAmount],
      ['Total Paid', input.summary.totalPaid],
      ['Total Received', input.summary.totalReceived],
      ['Total Payable', input.summary.totalPayable],
      ['Total Receivable', input.summary.totalReceivable],
      ['Outstanding Balance', input.summary.outstandingBalance]
    ]
    doc.font('Helvetica-Bold').fontSize(10)
    for (const [label, value] of summaryLines) {
      doc.text(`${label}:`, startX, y, { continued: true, width: colWidth * 2 })
      doc.font('Helvetica').text(`  ${formatCurrency(value, input.business.currency)}`, { align: 'right' })
      doc.font('Helvetica-Bold')
      y += 16
    }

    doc.end()
  })
}
