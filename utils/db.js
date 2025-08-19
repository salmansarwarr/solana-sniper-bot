// utils/db.js
const { MongoClient } = require("mongodb");
require('dotenv').config();

const uri = process.env.MONGO_URI;
const client = new MongoClient(uri);

let db;

async function connectDB() {
    if (!db) {
        await client.connect();
        db = client.db(process.env.MONGO_DB || "solanaBot");
        console.log("✅ Connected to MongoDB");
    }
    return db;
}

async function savePurchase(tokenMint, amount, decimals) {
    const database = await connectDB();
    const purchases = database.collection("purchases");
    const result = await purchases.insertOne({
        tokenMint,
        amount,
        decimals,
        timestamp: new Date(),
        firstSell: false,
        secondSell: false,
        purchasePrice: null, 
        targetPrice: null  
    });
    console.log(
        `📦 Saved purchase ${tokenMint}, amount: ${amount}, decimals: ${decimals}`
    );
    return result.insertedId;
}

async function getPurchases(limit = 50) {
    const database = await connectDB();
    return database
        .collection("purchases")
        .find({})
        .sort({ timestamp: -1 })
        .limit(limit)
        .toArray();
}

async function getTokensForFirstSell(limit = 50) {
    const database = await connectDB();
    return database
        .collection("purchases")
        .find({ firstSell: false })
        .limit(limit)
        .toArray();
}

async function markFirstSell(tokenMint, tp) {
    const database = await connectDB();
    const result = await database
        .collection("purchases")
        .updateOne(
            { tokenMint: tokenMint },
            { $set: { firstSell: true, firstSellTimestamp: new Date(), targetPrice: tp } }
        );
    
    if (result.matchedCount === 0) {
        console.log(`⚠️ No document found to mark first sell for ${tokenMint}`);
    } else {
        console.log(`✅ Successfully marked first sell for ${tokenMint}`);
    }
    
    return result;
}

module.exports = {
    connectDB,
    savePurchase,
    getPurchases,
    getTokensForFirstSell,
    markFirstSell,
};
