'use client'

import { useState, useEffect } from 'react'

const VAPID_PUBLIC = process.env.NEXT_PUBLIC_VAPID_PUBLIC || 'BEBev2JJnGphDMc42AbL2k-GZ0PcEqff5bF2Lz7MUxokxuTexOxJbYiT6IbZDjNMJpS5gk-4N2w90Gv44nIiiKU';

export default function AdminNotificationsPage() {
    const [isSubscribed, setIsSubscribed] = useState(false)
    const [isLoading, setIsLoading] = useState(true)
    const [error, setError] = useState('')
    const [success, setSuccess] = useState('')

    useEffect(() => {
        checkSubscription()
    }, [])

    async function checkSubscription() {
        try {
            if (!('serviceWorker' in navigator) || !('PushManager' in window)) {
                setError('Push notifications not supported in this browser')
                setIsLoading(false)
                return
            }

            const registration = await navigator.serviceWorker.getRegistration()
            if (registration) {
                const subscription = await registration.pushManager.getSubscription()
                setIsSubscribed(!!subscription)
            }
        } catch (err) {
            console.error(err)
        }
        setIsLoading(false)
    }

    async function subscribe() {
        setError('')
        setSuccess('')
        setIsLoading(true)

        try {
            // Register service worker
            const registration = await navigator.serviceWorker.register('/sw.js')
            await navigator.serviceWorker.ready

            // Request permission
            const permission = await Notification.requestPermission()
            if (permission !== 'granted') {
                setError('Notification permission denied. Please allow notifications in browser settings.')
                setIsLoading(false)
                return
            }

            // Subscribe to push
            const subscription = await registration.pushManager.subscribe({
                userVisibleOnly: true,
                applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC)
            })

            // Send to server
            await fetch('/api/subscribe', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(subscription.toJSON())
            })

            setIsSubscribed(true)
            setSuccess('✅ Subscribed! You will now receive invoice approval requests.')
        } catch (err: any) {
            setError(err.message || 'Failed to subscribe')
        }
        setIsLoading(false)
    }

    async function unsubscribe() {
        setIsLoading(true)
        try {
            const registration = await navigator.serviceWorker.getRegistration()
            if (registration) {
                const subscription = await registration.pushManager.getSubscription()
                if (subscription) {
                    await subscription.unsubscribe()
                    await fetch('/api/subscribe', {
                        method: 'DELETE',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ endpoint: subscription.endpoint })
                    })
                }
            }
            setIsSubscribed(false)
            setSuccess('Unsubscribed from notifications')
        } catch (err: any) {
            setError(err.message || 'Failed to unsubscribe')
        }
        setIsLoading(false)
    }

    function urlBase64ToUint8Array(base64String: string) {
        const padding = '='.repeat((4 - base64String.length % 4) % 4)
        const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/')
        const rawData = window.atob(base64)
        const outputArray = new Uint8Array(rawData.length)
        for (let i = 0; i < rawData.length; ++i) {
            outputArray[i] = rawData.charCodeAt(i)
        }
        return outputArray
    }

    return (
        <div style={{
            minHeight: '100vh',
            background: 'linear-gradient(135deg, #1a1a2e 0%, #16213e 100%)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: 20
        }}>
            <div style={{
                background: '#fff',
                borderRadius: 16,
                padding: 40,
                maxWidth: 450,
                width: '100%',
                boxShadow: '0 20px 60px rgba(0,0,0,0.3)',
                textAlign: 'center'
            }}>
                <div style={{ fontSize: 60, marginBottom: 20 }}>🔔</div>
                <h1 style={{ margin: '0 0 10px', color: '#1a1a2e', fontSize: 24 }}>
                    Admin Notifications
                </h1>
                <p style={{ color: '#666', marginBottom: 30 }}>
                    Subscribe to receive invoice approval requests on this device
                </p>

                {error && (
                    <div style={{
                        background: '#fee2e2',
                        color: '#dc2626',
                        padding: 12,
                        borderRadius: 8,
                        marginBottom: 20
                    }}>
                        {error}
                    </div>
                )}

                {success && (
                    <div style={{
                        background: '#dcfce7',
                        color: '#16a34a',
                        padding: 12,
                        borderRadius: 8,
                        marginBottom: 20
                    }}>
                        {success}
                    </div>
                )}

                {isLoading ? (
                    <div style={{ color: '#666' }}>Loading...</div>
                ) : isSubscribed ? (
                    <div>
                        <div style={{
                            background: '#dcfce7',
                            color: '#16a34a',
                            padding: 16,
                            borderRadius: 12,
                            marginBottom: 20,
                            fontWeight: 600
                        }}>
                            ✅ Notifications Active
                        </div>
                        <p style={{ color: '#666', fontSize: 14, marginBottom: 20 }}>
                            You'll receive push notifications when someone tries to generate an invoice.
                        </p>
                        <button
                            onClick={unsubscribe}
                            style={{
                                background: '#ef4444',
                                color: '#fff',
                                border: 'none',
                                padding: '12px 24px',
                                borderRadius: 8,
                                cursor: 'pointer',
                                fontSize: 14
                            }}
                        >
                            Unsubscribe
                        </button>
                    </div>
                ) : (
                    <button
                        onClick={subscribe}
                        style={{
                            background: 'linear-gradient(135deg, #3b82f6 0%, #1d4ed8 100%)',
                            color: '#fff',
                            border: 'none',
                            padding: '16px 32px',
                            borderRadius: 12,
                            cursor: 'pointer',
                            fontSize: 16,
                            fontWeight: 600,
                            width: '100%'
                        }}
                    >
                        🔔 Enable Notifications
                    </button>
                )}

                <div style={{
                    marginTop: 40,
                    padding: 20,
                    background: '#f8fafc',
                    borderRadius: 12,
                    textAlign: 'left'
                }}>
                    <h3 style={{ margin: '0 0 12px', fontSize: 14, color: '#374151' }}>How it works:</h3>
                    <ol style={{ margin: 0, paddingLeft: 20, color: '#666', fontSize: 13, lineHeight: 1.8 }}>
                        <li>Click "Enable Notifications" above</li>
                        <li>Allow notifications when prompted</li>
                        <li>When someone generates an invoice, you'll get a notification</li>
                        <li>Tap Approve ✅ or Reject ❌ directly from notification</li>
                    </ol>
                </div>
            </div>
        </div>
    )
}

