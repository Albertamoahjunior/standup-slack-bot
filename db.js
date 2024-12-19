const { MongoClient, ServerApiVersion } = require('mongodb');
require('dotenv').config(); 

const uri = `mongodb+srv://${process.env.MONGO_USER}:${process.env.MONGO_PASSWORD}@tech-titan.9arc1.mongodb.net/?retryWrites=true&w=majority&appName=tech-titan`;

const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  },
});

const databaseConnection = async () => {
  if (!client.isConnected?.()) {
    try {
      await client.connect();
      console.log('Connected to the MongoDB server');
    } catch (err) {
      console.error('Error connecting to MongoDB:', err);
      throw err;
    }
  }
  return client.db('tech-titan');
};

process.on('SIGINT', async () => {
  await client.close();
  console.log('MongoDB connection closed');
  process.exit(0);
});

module.exports = databaseConnection;
