import { NextRequest, NextResponse } from 'next/server';
import webpush from 'web-push';
import { getDatabase } from '@/lib/mongodb';

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
        const db = await getDatabase();
        const subscriptions = await db.collection('subscriptions').find({}).toArray();
        console.log('Retrieved subscriptions from MongoDB:', subscriptions.length);
        return subscriptions;
    } catch (error: any) {
        console.error('Error getting subscriptions:', error);
        return [];
    }
}

async function savePendingRequest(requestId: string, requestData: any): Promise<void> {
    try {
        const db = await getDatabase();
        await db.collection('approval_requests').insertOne({
            requestId: requestId,
            ...requestData
        });
        console.log('Saved pending request to MongoDB:', requestId);
    } catch (error: any) {
        console.error('Error saving pending request:', error);
        throw error;
    }
}

export async function POST(req: NextRequest) {
    try {
        const { invoiceNo, customerName, amount, propertyName } = await req.json();

        const requestId = `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

        // Save pending approval
        await savePendingRequest(requestId, {
            invoiceNo,
            customerName,
            amount,
            propertyName,
            status: 'pending',
            createdAt: new Date().toISOString()
        });

        // Send push to all subscribed admins
        const subs = await getSubscriptions();
        console.log('Subscriptions found for approval request:', subs.length);

        if (subs.length === 0) {
            console.warn('No subscriptions found in MongoDB.');
        }

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
                    const db = await getDatabase();
                    await db.collection('subscriptions').deleteOne({ endpoint: sub.endpoint });
                    console.log('Removed invalid subscription:', sub.endpoint);
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

