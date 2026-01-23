import { NextRequest, NextResponse } from 'next/server'
import puppeteer from 'puppeteer'
import path from 'path'
import os from 'os'

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

        // Get Puppeteer's Chrome path
        const executablePath = puppeteer.executablePath()
        
        console.log('Using Chrome at:', executablePath)

        // Launch Puppeteer
        browser = await puppeteer.launch({
            headless: true,
            executablePath: executablePath, // Use Puppeteer's bundled Chrome
            args: [
                '--no-sandbox',
                '--disable-setuid-sandbox',
                '--disable-dev-shm-usage',
                '--disable-accelerated-2d-canvas',
                '--disable-gpu',
                '--disable-web-security',
                '--disable-features=IsolateOrigins,site-per-process',
            ],
        })

        const page = await browser.newPage()

        // Set viewport to match invoice width (760px)
        await page.setViewport({
            width: 760,
            height: 1200,
            deviceScaleFactor: 2,
        })

        // Set content with HTML
        await page.setContent(html, {
            waitUntil: 'load',
            timeout: 60000,
        })

        // Wait for images to load
        await page.evaluate(() => {
            return Promise.all(
                Array.from(document.images).map((img) => {
                    if (img.src.startsWith('data:')) {
                        return Promise.resolve()
                    }
                    if (img.complete && img.naturalWidth > 0) {
                        return Promise.resolve()
                    }
                    return new Promise((resolve) => {
                        img.onload = () => resolve(null)
                        img.onerror = () => resolve(null)
                        setTimeout(() => resolve(null), 1000)
                    })
                })
            )
        })

        // Small delay to ensure layout is stable
        await new Promise(resolve => setTimeout(resolve, 300))

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

        console.log('PDF dimensions:', 760, 'x', contentHeight)

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
