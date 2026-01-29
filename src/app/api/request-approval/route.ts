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

export async function POST(req: NextRequest) {
    try {
        const { invoiceNo, customerName, amount, propertyName } = await req.json();
        const requestId = `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

        const db = await getDatabase();

        // Persist the pending approval in MongoDB
        const insertResult = await db.collection('approval_requests').insertOne({
            requestId,
            invoiceNo,
            customerName,
            amount,
            propertyName,
            status: 'pending',
            createdAt: new Date(),
        });

        console.log('Approval request inserted:', {
            requestId,
            insertedId: insertResult.insertedId,
            database: db.databaseName,
            collection: 'approval_requests'
        });

        // Read subscriptions from MongoDB
        const subs = await db.collection('subscriptions').find({}).toArray();

        const payload = JSON.stringify({
            title: `📄 Invoice Approval: ${invoiceNo}`,
            body: `${customerName} - ${propertyName}\nAmount: ₹${amount}`,
            tag: requestId,
            requestId,
        });

        const sendPromises = subs.map((sub: any) =>
            webpush.sendNotification(sub, payload).catch((err: any) => {
                console.error('Push failed:', err);
                // Remove invalid subscription
                if (err?.statusCode === 410 && sub?.endpoint) {
                    db.collection('subscriptions').deleteOne({ endpoint: sub.endpoint }).catch(() => { });
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

