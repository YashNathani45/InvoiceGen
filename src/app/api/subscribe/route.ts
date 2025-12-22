import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';

const SUBSCRIPTIONS_FILE = path.join(process.cwd(), 'subscriptions.json');

function getSubscriptions(): any[] {
    try {
        if (fs.existsSync(SUBSCRIPTIONS_FILE)) {
            return JSON.parse(fs.readFileSync(SUBSCRIPTIONS_FILE, 'utf-8'));
        }
    } catch { }
    return [];
}

function saveSubscriptions(subs: any[]) {
    fs.writeFileSync(SUBSCRIPTIONS_FILE, JSON.stringify(subs, null, 2));
}

export async function POST(req: NextRequest) {
    try {
        const subscription = await req.json();

        const subs = getSubscriptions();

        // Check if already exists
        const exists = subs.some(s => s.endpoint === subscription.endpoint);
        if (!exists) {
            subs.push(subscription);
            saveSubscriptions(subs);
        }

        return NextResponse.json({ success: true });
    } catch (error) {
        console.error('Subscribe error:', error);
        return NextResponse.json({ error: 'Failed to subscribe' }, { status: 500 });
    }
}

export async function DELETE(req: NextRequest) {
    try {
        const { endpoint } = await req.json();

        let subs = getSubscriptions();
        subs = subs.filter(s => s.endpoint !== endpoint);
        saveSubscriptions(subs);

        return NextResponse.json({ success: true });
    } catch (error) {
        return NextResponse.json({ error: 'Failed to unsubscribe' }, { status: 500 });
    }
}

