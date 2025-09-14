// A global variable to hold the garden data so the map callback can access it
let gardenForMap = null;
// A global variable to hold the active animation timer
let activeAnimationTimeout = null;

document.addEventListener('DOMContentLoaded', async () => {
    const cardContainer = document.getElementById('garden-card-container');

    const urlParams = new URLSearchParams(window.location.search);
    const gardenId = urlParams.get('id');

    if (!gardenId) {
        cardContainer.innerHTML = `<p class="text-center text-red-500">Error: No garden ID provided.</p>`;
        return;
    }

    try {
        const response = await fetch(`/api/gardens/${gardenId}`);
        if (!response.ok) {
            throw new Error((await response.json()).message || 'Garden not found');
        }
        const garden = await response.json();
        
        gardenForMap = garden;

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
            requestGardenAnimation(e.target.dataset);
        }
    });

    // Add event listener for the modal's close button
    document.getElementById('closeGeminiModalBtn').addEventListener('click', () => {
        const container = document.getElementById('geminiAnimationContainer');
        if (activeAnimationTimeout) {
            clearTimeout(activeAnimationTimeout);
        }
        container.innerHTML = '';
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
            locationStatusEl.innerHTML = `<p class="text-center text-yellow-600 font-semibold bg-white/50 p-3 rounded-lg">⚠️ Could not get location. Directions will not have a starting point.</p>`;
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

// --- ⭐️ START: Gemini Animation Logic with Summary Slide ⭐️ ---

function playAnimation(animationScript) {
    const container = document.getElementById('geminiAnimationContainer');
    const loadingIndicator = document.getElementById('geminiLoadingIndicator');
    
    loadingIndicator.classList.add('hidden');
    container.innerHTML = ''; 
    container.classList.remove('hidden');

    if (activeAnimationTimeout) {
        clearTimeout(activeAnimationTimeout);
    }

    let sceneIndex = 0;
    const iconsShown = []; // Array to collect icons

    function showNextScene() {
        if (sceneIndex < animationScript.length) {
            const sceneData = animationScript[sceneIndex];
            const sceneElement = document.createElement('div');
            sceneElement.className = 'scene animated-background';

            const iconMap = {
                'slide': '/icons/slide-icon.jpg',
                'swing': '/icons/swing-icon.jpg',
                'carousel': '/icons/carousel-icon.jpeg',
                'spring_horse': '/icons/spring-horse.png',
                'kids_playing': '/icons/slide-icon.jpg', // Use a more generic icon
                'dog_park': '/icons/dogs.jpg',
                'basketball': '/icons/basketball-field.png',
                'football': '/icons/football-field.jpg',
                'gym': '/icons/public-gym-icon.png',
                'ping_pong': '/icons/ping-pong.jpg',
                'books': '/icons/public-books.jpg',
                'water_tap': '/icons/water-tap-icon.png',
                'park_entrance': '/icons/slide-icon.jpg'
            };
            const iconSrc = iconMap[sceneData.icon] || '/icons/slide-icon.jpg';

            // Collect feature icons (don't add intro/outro icons)
            if (sceneData.icon !== 'park_entrance' && sceneData.icon !== 'kids_playing') {
                iconsShown.push(iconSrc);
            }

            sceneElement.innerHTML = `
                <img src="${iconSrc}" alt="${sceneData.description}" class="scene-icon">
                <p class="scene-description">${sceneData.description}</p>
            `;
            
            container.innerHTML = '';
            container.appendChild(sceneElement);

            setTimeout(() => sceneElement.classList.add('active'), 50);

            sceneIndex++;
            activeAnimationTimeout = setTimeout(showNextScene, sceneData.duration);
        } else {
            // This is the new final slide
            const finalElement = document.createElement('div');
            finalElement.className = 'scene active animated-background';

            // Create the HTML for all the collected icons
            const iconsHTML = iconsShown.map(src => `<img src="${src}" class="w-10 h-10 object-contain">`).join('');
            
            finalElement.innerHTML = `
                <p class="scene-description mb-4 font-bold">This park has it all!</p>
                <div class="flex flex-wrap justify-center items-center gap-4">
                    ${iconsHTML}
                </div>
            `;
            container.innerHTML = '';
            container.appendChild(finalElement);
        }
    }
    showNextScene();
}

async function requestGardenAnimation(gardenData) {
    const animationContainer = document.getElementById('geminiAnimationContainer');
    const loadingIndicator = document.getElementById('geminiLoadingIndicator');
    const modal = document.getElementById('geminiModal');

    document.getElementById('geminiModalTitle').textContent = `✨ Imagining Your Visit In ${gardenData.gardenCity} ✨`;
    
    animationContainer.classList.add('hidden');
    loadingIndicator.classList.remove('hidden');
    modal.classList.remove('hidden');

    let features = [];
    if (gardenData.hasWaterTap === 'true') features.push('water_tap');
    if (gardenData.hasSlide === 'true') features.push('slide');
    if (gardenData.hasCarrousel === 'true') features.push('carousel');
    if (gardenData.hasSwings === 'true') features.push('swing');
    if (gardenData.hasSpringHorse === 'true') features.push('spring_horse');
    if (gardenData.hasPublicBooksShelf === 'true') features.push('books');
    if (gardenData.hasPingPongTable === 'true') features.push('ping_pong');
    if (gardenData.hasPublicGym === 'true') features.push('gym');
    if (gardenData.hasBasketballField === 'true') features.push('basketball');
    if (gardenData.hasFootballField === 'true') features.push('football');
    if (gardenData.hasSpaceForDogs === 'true') features.push('dog_park');

    let featuresText = features.length > 0 ? `The park has: ${features.join(', ').replace(/_/g, ' ')}.` : 'The park has no special features listed.';
    const totalScenes = 2 + features.length; 

    const prompt = `
        You are an animation director creating a happy, family-friendly story about visiting a public garden.
        The story is told by a friendly mascot, "Sunny the Squirrel".
        Your output MUST be a valid JSON array of objects, with no text before or after it.

        Each object is a scene and must have four properties:
        1. "scene": The scene number.
        2. "description": A short, engaging description (max 10 words) from Sunny the Squirrel's perspective.
        3. "icon": A string representing the scene's main element. For the middle scenes, the icon name MUST be one of the feature names provided.
        4. "duration": A number in milliseconds for the scene's duration (between 2000 and 3000).

        Create a story with exactly ${totalScenes} scenes based on this park:
        - Location: A park in the city of ${gardenData.gardenCity}.
        - Features Available for icon use: ${features.join(', ')}.

        The story MUST be structured like this:
        1. The FIRST scene must be an entrance scene (icon: 'park_entrance').
        2. Create one scene for EACH of the features listed: ${features.join(', ')}. Use the feature name as the icon name for its scene.
        3. The LAST scene must be about kids playing (icon: 'kids_playing').
    `;

    try {
        const response = await fetch('/api/gemini-insight', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ prompt })
        });
        if (!response.ok) throw new Error((await response.json()).message || 'Failed to get animation script');

        const result = await response.json();
        playAnimation(result.animationScript);

    } catch (error) {
        loadingIndicator.classList.add('hidden');
        animationContainer.classList.remove('hidden');
        animationContainer.innerHTML = `<div class="scene active"><p class="scene-description text-red-500">Could not imagine the visit. Error: ${error.message}</p></div>`;
    }
}

// --- ⭐️ END: Gemini Animation Logic with Summary Slide ⭐️ ---

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