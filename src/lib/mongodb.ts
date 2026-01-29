import { MongoClient, Db } from 'mongodb';

if (!process.env.MONGODB_URI) {
    throw new Error('Please add your Mongo URI to .env.local');
}

const uri = process.env.MONGODB_URI;
const options = {
    // Better SSL/TLS handling
    tls: true,
    tlsAllowInvalidCertificates: false,
    // Connection pool settings
    maxPoolSize: 10,
    minPoolSize: 1,
    // Timeout settings
    connectTimeoutMS: 30000,
    serverSelectionTimeoutMS: 30000,
    socketTimeoutMS: 30000,
    // Retry settings
    retryWrites: true,
    retryReads: true,
};

// Use a global variable to cache the connection across serverless function invocations
// This is critical for serverless environments like Vercel
let globalWithMongo = global as typeof globalThis & {
    _mongoClientPromise?: Promise<MongoClient>;
};

let clientPromise: Promise<MongoClient>;

if (!globalWithMongo._mongoClientPromise) {
    const client = new MongoClient(uri, options);
    globalWithMongo._mongoClientPromise = client.connect().catch((error) => {
        console.error('MongoDB connection error:', error);
        // Reset the promise so it can be retried
        globalWithMongo._mongoClientPromise = undefined;
        throw error;
    });
}

clientPromise = globalWithMongo._mongoClientPromise;

export async function getDatabase(): Promise<Db> {
    try {
        const client = await clientPromise;
        // Test the connection
        await client.db('admin').command({ ping: 1 });
        const db = client.db('invoice_app');
        
        // Log database name for debugging (only in development)
        if (process.env.NODE_ENV === 'development') {
            console.log('Connected to database: invoice_app');
        }
        
        return db;
    } catch (error: any) {
        console.error('Error getting database:', error);
        console.error('MongoDB URI configured:', process.env.MONGODB_URI ? 'Yes' : 'No');
        throw new Error(`MongoDB connection failed: ${error.message}`);
    }
}

export default clientPromise;

