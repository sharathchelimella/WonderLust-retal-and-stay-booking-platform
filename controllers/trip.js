const Trip = require("../modals/trip");
const Listing = require("../modals/listing");
const aiPlanner = require("../utility/aiPlanner");
const logger = require("../config/logger");

module.exports.renderPlanner = async (req, res) => {
    let { destination = "", listingId = "", checkIn = "", checkOut = "" } = req.query;

    if (listingId && !destination) {
        try {
            const listing = await Listing.findById(listingId).select("location country title");
            if (listing) {
                destination = `${listing.location}, ${listing.country}`;
            }
        } catch (e) {
            logger.warn(`Could not lookup listing ${listingId}: ${e.message}`);
        }
    }

    res.render("trips/plan.ejs", {
        destination,
        listingId,
        checkIn,
        checkOut,
        pageTitle: "AI Trip Planner"
    });
};

module.exports.generateTrip = async (req, res) => {
    try {
        let { destination, checkIn, checkOut, preferences, budget, pace } = req.body;

        // Normalize preferences to array
        let prefList = [];
        if (Array.isArray(preferences)) {
            prefList = preferences;
        } else if (typeof preferences === "string" && preferences.trim().length > 0) {
            prefList = preferences.split(",").map(p => p.trim()).filter(Boolean);
        }

        const tripData = await aiPlanner.generateTripItinerary({
            destination,
            checkIn,
            checkOut,
            preferences: prefList,
            budget: budget || "Moderate",
            pace: pace || "Balanced"
        });

        // Store temporarily in session for preview & saving
        req.session.generatedTrip = tripData;

        if (req.xhr || req.headers.accept?.includes("application/json") || req.is("json")) {
            return res.json({
                success: true,
                redirectUrl: "/trips/preview",
                trip: tripData
            });
        }

        return res.redirect("/trips/preview");
    } catch (err) {
        logger.error(`Trip generation error: ${err.message}\n${err.stack}`);
        if (req.xhr || req.headers.accept?.includes("application/json") || req.is("json")) {
            return res.status(500).json({
                success: false,
                message: err.message || "Failed to generate AI trip. Please try again."
            });
        }
        req.flash("error", err.message || "Failed to generate AI trip itinerary. Please try again.");
        return res.redirect("/trips/plan");
    }
};

module.exports.previewTrip = async (req, res) => {
    const trip = req.session.generatedTrip;
    if (!trip || !trip.days || trip.days.length === 0) {
        req.flash("error", "No generated trip found. Please enter your trip preferences to create one!");
        return res.redirect("/trips/plan");
    }

    res.render("trips/show.ejs", {
        trip,
        isSaved: false,
        mapToken: process.env.MAP_TOKEN || "",
        pageTitle: `${trip.destination} - AI Trip Itinerary`
    });
};

module.exports.saveTrip = async (req, res) => {
    try {
        let tripPayload = null;

        if (req.body.tripData) {
            tripPayload = typeof req.body.tripData === "string" 
                ? JSON.parse(req.body.tripData) 
                : req.body.tripData;
        } else if (req.session.generatedTrip) {
            tripPayload = req.session.generatedTrip;
        }

        if (!tripPayload || !tripPayload.destination || !tripPayload.days) {
            if (req.xhr || req.headers.accept?.includes("application/json") || req.is("json")) {
                return res.status(400).json({ success: false, message: "No valid trip itinerary data to save." });
            }
            req.flash("error", "No valid trip itinerary data to save.");
            return res.redirect("/trips/plan");
        }

        const newTrip = new Trip({
            user: req.user._id,
            destination: tripPayload.destination,
            checkIn: new Date(tripPayload.checkIn),
            checkOut: new Date(tripPayload.checkOut),
            totalDays: tripPayload.totalDays || (tripPayload.days ? tripPayload.days.length : 1),
            preferences: tripPayload.preferences || [],
            budget: tripPayload.budget || "Moderate",
            pace: tripPayload.pace || "Balanced",
            title: tripPayload.title || `Trip to ${tripPayload.destination}`,
            summary: tripPayload.summary || "",
            days: tripPayload.days || []
        });

        await newTrip.save();

        // Clear session preview
        delete req.session.generatedTrip;

        req.flash("success", "Trip itinerary saved successfully to My Trips!");

        if (req.xhr || req.headers.accept?.includes("application/json") || req.is("json")) {
            return res.json({
                success: true,
                tripId: newTrip._id,
                redirectUrl: `/trips/${newTrip._id}`
            });
        }

        return res.redirect(`/trips/${newTrip._id}`);
    } catch (err) {
        logger.error(`Error saving trip: ${err.message}\n${err.stack}`);
        if (req.xhr || req.headers.accept?.includes("application/json") || req.is("json")) {
            return res.status(500).json({ success: false, message: "Failed to save trip." });
        }
        req.flash("error", "Failed to save trip itinerary. Please try again.");
        return res.redirect(req.get("Referrer") || "/trips");
    }
};

module.exports.indexTrips = async (req, res) => {
    try {
        const query = { user: req.user._id };
        const trips = await Trip.find(query).sort({ createdAt: -1 });

        res.render("trips/index.ejs", {
            trips,
            pageTitle: "My Saved Trips"
        });
    } catch (err) {
        logger.error(`Error fetching user trips: ${err.message}`);
        req.flash("error", "Could not load your saved trips.");
        return res.redirect("/listings");
    }
};

module.exports.showTrip = async (req, res) => {
    // res.locals.trip is already attached by isTripOwner middleware
    const trip = res.locals.trip;

    res.render("trips/show.ejs", {
        trip,
        isSaved: true,
        mapToken: process.env.MAP_TOKEN || "",
        pageTitle: `${trip.destination} - Saved Trip Itinerary`
    });
};

module.exports.deleteTrip = async (req, res) => {
    try {
        const { id } = req.params;
        await Trip.findByIdAndDelete(id);
        req.flash("success", "Trip deleted successfully.");
        return res.redirect("/trips");
    } catch (err) {
        logger.error(`Error deleting trip ${req.params.id}: ${err.message}`);
        req.flash("error", "Could not delete trip.");
        return res.redirect("/trips");
    }
};
