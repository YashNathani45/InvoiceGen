import { NextRequest, NextResponse } from 'next/server'
import puppeteer from 'puppeteer'
import os from 'os'
import path from 'path'

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

        // Get Chrome executable path based on OS
        let executablePath: string
        
        try {
            // Try to get Puppeteer's default path first
            executablePath = puppeteer.executablePath()
        } catch (e) {
            // Fallback: manually construct path
            const homeDir = os.homedir()
            const platform = os.platform()
            
            if (platform === 'win32') {
                // Windows path
                const cachePath = path.join(homeDir, '.cache', 'puppeteer', 'chrome')
                executablePath = path.join(cachePath, 'win64-144.0.7559.96', 'chrome-win64', 'chrome.exe')
            } else if (platform === 'linux') {
                // Linux path
                const cachePath = path.join(homeDir, '.cache', 'puppeteer', 'chrome')
                executablePath = path.join(cachePath, 'linux-144.0.7559.96', 'chrome-linux64', 'chrome')
            } else if (platform === 'darwin') {
                // macOS path
                const cachePath = path.join(homeDir, '.cache', 'puppeteer', 'chrome')
                executablePath = path.join(cachePath, 'mac-144.0.7559.96', 'chrome-mac-x64', 'Google Chrome for Testing.app', 'Contents', 'MacOS', 'Google Chrome for Testing')
            } else {
                throw new Error('Unsupported platform: ' + platform)
            }
        }

        console.log('Using Chrome at:', executablePath)

        // Launch Puppeteer
        browser = await puppeteer.launch({
            headless: true,
            executablePath: executablePath,
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
 