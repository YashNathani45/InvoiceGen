import { NextRequest, NextResponse } from 'next/server';
import { getDatabase } from '@/lib/mongodb';

async function getPendingRequest(requestId: string): Promise<any> {
    try {
        const db = await getDatabase();
        const request = await db.collection('approval_requests').findOne({ requestId: requestId });
        return request;
    } catch (error: any) {
        console.error('Error getting pending request:', error);
        return null;
    }
}

async function updatePendingRequest(requestId: string, updates: any): Promise<void> {
    try {
        const db = await getDatabase();
        await db.collection('approval_requests').updateOne(
            { requestId: requestId },
            { $set: updates }
        );
    } catch (error: any) {
        console.error('Error updating pending request:', error);
        throw error;
    }
}

export async function POST(req: NextRequest) {
    try {
        const { requestId, approved } = await req.json();

        console.log('Approval response received:', { requestId, approved });

        if (!requestId) {
            return NextResponse.json({ error: 'Missing requestId' }, { status: 400 });
        }

        const request = await getPendingRequest(requestId);

        if (request) {
            await updatePendingRequest(requestId, {
                status: approved ? 'approved' : 'rejected',
                respondedAt: new Date().toISOString()
            });
            console.log('✅ Approval status updated:', { requestId, status: approved ? 'approved' : 'rejected' });
        } else {
            console.warn('⚠️ Request ID not found in MongoDB:', requestId);
            return NextResponse.json({ error: 'Request not found' }, { status: 404 });
        }

        return NextResponse.json({ success: true, status: approved ? 'approved' : 'rejected' });
    } catch (error: any) {
        console.error('Approval response error:', error);
        return NextResponse.json({ 
            error: 'Failed to process response',
            details: error.message 
        }, { status: 500 });
    }
}

// Check approval status (polling endpoint)
export async function GET(req: NextRequest) {
    try {
        const requestId = req.nextUrl.searchParams.get('requestId');

        if (!requestId) {
            return NextResponse.json({ error: 'Missing requestId' }, { status: 400 });
        }

        const request = await getPendingRequest(requestId);

        if (!request) {
            console.log('Request not found:', requestId);
            return NextResponse.json({ status: 'not_found' });
        }

        console.log('Status check for requestId:', requestId, 'status:', request.status);
        return NextResponse.json({ status: request.status });
    } catch (error: any) {
        console.error('Get approval status error:', error);
        return NextResponse.json({ error: 'Failed to get status', details: error.message }, { status: 500 });
    }
}

