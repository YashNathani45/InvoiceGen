import { NextRequest, NextResponse } from 'next/server'
import puppeteer from 'puppeteer-core'

// Puppeteer requires Node.js runtime (NOT Edge)
export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function POST(req: NextRequest) {
    let browser: any | undefined
    try {
        const { html } = await req.json()

        if (!html) {
            return NextResponse.json(
                { error: 'Missing HTML content' },
                { status: 400 }
            )
        }

        const apiKey = process.env.BROWSERLESS_API_KEY
        if (!apiKey) {
            return NextResponse.json(
                { error: 'Browserless API key not configured.' },
                { status: 500 }
            )
        }

        // CSS to clean up the page
        const pageCSS = `
            <style>
                * { box-sizing: border-box; }
                html, body {
                    width: 760px !important;
                    margin: 0 !important;
                    padding: 0 !important;
                }
                .desktop-toolbar,
                .fab-container,
                .toast-container,
                .loading-overlay {
                    display: none !important;
                }
            </style>
        `

        let modifiedHtml = html
        if (modifiedHtml.includes('</head>')) {
            modifiedHtml = modifiedHtml.replace('</head>', pageCSS + '</head>')
        } else {
            modifiedHtml = '<head>' + pageCSS + '</head>' + modifiedHtml
        }

        const wsEndpoint = `wss://chrome.browserless.io?token=${apiKey}`

        const generateOnce = async () => {
            console.log('Connecting to Browserless with Puppeteer...')

            // Connect to Browserless using Puppeteer (remote Chrome)
            browser = await puppeteer.connect({
                browserWSEndpoint: wsEndpoint,
                // In many puppeteer-core versions this is supported; safe to include.
                // If unsupported, Browserless still works with defaults.
                protocolTimeout: 120000 as any,
            } as any)

            const page = await browser.newPage()
            page.setDefaultTimeout(60000)
            page.setDefaultNavigationTimeout(60000)

            // Set viewport
            await page.setViewport({
                width: 760,
                height: 1200,
                deviceScaleFactor: 2,
            })

            // Load HTML. Avoid 'networkidle0' which can hang forever on some pages.
            await page.setContent(modifiedHtml, {
                waitUntil: 'domcontentloaded',
                timeout: 60000,
            })

            // Wait for images (best-effort) + small layout delay
            await page.evaluate(() => {
                return Promise.all(
                    Array.from(document.images).map((img) => {
                        if (img.complete && img.naturalWidth > 0) return Promise.resolve()
                        return new Promise((resolve) => {
                            img.onload = () => resolve(null)
                            img.onerror = () => resolve(null)
                            setTimeout(() => resolve(null), 2000)
                        })
                    })
                )
            })

            await new Promise((resolve) => setTimeout(resolve, 500))

            // Get EXACT content height
            const contentHeight = await page.evaluate(() => {
                return Math.max(
                    document.body.scrollHeight,
                    document.body.offsetHeight,
                    document.documentElement.scrollHeight,
                    document.documentElement.offsetHeight
                )
            })

            console.log('Content dimensions: 760px x', contentHeight + 'px')

            // Generate PDF with EXACT dimensions - ONE SINGLE PAGE
            const pdfUint8 = await page.pdf({
                width: '760px',
                height: `${contentHeight}px`,
                printBackground: true,
                margin: {
                    top: '12px',
                    right: '12px',
                    bottom: '12px',
                    left: '12px',
                  },
                preferCSSPageSize: true,
            })

            // Ensure page is closed to reduce chance of Browserless killing the target
            await page.close().catch(() => {})

            return Buffer.from(pdfUint8)
        }

        let pdfBuffer: Buffer
        try {
            pdfBuffer = await generateOnce()
        } catch (e: any) {
            // Browserless can occasionally close the target mid-flight; retry once.
            const msg = String(e?.message || e)
            if (msg.includes('Target closed') || msg.includes('Protocol error')) {
                console.warn('Browserless target closed mid-flight; retrying once...')
                try {
                    await browser?.close().catch(() => {})
                } finally {
                    browser = undefined
                }
                pdfBuffer = await generateOnce()
            } else {
                throw e
            }
        } finally {
            await browser?.close().catch(() => {})
        }

        console.log('PDF generated successfully, size:', pdfBuffer.length, 'bytes')

        // NextResponse typing is a bit strict here; Buffer is valid at runtime in Node.js
        return new NextResponse(pdfBuffer as any, {
            headers: {
                'Content-Type': 'application/pdf',
                'Content-Disposition': 'attachment; filename="invoice.pdf"',
            },
        })
    } catch (error: any) {
        console.error('PDF generation error:', error)
        try {
            await browser?.close?.().catch(() => {})
        } catch {}
        return NextResponse.json(
            { error: 'Failed to generate PDF', details: error.message },
            { status: 500 }
        )
    }
}