'use client'

import { useEffect, useMemo, useState } from 'react'
import html2canvas from 'html2canvas'
import jsPDF from 'jspdf'

function formatINR(n: number) {
    return Number(n || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

// Round to nearest rupee to avoid floating point drift
const toMoney = (value: number) => Math.round(value + Number.EPSILON)

function numberToWordsIndian(num: number) {
    const n = Math.floor(Number(num) || 0)
    if (n === 0) return 'Zero'
    const belowTwenty = ['', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine', 'Ten', 'Eleven', 'Twelve', 'Thirteen', 'Fourteen', 'Fifteen', 'Sixteen', 'Seventeen', 'Eighteen', 'Nineteen']
    const tens = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety']
    const toWords = (x: number): string => {
        if (x < 20) return belowTwenty[x]
        if (x < 100) return tens[Math.floor(x / 10)] + (x % 10 ? ' ' + belowTwenty[x % 10] : '')
        if (x < 1000) return belowTwenty[Math.floor(x / 100)] + ' Hundred' + (x % 100 ? ' ' + toWords(x % 100) : '')
        if (x < 100000) return toWords(Math.floor(x / 1000)) + ' Thousand' + (x % 1000 ? ' ' + toWords(x % 1000) : '')
        if (x < 10000000) return toWords(Math.floor(x / 100000)) + ' Lakh' + (x % 100000 ? ' ' + toWords(x % 100000) : '')
        return toWords(Math.floor(x / 10000000)) + ' Crore' + (x % 10000000 ? ' ' + toWords(x % 10000000) : '')
    }
    return toWords(n)
}

export default function InvoicePage({ searchParams }: { searchParams: Record<string, string | string[] | undefined> }) {

    const p = useMemo(() => {
        const get = (k: string) => (Array.isArray(searchParams[k]) ? searchParams[k]![0] : searchParams[k]) || ''
        const toNum = (k: string) => Number(get(k) || 0)
        return {
            invoiceNo: get('invoiceNo') || 'MCSC-11',
            invoiceDate: get('invoiceDate'),
            invoiceType: get('invoiceType') || 'invoice',
            customerName: get('customerName') || 'Anuj',
            customerEmail: get('customerEmail') || '',
            customerPhone: get('customerPhone') || '',
            propertyName: get('propertyName') || "Rahul's Paradise",
            checkin: get('checkin'),
            checkout: get('checkout'),
            guests: toNum('guests') || 0,
            rate: toNum('rate') || 0,
            nights: toNum('nights') || 0,
            taxRate: toNum('taxRate') || 0,
            deposit: toNum('deposit') || 0,
            depositStatus: get('depositStatus') || 'none',
            amountPaid: toNum('amountPaid') || 0,
            paymentStatus: get('paymentStatus') || 'unpaid',
        }
    }, [searchParams])

    const [emailToSend, setEmailToSend] = useState('')

    useEffect(() => {
        setEmailToSend(p.customerEmail || '')
    }, [p.customerEmail])

    useEffect(() => {
        // Set viewport meta tag for mobile zoom
        const viewport = document.querySelector('meta[name="viewport"]');
        if (viewport) {
            viewport.setAttribute('content', 'width=device-width, initial-scale=0.5, maximum-scale=5.0, user-scalable=yes');
        } else {
            const meta = document.createElement('meta');
            meta.name = 'viewport';
            meta.content = 'width=device-width, initial-scale=0.5, maximum-scale=5.0, user-scalable=yes';
            document.head.appendChild(meta);
        }
    }, [])
    const [isSending, setIsSending] = useState(false)
    const [isDownloading, setIsDownloading] = useState(false)
    const [toast, setToast] = useState<{ type: 'success' | 'error' | 'info'; message: string } | null>(null)
    const [fabOpen, setFabOpen] = useState(false)
    const [awaitingApproval, setAwaitingApproval] = useState(false)
    const subtotal = toMoney((p.rate || 0) * (p.nights || 0))
    const taxAmount = toMoney(((p.taxRate || 0) / 100) * subtotal)
    const isProforma = (p.invoiceType || '').toLowerCase() === 'proforma'
    const depositStatus = (isProforma ? 'none' : (p.depositStatus || 'none')) as 'none' | 'paid' | 'pending'
    const depositCharge = depositStatus === 'none' ? 0 : toMoney(Math.max(0, p.deposit || 0))
    const paidDeposit = depositStatus === 'paid' ? depositCharge : 0
    const pendingDeposit = depositStatus === 'pending' ? depositCharge : 0
    const baseTotal = toMoney(subtotal + taxAmount)
    const displayTotal = toMoney(baseTotal + paidDeposit)
    let paymentStatus = (p.paymentStatus || 'unpaid') as 'unpaid' | 'partial' | 'full'
    const manualPaid = isProforma ? 0 : toMoney(Math.max(0, p.amountPaid || 0))
    if (isProforma) {
        paymentStatus = 'unpaid'
    }
    const otherPaidAmount = paymentStatus === 'full'
        ? baseTotal
        : paymentStatus === 'partial'
            ? Math.min(baseTotal, manualPaid)
            : 0
    const totalPaid = toMoney(otherPaidAmount + paidDeposit)
    const balance = toMoney(Math.max(0, baseTotal - otherPaidAmount) + pendingDeposit)
    const amountInWordsTotal = displayTotal
    const qtyText = `${p.nights} ${p.nights === 1 ? 'NIGHT' : 'NIGHTS'}`

    function handleLogoError(e: React.SyntheticEvent<HTMLImageElement>) {
        const el = e.currentTarget
        el.style.display = 'none'
        const fallback = document.createElement('div')
        fallback.textContent = 'MCSC'
        fallback.style.cssText = 'font-size: 24px; font-weight: 700; color: #5B9BD5;'
        el.parentElement?.appendChild(fallback)
    }

    function handleSignError(e: React.SyntheticEvent<HTMLImageElement>) {
        const el = e.currentTarget
        el.style.display = 'none'
        const fallback = document.createElement('div')
        fallback.textContent = 'Signature'
        fallback.style.cssText = 'font-family: cursive; font-size: 18px; color: #666;'
        el.parentElement?.appendChild(fallback)
    }

    const datePretty = (iso?: string) => {
        if (!iso) return '—'
        const d = new Date(iso)
        if (isNaN(d.getTime())) return '—'
        return d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })
    }

    const bookingHtml = `Booker: ${p.customerName || '-'}<br>` +
        `Check-in: ${datePretty(p.checkin)}<br>` +
        `Check-out: ${datePretty(p.checkout)}<br>` +
        `Guests: ${p.guests > 0 ? p.guests + ' Adults' : '-'}`

    async function buildInvoicePdf() {
        const target = document.getElementById('invoice-root')
        if (!target) return null

        // Wait for images to load and ensure layout is measured
        const images = target.querySelectorAll('img')
        await Promise.all(Array.from(images).map(img => {
            if (img.complete && img.naturalWidth > 0 && img.naturalHeight > 0) return Promise.resolve()
            return new Promise((resolve) => {
                img.onload = () => resolve(null)
                img.onerror = () => resolve(null) // Continue even if image fails
                setTimeout(() => resolve(null), 1200) // Timeout after ~1s
            })
        }))
        await new Promise(requestAnimationFrame)
        const DESKTOP_WIDTH = 760
        // Clone the element for capture (to avoid affecting the visible page)
        const clone = target.cloneNode(true) as HTMLElement
        clone.style.position = 'absolute'
        clone.style.left = '-9999px'
        clone.style.top = '0'
        clone.style.width = DESKTOP_WIDTH + 'px'
        clone.style.maxWidth = DESKTOP_WIDTH + 'px'
        clone.style.boxSizing = 'border-box'
        clone.style.display = 'block'
        document.body.appendChild(clone)

        // Measure height; bail if zero to avoid canvas errors
        const measuredHeight = Math.max(clone.scrollHeight, clone.offsetHeight, target.scrollHeight, target.offsetHeight)
        if (!measuredHeight || measuredHeight <= 0) {
            document.body.removeChild(clone)
            throw new Error('Invoice content not ready to render (height is 0)')
        }

        // Get the width for capture
        const capturePxWidth = DESKTOP_WIDTH

        // Use a balanced scale for crisp rendering with smaller file size
        // Change scale from 2 to 1.5 for mobile
const isMobileDevice = /Android|iPhone|iPad|iPod/i.test(navigator.userAgent || '')
const scale = isMobileDevice ? 1.5 : 2 // Lower scale for mobile

// Add mobile-specific canvas options
const canvas = await html2canvas(clone, {
    scale: scale,
    backgroundColor: '#ffffff',
    useCORS: true,
    logging: false,
    allowTaint: true, // Change to true for mobile
    scrollY: 0,
    width: capturePxWidth,
    height: measuredHeight,
    windowWidth: DESKTOP_WIDTH,
    windowHeight: measuredHeight,
    // Add these mobile-specific options:
    imageTimeout: 15000,
    removeContainer: true,
    foreignObjectRendering: false // Disable for better mobile compatibility
})

        // Clean up detached clone
        document.body.removeChild(clone)

        // Use high-quality JPEG for much smaller file size while keeping visual quality
        const imgData = canvas.toDataURL('image/jpeg', 0.9)

        // Match PDF page size exactly to the rendered canvas so there are no big inner margins
        const pxToMm = 0.264583 // 1px ≈ 0.264583mm
        const pdfW = canvas.width * pxToMm
        const pdfH = canvas.height * pxToMm

        // Create PDF with a custom page size matching the invoice rendering
        const pdf = new jsPDF({
            orientation: 'p',
            unit: 'mm',
            format: [pdfW, pdfH],
            // Enable internal compression to keep PDF size small
            compress: true
        })

        // Add a small margin around the content so it doesn't touch the edges
        const margin = 5 // mm
        const drawW = pdfW - margin * 2
        const drawH = pdfH - margin * 2
        pdf.addImage(imgData, 'JPEG', margin, margin, drawW, drawH)

        const safe = (s: string) => s.replace(/[^a-z0-9-_]/gi, '_')
        const fileName = `${safe(p.invoiceNo || 'INV')}_${safe(p.customerName || 'Customer')}.pdf`

        return { pdf, fileName }
    }

    async function requestApprovalAndDownload() {
        setAwaitingApproval(true)
        setToast({ type: 'info', message: '⏳ Requesting approval from admin...' })

        try {
            // Request approval
            const res = await fetch('/api/request-approval', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    invoiceNo: p.invoiceNo,
                    customerName: p.customerName,
                    amount: displayTotal.toLocaleString('en-IN'),
                    propertyName: p.propertyName
                })
            })

            const { requestId, subscriberCount } = await res.json()

            if (subscriberCount === 0) {
                setToast({ type: 'error', message: 'No admin subscribed. Ask admin to visit /admin-notifications' })
                setAwaitingApproval(false)
                return
            }

            setToast({ type: 'info', message: '📱 Waiting for admin approval...' })

            // Poll for approval status
            const maxWait = 120000 // 2 minutes
            const pollInterval = 2000 // 2 seconds
            const startTime = Date.now()

            while (Date.now() - startTime < maxWait) {
                await new Promise(r => setTimeout(r, pollInterval))

                const statusRes = await fetch(`/api/approval-response?requestId=${requestId}`)
                const { status } = await statusRes.json()

                if (status === 'approved') {
                    setToast({ type: 'success', message: '✅ Approved! Generating PDF...' })
                    await downloadInvoice()
                    setAwaitingApproval(false)
                    return
                } else if (status === 'rejected') {
                    setToast({ type: 'error', message: '❌ Request was rejected by admin' })
                    setTimeout(() => setToast(null), 4000)
                    setAwaitingApproval(false)
                    return
                }
            }

            setToast({ type: 'error', message: 'Approval timeout. Please try again.' })
            setTimeout(() => setToast(null), 4000)
        } catch (error) {
            setToast({ type: 'error', message: 'Failed to request approval' })
            setTimeout(() => setToast(null), 4000)
        }
        setAwaitingApproval(false)
    }

    const isMobile = () => /Android|iPhone|iPad|iPod/i.test(navigator.userAgent || '')

    async function downloadInvoice() {
        setIsDownloading(true)
        setToast({ type: 'info', message: 'Generating PDF...' })
        
        try {
            const result = await buildInvoicePdf()
            if (!result) {
                throw new Error('Failed to generate PDF')
            }
            const { pdf, fileName } = result
    
            if (isMobile()) {
                const arrayBuffer = pdf.output('arraybuffer')
                const blob = new Blob([arrayBuffer], { type: 'application/pdf' })
                const url = URL.createObjectURL(blob)
                
                // Try download link first (works better on mobile)
                const a = document.createElement('a')
                a.style.display = 'none'
                a.href = url
                a.download = fileName
                document.body.appendChild(a)
                a.click()
                
                // Fallback: open in new tab after short delay
                setTimeout(() => {
                    const opened = window.open(url, '_blank')
                    if (!opened) {
                        setToast({ type: 'info', message: 'PDF ready. Check your downloads or allow popups.' })
                    }
                }, 500)
                
                setTimeout(() => {
                    document.body.removeChild(a)
                    URL.revokeObjectURL(url)
                }, 10000)
            } else {
                pdf.save(fileName)
            }
    
            setToast({ type: 'success', message: 'Invoice downloaded successfully' })
            setTimeout(() => setToast(null), 3000)
        } catch (error: any) {
            console.error('Download failed:', error)
            setToast({ type: 'error', message: error.message || 'Failed to download invoice' })
            setTimeout(() => setToast(null), 4000)
        } finally {
            setIsDownloading(false)
        }
    }

    async function sendInvoiceByEmail() {
        if (isSending) return
    
        const email = (emailToSend || p.customerEmail || '').trim()
        if (!email) {
            setToast({ type: 'error', message: 'Please enter a customer email address first.' })
            setTimeout(() => setToast(null), 4000)
            return
        }
    
        try {
            setIsSending(true)
            setToast({ type: 'info', message: 'Generating PDF...' })
    
            const result = await buildInvoicePdf()
            if (!result) {
                setToast({ type: 'error', message: 'Could not build invoice PDF' })
                setTimeout(() => setToast(null), 4000)
                return
            }
    
            const { pdf, fileName } = result
    
            setToast({ type: 'info', message: 'Sending email...' })
    
            const pdfDataUri = pdf.output('datauristring')
            const base64 = pdfDataUri.split(',')[1] || ''
    
            const res = await fetch('/api/send-invoice', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    toEmail: email,
                    customerName: p.customerName,
                    invoiceNo: p.invoiceNo,
                    propertyName: p.propertyName,
                    checkinDate: datePretty(p.checkin),
                    checkoutDate: datePretty(p.checkout),
                    guests: p.guests || undefined,
                    totalAmount: formatINR(displayTotal),
                    paymentStatus,
                    invoiceDate: datePretty(p.invoiceDate),
                    pdfBase64: base64,
                    fileName,
                }),
            })
    
            const responseData = await res.json() // Add this to catch actual error
    
            if (!res.ok) {
                throw new Error(responseData.error || 'Failed to send')
            }
    
            setToast({ type: 'success', message: `Invoice emailed to ${email}` })
            setTimeout(() => {
                setToast(current => (current && current.type === 'success' ? null : current))
            }, 4000)
        } catch (err: any) {
            console.error('Email error:', err)
            setToast({ type: 'error', message: err.message || 'Could not send invoice email. Please try again.' })
            setTimeout(() => {
                setToast(current => (current && current.type === 'error' ? null : current))
            }, 5000)
        } finally {
            setIsSending(false)
        }
    }

    return (
        <div style={{ background: '#ffffff', padding: 10, minHeight: '100vh', overflow: 'auto' }}>

            {(isSending || isDownloading) && (
                <div className="loading-overlay">
                    <div className="loading-spinner-container">
                        <div className="loading-spinner"></div>
                        <p className="loading-text">
                            {isSending ? 'Sending invoice...' : 'Preparing download...'}
                        </p>
                    </div>
                </div>
            )}
            {toast && (
                <div className={`toast-container toast-${toast.type}`}>
                    <div className="toast-content">
                        <div className="toast-icon">
                            {toast.type === 'success' ? (
                                <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
                                    <circle cx="10" cy="10" r="9" stroke="currentColor" strokeWidth="2" />
                                    <path d="M6 10l2.5 2.5L14 7" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                                </svg>
                            ) : toast.type === 'info' ? (
                                <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
                                    <circle cx="10" cy="10" r="9" stroke="currentColor" strokeWidth="2" />
                                    <path d="M10 9v5M10 6h.01" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                                </svg>
                            ) : (
                                <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
                                    <circle cx="10" cy="10" r="9" stroke="currentColor" strokeWidth="2" />
                                    <path d="M10 6v5M10 14h.01" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                                </svg>
                            )}
                        </div>
                        <div className="toast-message">{toast.message}</div>
                        <button className="toast-close" onClick={() => setToast(null)}>×</button>
                    </div>
                </div>
            )}
            {/* Desktop buttons - hidden on mobile */}
            {/* Desktop buttons - hidden on mobile */}
            <div className="desktop-toolbar">
                <button onClick={() => window.history.back()} className="desktop-btn desktop-btn-back">
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <line x1="19" y1="12" x2="5" y2="12" />
                        <polyline points="12 19 5 12 12 5" />
                    </svg>
                    <span>Back</span>
                </button>
                <button
                    onClick={downloadInvoice}
                    disabled={isDownloading || isSending}
                    className="desktop-btn desktop-btn-download"
                >
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                        <polyline points="7 10 12 15 17 10" />
                        <line x1="12" y1="15" x2="12" y2="3" />
                    </svg>
                    <span>Download PDF</span>
                </button>
                <div className="desktop-email-group">
                    <div className="desktop-input-wrapper">
                        <svg className="desktop-input-icon" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z" />
                            <polyline points="22,6 12,13 2,6" />
                        </svg>
                        <input
                            type="email"
                            placeholder="Enter customer email"
                            value={emailToSend}
                            onChange={e => setEmailToSend(e.target.value)}
                            disabled={isSending || isDownloading}
                            className="desktop-email-input"
                        />
                    </div>
                    <button
                        onClick={sendInvoiceByEmail}
                        disabled={isSending || isDownloading}
                        className="desktop-btn desktop-btn-send"
                    >
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <line x1="22" y1="2" x2="11" y2="13" />
                            <polygon points="22 2 15 22 11 13 2 9 22 2" />
                        </svg>
                        <span>Send Email</span>
                    </button>
                </div>
            </div>
            {/* Floating Action Button - visible only on mobile */}
            <div className="fab-container">
                <div className={`fab-menu ${fabOpen ? 'open' : ''}`}>
                    <div className="fab-menu-item">
                        <input
                            type="email"
                            placeholder="Email address"
                            value={emailToSend}
                            onChange={e => setEmailToSend(e.target.value)}
                            disabled={isSending || isDownloading}
                            className="fab-email-input"
                        />
                    </div>
                    <button
                        onClick={() => {
                            sendInvoiceByEmail()
                            setFabOpen(false)
                        }}
                        disabled={isSending || isDownloading}
                        className="fab-menu-item fab-action"
                    >
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z" />
                            <polyline points="22,6 12,13 2,6" />
                        </svg>
                        <span>Send Email</span>
                    </button>
                    <button
                        onClick={() => {
                            downloadInvoice()
                            setFabOpen(false)
                        }}
                        disabled={isDownloading || isSending}
                        className="fab-menu-item fab-action"
                    >
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                            <polyline points="7 10 12 15 17 10" />
                            <line x1="12" y1="15" x2="12" y2="3" />
                        </svg>
                        <span>Download PDF</span>
                    </button>
                    <button
                        onClick={() => {
                            window.history.back()
                            setFabOpen(false)
                        }}
                        className="fab-menu-item fab-action"
                    >
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <line x1="19" y1="12" x2="5" y2="12" />
                            <polyline points="12 19 5 12 12 5" />
                        </svg>
                        <span>Back</span>
                    </button>
                </div>

                <button
                    className={`fab-button ${fabOpen ? 'open' : ''}`}
                    onClick={() => setFabOpen(!fabOpen)}
                    disabled={isSending || isDownloading}
                >
                    {fabOpen ? (
                        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                            <line x1="18" y1="6" x2="6" y2="18" />
                            <line x1="6" y1="6" x2="18" y2="18" />
                        </svg>
                    ) : (
                        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                            <circle cx="12" cy="12" r="1" />
                            <circle cx="12" cy="5" r="1" />
                            <circle cx="12" cy="19" r="1" />
                        </svg>
                    )}
                </button>
            </div>
            <div id="invoice-root" className="invoice-container">
                <div className={`invoice-header${isProforma ? ' proforma' : ''}`}>
                    <div>
                        <div className="invoice-title">{isProforma ? 'PROFORMA INVOICE' : 'INVOICE'}</div>
                    </div>
                    <div className="invoice-subtitle">{isProforma ? 'QUOTE - NOT YET CONFIRMED' : 'ORIGINAL FOR RECIPIENT'}</div>
                </div>

                <div className="company-section">
                    <div className="company-info">
                        <div className="company-name">Mi Casa Su Casa</div>
                        <div className="company-address">
                            Mi Casa Su Casa, Nirmala Apartment, Shop No. 1, J.P Road, Andheri, West, opposite
                        </div>
                        <div className="company-address">
                            Rajkumar Hotel, Mumbai, Maharashtra 400058
                        </div>
                        <div className="company-address">Mumbai Suburban, MAHARASHTRA, 400053</div>
                        <div className="company-email">Email mcscmicasasucasa@gmail.com</div>
                    </div>
                    <div className="company-logo-section">
                        <img src="/MCSC_LOGO.png" alt="MCSC Logo" className="mcsc-logo-img" id="mcsc-logo" onError={handleLogoError} />
                    </div>
                </div>

                <div className="invoice-meta">
                    <div className="meta-item">
                        <div className="meta-label">Invoice #</div>
                        <div className="meta-value">{p.invoiceNo}</div>
                    </div>
                    <div className="meta-divider" />
                    <div className="meta-item">
                        <div className="meta-label">Invoice Date</div>
                        <div className="meta-value">{datePretty(p.invoiceDate)}</div>
                    </div>
                </div>

                {isProforma && (
                    <div className="proforma-note">
                        <strong>Proforma Notice:</strong> Booking is not confirmed until payment is received in full.
                    </div>
                )}

                <div className="customer-section">
                    <div className="customer-title">Customer Details:</div>
                    <div className="customer-name">{p.customerName || '—'}</div>
                </div>

                <table className="items-table">
                    <thead>
                        <tr>
                            <th className="item-number">#</th>
                            <th className="item-name">Property</th>
                            <th className="item-rate">Rate / Night</th>
                            <th className="item-qty">Nights</th>
                            <th className="item-amount">Amount</th>
                        </tr>
                    </thead>
                    <tbody>
                        <tr>
                            <td className="item-number">1</td>
                            <td className="item-name">
                                <strong>{p.propertyName || '—'}</strong>
                                <div className="booking-details" dangerouslySetInnerHTML={{ __html: bookingHtml }} />
                            </td>
                            <td className="item-rate">{formatINR(p.rate)}</td>
                            <td className="item-qty">{qtyText}</td>
                            <td className="item-amount">{formatINR(subtotal)}</td>
                        </tr>
                    </tbody>
                </table>

                <div className="totals-section">
                    <div className="total-items-row">Total Items / Nights: 1 / {p.nights || 0}</div>
                    <div className="total-words">
                        Total amount (in words): INR {numberToWordsIndian(Math.round(amountInWordsTotal))} Rupees Only.
                    </div>
                    <div className="totals-breakdown">
                        <div className="breakdown-row">
                            <span>Subtotal</span>
                            <span>₹{formatINR(subtotal)}</span>
                        </div>
                        {taxAmount > 0 && (
                            <div className="breakdown-row">
                                <span>Tax ({p.taxRate}%)</span>
                                <span>₹{formatINR(taxAmount)}</span>
                            </div>
                        )}
                        <div className="breakdown-row breakdown-total">
                            <span>Grand Total</span>
                            <span>₹{formatINR(displayTotal)}</span>
                        </div>
                        {depositStatus !== 'none' && (
                            <div className={`breakdown-row info deposit-row deposit-${depositStatus}`}>
                                <div>
                                    <span>Security Deposit</span>
                                    <small>{depositStatus === 'paid' ? 'Already received' : 'Pending payment'}</small>
                                </div>
                                <span>
                                    ₹{formatINR(depositCharge)}
                                    {depositStatus === 'pending' ? ' due' : ''}
                                </span>
                            </div>
                        )}
                        {paymentStatus === 'partial' && otherPaidAmount > 0 && (
                            <div className="breakdown-row info">
                                <div>
                                    <span>Amount Paid</span>
                                    <small>Payments after deposit</small>
                                </div>
                                <span>₹{formatINR(otherPaidAmount)}</span>
                            </div>
                        )}
                        <div className="breakdown-row status-row">
                            <span>Payment Status</span>
                            <span style={{ textTransform: 'capitalize' }}>{paymentStatus === 'full' ? 'Paid in full' : paymentStatus === 'partial' ? 'Partially paid' : 'Unpaid'}</span>
                        </div>
                    </div>
                    {balance === 0 ? (
                        <div className="amount-payable">
                            <span>Total Amount Paid:</span>
                            <span>₹{formatINR(displayTotal)}</span>
                        </div>
                    ) : (
                        <div className="amount-payable">
                            <span>Balance Due:</span>
                            <span>₹{formatINR(balance)}</span>
                        </div>
                    )}
                </div>

                <div className="bank-signature-container">
                    <div className="bank-details">
                        <div className="bank-title">Bank Details:</div>
                        <div className="bank-info">
                            <div className="bank-item">
                                <span className="bank-label">Bank:</span>
                                <span className="bank-value">HDFC Bank</span>
                            </div>
                            <div className="bank-item">
                                <span className="bank-label">Account Holder:</span>
                                <span className="bank-value">Rahul Bhagtani</span>
                            </div>
                            <div className="bank-item">
                                <span className="bank-label">Account #:</span>
                                <span className="bank-value">13571930011724</span>
                            </div>
                            <div className="bank-item">
                                <span className="bank-label">IFSC Code:</span>
                                <span className="bank-value">HDFC0001357</span>
                            </div>
                            <div className="bank-item">
                                <span className="bank-label">Branch:</span>
                                <span className="bank-value">INDRALOK-LOKHANDWALA</span>
                            </div>
                        </div>
                    </div>

                    <div className="signature-section">
                        <div className="signature-content">
                            <div className="signature-line">For Mi Casa Su Casa</div>
                            <div className="rahul-signature">
                                <img src="/Signature.png" alt="Signature" className="rahul-signature-img" id="rahul-signature" onError={handleSignError} />
                            </div>
                            <div className="signature-name">Authorized Signatory</div>
                        </div>
                    </div>
                </div>

                <div className="notes-section">
                    <div className="notes-title">Notes:</div>
                    <div className="notes-content">
                        Thank you for booking with us!<br />
                        We truly appreciate your trust and look forward to hosting you. Should you need any assistance before or during your stay, feel free to reach out to us anytime.<br /><br />
                        Wishing you a pleasant and memorable stay!
                    </div>
                </div>

                <div className="terms-section">
                    <div className="terms-title">Terms and Conditions:</div>
                    <div className="terms-list">
                        <ol>
                            <li>Bookings are non-refundable and non-cancellable after confirmation; no date changes allowed.</li>
                            <li>Check-in time is 2:00 PM, check-out time is 11:00 AM; early check-in or late check-out may incur extra charges.</li>
                            <li>Valid government-issued photo ID is required at check-in; copies may be retained for security.</li>
                            <li>Guests are responsible for any property damage or loss; associated costs may be deducted from deposits or charged separately.</li>
                            <li>Property use is limited to registered guests for residential purposes only; misuse or illegal activities lead to eviction without refund.</li>
                            <li>No unregistered visitors allowed without prior approval; extra guest charges may apply.</li>
                            <li>Management is not liable for loss or damage to personal belongings; guests should safeguard valuables.</li>
                            <li>Compliance with house rules and local laws is mandatory; violations may result in eviction without refund.</li>
                        </ol>
                    </div>
                </div>

                <div className="footer">
                    <div className="footer-content">
                        <span>Mi Casa Su Casa</span>
                        <span>This is a computer-generated invoice.</span>
                    </div>
                    <div>
                        Page 1 / 1
                    </div>
                </div>
            </div>

            <style jsx global>{`
         body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Arial, sans-serif; color: #1a1a1a; margin: 0; padding: 0; }

/* Force desktop view on mobile */
@media (max-width: 768px) {
    body {
        width: 760px;
        overflow-x: auto;
    }
}

.invoice-container { 
    width: 760px; 
    min-width: 760px;
    margin: 0 auto; 
    background: white; 
    padding: 18px 16px; 
    box-shadow: 0 6px 18px rgba(0,0,0,0.08); 
    border: 1px solid #f0f0f0; 
}
        .invoice-header { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 18px; padding-bottom: 12px; border-bottom: 2px solid #5B9BD5; }
        .invoice-header.proforma { border-bottom-color: #5B9BD5; }
         .invoice-title { font-size: 22px; font-weight: 700; letter-spacing: 3.5px; color: #5B9BD5; margin: 0; }
        .invoice-header.proforma .invoice-title { color: #5B9BD5; }
        .invoice-subtitle { font-size: 10px; color: #666; letter-spacing: 0.5px; margin: 0; }
        .invoice-header.proforma .invoice-subtitle { color: #5B9BD5; font-weight: 600; }
        .company-section { margin-bottom: 18px; display: flex; justify-content: space-between; align-items: flex-start; }
        .company-info { flex: 1; }
         .company-name { font-size: 22px; font-weight: 700; color: #000000; margin: 0 0 8px 0; }
         .company-address { font-size: 14px; line-height: 1.6; color: #2d2d2d; margin: 0 0 2px 0; }
        .company-email { font-size: 14px; color: #5B9BD5; margin: 4px 0 0 0; }
         .company-logo-section { margin-left: 20px; margin-right: 28px; }
        .mcsc-logo-img { height: 110px; width: auto; object-fit: contain; border: 1px solid #E0E0E0; padding: 8px; border-radius: 100px; }
        .invoice-meta { display: flex; justify-content: center; align-items: stretch; gap: 0; margin: 16px auto 12px; max-width: 720px; width: 100%; padding: 0 8px; }
        .meta-item { flex: 1; padding: 8px 18px; display: flex; flex-direction: column; align-items: center; gap: 6px; text-align: center; }
        .meta-divider { width: 1px; background: linear-gradient(180deg, rgba(0,0,0,0), rgba(0,0,0,0.4), rgba(0,0,0,0)); min-height: 54px; align-self: stretch; margin: 0 12px; }
         .meta-label { font-size: 11px; color: #4a4a4a; margin: 0; font-weight: 700; letter-spacing: 0.08em; text-transform: uppercase; }
         .meta-value { font-size: 17px; font-weight: 700; color: #000000; margin: 0; letter-spacing: 0.03em; }
        .proforma-note { margin: 0 auto 18px; max-width: 720px; background: #f0f6ff; border: 1px solid rgba(91,155,213,0.35); border-radius: 8px; padding: 9px 12px; font-size: 11px; color: #1d3557; font-weight: 600; }
         .customer-section { margin-bottom: 12px; padding: 8px 10px; background-color: #fff; border-radius: 3px; }
         .customer-title { font-size: 11px; font-weight: 600; color: #333333; margin: 0 0 4px 0; }
         .customer-name { font-size: 15px; font-weight: 700; margin: 0 0 3px 0; color: #000000; }
         .items-table { width: 100%; border-collapse: collapse; margin: 16px 0 12px 0; }
        .items-table thead { background-color: transparent; border-top: 2px solid #5B9BD5; border-bottom: 2px solid #5B9BD5; }
         .items-table th { background-color: transparent; color: #000000; padding: 6px 8px; text-align: left; font-size: 15px; font-weight: 700; border-bottom: 2px solid #5B9BD5; }
        .items-table th:last-child { text-align: right; }
        .items-table tbody tr { background-color: #FAFAFA; }
        .items-table tbody tr:hover { background-color: #F5F5F5; }
         .items-table td { padding: 9px 10px; border-bottom: 1px solid #E5E8EB; font-size: 13px; vertical-align: top; color: #1a1a1a; }
        .items-table .item-number { width: 40px; color: #555; font-weight: 500; }
        .items-table .item-name { width: auto; }
         .items-table .item-name strong { font-size: 17px; font-weight: 700; color: #000000; }
        .items-table .item-rate { width: 140px; text-align: right; color: #000000; font-weight: 500; }
        .items-table .item-qty { width: 100px; text-align: center; color: #000000; font-weight: 500; }
        .items-table .item-amount { width: 140px; text-align: right; font-weight: 700; color: #000000; font-size: 14px; }
        .booking-details { font-size: 13px; color: #000000; line-height: 1.6; margin-top: 6px; }
         .totals-section { margin-top: 16px; display: flex; flex-direction: column; align-items: flex-end; padding: 16px; background-color: #F5F5F5; border-radius: 6px; }
        .total-items-row { font-size: 12px; color: #333333; margin-bottom: 4px; }
        .total-words { font-size: 12px; color: #333333; margin-bottom: 12px; text-align: right; }
        .totals-breakdown { width: 100%; max-width: 360px; border: 1px solid #dfe4ea; border-radius: 8px; padding: 12px 14px; background: #fff; display: flex; flex-direction: column; gap: 8px; }
        .breakdown-row { display: flex; justify-content: space-between; gap: 12px; font-size: 14px; color: #000; }
        .breakdown-row span:first-child { font-weight: 600; }
        .breakdown-row.breakdown-total { border-top: 1px dashed #d9d9d9; padding-top: 8px; margin-top: 4px; font-size: 15px; }
        .breakdown-row.info { font-size: 13px; color: #1a1a1a; }
        .breakdown-row.status-row { border-top: 1px dashed #d9d9d9; padding-top: 8px; margin-top: 4px; font-weight: 600; font-size: 13px; color: #111; }
        .breakdown-row.info small { display: block; font-size: 11px; color: #6b7280; font-weight: 400; }
         .amount-payable { display: flex; justify-content: space-between; gap: 32px; font-size: 18px; font-weight: 700; color: #000000; background-color: transparent; padding: 10px 14px; border-radius: 5px; margin-top: 12px; border-top: 2px solid #5B9BD5; width: 100%; max-width: 360px; }
         .bank-signature-container { display: flex; gap: 20px; margin: 18px 0; align-items: flex-start; }
        .bank-details { margin: 0; padding: 14px; background-color: #F5F5F5; border-radius: 5px; flex: 1; }
        .bank-title { font-size: 14px; font-weight: 700; color: #000000; margin: 0 0 12px 0; }
        .bank-info { display: grid; grid-template-columns: 1fr 1fr; gap: 8px 20px; font-size: 12px; }
        .bank-item { display: flex; gap: 10px; }
        .bank-label { font-weight: 600; color: #333333; min-width: 110px; }
        .bank-value { color: #000000; font-weight: 500; }
         .signature-section { flex: 0 0 auto; margin-right: 22px; }
        .signature-content { text-align: center; }
         .signature-line { font-size: 11px; color: #000000; margin-bottom: 8px; font-weight: 600; }
        .rahul-signature { margin: 15px 0; }
        .rahul-signature-img { height: 90px; width: auto; object-fit: contain; }
         .signature-name { font-size: 12px; font-weight: 700; color: #000000; }
         .notes-section { margin: 16px 0; padding: 10px; background-color: #F0F8F4; border-radius: 5px; border-left: 4px solid #4CAF50; }
        .notes-title { font-size: 15px; font-weight: 700; color: #000000; margin: 0 0 8px 0; }
         .notes-content { font-size: 13px; line-height: 1.65; color: #1a1a1a; }
         .terms-section { margin: 16px 0; }
        .terms-title { font-size: 15px; font-weight: 700; color: #000000; margin: 0 0 10px 0; }
        .terms-list { font-size: 13px; line-height: 1.7; color: #000000; }
        .terms-list ol { padding-left: 18px; margin: 0; }
        .terms-list li { margin-bottom: 8px; padding-left: 4px; }
         .footer { text-align: center; margin-top: 20px; padding-top: 12px; border-top: 2px solid #E5E5E5; font-size: 10px; color: #8a8a8a; }
        .footer-content { display: flex; justify-content: space-between; margin-bottom: 8px; }
        /* Loading Overlay */
.loading-overlay {
    position: fixed;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    background: rgba(0, 0, 0, 0.75);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 9999;
    backdrop-filter: blur(4px);
}
.loading-spinner-container {
    text-align: center;
}
.loading-spinner {
    width: 60px;
    height: 60px;
    border: 4px solid rgba(255, 255, 255, 0.2);
    border-top-color: #ffffff;
    border-radius: 50%;
    animation: spin 0.8s linear infinite;
    margin: 0 auto 16px;
}
.loading-text {
    color: #ffffff;
    font-size: 16px;
    font-weight: 500;
    margin: 0;
}
/* Desktop toolbar - hidden on mobile */
/* Desktop toolbar - hidden on mobile */
/* Desktop toolbar - hidden on mobile */
.desktop-toolbar {
    max-width: 800px;
    margin: 0 auto 20px auto;
    display: flex;
    gap: 12px;
    justify-content: flex-end;
    align-items: center;
    flex-wrap: wrap;
    padding: 16px 20px;
    background: linear-gradient(135deg, #ffffff 0%, #f8f9fa 100%);
    border-radius: 12px;
    box-shadow: 0 1px 3px rgba(0, 0, 0, 0.08);
    border: 1px solid #e5e7eb;
}

.desktop-btn {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 10px 18px;
    border: none;
    border-radius: 8px;
    font-size: 14px;
    font-weight: 600;
    cursor: pointer;
    transition: all 0.2s ease;
    color: white;
    box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
    position: relative;
    overflow: hidden;
}

.desktop-btn::before {
    content: '';
    position: absolute;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    background: rgba(255, 255, 255, 0.15);
    opacity: 0;
    transition: opacity 0.2s;
}

.desktop-btn:hover::before {
    opacity: 1;
}

.desktop-btn:hover {
    transform: translateY(-1px);
    box-shadow: 0 4px 8px rgba(0, 0, 0, 0.15);
}

.desktop-btn:active {
    transform: translateY(0);
    box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
}

.desktop-btn:disabled {
    opacity: 0.6;
    cursor: not-allowed;
    transform: none;
    box-shadow: 0 1px 3px rgba(0, 0, 0, 0.08);
}

.desktop-btn svg {
    flex-shrink: 0;
}
.desktop-btn {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 10px 16px;
    border-radius: 10px;
    font-size: 14px;
    font-weight: 500;
    cursor: pointer;

    background: #ffffff;
    color: #1a1a1a;

    border: 1px solid #e5e7eb;
    box-shadow: 0 2px 6px rgba(0,0,0,0.08);

    transition: all 0.2s ease;
}

.desktop-btn:hover {
    background: #f9fafb;
    transform: translateY(-1px);
    box-shadow: 0 4px 10px rgba(0,0,0,0.12);
}

.desktop-btn:active {
    transform: scale(0.98);
}

.desktop-btn:disabled {
    opacity: 0.5;
    cursor: not-allowed;
}
.desktop-btn svg {
    stroke: #374151;
}
   


.desktop-email-group {
    display: flex;
    align-items: center;
    gap: 10px;
}

.desktop-input-wrapper {
    position: relative;
    display: flex;
    align-items: center;
}

.desktop-input-icon {
    position: absolute;
    left: 12px;
    color: #9ca3af;
    pointer-events: none;
    z-index: 1;
}

.desktop-email-input {
    padding: 10px 14px 10px 40px;
    border-radius: 8px;
    border: 1px solid #d1d5db;
    font-size: 14px;
    min-width: 240px;
    transition: all 0.2s;
    background: white;
    color: #111827;
    font-weight: 500;
}

.desktop-email-input:focus {
    outline: none;
    border-color: #2563eb;
    box-shadow: 0 0 0 3px rgba(37, 99, 235, 0.1);
}

.desktop-email-input:disabled {
    background: #f3f4f6;
    cursor: not-allowed;
    color: #9ca3af;
}

.desktop-email-input::placeholder {
    color: #9ca3af;
    font-weight: 400;
}
/* Floating Action Button - hidden on desktop */
.fab-container {
    display: none;
}

@media (max-width: 768px) {
    .desktop-toolbar {
        display: none;
    }
    
    .fab-container {
        display: block;
        position: fixed;
        bottom: 24px;
        right: 24px;
        z-index: 1000;
    }
    
    .fab-button {
        width: 56px;
        height: 56px;
        border-radius: 50%;
        background: linear-gradient(135deg, #5B9BD5 0%, #4A8BC2 100%);
        border: none;
        color: white;
        cursor: pointer;
        box-shadow: 0 4px 12px rgba(91, 155, 213, 0.4), 0 2px 4px rgba(0, 0, 0, 0.1);
        display: flex;
        align-items: center;
        justify-content: center;
        transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
        position: relative;
        z-index: 1001;
    }
    
    .fab-button:active {
        transform: scale(0.95);
    }
    
    .fab-button.open {
        background: linear-gradient(135deg, #ef4444 0%, #dc2626 100%);
        transform: rotate(90deg);
    }
    
    .fab-button:disabled {
        opacity: 0.6;
        cursor: not-allowed;
    }
    
    .fab-menu {
        position: absolute;
        bottom: 70px;
        right: 0;
        display: flex;
        flex-direction: column;
        gap: 12px;
        opacity: 0;
        transform: translateY(20px) scale(0.9);
        pointer-events: none;
        transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
    }
    
    .fab-menu.open {
        opacity: 1;
        transform: translateY(0) scale(1);
        pointer-events: all;
    }
    
    .fab-menu-item {
        background: white;
        border: none;
        padding: 14px 20px;
        border-radius: 12px;
        box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15), 0 2px 4px rgba(0, 0, 0, 0.1);
        cursor: pointer;
        display: flex;
        align-items: center;
        gap: 12px;
        font-size: 15px;
        font-weight: 500;
        color: #1a1a1a;
        transition: all 0.2s ease;
        min-width: 200px;
        white-space: nowrap;
    }
    
    .fab-menu-item.fab-action:active {
        transform: scale(0.97);
        box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
    }
    
    .fab-menu-item:disabled {
        opacity: 0.5;
        cursor: not-allowed;
    }
    
    .fab-menu-item svg {
        flex-shrink: 0;
    }
    
    .fab-email-input {
        width: 100%;
        padding: 10px 12px;
        border: 1px solid #d1d5db;
        border-radius: 8px;
        font-size: 14px;
        outline: none;
        transition: border-color 0.2s;
    }
    
    .fab-email-input:focus {
        border-color: #5B9BD5;
    }
    
    .fab-email-input:disabled {
        background: #f3f4f6;
        cursor: not-allowed;
    }
}
/* Toast Notifications */
.toast-container {
    position: fixed;
    top: 24px;
    right: 24px;
    z-index: 10000;
    min-width: 320px;
    max-width: 420px;
    animation: slideIn 0.3s ease-out;
}
.toast-content {
    display: flex;
    align-items: center;
    gap: 12px;
    padding: 12px 14px;
    border-radius: 10px;
    background: #ffffff;
    border: 1px solid #e5e7eb;
    box-shadow: 0 10px 30px rgba(0, 0, 0, 0.12), 0 4px 10px rgba(0, 0, 0, 0.08);
}
.toast-success .toast-content {
    border-left: 4px solid #16a34a;
    color: #14532d;
}
.toast-error .toast-content {
    border-left: 4px solid #dc2626;
    color: #7f1d1d;
}
.toast-icon {
    flex-shrink: 0;
    width: 24px;
    height: 24px;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    border-radius: 50%;
    background: #f3f4f6;
}
.toast-success .toast-icon {
    color: #16a34a;
    background: #ecfdf3;
}
.toast-error .toast-icon {
    color: #dc2626;
    background: #fef2f2;
}
.toast-info .toast-content {
    border-left: 4px solid #3b82f6;
    color: #1e40af;
}
.toast-info .toast-icon {
    color: #3b82f6;
    background: #eff6ff;
}
.toast-message {
    flex: 1;
    font-size: 14px;
    font-weight: 500;
    line-height: 1.4;
}
.toast-close {
    flex-shrink: 0;
    width: 24px;
    height: 24px;
    border: none;
    background: transparent;
    color: currentColor;
    font-size: 24px;
    line-height: 1;
    cursor: pointer;
    opacity: 0.6;
    transition: opacity 0.2s;
    padding: 0;
    display: flex;
    align-items: center;
    justify-content: center;
}
.toast-close:hover {
    opacity: 1;
}

@keyframes slideIn {
    from {
        transform: translateX(400px);
        opacity: 0;
    }
    to {
        transform: translateX(0);
        opacity: 1;
    }
}

@keyframes spin { 
    to { transform: rotate(360deg); } 
}
        @keyframes spin { to { transform: rotate(360deg); } }
      `}</style>
        </div>
    )
}