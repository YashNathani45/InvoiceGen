// Service Worker for Push Notifications

self.addEventListener('push', function (event) {
    try {
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
    } catch (error) {
        console.error('Push event error:', error);
        // Fallback notification
        event.waitUntil(
            self.registration.showNotification('Invoice Approval', {
                body: 'New invoice approval request',
                icon: '/MCSC_LOGO.png'
            })
        );
    }
});

self.addEventListener('notificationclick', function (event) {
    event.notification.close();

    const action = event.action;
    const requestId = event.notification.data?.requestId;

    if (!requestId) {
        console.error('No requestId found in notification data');
        event.waitUntil(clients.openWindow('/admin-notifications'));
        return;
    }

    if (action === 'approve' || action === 'reject') {
        event.waitUntil(
            // Send approval response
            fetch('/api/approval-response', {
                method: 'POST',
                headers: { 
                    'Content-Type': 'application/json',
                    'Accept': 'application/json'
                },
                body: JSON.stringify({ 
                    requestId: requestId, 
                    approved: action === 'approve' 
                })
            })
            .then(response => {
                if (!response.ok) {
                    console.error('Approval response failed:', response.status);
                    throw new Error(`HTTP ${response.status}`);
                }
                return response.json();
            })
            .then(data => {
                console.log('Approval response successful:', data);
                // Show confirmation notification
                return self.registration.showNotification(
                    action === 'approve' ? '✅ Approved' : '❌ Rejected',
                    { 
                        body: 'Response sent successfully', 
                        icon: '/MCSC_LOGO.png', 
                        tag: 'response-confirm',
                        requireInteraction: false
                    }
                );
            })
            .catch(error => {
                console.error('Approval response error:', error);
                // Show error notification
                return self.registration.showNotification(
                    '❌ Error',
                    { 
                        body: 'Failed to send approval response. Please try from admin panel.', 
                        icon: '/MCSC_LOGO.png', 
                        tag: 'response-error',
                        requireInteraction: false
                    }
                );
            })
        );
    } else {
        // Clicked on notification body - open admin page
        event.waitUntil(
            clients.matchAll({ type: 'window', includeUncontrolled: true })
                .then(clientList => {
                    // Check if admin page is already open
                    for (let client of clientList) {
                        if (client.url.includes('/admin-notifications') && 'focus' in client) {
                            return client.focus();
                        }
                    }
                    // Otherwise open new window
                    if (clients.openWindow) {
                        return clients.openWindow('/admin-notifications');
                    }
                })
        );
    }
});

// Install event - skip waiting to activate immediately
self.addEventListener('install', (event) => {
    console.log('Service Worker installing...');
    self.skipWaiting();
});

// Activate event - claim all clients immediately
self.addEventListener('activate', (event) => {
    console.log('Service Worker activating...');
    event.waitUntil(
        self.clients.claim().then(() => {
            console.log('Service Worker activated and claimed clients');
        })
    );
});

// Handle fetch events (optional but good practice)
self.addEventListener('fetch', function(event) {
    // Let the browser handle all fetch requests normally
    return;
});