'use client'

import { useState, useEffect } from 'react'

type ApprovalRequest = {
    id: string
    invoiceNo: string
    customerName: string
    amount: string
    propertyName: string
    status: 'pending' | 'approved' | 'rejected'
    createdAt: string
    respondedAt?: string
}

export default function AdminPanel() {
    const [requests, setRequests] = useState<ApprovalRequest[]>([])
    const [loading, setLoading] = useState(true)
    const [filter, setFilter] = useState<'all' | 'pending' | 'approved' | 'rejected'>('pending')

    useEffect(() => {
        fetchRequests()
        // Poll every 3 seconds for new requests
        const interval = setInterval(fetchRequests, 3000)
        return () => clearInterval(interval)
    }, [])

    async function fetchRequests() {
        try {
            // Multiple cache-busting techniques
            const timestamp = Date.now();
            const random = Math.random();
            
            const res = await fetch(`/api/admin/requests?t=${timestamp}&r=${random}`, {
                method: 'GET',
                cache: 'no-store',
                headers: {
                    'Cache-Control': 'no-cache, no-store, must-revalidate',
                    'Pragma': 'no-cache',
                    'Expires': '0'
                },
                // Force Next.js to skip cache
                next: { revalidate: 0 }
            })
            
            if (!res.ok) {
                throw new Error(`HTTP error! status: ${res.status}`);
            }
            
            const data = await res.json()
            console.log('Fetched requests:', data.requests?.length || 0, 'items at', new Date().toISOString())
            setRequests(data.requests || [])
        } catch (err) {
            console.error('Failed to fetch requests:', err)
        }
        setLoading(false)
    }

    async function handleAction(requestId: string, approved: boolean) {
        try {
            await fetch('/api/approval-response', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ requestId, approved })
            })
            // Force immediate refresh after action
            setTimeout(() => fetchRequests(), 500);
        } catch (err) {
            console.error('Failed to update:', err)
        }
    }

    const filteredRequests = requests.filter(r =>
        filter === 'all' ? true : r.status === filter
    )

    const pendingCount = requests.filter(r => r.status === 'pending').length

    const formatDate = (iso: string) => {
        const d = new Date(iso)
        return d.toLocaleString('en-IN', {
            day: '2-digit',
            month: 'short',
            hour: '2-digit',
            minute: '2-digit'
        })
    }

    return (
        <div className="admin-page">
            <header className="admin-header">
                <div className="header-content">
                    <h1>🔐 Admin Panel</h1>
                    <p>Manage invoice approval requests</p>
                </div>
                <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
                    <button 
                        onClick={fetchRequests}
                        style={{
                            background: 'rgba(255,255,255,0.1)',
                            border: 'none',
                            color: '#94a3b8',
                            padding: '8px 16px',
                            borderRadius: '8px',
                            cursor: 'pointer',
                            fontSize: '14px'
                        }}
                    >
                        🔄 Refresh
                    </button>
                    {pendingCount > 0 && (
                        <div className="pending-badge">{pendingCount} pending</div>
                    )}
                </div>
            </header>

            <div className="filters">
                {(['pending', 'approved', 'rejected', 'all'] as const).map(f => (
                    <button
                        key={f}
                        className={`filter-btn ${filter === f ? 'active' : ''}`}
                        onClick={() => setFilter(f)}
                    >
                        {f === 'pending' && '⏳ '}
                        {f === 'approved' && '✅ '}
                        {f === 'rejected' && '❌ '}
                        {f === 'all' && '📋 '}
                        {f.charAt(0).toUpperCase() + f.slice(1)}
                        {f === 'pending' && pendingCount > 0 && ` (${pendingCount})`}
                    </button>
                ))}
            </div>

            {loading ? (
                <div className="loading">Loading...</div>
            ) : filteredRequests.length === 0 ? (
                <div className="empty">
                    <div className="empty-icon">📭</div>
                    <p>No {filter === 'all' ? '' : filter} requests</p>
                </div>
            ) : (
                <div className="requests-list">
                    {filteredRequests.map(req => (
                        <div key={req.id} className={`request-card ${req.status}`}>
                            <div className="request-header">
                                <span className="invoice-no">{req.invoiceNo}</span>
                                <span className={`status-badge ${req.status}`}>
                                    {req.status === 'pending' && '⏳ Pending'}
                                    {req.status === 'approved' && '✅ Approved'}
                                    {req.status === 'rejected' && '❌ Rejected'}
                                </span>
                            </div>

                            <div className="request-details">
                                <div className="detail">
                                    <span className="label">Customer</span>
                                    <span className="value">{req.customerName}</span>
                                </div>
                                <div className="detail">
                                    <span className="label">Property</span>
                                    <span className="value">{req.propertyName}</span>
                                </div>
                                <div className="detail">
                                    <span className="label">Amount</span>
                                    <span className="value amount">₹{req.amount}</span>
                                </div>
                                <div className="detail">
                                    <span className="label">Requested</span>
                                    <span className="value">{formatDate(req.createdAt)}</span>
                                </div>
                            </div>

                            {req.status === 'pending' && (
                                <div className="actions">
                                    <button
                                        className="btn approve"
                                        onClick={() => handleAction(req.id, true)}
                                    >
                                        ✅ Approve
                                    </button>
                                    <button
                                        className="btn reject"
                                        onClick={() => handleAction(req.id, false)}
                                    >
                                        ❌ Reject
                                    </button>
                                </div>
                            )}
                        </div>
                    ))}
                </div>
            )}

            <a href="/admin-notifications" className="notification-link">
                🔔 Setup Push Notifications
            </a>

            <style jsx>{`
        .admin-page {
          min-height: 100vh;
          background: linear-gradient(135deg, #0f172a 0%, #1e293b 100%);
          padding: 20px;
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
        }

        .admin-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 24px;
          padding-bottom: 20px;
          border-bottom: 1px solid rgba(255,255,255,0.1);
        }

        .header-content h1 {
          margin: 0;
          color: #fff;
          font-size: 24px;
        }

        .header-content p {
          margin: 4px 0 0;
          color: #94a3b8;
          font-size: 14px;
        }

        .pending-badge {
          background: #ef4444;
          color: #fff;
          padding: 8px 16px;
          border-radius: 20px;
          font-weight: 600;
          font-size: 14px;
          animation: pulse 2s infinite;
        }

        @keyframes pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.7; }
        }

        .filters {
          display: flex;
          gap: 8px;
          margin-bottom: 20px;
          flex-wrap: wrap;
        }

        .filter-btn {
          background: rgba(255,255,255,0.1);
          border: none;
          color: #94a3b8;
          padding: 10px 16px;
          border-radius: 8px;
          cursor: pointer;
          font-size: 14px;
          transition: all 0.2s;
        }

        .filter-btn:hover {
          background: rgba(255,255,255,0.15);
        }

        .filter-btn.active {
          background: #3b82f6;
          color: #fff;
        }

        .loading, .empty {
          text-align: center;
          padding: 60px 20px;
          color: #64748b;
        }

        .empty-icon {
          font-size: 48px;
          margin-bottom: 12px;
        }

        .requests-list {
          display: flex;
          flex-direction: column;
          gap: 16px;
        }

        .request-card {
          background: #fff;
          border-radius: 12px;
          padding: 20px;
          box-shadow: 0 4px 6px -1px rgba(0,0,0,0.1);
        }

        .request-card.pending {
          border-left: 4px solid #f59e0b;
        }

        .request-card.approved {
          border-left: 4px solid #22c55e;
        }

        .request-card.rejected {
          border-left: 4px solid #ef4444;
        }

        .request-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 16px;
        }

        .invoice-no {
          font-weight: 700;
          font-size: 18px;
          color: #0f172a;
        }

        .status-badge {
          padding: 4px 12px;
          border-radius: 20px;
          font-size: 12px;
          font-weight: 600;
        }

        .status-badge.pending {
          background: #fef3c7;
          color: #92400e;
        }

        .status-badge.approved {
          background: #dcfce7;
          color: #166534;
        }

        .status-badge.rejected {
          background: #fee2e2;
          color: #991b1b;
        }

        .request-details {
          display: grid;
          grid-template-columns: repeat(2, 1fr);
          gap: 12px;
          margin-bottom: 16px;
        }

        .detail {
          display: flex;
          flex-direction: column;
          gap: 2px;
        }

        .label {
          font-size: 12px;
          color: #64748b;
          text-transform: uppercase;
          letter-spacing: 0.05em;
        }

        .value {
          font-size: 14px;
          color: #0f172a;
          font-weight: 500;
        }

        .value.amount {
          color: #059669;
          font-weight: 700;
        }

        .actions {
          display: flex;
          gap: 12px;
          padding-top: 16px;
          border-top: 1px solid #e2e8f0;
        }

        .btn {
          flex: 1;
          padding: 12px;
          border: none;
          border-radius: 8px;
          font-size: 14px;
          font-weight: 600;
          cursor: pointer;
          transition: all 0.2s;
        }

        .btn.approve {
          background: #22c55e;
          color: #fff;
        }

        .btn.approve:hover {
          background: #16a34a;
        }

        .btn.reject {
          background: #fee2e2;
          color: #dc2626;
        }

        .btn.reject:hover {
          background: #fecaca;
        }

        .notification-link {
          display: block;
          text-align: center;
          margin-top: 32px;
          color: #94a3b8;
          text-decoration: none;
          font-size: 14px;
        }

        .notification-link:hover {
          color: #fff;
        }
      `}</style>
        </div>
    )
}