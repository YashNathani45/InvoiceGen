import { NextRequest, NextResponse } from 'next/server';
import { kv } from '@vercel/kv';

const PENDING_KEY = 'pending_approvals';

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
        const { requestId, approved } = await req.json();

        const pending = await getPending();

        if (pending[requestId]) {
            pending[requestId].status = approved ? 'approved' : 'rejected';
            pending[requestId].respondedAt = new Date().toISOString();
            await savePending(pending);
        }

        return NextResponse.json({ success: true, status: approved ? 'approved' : 'rejected' });
    } catch (error) {
        console.error('Approval response error:', error);
        return NextResponse.json({ error: 'Failed to process response' }, { status: 500 });
    }
}

// Check approval status (polling endpoint)
export async function GET(req: NextRequest) {
    try {
        const requestId = req.nextUrl.searchParams.get('requestId');

        if (!requestId) {
            return NextResponse.json({ error: 'Missing requestId' }, { status: 400 });
        }

        const pending = await getPending();
        const request = pending[requestId];

        if (!request) {
            return NextResponse.json({ status: 'not_found' });
        }

        return NextResponse.json({ status: request.status });
    } catch (error) {
        console.error('Get approval status error:', error);
        return NextResponse.json({ error: 'Failed to get status' }, { status: 500 });
    }
}

