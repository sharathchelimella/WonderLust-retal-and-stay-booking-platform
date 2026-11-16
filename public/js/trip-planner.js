/**
 * Wanderlust AI Trip Planner - Form Interactivity & Submission
 */
document.addEventListener("DOMContentLoaded", () => {
    const form = document.getElementById("tripPlannerForm");
    if (!form) return;

    const checkInInput = document.getElementById("tripCheckIn");
    const checkOutInput = document.getElementById("tripCheckOut");
    const daysBadge = document.getElementById("totalDaysBadge");
    const daysCountText = document.getElementById("daysCountText");
    const totalDaysInput = document.getElementById("totalDaysInput");
    const loadingOverlay = document.getElementById("tripLoadingOverlay");
    const loadingDynamicText = document.getElementById("loadingDynamicText");

    // Dynamic date restrictions
    const today = new Date().toISOString().split("T")[0];
    if (checkInInput) {
        if (!checkInInput.getAttribute("min")) {
            checkInInput.min = today;
        }
    }

    function calculateDays() {
        if (!checkInInput || !checkOutInput) return 1;
        const start = new Date(checkInInput.value);
        const end = new Date(checkOutInput.value);

        if (start && end && !isNaN(start.getTime()) && !isNaN(end.getTime())) {
            const diffTime = end.getTime() - start.getTime();
            const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
            const calculated = Math.max(1, Math.min(diffDays, 14)); // cap at 14 days for optimal itinerary

            if (daysCountText) daysCountText.textContent = `${calculated} Day${calculated > 1 ? 's' : ''}`;
            if (daysBadge) daysBadge.style.display = "inline-flex";
            if (totalDaysInput) totalDaysInput.value = calculated;
            return calculated;
        }
        return 1;
    }

    if (checkInInput && checkOutInput) {
        checkInInput.addEventListener("change", () => {
            if (checkInInput.value) {
                // Set checkOut min to checkIn + 1 day
                const nextDay = new Date(checkInInput.value);
                nextDay.setDate(nextDay.getDate() + 1);
                checkOutInput.min = nextDay.toISOString().split("T")[0];

                if (!checkOutInput.value || new Date(checkOutInput.value) <= new Date(checkInInput.value)) {
                    // Default to 3 days after checkIn
                    const defaultEnd = new Date(checkInInput.value);
                    defaultEnd.setDate(defaultEnd.getDate() + 3);
                    checkOutInput.value = defaultEnd.toISOString().split("T")[0];
                }
            }
            calculateDays();
        });

        checkOutInput.addEventListener("change", () => {
            calculateDays();
        });

        // Initial calculation on load if values exist
        calculateDays();
    }

    // Travel Preference Cards (Multi-select)
    const prefCards = document.querySelectorAll(".pref-card");
    const prefHiddenInputsContainer = document.getElementById("prefHiddenInputs");

    function updatePreferenceInputs() {
        if (!prefHiddenInputsContainer) return;
        prefHiddenInputsContainer.innerHTML = "";
        const activeCards = document.querySelectorAll(".pref-card.active");
        activeCards.forEach(card => {
            const val = card.dataset.pref;
            const hidden = document.createElement("input");
            hidden.type = "hidden";
            hidden.name = "preferences[]";
            hidden.value = val;
            prefHiddenInputsContainer.appendChild(hidden);
        });
    }

    prefCards.forEach(card => {
        card.addEventListener("click", () => {
            card.classList.toggle("active");
            updatePreferenceInputs();
        });
    });

    // Budget Choice Pills (Single select)
    const budgetPills = document.querySelectorAll(".budget-pill");
    const budgetInput = document.getElementById("tripBudget");
    budgetPills.forEach(pill => {
        pill.addEventListener("click", () => {
            budgetPills.forEach(p => p.classList.remove("active"));
            pill.classList.add("active");
            if (budgetInput) budgetInput.value = pill.dataset.val;
        });
    });

    // Travel Pace Choice Pills (Single select)
    const pacePills = document.querySelectorAll(".pace-pill");
    const paceInput = document.getElementById("tripPace");
    pacePills.forEach(pill => {
        pill.addEventListener("click", () => {
            pacePills.forEach(p => p.classList.remove("active"));
            pill.classList.add("active");
            if (paceInput) paceInput.value = pill.dataset.val;
        });
    });

    // Loading overlay animation & dynamic quotes
    const loadingSteps = [
        "Analyzing destination highlights...",
        "Selecting famous attractions & hidden gems...",
        "Optimizing travel routes to avoid backtracking...",
        "Calculating exploration durations & arrival times...",
        "Generating Google Maps navigation links...",
        "Finalizing your personalized day-by-day plan..."
    ];

    let stepInterval = null;

    function startLoadingAnimation() {
        if (!loadingOverlay) return;
        loadingOverlay.style.display = "flex";
        let stepIdx = 0;
        if (loadingDynamicText) {
            loadingDynamicText.textContent = loadingSteps[0];
            stepInterval = setInterval(() => {
                stepIdx = (stepIdx + 1) % loadingSteps.length;
                loadingDynamicText.textContent = loadingSteps[stepIdx];
            }, 2500);
        }
    }

    function stopLoadingAnimation() {
        if (stepInterval) clearInterval(stepInterval);
        if (loadingOverlay) loadingOverlay.style.display = "none";
    }

    // Form submission via Fetch for smooth animated experience
    form.addEventListener("submit", async (e) => {
        e.preventDefault();

        const destInput = document.getElementById("tripDestination");
        if (!destInput || !destInput.value.trim()) {
            destInput?.focus();
            return;
        }

        if (!checkInInput || !checkInInput.value) {
            checkInInput?.focus();
            return;
        }

        if (!checkOutInput || !checkOutInput.value) {
            checkOutInput?.focus();
            return;
        }

        startLoadingAnimation();

        // Collect preferences
        const selectedPrefs = Array.from(document.querySelectorAll(".pref-card.active"))
            .map(c => c.dataset.pref);

        const csrfTokenEl = document.querySelector('input[name="_csrf"]');
        const csrfToken = csrfTokenEl ? csrfTokenEl.value : "";

        const payload = {
            _csrf: csrfToken,
            destination: destInput.value.trim(),
            checkIn: checkInInput.value,
            checkOut: checkOutInput.value,
            preferences: selectedPrefs,
            budget: budgetInput ? budgetInput.value : "Moderate",
            pace: paceInput ? paceInput.value : "Balanced"
        };

        try {
            const response = await fetch("/trips/generate", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    "Accept": "application/json",
                    "X-CSRF-Token": csrfToken
                },
                body: JSON.stringify(payload)
            });

            const data = await response.json();

            if (response.ok && data.success) {
                window.location.href = data.redirectUrl || "/trips/preview";
            } else {
                stopLoadingAnimation();
                alert(data.message || "Failed to generate itinerary. Please verify your dates and try again.");
            }
        } catch (err) {
            console.error("Trip generation fetch error:", err);
            // Fallback to standard form submission if fetch or network blocked
            form.submit();
        }
    });
});
