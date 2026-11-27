const { MongoClient, ServerApiVersion } = require('mongodb');

const uri = process.env.MONGODB_URI || 'mongodb://localhost:27017/jobtracker';
const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  },
});

let db;
let applicationsCollection;
let usersCollection;
let interviewsCollection;

async function initMongoDB() {
  try {
    await client.connect();
    db = client.db(process.env.DB_NAME || 'jobtracker');
    applicationsCollection = db.collection('applications');
    usersCollection = db.collection('users');
    interviewsCollection = db.collection('interviews');

    // Indexes for applications
    await applicationsCollection.createIndex({ userId: 1, createdAt: -1 });
    await applicationsCollection.createIndex({ userId: 1, id: 1 }, { unique: true });
    await applicationsCollection.createIndex({ userId: 1, company: 1, position: 1, jobUrl: 1 });

    // Indexes for interviews
    await interviewsCollection.createIndex({ userId: 1, date: 1, time: 1 });
    await interviewsCollection.createIndex({ userId: 1, id: 1 }, { unique: true });

    // Indexes for users
    await usersCollection.createIndex({ email: 1 }, { unique: true });
    await usersCollection.createIndex({ id: 1 }, { unique: true });
    await usersCollection.createIndex({ apiKey: 1 }, { unique: true, sparse: true });

    return db;
  } catch (error) {
    console.error('MongoDB connection error:', error);
    if (process.env.NODE_ENV !== 'test') {
      process.exit(1);
    }
    throw error;
  }
}

function getDb() {
  return db;
}

function getApplicationsCollection() {
  return applicationsCollection;
}

function getUsersCollection() {
  return usersCollection;
}

function getInterviewsCollection() {
  return interviewsCollection;
}

module.exports = {
  client,
  initMongoDB,
  getDb,
  getApplicationsCollection,
  getUsersCollection,
  getInterviewsCollection,
};
