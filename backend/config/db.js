const { MongoClient, ServerApiVersion } = require('mongodb');

const uri = process.env.MONGODB_URI || "mongodb://localhost:27017/jobtracker";
const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  }
});

let db;
let applicationsCollection;
let usersCollection;

async function initMongoDB() {
  try {
    await client.connect();
    db = client.db(process.env.DB_NAME || "jobtracker");
    applicationsCollection = db.collection("applications");
    usersCollection = db.collection("users");

    // Indexes for applications
    await applicationsCollection.createIndex({ userId: 1, createdAt: -1 });
    await applicationsCollection.createIndex({ userId: 1, company: 1, position: 1, jobUrl: 1 });

    // Indexes for users
    await usersCollection.createIndex({ email: 1 }, { unique: true });
    await usersCollection.createIndex({ apiKey: 1 }, { unique: true, sparse: true });

    return db;
  } catch (error) {
    console.error("MongoDB connection error:", error);
    process.exit(1);
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

module.exports = {
  client,
  initMongoDB,
  getDb,
  getApplicationsCollection,
  getUsersCollection,
};
