import { NextRequest, NextResponse } from 'next/server';
import { kv } from '@vercel/kv';

const SUBSCRIPTIONS_KEY = 'push_subscriptions';

async function getSubscriptions(): Promise<any[]> {
    try {
        const subs = await kv.get<any[]>(SUBSCRIPTIONS_KEY);
        console.log('Retrieved subscriptions from KV:', subs ? subs.length : 0);
        return subs || [];
    } catch (error: any) {
        console.error('Error getting subscriptions:', error);
        console.error('KV error details:', error.message, error.stack);
        return [];
    }
}

async function saveSubscriptions(subs: any[]): Promise<void> {
    try {
        await kv.set(SUBSCRIPTIONS_KEY, subs);
    } catch (error) {
        console.error('Error saving subscriptions:', error);
        throw error;
    }
}

export async function POST(req: NextRequest) {
    try {
        const subscription = await req.json();

        console.log('Received subscription:', { endpoint: subscription.endpoint });

        const subs = await getSubscriptions();
        console.log('Current subscriptions count:', subs.length);

        // Check if already exists
        const exists = subs.some(s => s.endpoint === subscription.endpoint);
        if (!exists) {
            subs.push(subscription);
            await saveSubscriptions(subs);
            console.log('Subscription saved. New count:', subs.length);
        } else {
            console.log('Subscription already exists');
        }

        return NextResponse.json({ success: true, count: subs.length });
    } catch (error: any) {
        console.error('Subscribe error:', error);
        return NextResponse.json({ 
            error: 'Failed to subscribe', 
            details: error.message 
        }, { status: 500 });
    }
}

export async function DELETE(req: NextRequest) {
    try {
        const { endpoint } = await req.json();

        let subs = await getSubscriptions();
        subs = subs.filter(s => s.endpoint !== endpoint);
        await saveSubscriptions(subs);

        return NextResponse.json({ success: true });
    } catch (error) {
        console.error('Unsubscribe error:', error);
        return NextResponse.json({ error: 'Failed to unsubscribe' }, { status: 500 });
    }
}

