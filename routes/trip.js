const express = require("express");
const router = express.Router();
const rateLimit = require("express-rate-limit");
const wrapAsync = require("../utility/wrapAsync");
const tripController = require("../controllers/trip");
const { isLoggedIn, validateTripGenerate, isTripOwner } = require("../middleware");

// Rate limiting for AI trip generation endpoint
const tripGenerationLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 30, // limit each IP to 30 trip generations per 15 mins
    message: {
        success: false,
        message: "You have generated several trips recently. Please wait a few minutes before generating more."
    },
    standardHeaders: true,
    legacyHeaders: false,
    skip: () => process.env.NODE_ENV === "test"
});

// Trip Planner Form Page
router.get("/plan", wrapAsync(tripController.renderPlanner));

// AI Trip Generation
router.post(
    "/generate",
    tripGenerationLimiter,
    validateTripGenerate,
    wrapAsync(tripController.generateTrip)
);

// Preview currently generated itinerary before saving
router.get("/preview", wrapAsync(tripController.previewTrip));

// Save generated trip to user account
router.post("/save", isLoggedIn, wrapAsync(tripController.saveTrip));

// My Trips Dashboard (List of user's saved trips)
router.get("/", isLoggedIn, wrapAsync(tripController.indexTrips));

// View a specific saved trip
router.get("/:id", isLoggedIn, isTripOwner, wrapAsync(tripController.showTrip));

// Delete a saved trip
router.delete("/:id", isLoggedIn, isTripOwner, wrapAsync(tripController.deleteTrip));

module.exports = router;
