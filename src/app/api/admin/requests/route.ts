import { NextResponse } from 'next/server';
import { getDatabase } from '@/lib/mongodb';

async function getAllRequests(): Promise<any[]> {
    try {
        const db = await getDatabase();
        console.log('Fetching requests from database:', db.databaseName, 'collection: approval_requests');
        
        const requests = await db.collection('approval_requests')
            .find({})
            .sort({ createdAt: -1 })
            .toArray();
        
        console.log('Found', requests.length, 'requests in database');
        return requests;
    } catch (error: any) {
        console.error('Error getting requests:', error);
        console.error('Error details:', {
            message: error.message,
            stack: error.stack,
            name: error.name
        });
        return [];
    }
}

export async function GET() {
    try {
        const requests = await getAllRequests();
        console.log('Admin requests - total:', requests.length);

        // Map MongoDB documents to expected format
        const formattedRequests = requests.map((req: any) => ({
            id: req.requestId || req._id?.toString() || String(req._id),
            invoiceNo: req.invoiceNo,
            customerName: req.customerName,
            amount: req.amount,
            propertyName: req.propertyName,
            status: req.status,
            createdAt: req.createdAt ? (req.createdAt instanceof Date ? req.createdAt.toISOString() : req.createdAt) : new Date().toISOString(),
            respondedAt: req.respondedAt ? (req.respondedAt instanceof Date ? req.respondedAt.toISOString() : req.respondedAt) : undefined
        }));

        console.log('Admin requests - returning:', formattedRequests.length, 'requests');
        
        // Prevent caching to ensure fresh data
        return NextResponse.json({ requests: formattedRequests }, {
            headers: {
                'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate',
                'Pragma': 'no-cache',
                'Expires': '0',
            }
        });
    } catch (error: any) {
        console.error('Error fetching admin requests:', error);
        return NextResponse.json({ 
            requests: [],
            error: 'Failed to fetch requests',
            details: error.message 
        }, { status: 500 });
    }
}

