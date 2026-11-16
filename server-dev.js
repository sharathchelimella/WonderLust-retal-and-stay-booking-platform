require("dotenv").config();
const { MongoMemoryServer } = require("mongodb-memory-server");
const mongoose = require("mongoose");
const logger = require("./config/logger");
const initData = require("./init/data");
const Listing = require("./modals/listing");
const User = require("./modals/user");

let mongod;

async function startDevServer() {
    console.log("\n=======================================================");
    console.log("🚀 Starting Wanderlust with Local In-Memory MongoDB...");
    console.log("=======================================================");

    mongod = await MongoMemoryServer.create();
    const uri = mongod.getUri();
    process.env.MONGODB_ATLAS = uri;
    console.log(`📦 In-Memory MongoDB URI: ${uri}`);

    // Load Express app and connect
    const app = require("./app");
    const connectDB = require("./config/db");
    await connectDB();

    // Seed database
    console.log("🌱 Populating seed data...");
    const existingCount = await Listing.countDocuments();
    if (existingCount === 0) {
        // Create Wonderlust_host
        const hostUser = new User({
            username: "Wonderlust_host",
            email: "host@wanderlust.com",
            emailVerified: true
        });
        const registeredHost = await User.register(hostUser, "HostPass@2026");

        // Create guest_user
        const guestUser = new User({
            username: "guest_user",
            email: "guest@wanderlust.com",
            emailVerified: true
        });
        const registeredGuest = await User.register(guestUser, "GuestPass@2026");

        const listingsToInsert = initData.data.map((obj) => ({
            ...obj,
            owner: registeredHost._id,
            image: obj.image || (obj.images && obj.images[0]) || { url: "", filename: "listingimage" },
            images: obj.images && obj.images.length >= 5 ? obj.images : [
                obj.image,
                obj.image,
                obj.image,
                obj.image,
                obj.image
            ],
            reviews: [],
            country: obj.country || "India",
            geometry: obj.geometry || {
                type: "Point",
                coordinates: [78.4867, 17.3850]
            },
            category: obj.category || "Rooms"
        }));

        const inserted = await Listing.insertMany(listingsToInsert);
        console.log(`✅ Seeded ${inserted.length} sample listings.`);
        console.log(`👤 Seeded accounts:`);
        console.log(`   - Host:  username: "Wonderlust_host" | password: "HostPass@2026"`);
        console.log(`   - Guest: username: "guest_user"      | password: "GuestPass@2026"`);
    }

    const port = process.env.PORT || 8080;
    const server = app.listen(port, () => {
        console.log(`\n=======================================================`);
        console.log(`🌐 Server running! Open: http://localhost:${port}`);
        console.log(`=======================================================\n`);
    });

    process.on("SIGINT", async () => {
        console.log("\nShutting down dev server...");
        server.close();
        await mongoose.disconnect();
        if (mongod) await mongod.stop();
        process.exit(0);
    });
}

startDevServer().catch((err) => {
    console.error("❌ Failed to start dev server:", err);
    process.exit(1);
});
