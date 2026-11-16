const request = require("supertest");
const mongoose = require("mongoose");
const { MongoMemoryServer } = require("mongodb-memory-server");
const Trip = require("../modals/trip");
const User = require("../modals/user");

jest.setTimeout(45000);

let mongoServer;
let app;

beforeAll(async () => {
    mongoServer = await MongoMemoryServer.create();
    const uri = mongoServer.getUri();
    process.env.MONGODB_ATLAS = uri;
    process.env.SECRET = "yoursupersecrettestkeyfortesting";
    process.env.NODE_ENV = "test";
    
    await mongoose.connect(uri);
    app = require("../app");
}, 45000);

afterAll(async () => {
    await mongoose.disconnect();
    await mongoServer.stop();
}, 45000);

describe("AI Trip Planner Routes & Auth Tests", () => {
    let userCookie;
    let otherUserCookie;
    let testUser;
    let otherUser;

    beforeEach(async () => {
        await Trip.deleteMany({});
        await User.deleteMany({});

        // Signup primary test user
        const resA = await request(app)
            .post("/signup")
            .type("form")
            .send({ username: "traveler", email: "traveler@example.com", password: "password123" });
        userCookie = resA.headers["set-cookie"];
        testUser = await User.findOne({ username: "traveler" });

        // Signup second user for ownership verification
        const resB = await request(app)
            .post("/signup")
            .type("form")
            .send({ username: "other traveler", email: "other@example.com", password: "password123" });
        otherUserCookie = resB.headers["set-cookie"];
        otherUser = await User.findOne({ username: "other traveler" });

        await User.updateMany({}, { emailVerified: true });
    });

    test("GET /trips/plan - Renders trip preferences form with optional prefilled destination", async () => {
        const res = await request(app).get("/trips/plan?destination=Manali");
        expect(res.status).toBe(200);
        expect(res.text).toContain("Personalized AI Trip Planner");
        expect(res.text).toContain("Manali");
        expect(res.text).toContain("Adventure");
        expect(res.text).toContain("Famous Places");
    });

    test("POST /trips/generate - Validates inputs and rejects invalid dates", async () => {
        const invalidRes = await request(app)
            .post("/trips/generate")
            .send({
                destination: "Goa",
                checkIn: "2026-12-10",
                checkOut: "2026-12-05" // Before check-in
            });

        expect(invalidRes.status).toBe(302); // Redirect back with flash error
    });

    test("POST /trips/generate - Generates itinerary and returns JSON or redirect", async () => {
        const res = await request(app)
            .post("/trips/generate")
            .set("Accept", "application/json")
            .send({
                destination: "Manali",
                checkIn: "2026-12-10",
                checkOut: "2026-12-13",
                preferences: ["Adventure", "Nature"],
                budget: "Moderate",
                pace: "Balanced"
            });

        expect(res.status).toBe(200);
        expect(res.body.success).toBe(true);
        expect(res.body.trip).toBeTruthy();
        expect(res.body.trip.days.length).toBeGreaterThan(0);
        expect(res.body.trip.days[0].places[0].googleMapsUrl).toContain("google.com/maps");
    });

    test("POST /trips/save - Requires authentication and saves trip for logged-in user", async () => {
        // Unauthenticated attempt
        const unauthRes = await request(app)
            .post("/trips/save")
            .send({
                tripData: {
                    destination: "Jaipur",
                    checkIn: "2026-12-10",
                    checkOut: "2026-12-12",
                    days: [{ dayNumber: 1, theme: "Heritage", places: [] }]
                }
            });

        expect(unauthRes.status).toBe(302);
        expect(unauthRes.headers.location).toBe("/login");

        // Authenticated save
        const authRes = await request(app)
            .post("/trips/save")
            .set("Cookie", userCookie)
            .send({
                tripData: {
                    destination: "Jaipur",
                    checkIn: "2026-12-10",
                    checkOut: "2026-12-12",
                    totalDays: 2,
                    preferences: ["Heritage", "Culture"],
                    budget: "Moderate",
                    pace: "Balanced",
                    days: [
                        {
                            dayNumber: 1,
                            theme: "Royal Forts",
                            places: [
                                {
                                    name: "Amber Palace",
                                    location: "Amer, Jaipur",
                                    shortDescription: "Majestic hilltop fort-palace",
                                    importance: "UNESCO World Heritage Site",
                                    speciality: "Sheesh Mahal mirror mosaics",
                                    bestTimeToVisit: "Morning",
                                    explorationDuration: "2 - 3 hours",
                                    arrivalTime: "09:00 AM",
                                    departureTime: "12:00 PM",
                                    coordinates: [75.8513, 26.9855],
                                    googleMapsUrl: "https://www.google.com/maps/dir/?api=1&destination=26.9855,75.8513&travelmode=driving"
                                }
                            ]
                        }
                    ]
                }
            });

        expect(authRes.status).toBe(200);
        expect(authRes.body.success).toBe(true);
        expect(authRes.body.redirectUrl).toContain("/trips/");
        const savedTrip = await Trip.findOne({ destination: "Jaipur", user: testUser._id });
        expect(savedTrip).toBeTruthy();
        expect(savedTrip.days[0].places[0].name).toBe("Amber Palace");
    });

    test("GET /trips - Lists user's saved trips only", async () => {
        // Create trip for testUser
        await Trip.create({
            user: testUser._id,
            destination: "Paris",
            checkIn: new Date("2026-12-01"),
            checkOut: new Date("2026-12-05"),
            totalDays: 4,
            preferences: ["Culture", "Food"],
            days: []
        });

        // Create trip for otherUser
        await Trip.create({
            user: otherUser._id,
            destination: "Tokyo",
            checkIn: new Date("2026-12-01"),
            checkOut: new Date("2026-12-05"),
            totalDays: 4,
            preferences: ["Famous Places"],
            days: []
        });

        const res = await request(app)
            .get("/trips")
            .set("Cookie", userCookie);

        expect(res.status).toBe(200);
        expect(res.text).toContain("Paris");
        expect(res.text).not.toContain("Tokyo");
    });

    test("GET /trips/:id & DELETE /trips/:id - Ownership authorization", async () => {
        const trip = await Trip.create({
            user: testUser._id,
            destination: "Ooty",
            checkIn: new Date("2026-12-10"),
            checkOut: new Date("2026-12-12"),
            totalDays: 2,
            days: [
                {
                    dayNumber: 1,
                    theme: "Nature",
                    places: [
                        {
                            name: "Ooty Lake",
                            location: "Ooty",
                            coordinates: [76.6948, 11.4064],
                            googleMapsUrl: "https://www.google.com/maps/dir/?api=1&destination=11.4064,76.6948&travelmode=driving"
                        }
                    ]
                }
            ]
        });

        // Other user attempts to view trip -> unauthorized redirect
        const otherViewRes = await request(app)
            .get(`/trips/${trip._id}`)
            .set("Cookie", otherUserCookie);
        expect(otherViewRes.status).toBe(302);
        expect(otherViewRes.headers.location).toBe("/trips");

        // Owner views trip -> 200 with place details and Google Maps button
        const ownerViewRes = await request(app)
            .get(`/trips/${trip._id}`)
            .set("Cookie", userCookie);
        expect(ownerViewRes.status).toBe(200);
        expect(ownerViewRes.text).toContain("Ooty Lake");
        expect(ownerViewRes.text).toContain("Navigate with Google Maps");

        // Other user attempts to delete trip -> unauthorized redirect
        const otherDeleteRes = await request(app)
            .delete(`/trips/${trip._id}`)
            .set("Cookie", otherUserCookie);
        expect(otherDeleteRes.status).toBe(302);
        expect(await Trip.findById(trip._id)).toBeTruthy();

        // Owner deletes trip -> success
        const ownerDeleteRes = await request(app)
            .delete(`/trips/${trip._id}`)
            .set("Cookie", userCookie);
        expect(ownerDeleteRes.status).toBe(302);
        expect(await Trip.findById(trip._id)).toBeNull();
    });
});
