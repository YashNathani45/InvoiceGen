import { NextRequest, NextResponse } from 'next/server';
import { getDatabase } from '@/lib/mongodb';

// Test endpoint to check MongoDB configuration
export async function GET(req: NextRequest) {
    const envCheck = {
        MONGODB_URI: process.env.MONGODB_URI ? '✅ Set' : '❌ Missing',
    };

    // Try to connect to MongoDB
    let mongoTest = 'Not tested';
    try {
        const db = await getDatabase();
        // Try a simple operation
        await db.collection('test').findOne({});
        mongoTest = '✅ MongoDB connection successful';
    } catch (error: any) {
        // If collection doesn't exist, that's fine - connection worked
        if (error.message?.includes('not found') || error.code === 26) {
            mongoTest = '✅ MongoDB connection successful (test collection not found is expected)';
        } else {
            mongoTest = `❌ MongoDB connection failed: ${error.message}`;
        }
    }

    return NextResponse.json({
        environment: process.env.NODE_ENV,
        environmentVariables: envCheck,
        mongoConnection: mongoTest,
        timestamp: new Date().toISOString()
    });
}

