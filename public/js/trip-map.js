/**
 * Wanderlust AI Trip Planner - Interactive Route Map
 */
document.addEventListener("DOMContentLoaded", () => {
    const mapContainer = document.getElementById("tripInteractiveMap");
    const tripDataEl = document.getElementById("trip-data-json");

    if (!mapContainer || !tripDataEl) return;

    let tripData = null;
    try {
        tripData = JSON.parse(tripDataEl.textContent);
    } catch (e) {
        console.error("Failed to parse trip JSON data:", e);
        return;
    }

    if (!tripData || !tripData.days || tripData.days.length === 0) return;

    const mapToken = window.mapToken || "";

    if (!mapToken || mapToken.includes("fallback") || mapToken.length < 20) {
        mapContainer.innerHTML = `
            <div class="d-flex flex-column align-items-center justify-content-center h-100 p-4 text-center text-muted">
                <i class="fa-solid fa-map-location-dot fs-1 text-danger mb-3"></i>
                <h5 class="fw-bold">Interactive Route Map</h5>
                <p class="small mb-3">Interactive map route requires a Mapbox token. You can use the direct <strong>Navigate with Google Maps</strong> buttons below on every attraction.</p>
                <a href="${tripData.days[0]?.places[0]?.googleMapsUrl || '#'}" target="_blank" class="btn btn-sm btn-outline-danger rounded-pill px-3">
                    <i class="fa-brands fa-google me-1"></i>Open First Attraction in Google Maps
                </a>
            </div>
        `;
        return;
    }

    mapboxgl.accessToken = mapToken;

    // Collect all valid coordinates
    const allPlaces = [];
    tripData.days.forEach(day => {
        if (day.places && Array.isArray(day.places)) {
            day.places.forEach((p, idx) => {
                if (p.coordinates && p.coordinates.length === 2 && !isNaN(p.coordinates[0]) && !isNaN(p.coordinates[1])) {
                    allPlaces.push({
                        ...p,
                        dayNumber: day.dayNumber,
                        stepNumber: idx + 1,
                        dayTitle: day.theme || `Day ${day.dayNumber}`
                    });
                }
            });
        }
    });

    if (allPlaces.length === 0) {
        mapContainer.innerHTML = `<div class="p-4 text-center text-muted">No route coordinates available for this destination.</div>`;
        return;
    }

    // Default center to first place
    const initialCenter = allPlaces[0].coordinates;

    const map = new mapboxgl.Map({
        container: "tripInteractiveMap",
        style: "mapbox://styles/mapbox/streets-v12",
        center: initialCenter,
        zoom: 12
    });

    map.addControl(new mapboxgl.NavigationControl(), "top-right");

    const markersMap = new Map(); // id -> mapboxgl.Marker

    function createMarkerElement(number) {
        const el = document.createElement("div");
        el.className = "custom-map-marker";
        el.textContent = number;
        return el;
    }

    map.on("load", () => {
        // Source & Layer for Route Polylines
        map.addSource("trip-route", {
            type: "geojson",
            data: {
                type: "FeatureCollection",
                features: []
            }
        });

        map.addLayer({
            id: "trip-route-line",
            type: "line",
            source: "trip-route",
            layout: {
                "line-join": "round",
                "line-cap": "round"
            },
            paint: {
                "line-color": "#fe424d",
                "line-width": 4,
                "line-opacity": 0.85
            }
        });

        // Initialize with all markers
        renderDayView("all");
    });

    function renderDayView(selectedDay) {
        // Remove existing markers
        markersMap.forEach(marker => marker.remove());
        markersMap.clear();

        const filteredPlaces = selectedDay === "all" 
            ? allPlaces 
            : allPlaces.filter(p => String(p.dayNumber) === String(selectedDay));

        if (filteredPlaces.length === 0) return;

        const bounds = new mapboxgl.LngLatBounds();
        const routeCoords = [];

        filteredPlaces.forEach((place, index) => {
            const markerEl = createMarkerElement(place.stepNumber || index + 1);
            
            const popupHtml = `
                <div style="font-family: 'Plus Jakarta Sans', sans-serif; padding: 4px;">
                    <strong style="color: #1e293b; font-size: 14px;">${place.name}</strong>
                    <div style="font-size: 11px; color: #64748b; margin-bottom: 6px;">${place.location}</div>
                    <div style="font-size: 12px; margin-bottom: 8px;">
                        <span style="background: #f1f5f9; padding: 2px 6px; border-radius: 4px;">
                            ⏰ ${place.arrivalTime || 'Morning'}
                        </span>
                    </div>
                    <a href="${place.googleMapsUrl}" target="_blank" style="display: inline-block; background: #1a73e8; color: #fff; padding: 4px 10px; border-radius: 99px; text-decoration: none; font-size: 11px; font-weight: 600;">
                        <i class="fa-solid fa-diamond-turn-right me-1"></i>Google Maps
                    </a>
                </div>
            `;

            const popup = new mapboxgl.Popup({ offset: 25 }).setHTML(popupHtml);

            const marker = new mapboxgl.Marker({ element: markerEl })
                .setLngLat(place.coordinates)
                .setPopup(popup)
                .addTo(map);

            const placeKey = `${place.dayNumber}-${place.stepNumber}`;
            markersMap.set(placeKey, marker);

            bounds.extend(place.coordinates);
            routeCoords.push(place.coordinates);
        });

        // Update GeoJSON route line
        if (map.getSource("trip-route")) {
            map.getSource("trip-route").setData({
                type: "FeatureCollection",
                features: routeCoords.length > 1 ? [{
                    type: "Feature",
                    geometry: {
                        type: "LineString",
                        coordinates: routeCoords
                    }
                }] : []
            });
        }

        // Fit map bounds
        if (!bounds.isEmpty()) {
            map.fitBounds(bounds, {
                padding: { top: 60, bottom: 60, left: 50, right: 50 },
                maxZoom: 14,
                duration: 1000
            });
        }
    }

    // Day Switcher Filter Pills
    const dayPills = document.querySelectorAll(".day-pill-btn");
    const daySections = document.querySelectorAll(".day-section");

    dayPills.forEach(pill => {
        pill.addEventListener("click", () => {
            dayPills.forEach(p => p.classList.remove("active"));
            pill.classList.add("active");

            const dayVal = pill.dataset.day;

            // Toggle timeline visibility
            daySections.forEach(sec => {
                if (dayVal === "all" || sec.dataset.day === dayVal) {
                    sec.style.display = "block";
                } else {
                    sec.style.display = "none";
                }
            });

            // Update Map View
            renderDayView(dayVal);
        });
    });

    // Place card click/hover interaction with map
    const placeCards = document.querySelectorAll(".place-card");
    placeCards.forEach(card => {
        const day = card.dataset.day;
        const step = card.dataset.step;
        const placeKey = `${day}-${step}`;

        card.addEventListener("mouseenter", () => {
            const marker = markersMap.get(placeKey);
            if (marker) {
                marker.getElement().classList.add("active");
            }
        });

        card.addEventListener("mouseleave", () => {
            const marker = markersMap.get(placeKey);
            if (marker) {
                marker.getElement().classList.remove("active");
            }
        });

        card.addEventListener("click", (e) => {
            // Ignore if clicking a button/link inside card
            if (e.target.closest("a") || e.target.closest("button")) return;

            placeCards.forEach(c => c.classList.remove("highlighted"));
            card.classList.add("highlighted");

            const marker = markersMap.get(placeKey);
            if (marker) {
                const lngLat = marker.getLngLat();
                map.flyTo({
                    center: [lngLat.lng, lngLat.lat],
                    zoom: 14,
                    speed: 1.2
                });
                marker.togglePopup();
            }
        });
    });
});
