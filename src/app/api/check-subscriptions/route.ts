import { NextRequest, NextResponse } from 'next/server';
import { kv } from '@vercel/kv';

const SUBSCRIPTIONS_KEY = 'push_subscriptions';

// Debug endpoint to check subscriptions
export async function GET(req: NextRequest) {
    try {
        const subs = await kv.get<any[]>(SUBSCRIPTIONS_KEY);
        return NextResponse.json({ 
            count: subs ? subs.length : 0,
            subscriptions: subs || [],
            key: SUBSCRIPTIONS_KEY
        });
    } catch (error: any) {
        return NextResponse.json({ 
            error: 'Failed to get subscriptions',
            details: error.message,
            stack: error.stack
        }, { status: 500 });
    }
}


