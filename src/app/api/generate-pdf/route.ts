import { NextRequest, NextResponse } from 'next/server'
import puppeteer from 'puppeteer-core'
import chromium from '@sparticuz/chromium-min'

export async function POST(req: NextRequest) {
    let browser
    try {
        const { html } = await req.json()

        if (!html) {
            return NextResponse.json(
                { error: 'Missing HTML content' },
                { status: 400 }
            )
        }

        // Launch Puppeteer with Vercel-compatible Chromium
        const isVercel = !!process.env.VERCEL
        
        browser = await puppeteer.launch({
            args: isVercel
                ? [
                    ...chromium.args,
                    '--hide-scrollbars',
                    '--disable-web-security',
                    '--disable-features=IsolateOrigins,site-per-process',
                ]
                : [
                    '--no-sandbox',
                    '--disable-setuid-sandbox',
                    '--disable-dev-shm-usage',
                    '--disable-accelerated-2d-canvas',
                    '--disable-gpu',
                    '--disable-web-security',
                    '--disable-features=IsolateOrigins,site-per-process',
                ],
            executablePath: isVercel
                ? await chromium.executablePath()
                : undefined, // Use system Chrome in local dev
            headless: true,
        })

        const page = await browser.newPage()

        // Increase timeout for large HTML content
        page.setDefaultNavigationTimeout(60000) // 60 seconds

        // Set viewport to match invoice width (760px)
        await page.setViewport({
            width: 760,
            height: 1200, // Will auto-expand
            deviceScaleFactor: 2,
        })

        // Set content with HTML - use 'load' instead of 'networkidle0' since images are base64
        await page.setContent(html, {
            waitUntil: 'load', // Changed from 'networkidle0' - better for static HTML with embedded images
            timeout: 60000,
        })

        // Wait for images to load (all should be base64, so this should be instant)
        await page.evaluate(() => {
            return Promise.all(
                Array.from(document.images).map((img) => {
                    // Base64 images are already loaded
                    if (img.src.startsWith('data:')) {
                        return Promise.resolve()
                    }
                    // For any non-base64 images, wait briefly
                    if (img.complete && img.naturalWidth > 0) {
                        return Promise.resolve()
                    }
                    return new Promise((resolve) => {
                        img.onload = resolve
                        img.onerror = resolve // Continue even if image fails
                        setTimeout(resolve, 1000) // Shorter timeout since most are base64
                    })
                })
            )
        })

        // Small delay to ensure layout is stable
        await new Promise(resolve => setTimeout(resolve, 200))

        // Get the actual content height
        const contentHeight = await page.evaluate(() => {
            return Math.max(
                document.body.scrollHeight,
                document.body.offsetHeight,
                document.documentElement.clientHeight,
                document.documentElement.scrollHeight,
                document.documentElement.offsetHeight
            )
        })

        // Generate PDF - single page, exact width and height
        const pdfBuffer = await page.pdf({
            width: '760px',
            height: `${contentHeight}px`,
            printBackground: true,
            preferCSSPageSize: true,
            margin: {
                top: '0mm',
                right: '0mm',
                bottom: '0mm',
                left: '0mm',
            },
        })

        await browser.close()

        return new NextResponse(Buffer.from(pdfBuffer), {
            headers: {
                'Content-Type': 'application/pdf',
                'Content-Disposition': 'attachment; filename="invoice.pdf"',
            },
        })
    } catch (error: any) {
        console.error('PDF generation error:', error)
        if (browser) {
            await browser.close().catch(() => {})
        }
        return NextResponse.json(
            { error: 'Failed to generate PDF', details: error.message },
            { status: 500 }
        )
    }
}

