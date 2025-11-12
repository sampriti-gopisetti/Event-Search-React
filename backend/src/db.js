const { MongoClient } = require('mongodb')

let client
let db

async function connect() {
  if (db) return db
  const uri = process.env.MONGODB_URI
  if (!uri) throw new Error('MONGODB_URI missing')
  client = new MongoClient(uri)
  await client.connect()
  const dbName = process.env.MONGODB_DB || 'hw3'
  db = client.db(dbName)
  await db.collection('favorites').createIndex({ userId: 1, eventId: 1 }, { unique: true })
  await db.collection('favorites').createIndex({ userId: 1, createdAt: 1 })
  return db
}

async function getCollection(name) {
  const d = await connect()
  return d.collection(name)
}

module.exports = { connect, getCollection }
