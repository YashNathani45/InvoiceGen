'use client'

import { useRouter } from 'next/navigation'
import { useEffect, useMemo, useState, useCallback } from 'react'
import DatePicker from 'react-datepicker'
import Select from 'react-select'
import 'react-datepicker/dist/react-datepicker.css'

type FormState = {
  invoiceNo: string
  invoiceDate: string
  invoiceType: 'invoice' | 'proforma'
  customerName: string
  propertyName: string
  checkin: string
  checkout: string
  guests: string
  rate: string
  nights: number
  taxRate: string
  deposit: string
  depositStatus: 'none' | 'paid' | 'pending'
  amountPaid: string
  paymentStatus: 'unpaid' | 'partial' | 'full'
}

type Option<T extends string> = { value: T, label: string }

const docTypeOptions: Option<FormState['invoiceType']>[] = [
  { value: 'invoice', label: 'Invoice' },
  { value: 'proforma', label: 'Proforma Invoice' },
]

const paymentStatusOptions: Option<FormState['paymentStatus']>[] = [
  { value: 'unpaid', label: 'Not paid yet' },
  { value: 'partial', label: 'Partially paid' },
  { value: 'full', label: 'Paid in full' },
]

const depositOptions: Option<FormState['depositStatus']>[] = [
  { value: 'none', label: 'No deposit' },
  { value: 'paid', label: 'Deposit paid' },
  { value: 'pending', label: 'Deposit pending' },
]

const selectStyles = {
  control: (base: any, state: any) => ({
    ...base,
    borderRadius: 8,
    borderColor: state.isFocused ? '#18181b' : '#e4e4e7',
    boxShadow: state.isFocused ? '0 0 0 1px #18181b' : 'none',
    minHeight: 42,
    backgroundColor: state.isDisabled ? '#fafafa' : '#fff',
    '&:hover': {
      borderColor: state.isFocused ? '#18181b' : '#d4d4d8',
    },
  }),
  valueContainer: (base: any) => ({
    ...base,
    padding: '0 12px',
  }),
  input: (base: any) => ({ ...base, color: '#09090b' }),
  singleValue: (base: any) => ({ ...base, color: '#09090b', fontWeight: 500 }),
  placeholder: (base: any) => ({ ...base, color: '#a1a1aa' }),
  option: (base: any, state: any) => ({
    ...base,
    backgroundColor: state.isSelected ? '#18181b' : state.isFocused ? '#f4f4f5' : '#fff',
    color: state.isSelected ? '#fff' : '#09090b',
    cursor: 'pointer',
    fontWeight: state.isSelected ? 500 : 400,
  }),
  menu: (base: any) => ({
    ...base,
    borderRadius: 8,
    overflow: 'hidden',
    boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06)',
    border: '1px solid #e4e4e7',
  }),
}

const getTodayDate = () => {
  const today = new Date()
  return today.toISOString().split('T')[0]
}

const defaultState: FormState = {
  invoiceNo: '',
  invoiceDate: getTodayDate(),
  invoiceType: 'invoice',
  customerName: '',
  propertyName: '',
  checkin: '',
  checkout: '',
  guests: '',
  rate: '',
  nights: 1,
  taxRate: '',
  deposit: '',
  depositStatus: 'none',
  amountPaid: '',
  paymentStatus: 'unpaid',
}

export default function FormPage() {
  const router = useRouter()
  const [form, setForm] = useState<FormState>(() => {
    if (typeof window === 'undefined') return defaultState
    try {
      const saved = window.localStorage.getItem('invoice-form')
      return saved ? { ...defaultState, ...JSON.parse(saved) } : defaultState
    } catch {
      return defaultState
    }
  })
  const [hydrated, setHydrated] = useState(false)
  const [awaitingApproval, setAwaitingApproval] = useState(false)
  const [approvalStatus, setApprovalStatus] = useState<'idle' | 'pending' | 'approved' | 'rejected' | 'error'>('idle')
  const [statusMessage, setStatusMessage] = useState('')

  useEffect(() => {
    try { window.localStorage.setItem('invoice-form', JSON.stringify(form)) } catch { }
  }, [form])

  useEffect(() => {
    setHydrated(true)
    // Format invoice number on initial load if it exists
    if (form.invoiceNo) {
      const number = getInvoiceNumber(form.invoiceNo)
      const prefix = form.invoiceType === 'proforma' ? 'PFI-' : 'MCSC-'
      const formatted = number ? prefix + number : ''
      if (formatted !== form.invoiceNo && formatted) {
        update('invoiceNo', formatted)
      }
    }
  }, [])

  const autoNights = useMemo(() => {
    if (!form.checkin || !form.checkout) return form.nights
    const a = new Date(form.checkin)
    const b = new Date(form.checkout)
    const diff = Math.max(1, Math.round((b.getTime() - a.getTime()) / (1000 * 60 * 60 * 24)))
    return diff
  }, [form.checkin, form.checkout, form.nights])

  function update<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm(prev => ({ ...prev, [key]: value }))
  }

  // Extract number from invoice number (remove prefix)
  const getInvoiceNumber = (value: string): string => {
    const prefix = form.invoiceType === 'proforma' ? 'PFI-' : 'MCSC-'
    // Remove existing prefix if present
    const cleaned = value.replace(/^(MCSC-|PFI-)/i, '')
    // Extract only digits
    const number = cleaned.replace(/\D/g, '')
    return number
  }

  // Format invoice number with appropriate prefix
  const formatInvoiceNumber = (number: string): string => {
    const prefix = form.invoiceType === 'proforma' ? 'PFI-' : 'MCSC-'
    if (!number) return ''
    return prefix + number
  }

  // Handle invoice number change - only allow numbers, auto-add prefix
  const handleInvoiceNumberChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const inputValue = e.target.value
    const number = getInvoiceNumber(inputValue)
    const formatted = formatInvoiceNumber(number)
    update('invoiceNo', formatted)
  }

  // Handle invoice type change - update invoice number prefix
  const handleInvoiceTypeChange = (opt: Option<FormState['invoiceType']> | null) => {
    const newType = (opt?.value || 'invoice') as FormState['invoiceType']
    // Update invoice number prefix if it exists, before updating type
    if (form.invoiceNo) {
      const number = getInvoiceNumber(form.invoiceNo)
      const prefix = newType === 'proforma' ? 'PFI-' : 'MCSC-'
      const formatted = number ? prefix + number : ''
      setForm(prev => ({ ...prev, invoiceType: newType, invoiceNo: formatted }))
    } else {
      update('invoiceType', newType)
    }
  }

  const buildPayload = useCallback(() => {
    const isProforma = form.invoiceType === 'proforma'
    const effectiveDepositStatus: FormState['depositStatus'] = isProforma ? 'none' : form.depositStatus
    const depositActive = effectiveDepositStatus !== 'none'
    const cleanedDeposit = depositActive ? Math.max(0, Number(form.deposit) || 0) : 0
    const rate = Number(form.rate) || 0
    const nights = autoNights
    const taxRate = Number(form.taxRate) || 0
    const subtotal = rate * nights
    const total = subtotal + (subtotal * taxRate / 100)

    return {
      payload: {
        ...form,
        nights,
        guests: Number(form.guests) || 0,
        rate,
        taxRate,
        deposit: cleanedDeposit,
        amountPaid: isProforma ? 0 : form.paymentStatus === 'partial' ? (Number(form.amountPaid) || 0) : 0,
        invoiceType: form.invoiceType,
        paymentStatus: isProforma ? 'unpaid' : form.paymentStatus,
        depositStatus: effectiveDepositStatus,
      },
      total
    }
  }, [form, autoNights])

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault()

    setAwaitingApproval(true)
    setApprovalStatus('pending')
    setStatusMessage('📱 Requesting admin approval...')

    try {
      const { payload, total } = buildPayload()

      // Request approval
      const res = await fetch('/api/request-approval', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          invoiceNo: form.invoiceNo,
          customerName: form.customerName,
          amount: total.toLocaleString('en-IN', { minimumFractionDigits: 2 }),
          propertyName: form.propertyName
        })
      })

      const { requestId, subscriberCount } = await res.json()

      if (subscriberCount === 0) {
        setApprovalStatus('error')
        setStatusMessage('❌ No admin subscribed. Ask admin to visit /admin-notifications first.')
        setTimeout(() => {
          setAwaitingApproval(false)
          setApprovalStatus('idle')
        }, 4000)
        return
      }

      setStatusMessage('⏳ Waiting for admin to approve...')

      // Poll for approval status
      const maxWait = 120000 // 2 minutes
      const pollInterval = 2000 // 2 seconds
      const startTime = Date.now()

      while (Date.now() - startTime < maxWait) {
        await new Promise(r => setTimeout(r, pollInterval))

        const statusRes = await fetch(`/api/approval-response?requestId=${requestId}`)
        const { status } = await statusRes.json()

        if (status === 'approved') {
          setApprovalStatus('approved')
          setStatusMessage('✅ Approved! Redirecting to invoice...')

          // Navigate to invoice page
          const params = new URLSearchParams()
          Object.entries(payload).forEach(([k, v]) => params.set(k, String(v)))

          setTimeout(() => {
            router.push(`/invoice?${params.toString()}`)
          }, 1000)
          return
        } else if (status === 'rejected') {
          setApprovalStatus('rejected')
          setStatusMessage('❌ Request was rejected by admin')
          setTimeout(() => {
            setAwaitingApproval(false)
            setApprovalStatus('idle')
          }, 3000)
          return
        }
      }

      setApprovalStatus('error')
      setStatusMessage('⏰ Approval timeout. Please try again.')
      setTimeout(() => {
        setAwaitingApproval(false)
        setApprovalStatus('idle')
      }, 3000)
    } catch (error) {
      setApprovalStatus('error')
      setStatusMessage('❌ Failed to request approval')
      setTimeout(() => {
        setAwaitingApproval(false)
        setApprovalStatus('idle')
      }, 3000)
    }
  }

  const disablePayments = form.invoiceType === 'proforma'

  if (!hydrated) return null

  return (
    <div className="page">
      <div className="container">
        <header className="hero">
          <div className="hero-content">
            <div className="brand-section">
              <img src="/MCSC_LOGO.png" alt="Mi Casa Su Casa" className="brand-logo" />
              <div className="brand-info">
                <p className="brand-name">Mi Casa Su Casa</p>
                <p className="brand-location">Andheri West, Mumbai</p>
              </div>
            </div>
            <div className="hero-text">
              <h1>Generate Invoices</h1>
              <p className="subtitle">Create professional invoices with accurate stay details and auto-calculated nights.</p>
            </div>
          </div>
        </header>

        <form onSubmit={onSubmit} className="form">
          <section className="section">
            <div className="section-header">
              <h2>Invoice Details</h2>
              <span className="step">Step 1 of 3</span>
            </div>
            <div className="grid">
              <Field label="Document Type">
                <Select
                  classNamePrefix="mcsc-select"
                  styles={selectStyles}
                  value={docTypeOptions.find(opt => opt.value === form.invoiceType)}
                  onChange={handleInvoiceTypeChange}
                  options={docTypeOptions}
                />
              </Field>
              <Field label="Invoice Number">
                <input
                  inputMode="numeric"
                  autoComplete="off"
                  placeholder={form.invoiceType === 'proforma' ? 'PFI-001' : 'MCSC-001'}
                  value={form.invoiceNo}
                  onChange={handleInvoiceNumberChange}
                  className="input"
                  required
                />
              </Field>
              <Field label="Invoice Date">
                <DatePicker
                  selected={form.invoiceDate ? new Date(form.invoiceDate) : null}
                  onChange={date => update('invoiceDate', date ? date.toISOString().split('T')[0] : '')}
                  placeholderText="Select date"
                  dateFormat="dd MMM yyyy"
                  className="input date-input"
                  calendarClassName="mcsc-datepicker"
                  popperPlacement="bottom-start"
                />
              </Field>
            </div>
          </section>

          <section className="section">
            <div className="section-header">
              <h2>Guest & Property</h2>
              <span className="step">Step 2 of 3</span>
            </div>
            <div className="grid">
              <Field className="col-span-full" label="Customer Name">
                <input
                  inputMode="text"
                  placeholder="Enter customer name"
                  value={form.customerName}
                  onChange={e => update('customerName', e.target.value)}
                  className="input"
                  required
                />
              </Field>
              <Field className="col-span-full" label="Property Name">
                <input
                  inputMode="text"
                  placeholder="Enter property name"
                  value={form.propertyName}
                  onChange={e => update('propertyName', e.target.value)}
                  className="input"
                  required
                />
              </Field>
              <Field label="Check-in">
                <DatePicker
                  selected={form.checkin ? new Date(form.checkin) : null}
                  onChange={date => update('checkin', date ? date.toISOString().split('T')[0] : '')}
                  placeholderText="Select date"
                  dateFormat="dd MMM yyyy"
                  className="input date-input"
                  calendarClassName="mcsc-datepicker"
                  popperPlacement="bottom-start"
                />
              </Field>
              <Field label="Check-out">
                <DatePicker
                  selected={form.checkout ? new Date(form.checkout) : null}
                  onChange={date => update('checkout', date ? date.toISOString().split('T')[0] : '')}
                  placeholderText="Select date"
                  dateFormat="dd MMM yyyy"
                  className="input date-input"
                  calendarClassName="mcsc-datepicker"
                  popperPlacement="bottom-start"
                  minDate={form.checkin ? new Date(new Date(form.checkin).getTime() + 24 * 60 * 60 * 1000) : undefined}
                  disabled={!form.checkin}
                />
              </Field>
              <Field label="Guests">
                <input
                  type="number"
                  min={1}
                  inputMode="numeric"
                  placeholder="2"
                  value={form.guests}
                  onChange={e => update('guests', e.target.value)}
                  className="input"
                />
              </Field>
              <Field label="Rate per Night (₹)">
                <input
                  type="number"
                  min={0}
                  step={0.01}
                  inputMode="decimal"
                  placeholder="5000"
                  value={form.rate}
                  onChange={e => update('rate', e.target.value)}
                  className="input"
                />
              </Field>
              <Field label="Number of Nights">
                <input
                  type="number"
                  min={1}
                  inputMode="numeric"
                  value={autoNights}
                  onChange={e => update('nights', Number(e.target.value))}
                  className="input"
                />
              </Field>
            </div>
          </section>

          <section className="section">
            <div className="section-header">
              <h2>Payment & Adjustments</h2>
              <span className="step">Step 3 of 3</span>
            </div>
            <div className="grid">
              <Field label="Payment Status">
                <Select
                  classNamePrefix="mcsc-select"
                  styles={selectStyles}
                  value={paymentStatusOptions.find(opt => opt.value === (disablePayments ? 'unpaid' : form.paymentStatus))}
                  onChange={opt => update('paymentStatus', (opt?.value || 'unpaid') as FormState['paymentStatus'])}
                  options={paymentStatusOptions}
                  isDisabled={disablePayments}
                />
              </Field>
              <Field label="Tax Rate (%)">
                <input
                  type="number"
                  min={0}
                  step={0.01}
                  inputMode="decimal"
                  placeholder="18"
                  value={form.taxRate}
                  onChange={e => update('taxRate', e.target.value)}
                  className="input"
                />
              </Field>
              <Field label="Security Deposit">
                <Select
                  classNamePrefix="mcsc-select"
                  styles={selectStyles}
                  value={depositOptions.find(opt => opt.value === (disablePayments ? 'none' : form.depositStatus))}
                  onChange={opt => {
                    const status = (opt?.value || 'none') as FormState['depositStatus']
                    update('depositStatus', status)
                    if (status === 'none') update('deposit', '')
                  }}
                  options={depositOptions}
                  isDisabled={disablePayments}
                />
              </Field>
              <Field label="Deposit Amount (₹)">
                <input
                  type="number"
                  min={0}
                  step={0.01}
                  inputMode="decimal"
                  placeholder="10000"
                  value={form.deposit}
                  onChange={e => update('deposit', e.target.value)}
                  className="input"
                  disabled={disablePayments || form.depositStatus === 'none'}
                />
              </Field>
              {!disablePayments && form.paymentStatus === 'partial' && (
                <Field label="Amount Paid (₹)">
                  <input
                    type="number"
                    min={0}
                    step={0.01}
                    inputMode="decimal"
                    placeholder="25000"
                    value={form.amountPaid}
                    onChange={e => update('amountPaid', e.target.value)}
                    className="input"
                  />
                </Field>
              )}
            </div>
          </section>

          <div className="submit-section">
            <button type="submit" className="btn-submit" disabled={awaitingApproval}>
              {awaitingApproval ? 'Awaiting Approval...' : 'Generate Invoice'}
            </button>
          </div>
        </form>
      </div>

      {/* Approval Overlay */}
      {awaitingApproval && (
        <div className="approval-overlay">
          <div className="approval-modal">
            <div className={`approval-icon ${approvalStatus}`}>
              {approvalStatus === 'pending' && <div className="spinner"></div>}
              {approvalStatus === 'approved' && '✅'}
              {approvalStatus === 'rejected' && '❌'}
              {approvalStatus === 'error' && '⚠️'}
            </div>
            <p className="approval-message">{statusMessage}</p>
            {approvalStatus === 'pending' && (
              <p className="approval-hint">Admin will receive a notification on their phone</p>
            )}
          </div>
        </div>
      )}

      <style jsx>{`
  * { 
    -webkit-font-smoothing: antialiased; 
    -moz-osx-font-smoothing: grayscale; 
  }
  
  .page { 
    min-height: 100vh; 
    background: #fafafa;
    padding: 20px 0 100px;
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Inter', sans-serif;
  }

  @media (min-width: 768px) {
    .page { padding: 40px 0 120px; }
  }
  
  .container { 
    max-width: 880px; 
    margin: 0 auto; 
    padding: 0 16px;
  }

  @media (min-width: 768px) {
    .container { padding: 0 24px; }
  }
  
  .hero { 
    background: #fff; 
    border: 1px solid #e4e4e7;
    border-radius: 12px;
    padding: 28px;
    margin-bottom: 24px;
    box-shadow: 0 1px 2px 0 rgba(0, 0, 0, 0.05);
  }

  @media (min-width: 768px) {
    .hero { 
      padding: 36px 40px;
      margin-bottom: 32px;
    }
  }

  .hero-content {
    display: flex;
    flex-direction: column;
    gap: 24px;
  }

  @media (min-width: 768px) {
    .hero-content {
      flex-direction: row;
      align-items: center;
      justify-content: space-between;
      gap: 32px;
    }
  }

  .brand-section {
    display: flex;
    align-items: center;
    gap: 14px;
    padding-bottom: 24px;
    border-bottom: 1px solid #f4f4f5;
  }

  @media (min-width: 768px) {
    .brand-section {
      padding-bottom: 0;
      border-bottom: none;
      flex-shrink: 0;
    }
  }

  .brand-logo {
    width: 56px;
    height: 56px;
    object-fit: contain;
    border-radius: 8px;
    background: #fafafa;
    padding: 4px;
    border: 1px solid #e4e4e7;
  }

  .brand-info {
    display: flex;
    flex-direction: column;
    gap: 2px;
  }

  .brand-name {
    margin: 0;
    font-size: 16px;
    font-weight: 600;
    color: #09090b;
    line-height: 1.3;
  }

  .brand-location {
    margin: 0;
    font-size: 13px;
    color: #71717a;
    line-height: 1.4;
  }

  .hero-text {
    flex: 1;
  }

  .hero-text h1 {
    margin: 0 0 8px 0;
    font-size: 28px;
    font-weight: 600;
    color: #09090b;
    line-height: 1.2;
    letter-spacing: -0.02em;
  }

  @media (min-width: 768px) {
    .hero-text h1 { font-size: 32px; }
  }

  .subtitle {
    margin: 0;
    font-size: 14px;
    color: #71717a;
    line-height: 1.5;
  }

  @media (min-width: 768px) {
    .subtitle { font-size: 15px; }
  }

  .form {
    display: flex;
    flex-direction: column;
    gap: 20px;
  }

  @media (min-width: 768px) {
    .form { gap: 24px; }
  }

  .section {
    background: #fff;
    border: 1px solid #e4e4e7;
    border-radius: 12px;
    padding: 24px;
    box-shadow: 0 1px 2px 0 rgba(0, 0, 0, 0.05);
  }

  @media (min-width: 768px) {
    .section { padding: 28px 32px; }
  }

  .section-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 20px;
    padding-bottom: 16px;
    border-bottom: 1px solid #f4f4f5;
  }

  @media (min-width: 768px) {
    .section-header { margin-bottom: 24px; }
  }

  .section-header h2 {
    margin: 0;
    font-size: 18px;
    font-weight: 600;
    color: #09090b;
    letter-spacing: -0.01em;
  }

  @media (min-width: 768px) {
    .section-header h2 { font-size: 20px; }
  }

  .step {
    font-size: 12px;
    color: #a1a1aa;
    font-weight: 500;
    text-transform: uppercase;
    letter-spacing: 0.05em;
  }

  .grid {
    display: grid;
    grid-template-columns: 1fr;
    gap: 18px;
  }

  @media (min-width: 640px) {
    .grid {
      grid-template-columns: repeat(2, 1fr);
      gap: 20px;
    }
  }

  @media (min-width: 1024px) {
    .grid {
      grid-template-columns: repeat(3, 1fr);
    }
  }

  .col-span-full {
    grid-column: 1 / -1;
  }

  .field {
    display: flex;
    flex-direction: column;
    gap: 7px;
  }

  .label {
    font-size: 13px;
    color: #52525b;
    font-weight: 500;
  }

  .input {
    width: 100%;
    border: 1px solid #e4e4e7;
    border-radius: 8px;
    padding: 10px 12px;
    font-size: 14px;
    color: #09090b;
    background: #fff;
    outline: none;
    transition: all 0.15s ease;
    box-sizing: border-box;
    font-family: inherit;
  }

  .input:hover {
    border-color: #d4d4d8;
  }

  .input:focus {
    border-color: #18181b;
    box-shadow: 0 0 0 1px #18181b;
  }

  .input::placeholder {
    color: #a1a1aa;
  }

  .input:disabled {
    background: #fafafa;
    color: #a1a1aa;
    cursor: not-allowed;
  }

  :global(.react-datepicker-wrapper),
  :global(.react-datepicker__input-container) {
    width: 100%;
  }

  :global(.react-datepicker__input-container input) {
    width: 100%;
    border: 1px solid #e4e4e7;
    border-radius: 8px;
    padding: 10px 12px;
    font-size: 14px;
    color: #09090b;
    background: #fff;
    outline: none;
    box-sizing: border-box;
    transition: all 0.15s ease;
    font-family: inherit;
    cursor: pointer;
  }

  :global(.react-datepicker__input-container input:hover) {
    border-color: #d4d4d8;
  }

  :global(.react-datepicker__input-container input:focus) {
    border-color: #18181b;
    box-shadow: 0 0 0 1px #18181b;
  }

  :global(.mcsc-select__control) {
    border-radius: 8px !important;
    border: 1px solid #e4e4e7 !important;
    min-height: 42px !important;
    background: #fff !important;
    box-shadow: none !important;
    transition: all 0.15s ease !important;
  }

  :global(.mcsc-select__control:hover) {
    border-color: #d4d4d8 !important;
  }

  :global(.mcsc-select__control--is-focused) {
    border-color: #18181b !important;
    box-shadow: 0 0 0 1px #18181b !important;
  }

  :global(.mcsc-select__control--is-disabled) {
    background: #fafafa !important;
    border-color: #e4e4e7 !important;
  }

  :global(.mcsc-select__value-container) {
    padding: 0 12px !important;
  }

  :global(.mcsc-select__indicator-separator) {
    display: none;
  }

  :global(.mcsc-select__indicator) {
    color: #a1a1aa !important;
  }

  :global(.mcsc-select__placeholder) {
    color: #a1a1aa !important;
  }

  :global(.mcsc-select__single-value) {
    color: #09090b !important;
    font-weight: 500 !important;
  }

  :global(.mcsc-select__menu) {
    border-radius: 8px !important;
    box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06) !important;
    border: 1px solid #e4e4e7 !important;
    background: #fff !important;
  }

  :global(.mcsc-select__option) {
    padding: 10px 12px !important;
    cursor: pointer !important;
  }

  :global(.mcsc-select__option--is-focused) {
    background: #f4f4f5 !important;
  }

  :global(.mcsc-select__option--is-selected) {
    background: #18181b !important;
    color: #fff !important;
  }

  :global(.react-datepicker) {
    border: 1px solid #e4e4e7;
    border-radius: 8px;
    padding: 12px;
    box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06);
    font-family: inherit;
  }

  :global(.react-datepicker__header) {
    background: #fff;
    border-bottom: 1px solid #f4f4f5;
    border-top-left-radius: 8px;
    border-top-right-radius: 8px;
  }

  :global(.react-datepicker__current-month) {
    font-weight: 600;
    color: #09090b;
  }

  :global(.react-datepicker__day-name) {
    color: #71717a;
  }

  :global(.react-datepicker__day) {
    border-radius: 6px;
    color: #3f3f46;
  }

  :global(.react-datepicker__day--selected),
  :global(.react-datepicker__day--keyboard-selected) {
    background: #18181b !important;
    color: #fff !important;
    font-weight: 500;
  }

  :global(.react-datepicker__day:hover) {
    background: #f4f4f5;
    color: #09090b;
  }

  .submit-section {
    position: sticky;
    bottom: 20px;
    display: flex;
    justify-content: center;
    padding-top: 8px;
  }

  @media (min-width: 768px) {
    .submit-section {
      justify-content: flex-end;
      bottom: 24px;
    }
  }

  .btn-submit {
    background: #18181b;
    color: #fff;
    border: none;
    padding: 12px 32px;
    border-radius: 8px;
    font-weight: 600;
    font-size: 14px;
    cursor: pointer;
    transition: all 0.2s ease;
    font-family: inherit;
    box-shadow: 0 1px 2px 0 rgba(0, 0, 0, 0.05);
    width: 100%;
    max-width: 280px;
  }

  @media (min-width: 768px) {
    .btn-submit {
      width: auto;
      min-width: 200px;
    }
  }

  .btn-submit:hover {
    background: #27272a;
    transform: translateY(-1px);
    box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06);
  }

  .btn-submit:active {
    transform: translateY(0);
  }

  .btn-submit:disabled {
    background: #a1a1aa;
    cursor: not-allowed;
    transform: none;
  }

  .approval-overlay {
    position: fixed;
    inset: 0;
    background: rgba(0, 0, 0, 0.6);
    backdrop-filter: blur(4px);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 1000;
    padding: 20px;
  }

  .approval-modal {
    background: #fff;
    border-radius: 16px;
    padding: 40px;
    text-align: center;
    max-width: 380px;
    width: 100%;
    box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.25);
  }

  .approval-icon {
    width: 80px;
    height: 80px;
    margin: 0 auto 24px;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 40px;
    border-radius: 50%;
  }

  .approval-icon.pending {
    background: #eff6ff;
  }

  .approval-icon.approved {
    background: #dcfce7;
  }

  .approval-icon.rejected {
    background: #fee2e2;
  }

  .approval-icon.error {
    background: #fef3c7;
  }

  .spinner {
    width: 40px;
    height: 40px;
    border: 4px solid #e0e7ff;
    border-top-color: #3b82f6;
    border-radius: 50%;
    animation: spin 1s linear infinite;
  }

  @keyframes spin {
    to { transform: rotate(360deg); }
  }

  .approval-message {
    font-size: 18px;
    font-weight: 600;
    color: #09090b;
    margin: 0 0 8px;
  }

  .approval-hint {
    font-size: 14px;
    color: #71717a;
    margin: 0;
  }
`}</style>

    </div>
  )
}

function Field({ label, className, children }: { label: string, className?: string, children: React.ReactNode }) {
  return (
    <div className={`field ${className || ''}`.trim()}>
      <label className="label">{label}</label>
      {children}
    </div>
  )
}