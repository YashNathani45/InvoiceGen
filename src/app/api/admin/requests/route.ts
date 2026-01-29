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
            id: req.requestId || req._id,
            invoiceNo: req.invoiceNo,
            customerName: req.customerName,
            amount: req.amount,
            propertyName: req.propertyName,
            status: req.status,
            createdAt: req.createdAt,
            respondedAt: req.respondedAt
        }));

        console.log('Admin requests - returning:', formattedRequests.length, 'requests');
        return NextResponse.json({ requests: formattedRequests });
    } catch (error: any) {
        console.error('Error fetching admin requests:', error);
        return NextResponse.json({ 
            requests: [],
            error: 'Failed to fetch requests',
            details: error.message 
        }, { status: 500 });
    }
}

