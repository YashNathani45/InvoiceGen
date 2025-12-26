import { NextRequest, NextResponse } from 'next/server';
import { kv } from '@vercel/kv';

const SUBSCRIPTIONS_KEY = 'push_subscriptions';

async function getSubscriptions(): Promise<any[]> {
    try {
        const subs = await kv.get<any[]>(SUBSCRIPTIONS_KEY);
        return subs || [];
    } catch (error) {
        console.error('Error getting subscriptions:', error);
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

        const subs = await getSubscriptions();

        // Check if already exists
        const exists = subs.some(s => s.endpoint === subscription.endpoint);
        if (!exists) {
            subs.push(subscription);
            await saveSubscriptions(subs);
        }

        return NextResponse.json({ success: true });
    } catch (error) {
        console.error('Subscribe error:', error);
        return NextResponse.json({ error: 'Failed to subscribe' }, { status: 500 });
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

