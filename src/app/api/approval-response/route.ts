import { NextRequest, NextResponse } from 'next/server';
import { getDatabase } from '@/lib/mongodb';

export async function POST(req: NextRequest) {
    try {
        const { requestId, approved } = await req.json();

        const db = await getDatabase();

        await db.collection('approval_requests').updateOne(
            { requestId },
            {
                $set: {
                    status: approved ? 'approved' : 'rejected',
                    respondedAt: new Date(),
                },
            }
        );

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

        const db = await getDatabase();
        const request = await db.collection('approval_requests').findOne({ requestId });

    if (!request) {
        return NextResponse.json({ status: 'not_found' });
    }

    return NextResponse.json({ status: request.status });
    } catch (error) {
        console.error('Approval status error:', error);
        return NextResponse.json({ status: 'error' }, { status: 500 });
    }
}

