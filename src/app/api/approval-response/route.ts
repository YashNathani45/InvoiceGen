import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';

const PENDING_FILE = path.join(process.cwd(), 'pending-approvals.json');

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
        const { requestId, approved } = await req.json();

        const pending = getPending();

        if (pending[requestId]) {
            pending[requestId].status = approved ? 'approved' : 'rejected';
            pending[requestId].respondedAt = new Date().toISOString();
            savePending(pending);
        }

        return NextResponse.json({ success: true, status: approved ? 'approved' : 'rejected' });
    } catch (error) {
        return NextResponse.json({ error: 'Failed to process response' }, { status: 500 });
    }
}

// Check approval status (polling endpoint)
export async function GET(req: NextRequest) {
    const requestId = req.nextUrl.searchParams.get('requestId');

    if (!requestId) {
        return NextResponse.json({ error: 'Missing requestId' }, { status: 400 });
    }

    const pending = getPending();
    const request = pending[requestId];

    if (!request) {
        return NextResponse.json({ status: 'not_found' });
    }

    return NextResponse.json({ status: request.status });
}

