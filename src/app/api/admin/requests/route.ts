import { NextResponse } from 'next/server';
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

export async function GET() {
    const pending = getPending();

    // Convert to array and sort by date (newest first)
    const requests = Object.entries(pending).map(([id, data]: [string, any]) => ({
        id,
        ...data
    })).sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

    return NextResponse.json({ requests });
}

