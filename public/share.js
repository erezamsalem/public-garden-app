// A global variable to hold the garden data so the map callback can access it
let gardenForMap = null;

document.addEventListener('DOMContentLoaded', async () => {
    const cardContainer = document.getElementById('garden-card-container');

    // 1. Get the garden ID from the URL
    const urlParams = new URLSearchParams(window.location.search);
    const gardenId = urlParams.get('id');

    if (!gardenId) {
        cardContainer.innerHTML = `<p class="text-center text-red-500">Error: No garden ID provided.</p>`;
        return;
    }

    try {
        // 2. Fetch the garden data first
        const response = await fetch(`/api/gardens/${gardenId}`);
        if (!response.ok) {
            throw new Error((await response.json()).message || 'Garden not found');
        }
        const garden = await response.json();
        
        gardenForMap = garden;

        // 3. Render map and card, then find location
        loadGoogleMapsScript();
        cardContainer.innerHTML = createGardenCardHTML(garden);
        findLocationAndUpdateDirections(garden);

    } catch (error) {
        console.error("Failed to load garden:", error);
        cardContainer.innerHTML = `<p class="text-center text-red-500">Error: ${error.message}</p>`;
    }
    
    // Add event listener for the dynamically created Gemini button
    cardContainer.addEventListener('click', (e) => {
        if (e.target.classList.contains('gemini-insight-btn')) {
            getGardenInsight(e.target.dataset);
        }
    });

    // Add event listener for the modal's close button
    document.getElementById('closeGeminiModalBtn').addEventListener('click', () => {
        document.getElementById('geminiModal').classList.add('hidden');
    });
});

function findLocationAndUpdateDirections(garden) {
    const locationStatusEl = document.getElementById('location-status');
    navigator.geolocation.getCurrentPosition(
        (position) => {
            locationStatusEl.innerHTML = '';
            const userLocation = { lat: position.coords.latitude, lng: position.coords.longitude };
            const directionsUrl = `https://www.google.com/maps/dir/?api=1&origin=${userLocation.lat},${userLocation.lng}&destination=${garden.latitude},${garden.longitude}&travelmode=walking`;
            updateDirectionsButton(directionsUrl);
        },
        () => {
            locationStatusEl.innerHTML = `<p class="text-center text-yellow-600 font-semibold bg-yellow-100/50 p-3 rounded-lg">⚠️ Could not get location. Directions will not have a starting point.</p>`;
            const directionsUrl = `https://www.google.com/maps/dir/?api=1&destination=${garden.latitude},${garden.longitude}&travelmode=walking`;
            updateDirectionsButton(directionsUrl);
        }
    );
}

// --- GOOGLE MAPS FUNCTIONS ---

async function loadGoogleMapsScript() {
    try {
        const response = await fetch('/api/config');
        const config = await response.json();
        const apiKey = config.googleMapsApiKey;
        const script = document.createElement('script');
        script.src = `https://maps.googleapis.com/maps/api/js?key=${apiKey}&callback=initShareMap`;
        script.async = true;
        script.defer = true;
        document.head.appendChild(script);
    } catch (error) {
        console.error("Could not load Google Maps config:", error);
        document.getElementById('map').innerText = "Error: Could not load map configuration.";
    }
}

function initShareMap() {
    if (!gardenForMap) { return; }
    const gardenLocation = { lat: gardenForMap.latitude, lng: gardenForMap.longitude };
    const map = new google.maps.Map(document.getElementById('map'), {
        center: gardenLocation, zoom: 16, disableDefaultUI: true, zoomControl: true
    });
    new google.maps.Marker({
        position: gardenLocation, map: map, title: gardenForMap.customName || gardenForMap.address,
        icon: {
            url: 'data:image/svg+xml;charset=UTF-8,' + encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="#8B5CF6" width="48px" height="48px"><path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z"/><path d="M0 0h24v24H0z" fill="none"/></svg>'),
            scaledSize: new google.maps.Size(40, 40)
        }
    });
}

// --- GEMINI AI INSIGHT FUNCTIONS ---

async function getGardenInsight(gardenData) {
    const geminiModalContent = document.getElementById('geminiModalContent');
    const geminiLoadingIndicator = document.getElementById('geminiLoadingIndicator');
    let features = [];
    if (gardenData.hasWaterTap === 'true') features.push('water tap');
    if (gardenData.hasSlide === 'true') features.push('slide');
    if (gardenData.hasCarrousel === 'true') features.push('carrousel');
    if (gardenData.hasSwings === 'true') features.push('swings');
    if (gardenData.hasSpringHorse === 'true') features.push('spring horse');
    if (gardenData.hasPublicBooksShelf === 'true') features.push('public books shelf');
    if (gardenData.hasPingPongTable === 'true') features.push('ping pong table');
    if (gardenData.hasPublicGym === 'true') features.push('public gym');
    if (gardenData.hasBasketballField === 'true') features.push('basketball field');
    if (gardenData.hasFootballField === 'true') features.push('football field');
    if (gardenData.hasSpaceForDogs === 'true') features.push('space for dogs');
    let featuresText = features.length > 0 ? `It has ${features.join(', ')}.` : 'It has no specific amenities listed.';
    const prompt = `Generate a short (2-3 sentences) and engaging description for a public park in "${gardenData.gardenCity}". Emphasize its appeal for families based on its features: ${featuresText}.`;
    document.getElementById('geminiModalTitle').textContent = `✨ Imagine Your Visit In ${gardenData.gardenCity} ✨`;
    geminiModalContent.textContent = '';
    geminiLoadingIndicator.classList.remove('hidden');
    document.getElementById('geminiModal').classList.remove('hidden');
    try {
        const response = await fetch('/api/gemini-insight', {
            method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ prompt })
        });
        if (!response.ok) throw new Error((await response.json()).message || 'Failed to get insight');
        const result = await response.json();
        geminiModalContent.textContent = result.insight;
    } catch (error) {
        geminiModalContent.textContent = `Failed to get insight. Error: ${error.message}`;
    } finally {
        geminiLoadingIndicator.classList.add('hidden');
    }
}

// --- CARD RENDERING FUNCTIONS ---

function updateDirectionsButton(url) {
    const container = document.getElementById('directions-container');
    if (container) {
        container.innerHTML = `<a href="${url}" target="_blank" rel="noopener noreferrer" class="block w-full text-center bg-blue-500 text-white font-bold py-2 px-4 rounded-full hover:bg-blue-600 transition-colors">Get Directions</a>`;
    }
}

function createGardenCardHTML(garden) {
    const formatTimeAgo = (dateString) => {
        if (!dateString) return '';
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
    const title = `${garden.city || 'Unknown'} - ${garden.customName ? `<strong>${garden.customName}</strong>, ` : ''}${garden.address || 'Address not found'}`;
    return `
        <div class="bg-white p-4 rounded-lg shadow-lg">
            <h2 class="text-xl font-bold text-gray-700 mb-2">${title}</h2>
            <p class="text-gray-600 mb-4"><strong>Kids Now:</strong> ${garden.kidsCount} <span class="text-xs text-gray-500 italic">(updated ${formatTimeAgo(garden.kidsCountLastUpdated)})</span></p>
            <div class="space-y-2 text-gray-600 mb-4">
                ${generateFeatureHTML('water-tap-icon.png', 'Water Tap', garden.hasWaterTap)}
                ${generateFeatureHTML('slide-icon.jpg', 'Slide', garden.hasSlide)}
                ${generateFeatureHTML('carousel-icon.jpeg', 'Carrousel', garden.hasCarrousel)}
                ${generateFeatureHTML('swing-icon.jpg', 'Swings', garden.hasSwings)}
                ${generateFeatureHTML('spring-horse.png', 'Spring Horse', garden.hasSpringHorse)}
                ${generateFeatureHTML('public-books.jpg', 'Books Shelf', garden.hasPublicBooksShelf)}
                ${generateFeatureHTML('ping-pong.jpg', 'Ping Pong', garden.hasPingPongTable)}
                ${generateFeatureHTML('public-gym-icon.png', 'Public Gym', garden.hasPublicGym)}
                ${generateFeatureHTML('basketball-field.png', 'Basketball', garden.hasBasketballField)}
                ${generateFeatureHTML('football-field.jpg', 'Football', garden.hasFootballField)}
                ${generateFeatureHTML('dogs.jpg', 'Dog Space', garden.hasSpaceForDogs)}
            </div>
            <div class="space-y-2">
                <div id="directions-container">
                    <button disabled class="block w-full text-center bg-gray-400 text-white font-bold py-2 px-4 rounded-full cursor-not-allowed">Finding Location...</button>
                </div>
                <button class="block w-full text-center bg-purple-500 text-white font-bold py-2 px-4 rounded-full hover:bg-purple-600 transition-colors gemini-insight-btn"
                    data-garden-city="${garden.city || 'Unknown'}" data-has-water-tap="${garden.hasWaterTap}" data-has-slide="${garden.hasSlide}" data-has-carrousel="${garden.hasCarrousel}"
                    data-has-swings="${garden.hasSwings}" data-has-spring-horse="${garden.hasSpringHorse}" data-has-public-books-shelf="${garden.hasPublicBooksShelf}"
                    data-has-ping-pong-table="${garden.hasPingPongTable}" data-has-public-gym="${garden.hasPublicGym}" data-has-basketball-field="${garden.hasBasketballField}"
                    data-has-football-field="${garden.hasFootballField}" data-has-space-for-dogs="${garden.hasSpaceForDogs}">
                    ✨ Imagine Your Visit ✨
                </button>
                <a href="/" class="block w-full text-center bg-green-500 text-white font-bold py-2 px-4 rounded-full hover:bg-green-600 transition-colors">
                    Find More Gardens
                </a>
            </div>
        </div>
    `;
}

function generateFeatureHTML(icon, name, hasFeature) {
    const grayscale = hasFeature ? '' : 'img-grayscale';
    const checkmark = hasFeature ? '✅' : '❌';
    return `
        <div class="flex items-center justify-between">
            <div class="flex items-center">
                <img src="/icons/${icon}" class="w-5 h-5 mr-2 ${grayscale}">
                <span><strong>${name}:</strong> ${hasFeature ? 'Yes' : 'No'}</span>
            </div>
            <span>${checkmark}</span>
        </div>
    `;
}