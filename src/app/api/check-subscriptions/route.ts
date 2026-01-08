import { NextRequest, NextResponse } from 'next/server';
import { getDatabase } from '@/lib/mongodb';

// Debug endpoint to check subscriptions
export async function GET(req: NextRequest) {
    try {
        const db = await getDatabase();
        const subscriptions = await db.collection('subscriptions').find({}).toArray();
        return NextResponse.json({ 
            count: subscriptions.length,
            subscriptions: subscriptions,
            collection: 'subscriptions'
        });
    } catch (error: any) {
        return NextResponse.json({ 
            error: 'Failed to get subscriptions',
            details: error.message,
            stack: error.stack
        }, { status: 500 });
    }
}


