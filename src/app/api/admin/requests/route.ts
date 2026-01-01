import { NextResponse } from 'next/server';
import { kv } from '@vercel/kv';

const PENDING_KEY = 'pending_approvals';

async function getPending(): Promise<Record<string, any>> {
    try {
        const pending = await kv.get<Record<string, any>>(PENDING_KEY);
        return pending || {};
    } catch (error: any) {
        console.error('Error getting pending requests:', error);
        // For local development, return empty if KV is not configured
        if (error.message?.includes('Missing required environment variables')) {
            console.warn('KV not configured for local development. Returning empty requests.');
            return {};
        }
        throw error;
    }
}

export async function GET() {
    try {
        const pending = await getPending();

        // Convert to array and sort by date (newest first)
        const requests = Object.entries(pending).map(([id, data]: [string, any]) => ({
            id,
            ...data
        })).sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

        return NextResponse.json({ requests });
    } catch (error: any) {
        console.error('Error fetching admin requests:', error);
        return NextResponse.json({ 
            requests: [],
            error: 'Failed to fetch requests',
            details: error.message 
        }, { status: 500 });
    }
}

