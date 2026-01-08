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

let client: MongoClient;
let clientPromise: Promise<MongoClient>;

if (process.env.NODE_ENV === 'development') {
    // In development mode, use a global variable so that the value
    // is preserved across module reloads caused by HMR (Hot Module Replacement).
    let globalWithMongo = global as typeof globalThis & {
        _mongoClientPromise?: Promise<MongoClient>;
    };

    if (!globalWithMongo._mongoClientPromise) {
        client = new MongoClient(uri, options);
        globalWithMongo._mongoClientPromise = client.connect().catch((error) => {
            console.error('MongoDB connection error:', error);
            // Reset the promise so it can be retried
            globalWithMongo._mongoClientPromise = undefined;
            throw error;
        });
    }
    clientPromise = globalWithMongo._mongoClientPromise;
} else {
    // In production mode, it's best to not use a global variable.
    client = new MongoClient(uri, options);
    clientPromise = client.connect().catch((error) => {
        console.error('MongoDB connection error:', error);
        throw error;
    });
}

export async function getDatabase(): Promise<Db> {
    try {
        const client = await clientPromise;
        // Test the connection
        await client.db('admin').command({ ping: 1 });
        return client.db('invoice_app');
    } catch (error: any) {
        console.error('Error getting database:', error);
        throw new Error(`MongoDB connection failed: ${error.message}`);
    }
}

export default clientPromise;

