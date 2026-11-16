const mongoose = require("mongoose");
const Schema = mongoose.Schema;

const placeSchema = new Schema({
    name: {
        type: String,
        required: true,
        trim: true
    },
    location: {
        type: String,
        required: true,
        trim: true
    },
    shortDescription: {
        type: String,
        default: ""
    },
    importance: {
        type: String,
        default: ""
    },
    speciality: {
        type: String,
        default: ""
    },
    bestTimeToVisit: {
        type: String,
        default: "Morning / Afternoon"
    },
    explorationDuration: {
        type: String,
        default: "1 - 2 hours"
    },
    arrivalTime: {
        type: String,
        default: ""
    },
    departureTime: {
        type: String,
        default: ""
    },
    travelDistance: {
        type: String,
        default: ""
    },
    travelDuration: {
        type: String,
        default: ""
    },
    nextDestination: {
        type: String,
        default: ""
    },
    coordinates: {
        type: [Number], // [longitude, latitude] for Mapbox GeoJSON standard
        default: [78.4867, 17.3850]
    },
    googleMapsUrl: {
        type: String,
        default: ""
    },
    nextGoogleMapsUrl: {
        type: String,
        default: ""
    }
});

const daySchema = new Schema({
    dayNumber: {
        type: Number,
        required: true
    },
    theme: {
        type: String,
        default: ""
    },
    summary: {
        type: String,
        default: ""
    },
    places: [placeSchema]
});

const tripSchema = new Schema({
    user: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
        required: true
    },
    destination: {
        type: String,
        required: true,
        trim: true
    },
    checkIn: {
        type: Date,
        required: true
    },
    checkOut: {
        type: Date,
        required: true
    },
    totalDays: {
        type: Number,
        required: true,
        min: 1
    },
    preferences: {
        type: [String],
        default: []
    },
    budget: {
        type: String,
        enum: ["Budget", "Moderate", "Luxury"],
        default: "Moderate"
    },
    pace: {
        type: String,
        enum: ["Relaxed", "Balanced", "Packed"],
        default: "Balanced"
    },
    title: {
        type: String,
        default: ""
    },
    summary: {
        type: String,
        default: ""
    },
    days: [daySchema],
    createdAt: {
        type: Date,
        default: Date.now
    }
});

const Trip = mongoose.model("Trip", tripSchema);
module.exports = Trip;
