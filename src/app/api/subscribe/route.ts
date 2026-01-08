import { NextRequest, NextResponse } from 'next/server';
import { getDatabase } from '@/lib/mongodb';

async function getSubscriptions(): Promise<any[]> {
    try {
        const db = await getDatabase();
        const subscriptions = await db.collection('subscriptions').find({}).toArray();
        console.log('Retrieved subscriptions from MongoDB:', subscriptions.length);
        return subscriptions;
    } catch (error: any) {
        console.error('Error getting subscriptions:', error);
        throw error;
    }
}

async function saveSubscriptions(subs: any[]): Promise<void> {
    try {
        const db = await getDatabase();
        console.log('Saving subscriptions to MongoDB:', { count: subs.length });
        
        // Clear existing subscriptions and insert new ones
        await db.collection('subscriptions').deleteMany({});
        if (subs.length > 0) {
            await db.collection('subscriptions').insertMany(subs);
        }
        
        // Verify it was saved
        const verified = await db.collection('subscriptions').find({}).toArray();
        console.log('Verified saved subscriptions:', verified.length);
        if (verified.length !== subs.length) {
            throw new Error(`Subscription save verification failed. Expected ${subs.length}, got ${verified.length}`);
        }
    } catch (error: any) {
        console.error('Error saving subscriptions:', error);
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
                    hint: 'Check MongoDB connection string in environment variables'
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

