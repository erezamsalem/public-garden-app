// public/script.js

// Make these variables global by attaching them to the window object
window.map = null;
window.adminMap = null; // Separate map instance for the admin page
window.currentLocation = {
    lat: 32.0853,
    lng: 34.7818
}; // Default: Tel Aviv
window.gardenMarkers = [];
window.adminGardenMarkers = [];
window.isPlacingGarden = false;
window.tempGardenMarker = null;
window.newGardenLocation = null;
window.userLocationMarker = null;
window.locationSearchInterval = null; // To hold the searching animation interval

// This variable will also be shared globally
window.isAdmin = false;

// Make these functions global
window.getAuthHeaders = function() {
    const token = localStorage.getItem('adminToken');
    return token ? {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
    } : {
        'Content-Type': 'application/json'
    };
};

window.loadGoogleMapsScript = async function() {
    try {
        const response = await fetch('/api/config');
        const config = await response.json();
        const apiKey = config.googleMapsApiKey;
        const script = document.createElement('script');
        script.src = `https://maps.googleapis.com/maps/api/js?key=${apiKey}&callback=initMap`;
        script.async = true;
        script.defer = true;
        document.head.appendChild(script);
    } catch (error) {
        console.error("Could not load Google Maps config:", error);
        document.getElementById('map').innerText = "Error: Could not load map configuration.";
    }
};

window.formatTimeAgo = function(dateString) {
    const date = new Date(dateString);
    const now = new Date();
    const seconds = Math.round((now - date) / 1000);
    if (seconds < 60) return 'just now';
    const minutes = Math.round(seconds / 60);
    if (minutes < 60) return `${minutes} minute${minutes > 1 ? 's' : ''} ago`;
    const hours = Math.round(minutes / 60);
    if (hours < 24) return `${hours} hour${hours > 1 ? 's' : ''} ago`;
    const days = Math.round(hours / 24);
    return `${days} day${days > 1 ? 's' : ''} ago`;
};

window.calculateDistance = function(lat1, lon1, lat2, lon2) {
    const R = 6371; // Radius of the Earth in km
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) + Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLon / 2) * Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
};

window.initMap = function() {
    // Check for a garden ID in the URL to highlight it
    const urlParams = new URLSearchParams(window.location.search);
    const gardenIdFromUrl = urlParams.get('garden');

    const highlightSharedGarden = () => {
        if (!gardenIdFromUrl) return; // Exit if no garden ID is in the URL

        const cardElement = document.getElementById(`card-${gardenIdFromUrl}`);
        const marker = window.gardenMarkers.find(m => m.gardenId === gardenIdFromUrl);

        if (cardElement) {
            // Reuse your existing function to scroll to and highlight the card
            window.scrollToCard(gardenIdFromUrl);
        }

        if (marker) {
            // Delay this part slightly to ensure a smooth scroll experience
            setTimeout(() => {
                // document.getElementById('map').scrollIntoView({ behavior: 'smooth' });
                window.map.panTo(marker.getPosition());
                window.map.setZoom(16); // Zoom in closer to the shared garden
                google.maps.event.trigger(marker, 'click'); // Open its info window on the map
            }, 700);
        }
    };

    // Load gardens and pass the highlighting function as a callback
    window.loadGardens(true, highlightSharedGarden);

    window.map = new google.maps.Map(document.getElementById('map'), {
        center: window.currentLocation,
        zoom: 12,
        disableDefaultUI: true,
        zoomControl: true
    });

    window.adminMap = new google.maps.Map(document.getElementById('admin-map'), {
        center: window.currentLocation,
        zoom: 12,
        disableDefaultUI: true,
        zoomControl: true
    });

    const updateDistancesWithRealLocation = (position) => {
        // This part always runs: clear the 'searching' message, update location, and center the map.
        if (window.locationSearchInterval) {
            clearInterval(window.locationSearchInterval);
            window.locationSearchInterval = null;
        }

        const locationStatus = document.getElementById('location-status');
        locationStatus.innerHTML = '';
        locationStatus.classList.add('hidden');

        window.currentLocation = {
            lat: position.coords.latitude,
            lng: position.coords.longitude
        };

        updateUserLocationOnMap();
        window.map.setCenter(window.currentLocation);
        window.adminMap.setCenter(window.currentLocation);

        // This check prevents the race condition. We only proceed if gardens have been loaded.
        if (window.allGardens && window.allGardens.length > 0) {
            console.log("Gardens already loaded. Re-calculating distances and re-rendering.");

            // Re-calculate and sort for the main garden list
            window.allGardens.forEach(garden => {
                garden.distance = window.calculateDistance(window.currentLocation.lat, window.currentLocation.lng, garden.latitude, garden.longitude);
            });
            window.allGardens.sort((a, b) => a.distance - b.distance);

            // DEFENSIVE CHECK: Only process admin gardens if the array exists.
            // This prevents an error if admin.js hasn't initialized the variable yet.
            if (window.allAdminGardens && Array.isArray(window.allAdminGardens)) {
                window.allAdminGardens.forEach(garden => {
                    garden.distance = window.calculateDistance(window.currentLocation.lat, window.currentLocation.lng, garden.latitude, garden.longitude);
                });
                window.allAdminGardens.sort((a, b) => a.distance - b.distance);
            }

            // Re-render the correct list (admin or public)
            if (!document.getElementById('admin-page-content').classList.contains('hidden')) {
                window.renderFilteredAdminGardens();
            } else {
                window.renderFilteredGardens();
            }
        } else {
            console.log("Location found, but gardens not loaded yet. The initial render will use this new location.");
        }
    };

    if (navigator.geolocation) {
        const locationStatus = document.getElementById('location-status');
        locationStatus.innerHTML = `<p class="text-center text-blue-600 font-semibold bg-blue-100/50 p-3 rounded-lg"><span>🛰️ Searching for your location</span><span id="location-dots" class="inline-block text-left w-6"></span></p>`;
        locationStatus.classList.remove('hidden');

        if (window.locationSearchInterval) clearInterval(window.locationSearchInterval);

        let dotCount = 0;
        const dotsSpan = document.getElementById('location-dots');

        window.locationSearchInterval = setInterval(() => {
            dotCount = (dotCount % 3) + 1; // Cycles through 1, 2, 3
            if (dotsSpan) { // Check if the element still exists
                dotsSpan.textContent = '.'.repeat(dotCount);
            }
        }, 400); // Animation speed

        navigator.geolocation.getCurrentPosition(updateDistancesWithRealLocation, () => {
            if (window.locationSearchInterval) {
                clearInterval(window.locationSearchInterval);
                window.locationSearchInterval = null;
            }

            const locationStatus = document.getElementById('location-status');
            locationStatus.innerHTML = `<p class="text-center text-yellow-600 font-semibold bg-yellow-100/50 p-3 rounded-lg">⚠️ Could not get your location. Showing gardens near the default location.</p>`;

            setTimeout(() => {
                locationStatus.classList.add('hidden');
                locationStatus.innerHTML = '';
            }, 5000);

            console.log("Geolocation failed. Using default location.");
        });
    }

    window.map.addListener('click', (event) => {
        if (window.isPlacingGarden) {
            placeTemporaryMarker(event.latLng);
            window.newGardenLocation = {
                lat: event.latLng.lat(),
                lng: event.latLng.lng()
            };
            openAddGardenModal();
        }
    });
};

window.updateUserLocationOnMap = function() {
    if (window.userLocationMarker) {
        window.userLocationMarker.setPosition(window.currentLocation);
    } else {
        window.userLocationMarker = new google.maps.Marker({
            position: window.currentLocation,
            map: window.map,
            title: "Your current location",
            icon: {
                path: google.maps.SymbolPath.CIRCLE,
                scale: 8,
                fillColor: "#4285F4",
                fillOpacity: 1,
                strokeWeight: 2,
                strokeColor: "white"
            }
        });
    }
    window.map.setCenter(window.currentLocation);
    window.map.setZoom(15);
};

const modal = document.getElementById('add-garden-modal');
const addGardenForm = document.getElementById('add-garden-form');
const addAtMyLocationBtn = document.getElementById('add-garden-at-location-btn');
const chooseLocationBtn = document.getElementById('choose-location-btn');
const closeModalBtn = document.getElementById('close-modal-btn');
const instructionText = document.getElementById('instruction-text');

addAtMyLocationBtn.addEventListener('click', () => {
    exitPlacingMode();
    window.newGardenLocation = null;
    openAddGardenModal();
});

chooseLocationBtn.addEventListener('click', () => {
    window.isPlacingGarden = true;
    instructionText.classList.remove('hidden');
    window.map.setOptions({
        draggableCursor: 'crosshair'
    });
});

closeModalBtn.addEventListener('click', () => {
    closeAddGardenModal();
});

addGardenForm.addEventListener('submit', async (e) => {
    e.preventDefault();

    const saveButton = e.submitter;
    const originalButtonText = saveButton.textContent;
    saveButton.textContent = 'Saving...';
    saveButton.disabled = true;

    try {
        const locationToSave = window.newGardenLocation || window.currentLocation;
        const gardenData = {
            latitude: locationToSave.lat,
            longitude: locationToSave.lng,
            customName: document.getElementById('add-custom-name').value,
            hasWaterTap: document.getElementById('has-water-tap').checked,
            hasSlide: document.getElementById('has-slide').checked,
            hasCarrousel: document.getElementById('has-carrousel').checked,
            hasSwings: document.getElementById('has-swings').checked,
            hasSpringHorse: document.getElementById('has-spring-horse').checked,
            hasPublicBooksShelf: document.getElementById('has-public-books-shelf').checked,
            hasPingPongTable: document.getElementById('has-ping-pong-table').checked,
            hasPublicGym: document.getElementById('has-public-gym').checked,
            hasBasketballField: document.getElementById('has-basketball-field').checked,
            hasFootballField: document.getElementById('has-football-field').checked,
            hasSpaceForDogs: document.getElementById('has-space-for-dogs').checked,
            kidsCount: parseInt(document.getElementById('kids-count').value)
        };

        const features = [
            gardenData.hasWaterTap, gardenData.hasSlide, gardenData.hasCarrousel,
            gardenData.hasSwings, gardenData.hasSpringHorse, gardenData.hasPublicBooksShelf, gardenData.hasPingPongTable, gardenData.hasPublicGym,
            gardenData.hasBasketballField, gardenData.hasFootballField, gardenData.hasSpaceForDogs
        ];
        if (!features.some(feature => feature === true)) {
            alert('Please select at least one feature for the garden.');
            saveButton.textContent = originalButtonText;
            saveButton.disabled = false;
            return;
        }

        const response = await fetch('/api/gardens', {
            method: 'POST',
            headers: window.getAuthHeaders(),
            body: JSON.stringify(gardenData)
        });

        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.message || 'Failed to save garden');
        }

        closeAddGardenModal();
        showSuccessPopup();
        window.loadGardens(false);
        if (window.isAdmin) window.loadAdminGardens();

    } catch (error) {
        console.error("Error adding garden:", error);
        alert("Could not save the garden. " + error.message);
    } finally {
        saveButton.textContent = originalButtonText;
        saveButton.disabled = false;
    }
});

window.openAddGardenModal = function() {
    modal.classList.remove('hidden');
};

window.closeAddGardenModal = function() {
    modal.classList.add('hidden');
    addGardenForm.reset();
    exitPlacingMode();
};

window.exitPlacingMode = function() {
    window.isPlacingGarden = false;
    instructionText.classList.add('hidden');
    if (window.map) {
        window.map.setOptions({
            draggableCursor: ''
        });
    }
    if (window.tempGardenMarker) {
        window.tempGardenMarker.setMap(null);
        window.tempGardenMarker = null;
    }
};

window.placeTemporaryMarker = function(location) {
    if (window.tempGardenMarker) {
        window.tempGardenMarker.setMap(null);
    }
    window.tempGardenMarker = new google.maps.Marker({
        position: location,
        map: window.map,
        title: 'New Garden Location'
    });
};

window.showSuccessPopup = function() {
    const popup = document.getElementById('success-popup');
    popup.style.opacity = '1';
    popup.style.transform = 'translateY(0)';

    setTimeout(() => {
        popup.style.opacity = '0';
        popup.style.transform = 'translateY(2rem)';
    }, 4000);
};