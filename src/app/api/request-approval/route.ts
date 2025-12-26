import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';
import webpush from 'web-push';

const SUBSCRIPTIONS_FILE = path.join(process.cwd(), 'subscriptions.json');
const PENDING_FILE = path.join(process.cwd(), 'pending-approvals.json');

// VAPID keys - you should generate your own and store in env variables
// Generate with: npx web-push generate-vapid-keys
const VAPID_PUBLIC = process.env.NEXT_PUBLIC_VAPID_PUBLIC || 'BEBev2JJnGphDMc42AbL2k-GZ0PcEqff5bF2Lz7MUxokxuTexOxJbYiT6IbZDjNMJpS5gk-4N2w90Gv44nIiiKU';
const VAPID_PRIVATE = process.env.VAPID_PRIVATE || 'wfzWBBz_qAm_ThSKNK6sYwP8Y8XxDsW8NUf820lXcUw';

webpush.setVapidDetails(
    'mailto:admin@example.com',
    VAPID_PUBLIC,
    VAPID_PRIVATE
);

function getSubscriptions(): any[] {
    try {
        if (fs.existsSync(SUBSCRIPTIONS_FILE)) {
            return JSON.parse(fs.readFileSync(SUBSCRIPTIONS_FILE, 'utf-8'));
        }
    } catch { }
    return [];
}

function getPending(): Record<string, any> {
    try {
        if (fs.existsSync(PENDING_FILE)) {
            return JSON.parse(fs.readFileSync(PENDING_FILE, 'utf-8'));
        }
    } catch { }
    return {};
}

function savePending(pending: Record<string, any>) {
    fs.writeFileSync(PENDING_FILE, JSON.stringify(pending, null, 2));
}

export async function POST(req: NextRequest) {
    try {
        const { invoiceNo, customerName, amount, propertyName } = await req.json();

        const requestId = `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

        // Save pending approval
        const pending = getPending();
        pending[requestId] = {
            invoiceNo,
            customerName,
            amount,
            propertyName,
            status: 'pending',
            createdAt: new Date().toISOString()
        };
        savePending(pending);

        // Send push to all subscribed admins
        const subs = getSubscriptions();

        const payload = JSON.stringify({
            title: `📄 Invoice Approval: ${invoiceNo}`,
            body: `${customerName} - ${propertyName}\nAmount: ₹${amount}`,
            tag: requestId,
            requestId
        });

        const sendPromises = subs.map(sub =>
            webpush.sendNotification(sub, payload).catch((err: any) => {
                console.error('Push failed:', err);
                // Remove invalid subscription
                if (err.statusCode === 410) {
                    const updatedSubs = getSubscriptions().filter(s => s.endpoint !== sub.endpoint);
                    fs.writeFileSync(SUBSCRIPTIONS_FILE, JSON.stringify(updatedSubs, null, 2));
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

