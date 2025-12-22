import { NextResponse } from 'next/server'
import nodemailer from 'nodemailer'
import { Buffer } from 'buffer'

export async function POST(req: Request) {
    try {
        const { toEmail, customerName, invoiceNo, pdfBase64, fileName } = await req.json()

        if (!toEmail || !pdfBase64) {
            return NextResponse.json(
                { success: false, message: 'Missing recipient email or PDF data' },
                { status: 400 }
            )
        }

        const host = process.env.SMTP_HOST
        const user = process.env.SMTP_USER
        const pass = process.env.SMTP_PASS
        const port = Number(process.env.SMTP_PORT || 587)
        const from = process.env.SMTP_FROM || user

        if (!host || !user || !pass) {
            return NextResponse.json(
                { success: false, message: 'Email server is not configured on this deployment' },
                { status: 500 }
            )
        }

        const transporter = nodemailer.createTransport({
            host,
            port,
            secure: port === 465,
            auth: {
                user,
                pass,
            },
        })

        const subject = `Invoice ${invoiceNo || ''} from Mi Casa Su Casa`.trim()
        const text = `Dear ${customerName || 'Guest'},

Please find attached your invoice.

Thank you for choosing Mi Casa Su Casa.

Warm regards,
Mi Casa Su Casa`

        await transporter.sendMail({
            from,
            to: toEmail,
            subject,
            text,
            attachments: [
                {
                    filename: fileName || 'invoice.pdf',
                    content: Buffer.from(pdfBase64, 'base64'),
                    contentType: 'application/pdf',
                },
            ],
        })

        return NextResponse.json({ success: true })
    } catch (error) {
        console.error('Error sending invoice email', error)
        return NextResponse.json(
            { success: false, message: 'Failed to send invoice email' },
            { status: 500 }
        )
    }
}


