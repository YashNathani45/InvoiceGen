import { NextRequest, NextResponse } from 'next/server';
import { kv } from '@vercel/kv';

const SUBSCRIPTIONS_KEY = 'push_subscriptions';

async function getSubscriptions(): Promise<any[]> {
    try {
        // Check if KV is configured
        if (!process.env.KV_REST_API_URL || !process.env.KV_REST_API_TOKEN) {
            console.error('KV environment variables not set!');
            console.error('KV_REST_API_URL:', process.env.KV_REST_API_URL ? 'set' : 'missing');
            console.error('KV_REST_API_TOKEN:', process.env.KV_REST_API_TOKEN ? 'set' : 'missing');
            throw new Error('KV not configured - missing environment variables');
        }
        
        const subs = await kv.get<any[]>(SUBSCRIPTIONS_KEY);
        console.log('Retrieved subscriptions from KV:', subs ? subs.length : 0);
        return subs || [];
    } catch (error: any) {
        console.error('Error getting subscriptions:', error);
        console.error('KV error details:', error.message, error.stack);
        throw error; // Re-throw so caller knows it failed
    }
}

async function saveSubscriptions(subs: any[]): Promise<void> {
    try {
        console.log('Saving subscriptions to KV:', { key: SUBSCRIPTIONS_KEY, count: subs.length });
        await kv.set(SUBSCRIPTIONS_KEY, subs);
        // Verify it was saved
        const verified = await kv.get<any[]>(SUBSCRIPTIONS_KEY);
        console.log('Verified saved subscriptions:', verified ? verified.length : 0);
        if (!verified || verified.length !== subs.length) {
            throw new Error(`Subscription save verification failed. Expected ${subs.length}, got ${verified?.length || 0}`);
        }
    } catch (error: any) {
        console.error('Error saving subscriptions:', error);
        console.error('Error details:', error.message, error.stack);
        throw error;
    }
}

export async function POST(req: NextRequest) {
    try {
        const subscription = await req.json();

        if (!subscription || !subscription.endpoint) {
            return NextResponse.json({ 
                error: 'Invalid subscription data',
                details: 'Missing endpoint'
            }, { status: 400 });
        }

        console.log('Received subscription:', { endpoint: subscription.endpoint });

        let subs: any[] = [];
        try {
            subs = await getSubscriptions();
            console.log('Current subscriptions count:', subs.length);
        } catch (error: any) {
            console.error('Failed to get existing subscriptions:', error);
            // If KV is not configured, return helpful error
            if (error.message?.includes('KV not configured')) {
                return NextResponse.json({ 
                    error: 'Database not configured',
                    details: 'Upstash Redis (KV) environment variables are missing. Please check Vercel environment variables.',
                    hint: 'Set KV_REST_API_URL, KV_REST_API_TOKEN, and KV_REST_API_READ_ONLY_TOKEN'
                }, { status: 500 });
            }
            // For other errors, try to continue (might be first subscription)
            console.warn('Continuing despite error...');
        }

        // Check if already exists
        const exists = subs.some(s => s.endpoint === subscription.endpoint);
        if (!exists) {
            subs.push(subscription);
            console.log('Adding new subscription. Total will be:', subs.length);
            try {
                await saveSubscriptions(subs);
                console.log('✅ Subscription saved successfully. New count:', subs.length);
                
                // Double-check it was saved
                const verifySubs = await getSubscriptions();
                console.log('Double-check: subscriptions in KV:', verifySubs.length);
                
                return NextResponse.json({ 
                    success: true, 
                    count: subs.length,
                    verified: verifySubs.length 
                });
            } catch (error: any) {
                console.error('❌ Failed to save subscription:', error);
                return NextResponse.json({ 
                    error: 'Failed to save subscription',
                    details: error.message,
                    hint: 'Check KV environment variables in Vercel'
                }, { status: 500 });
            }
        } else {
            console.log('Subscription already exists');
            return NextResponse.json({ success: true, count: subs.length, alreadyExists: true });
        }
    } catch (error: any) {
        console.error('Subscribe error:', error);
        return NextResponse.json({ 
            error: 'Failed to subscribe', 
            details: error.message,
            stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
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

