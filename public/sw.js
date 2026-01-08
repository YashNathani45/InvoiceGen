// Service Worker for Push Notifications

self.addEventListener('push', function (event) {
    const data = event.data ? event.data.json() : {};

    const options = {
        body: data.body || 'New invoice approval request',
        icon: '/MCSC_LOGO.png',
        badge: '/MCSC_LOGO.png',
        vibrate: [200, 100, 200],
        tag: data.tag || 'invoice-approval',
        requireInteraction: true,
        actions: [
            { action: 'approve', title: '✅ Approve' },
            { action: 'reject', title: '❌ Reject' }
        ],
        data: {
            requestId: data.requestId,
            url: data.url || '/'
        }
    };

    event.waitUntil(
        self.registration.showNotification(data.title || 'Invoice Approval', options)
    );
});

self.addEventListener('notificationclick', function (event) {
    event.notification.close();

    const action = event.action;
    const requestId = event.notification.data.requestId;

    if (action === 'approve' || action === 'reject') {
        event.waitUntil(
            fetch('/api/approval-response', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ requestId, approved: action === 'approve' })
            }).then(response => {
                if (!response.ok) {
                    console.error('Approval response failed:', response.status);
                    return self.registration.showNotification(
                        '❌ Error',
                        { body: 'Failed to send approval response', icon: '/MCSC_LOGO.png', tag: 'response-error' }
                    );
                }
                // Show confirmation
                return self.registration.showNotification(
                    action === 'approve' ? '✅ Approved' : '❌ Rejected',
                    { body: 'Response sent', icon: '/MCSC_LOGO.png', tag: 'response-confirm' }
                );
            }).catch(error => {
                console.error('Approval response error:', error);
                return self.registration.showNotification(
                    '❌ Error',
                    { body: 'Failed to send approval response', icon: '/MCSC_LOGO.png', tag: 'response-error' }
                );
            })
        );
    } else {
        // Clicked on notification body - open admin page
        event.waitUntil(
            clients.openWindow('/admin-notifications')
        );
    }
});

self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', () => self.clients.claim());

