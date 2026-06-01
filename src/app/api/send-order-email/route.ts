import { NextRequest, NextResponse } from 'next/server'

export const runtime = 'nodejs'

export async function POST(req: NextRequest) {
  try {
    const { orderData, pdfData } = await req.json()

    // Generate PDF buffer server-side
    let pdfBuffer: Buffer | null = null
    try {
      const { createElement } = await import('react')
      const { pdf } = await import('@react-pdf/renderer')
      const { SalesOrderPDF } = await import('@/components/modules/sales/SalesOrderPDF')
      const blob = await pdf(createElement(SalesOrderPDF, { data: pdfData })).toBlob()
      pdfBuffer = Buffer.from(await blob.arrayBuffer())
    } catch (pdfErr) {
      console.error('PDF generation error:', pdfErr)
      // Continue without attachment if PDF fails
    }

    // Skip if no API key configured
    if (!process.env.RESEND_API_KEY) {
      console.warn('RESEND_API_KEY not set — email skipped')
      return NextResponse.json({ success: true, skipped: true })
    }

    const { Resend } = await import('resend')
    const resend = new Resend(process.env.RESEND_API_KEY)

    const emailPayload: any = {
      from: process.env.EMAIL_FROM ?? 'Dispofast <onboarding@resend.dev>',
      to: ['informacion@dispocol.com', 'raquintero@dispocol.com'],
      subject: `Nueva Orden de Compra - ${orderData.clientName} - ${orderData.orderNumber}`,
      html: `
        <div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;padding:20px">
          <div style="background:#1d4ed8;padding:20px;border-radius:8px 8px 0 0">
            <h1 style="color:#fff;margin:0;font-size:20px">Nueva Orden de Compra</h1>
          </div>
          <div style="background:#f8fafc;padding:24px;border-radius:0 0 8px 8px;border:1px solid #e2e8f0">
            <table style="width:100%;border-collapse:collapse">
              <tr><td style="padding:8px 0;color:#64748b;width:140px">N° Orden:</td><td style="padding:8px 0;font-weight:bold">${orderData.orderNumber}</td></tr>
              <tr><td style="padding:8px 0;color:#64748b">Cliente:</td><td style="padding:8px 0;font-weight:bold">${orderData.clientName}</td></tr>
              <tr><td style="padding:8px 0;color:#64748b">Asesor:</td><td style="padding:8px 0">${orderData.advisorName ?? '—'}</td></tr>
              <tr><td style="padding:8px 0;color:#64748b">Fecha:</td><td style="padding:8px 0">${orderData.date}</td></tr>
              <tr><td style="padding:8px 0;color:#64748b">Total:</td><td style="padding:8px 0;font-size:18px;font-weight:bold;color:#1d4ed8">${orderData.totalFormatted}</td></tr>
            </table>
            ${pdfBuffer ? '<p style="margin-top:16px;color:#64748b;font-size:13px">📎 Se adjunta el PDF de la orden.</p>' : ''}
            <hr style="border:none;border-top:1px solid #e2e8f0;margin:20px 0">
            <p style="color:#94a3b8;font-size:12px;margin:0">Notificación automática del sistema Dispofast.</p>
          </div>
        </div>
      `,
    }

    if (pdfBuffer) {
      emailPayload.attachments = [{
        filename: `orden-${orderData.orderNumber}.pdf`,
        content: pdfBuffer,
      }]
    }

    const { error } = await resend.emails.send(emailPayload)
    if (error) {
      console.error('Resend error:', error)
      return NextResponse.json({ error }, { status: 500 })
    }

    return NextResponse.json({ success: true })
  } catch (err) {
    console.error('send-order-email error:', err)
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}
