import { NextRequest, NextResponse } from 'next/server';
import webpush from 'web-push';
import { kv } from '@vercel/kv';

const SUBSCRIPTIONS_KEY = 'push_subscriptions';
const PENDING_KEY = 'pending_approvals';

// VAPID keys - you should generate your own and store in env variables
// Generate with: npx web-push generate-vapid-keys
const VAPID_PUBLIC = process.env.NEXT_PUBLIC_VAPID_PUBLIC || 'BEBev2JJnGphDMc42AbL2k-GZ0PcEqff5bF2Lz7MUxokxuTexOxJbYiT6IbZDjNMJpS5gk-4N2w90Gv44nIiiKU';
const VAPID_PRIVATE = process.env.VAPID_PRIVATE || 'wfzWBBz_qAm_ThSKNK6sYwP8Y8XxDsW8NUf820lXcUw';

webpush.setVapidDetails(
    'mailto:admin@example.com',
    VAPID_PUBLIC,
    VAPID_PRIVATE
);

async function getSubscriptions(): Promise<any[]> {
    try {
        const subs = await kv.get<any[]>(SUBSCRIPTIONS_KEY);
        return subs || [];
    } catch (error) {
        console.error('Error getting subscriptions:', error);
        return [];
    }
}

async function getPending(): Promise<Record<string, any>> {
    try {
        const pending = await kv.get<Record<string, any>>(PENDING_KEY);
        return pending || {};
    } catch (error) {
        console.error('Error getting pending:', error);
        return {};
    }
}

async function savePending(pending: Record<string, any>): Promise<void> {
    try {
        await kv.set(PENDING_KEY, pending);
    } catch (error) {
        console.error('Error saving pending:', error);
        throw error;
    }
}

export async function POST(req: NextRequest) {
    try {
        const { invoiceNo, customerName, amount, propertyName } = await req.json();

        const requestId = `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

        // Save pending approval
        const pending = await getPending();
        pending[requestId] = {
            invoiceNo,
            customerName,
            amount,
            propertyName,
            status: 'pending',
            createdAt: new Date().toISOString()
        };
        await savePending(pending);

        // Send push to all subscribed admins
        const subs = await getSubscriptions();

        const payload = JSON.stringify({
            title: `📄 Invoice Approval: ${invoiceNo}`,
            body: `${customerName} - ${propertyName}\nAmount: ₹${amount}`,
            tag: requestId,
            requestId
        });

        const sendPromises = subs.map(sub =>
            webpush.sendNotification(sub, payload).catch(async (err: any) => {
                console.error('Push failed:', err);
                // Remove invalid subscription
                if (err.statusCode === 410) {
                    const updatedSubs = (await getSubscriptions()).filter(s => s.endpoint !== sub.endpoint);
                    await kv.set(SUBSCRIPTIONS_KEY, updatedSubs);
                }
            })
        );

        await Promise.all(sendPromises);

        return NextResponse.json({ requestId, subscriberCount: subs.length });
    } catch (error) {
        console.error('Request approval error:', error);
        return NextResponse.json({ error: 'Failed to request approval' }, { status: 500 });
    }
}

