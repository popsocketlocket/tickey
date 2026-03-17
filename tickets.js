const { MongoClient, ObjectId } = require("mongodb");

const MONGODB_URI = process.env.MONGODB_URI;
const API_SECRET = process.env.API_SECRET;
const DB_NAME = "tickr";
const COLLECTION = "tickets";

let cachedClient = null;

async function getDb() {
  if (!cachedClient) {
    cachedClient = new MongoClient(MONGODB_URI);
    await cachedClient.connect();
  }
  return cachedClient.db(DB_NAME).collection(COLLECTION);
}

function unauthorized() {
  return {
    statusCode: 401,
    body: JSON.stringify({ error: "Unauthorized" }),
  };
}

function respond(statusCode, body) {
  return {
    statusCode,
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  };
}

exports.handler = async (event) => {
  // Auth check — every request must carry the secret
  const authHeader = event.headers["x-api-secret"];
  if (!API_SECRET || authHeader !== API_SECRET) return unauthorized();

  const col = await getDb();
  const method = event.httpMethod;

  // GET /api/tickets — list all tickets
  if (method === "GET") {
    const tickets = await col.find({}).sort({ createdAt: -1 }).toArray();
    return respond(200, tickets);
  }

  // POST /api/tickets — create a ticket
  if (method === "POST") {
    const ticket = JSON.parse(event.body);
    ticket.createdAt = Date.now();
    ticket.updatedAt = null;
    ticket.comments = ticket.comments || [];
    const result = await col.insertOne(ticket);
    return respond(201, { ...ticket, _id: result.insertedId });
  }

  // PATCH /api/tickets/:id — update a ticket
  if (method === "PATCH") {
    const id = event.path.split("/").pop();
    const updates = JSON.parse(event.body);
    updates.updatedAt = Date.now();
    await col.updateOne({ _id: new ObjectId(id) }, { $set: updates });
    return respond(200, { ok: true });
  }

  // DELETE /api/tickets/:id — delete a ticket permanently
  if (method === "DELETE") {
    const id = event.path.split("/").pop();
    await col.deleteOne({ _id: new ObjectId(id) });
    return respond(200, { ok: true });
  }

  return respond(405, { error: "Method not allowed" });
};
