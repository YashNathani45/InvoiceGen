import { NextRequest, NextResponse } from 'next/server';
import { kv } from '@vercel/kv';

// Test endpoint to check KV configuration
export async function GET(req: NextRequest) {
    const envCheck = {
        KV_REST_API_URL: process.env.KV_REST_API_URL ? '✅ Set' : '❌ Missing',
        KV_REST_API_TOKEN: process.env.KV_REST_API_TOKEN ? '✅ Set' : '❌ Missing',
        KV_REST_API_READ_ONLY_TOKEN: process.env.KV_REST_API_READ_ONLY_TOKEN ? '✅ Set' : '❌ Missing',
    };

    // Try to connect to KV
    let kvTest = 'Not tested';
    try {
        await kv.get('test_key');
        kvTest = '✅ KV connection successful';
    } catch (error: any) {
        kvTest = `❌ KV connection failed: ${error.message}`;
    }

    return NextResponse.json({
        environment: process.env.NODE_ENV,
        environmentVariables: envCheck,
        kvConnection: kvTest,
        timestamp: new Date().toISOString()
    });
}

