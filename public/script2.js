// --- Global State for Public View ---
window.allGardens = [];
window.activeFilter = 'all';
let activeAnimationTimeout = null;

// --- Garden Loading & Rendering for Main Page ---
window.loadGardens = async function(isInitialLoad, callback) {
    const gardensList = document.getElementById('gardens-list');
    const messageContainer = document.getElementById('message-container');

    if (isInitialLoad) {
        gardensList.innerHTML = `<p class="text-center text-gray-600">Loading gardens...</p>`;
    }

    try {
        const response = await fetch('/api/gardens');
        if (!response.ok) throw new Error('Failed to fetch gardens');

        window.allGardens = await response.json();
        window.allGardens.forEach(garden => {
            garden.distance = window.calculateDistance(window.currentLocation.lat, window.currentLocation.lng, garden.latitude, garden.longitude);
        });
        window.allGardens.sort((a, b) => a.distance - b.distance);
        window.renderFilteredGardens();

        messageContainer.innerHTML = '';
        if (window.allGardens.length === 0) {
            messageContainer.innerHTML = `<p class="text-center text-gray-700 font-semibold bg-white/50 p-3 rounded-lg">🖊️ No gardens have been added yet. Be the first to write 🖊️</p>`;
        } else if (window.allGardens.length > 0 && window.allGardens[0].distance > 0.1) {
            messageContainer.innerHTML = `<p class="text-center text-gray-700 font-semibold bg-white/50 p-3 rounded-lg">🖊️ Post your garden review to improve the app 🖊️</p>`;
        }

        if (callback && typeof callback === 'function') {
            callback();
        }

    } catch (error) {
        console.error("Error loading gardens:", error);
        gardensList.innerHTML = `<p class="text-center text-red-500">Could not load gardens. ${error.message}</p>`;
    }
};

window.renderFilteredGardens = function() {
    const gardensList = document.getElementById('gardens-list');
    const messageContainer = document.getElementById('message-container');
    gardensList.innerHTML = '';

    const filteredGardens = window.allGardens.filter(garden => {
        if (window.activeFilter === 'all') return true;
        return garden[window.activeFilter] === true;
    });

    if (filteredGardens.length === 0 && window.activeFilter !== 'all') {
        messageContainer.innerHTML = `<p class="text-center text-gray-700 font-semibold bg-white/50 p-3 rounded-lg">No gardens found with this feature.</p>`;
    } else if (filteredGardens.length > 0 && messageContainer.textContent === 'No gardens found with this feature.') {
        messageContainer.innerHTML = '';
    }

    window.gardenMarkers.forEach(marker => marker.setMap(null));
    window.gardenMarkers = [];

    filteredGardens.forEach(garden => {
        const marker = new google.maps.Marker({
            position: { lat: garden.latitude, lng: garden.longitude },
            map: window.map,
            title: garden.customName || `Public Garden - ${garden.address || 'Unknown'}`,
            icon: {
                url: 'data:image/svg+xml;charset=UTF-8,' + encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="#8B5CF6" width="48px" height="48px"><path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z"/><path d="M0 0h24v24H0z" fill="none"/></svg>'),
                scaledSize: new google.maps.Size(40, 40)
            }
        });

        marker.gardenId = garden._id;
        const infoWindowTitle = `${garden.city || 'Unknown'} - ${garden.customName ? `${garden.customName}, ` : ''}${garden.address || 'Address not found'}`;
        const infoWindow = new google.maps.InfoWindow({
            content: `<div class="text-gray-800 cursor-pointer" style="max-width: 250px;" onclick="window.scrollToCard('${garden._id}')">
                          <h3 class="font-bold mb-0.5">${infoWindowTitle}</h3>
                          <p class="text-sm mb-1">Kids Now: ${garden.kidsCount}</p>
                          <p class="text-blue-600 text-xs font-semibold">Click to scroll to card</p>
                      </div>`
        });

        marker.addListener('click', () => {
            infoWindow.open(window.map, marker);
        });
        window.gardenMarkers.push(marker);

        const gardenEl = createGardenCard(garden);
        gardensList.appendChild(gardenEl);
    });

    attachPublicCardEventListeners();
};

function createGardenCard(garden) {
    const el = document.createElement('div');
    el.id = `card-${garden._id}`;
    el.dataset.gardenId = garden._id;
    el.className = 'bg-white p-4 rounded-lg shadow cursor-pointer garden-card';

    const waterTapGrayscale = garden.hasWaterTap ? '' : 'img-grayscale';
    const slideGrayscale = garden.hasSlide ? '' : 'img-grayscale';
    const carrouselGrayscale = garden.hasCarrousel ? '' : 'img-grayscale';
    const swingsGrayscale = garden.hasSwings ? '' : 'img-grayscale';
    const springHorseGrayscale = garden.hasSpringHorse ? '' : 'img-grayscale';
    const publicBooksShelfGrayscale = garden.hasPublicBooksShelf ? '' : 'img-grayscale';
    const pingPongTableGrayscale = garden.hasPingPongTable ? '' : 'img-grayscale';
    const publicGymGrayscale = garden.hasPublicGym ? '' : 'img-grayscale';
    const basketballFieldGrayscale = garden.hasBasketballField ? '' : 'img-grayscale';
    const footballFieldGrayscale = garden.hasFootballField ? '' : 'img-grayscale';
    const spaceForDogsGrayscale = garden.hasSpaceForDogs ? '' : 'img-grayscale';

    el.innerHTML = `
        <div class="flex items-center justify-between mb-2 pointer-events-none">
            <div class="flex items-center"><svg class="w-6 h-6 mr-2 text-green-600" fill="currentColor" viewBox="0 0 20 20"><path d="M11 17a1 1 0 001.447.894l4-2A1 1 0 0017 15V9.236a1 1 0 00-1.447-.894l-4 2a1 1 0 00-.553.894V17zM15.212 6.212A3 3 0 0012 4.077V4a3 3 0 00-6 0v.077a3 3 0 00-3.212 2.135A3 3 0 004 12v3a1 1 0 102 0v-3a1 1 0 10-2 0v-1a1 1 0 011-1 1 1 0 100-2h1a1 1 0 100-2H8a1 1 0 100 2h1a1 1 0 100 2H6a3 3 0 00-2.828 2.828A1 1 0 102 12V9a1 1 0 011-1h1.077a3 3 0 004.846 0H16a1 1 0 011 1v3a1 1 0 102 0v-3a3 3 0 00-1.788-2.788z"></path></svg><h2 class="text-xl font-bold text-gray-700">Public Garden - ${garden.city || 'Unknown'}</h2></div>
            <span class="text-sm font-semibold text-blue-600">${garden.distance.toFixed(1)} km</span>
        </div>
        <div class="flex items-center mb-3 pointer-events-none">
            <svg class="w-4 h-4 mr-2 text-[#8B5CF6] flex-shrink-0" fill="currentColor" viewBox="0 0 20 20"><path fill-rule="evenodd" d="M5.05 4.05a7 7 0 119.9 9.9L10 20l-4.95-6.05a7 7 0 010-9.9zM10 11a2 2 0 100-4 2 2 0 000 4z" clip-rule="evenodd"></path></svg>
            <p class="text-sm text-gray-500">${garden.customName ? `<strong>${garden.customName}</strong> - ` : ''}${garden.address || 'Address not found'}</p>
            <svg class="w-4 h-4 ml-2 text-[#8B5CF6] flex-shrink-0" fill="currentColor" viewBox="0 0 20 20"><path fill-rule="evenodd" d="M5.05 4.05a7 7 0 119.9 9.9L10 20l-4.95-6.05a7 7 0 010-9.9zM10 11a2 2 0 100-4 2 2 0 000 4z" clip-rule="evenodd"></path></svg>
        </div>
        <div class="space-y-2 text-gray-600 pointer-events-none">
            <div class="flex items-center justify-between">
                <div class="flex items-center"><img src="/icons/water-tap-icon.png" class="w-5 h-5 mr-2 ${waterTapGrayscale}"><span><strong>Water Tap:</strong> ${garden.hasWaterTap ? 'Yes' : 'No'}</span></div>
                <span>${garden.hasWaterTap ? '✅' : '❌'}</span>
            </div>
            <div class="flex items-center justify-between">
                <div class="flex items-center"><img src="/icons/slide-icon.jpg" class="w-5 h-5 mr-2 ${slideGrayscale}"><span><strong>Slide:</strong> ${garden.hasSlide ? 'Yes' : 'No'}</span></div>
                <span>${garden.hasSlide ? '✅' : '❌'}</span>
            </div>
            <div class="flex items-center justify-between">
                <div class="flex items-center"><img src="/icons/carousel-icon.jpeg" class="w-5 h-5 mr-2 ${carrouselGrayscale}"><span><strong>Carrousel:</strong> ${garden.hasCarrousel ? 'Yes' : 'No'}</span></div>
                <span>${garden.hasCarrousel ? '✅' : '❌'}</span>
            </div>
            <div class="flex items-center justify-between">
                <div class="flex items-center"><img src="/icons/swing-icon.jpg" class="w-5 h-5 mr-2 ${swingsGrayscale}"><span><strong>Swings:</strong> ${garden.hasSwings ? 'Yes' : 'No'}</span></div>
                <span>${garden.hasSwings ? '✅' : '❌'}</span>
            </div>
            <div class="flex items-center justify-between">
                <div class="flex items-center"><img src="/icons/spring-horse.png" class="w-5 h-5 mr-2 ${springHorseGrayscale}"><span><strong>Spring Horse:</strong> ${garden.hasSpringHorse ? 'Yes' : 'No'}</span></div>
                <span>${garden.hasSpringHorse ? '✅' : '❌'}</span>
            </div>
            <div class="flex items-center justify-between">
                <div class="flex items-center"><img src="/icons/public-books.jpg" class="w-5 h-5 mr-2 ${publicBooksShelfGrayscale}"><span><strong>Public Books Shelf:</strong> ${garden.hasPublicBooksShelf ? 'Yes' : 'No'}</span></div>
                <span>${garden.hasPublicBooksShelf ? '✅' : '❌'}</span>
            </div>
            <div class="flex items-center justify-between">
                <div class="flex items-center"><img src="/icons/ping-pong.jpg" class="w-5 h-5 mr-2 ${pingPongTableGrayscale}"><span><strong>Ping Pong Table:</strong> ${garden.hasPingPongTable ? 'Yes' : 'No'}</span></div>
                <span>${garden.hasPingPongTable ? '✅' : '❌'}</span>
            </div>
            <div class="flex items-center justify-between">
                <div class="flex items-center"><img src="/icons/public-gym-icon.png" class="w-5 h-5 mr-2 ${publicGymGrayscale}"><span><strong>Public Gym:</strong> ${garden.hasPublicGym ? 'Yes' : 'No'}</span></div>
                <span>${garden.hasPublicGym ? '✅' : '❌'}</span>
            </div>
            <div class="flex items-center justify-between">
                <div class="flex items-center"><img src="/icons/basketball-field.png" class="w-5 h-5 mr-2 ${basketballFieldGrayscale}"><span><strong>Basketball Field:</strong> ${garden.hasBasketballField ? 'Yes' : 'No'}</span></div>
                <span>${garden.hasBasketballField ? '✅' : '❌'}</span>
            </div>
            <div class="flex items-center justify-between">
                <div class="flex items-center"><img src="/icons/football-field.jpg" class="w-5 h-5 mr-2 ${footballFieldGrayscale}"><span><strong>Football Field:</strong> ${garden.hasFootballField ? 'Yes' : 'No'}</span></div>
                <span>${garden.hasFootballField ? '✅' : '❌'}</span>
            </div>
            <div class="flex items-center justify-between">
                <div class="flex items-center"><img src="/icons/dogs.jpg" class="w-5 h-5 mr-2 ${spaceForDogsGrayscale}"><span><strong>Space for Dogs:</strong> ${garden.hasSpaceForDogs ? 'Yes' : 'No'}</span></div>
                <span>${garden.hasSpaceForDogs ? '✅' : '❌'}</span>
            </div>
        </div>
        <div class="mt-4 flex items-center justify-between">
            <div class="flex items-center">
                <svg class="w-5 h-5 mr-2 text-gray-700 pointer-events-none" fill="currentColor" viewBox="0 0 20 20"><path fill-rule="evenodd" d="M10 9a3 3 0 100-6 3 3 0 000 6zm-7 9a7 7 0 1114 0H3z" clip-rule="evenodd"></path></svg>
                <label class="font-bold text-gray-700 pointer-events-none">Kids Now: </label>
                <div class="flex items-center ml-2">
                    <input type="number" value="${garden.kidsCount}" min="0" class="kids-count-input w-20 p-1 border rounded" data-id="${garden._id}">
                    <button type="button" class="update-kids-btn hidden ml-2 px-3 py-1 bg-blue-500 text-white text-sm font-semibold rounded-md shadow-sm hover:bg-blue-600" data-id="${garden._id}">Update</button>
                </div>
            </div>
            <span class="text-xs text-gray-500 italic">
                ${garden.kidsCountLastUpdated ? `(updated ${window.formatTimeAgo(garden.kidsCountLastUpdated)})` : ''}
            </span>
        </div>
        <div class="mt-4 pt-4 border-t border-gray-200">
            <a href="https://www.google.com/maps/dir/?api=1&origin=${window.currentLocation.lat},${window.currentLocation.lng}&destination=${garden.latitude},${garden.longitude}&travelmode=walking"
               target="_blank" rel="noopener noreferrer"
               class="block w-full text-center bg-blue-500 text-white font-bold py-2 px-4 rounded-full hover:bg-blue-600 transition-colors directions-btn">
               Get Directions
            </a>
        </div>
        <div class="mt-2">
            <button class="w-full text-center bg-purple-500 text-white font-bold py-2 px-4 rounded-full hover:bg-purple-600 transition-colors gemini-insight-btn"
                data-garden-city="${garden.city || 'Unknown'}"
                data-has-water-tap="${garden.hasWaterTap}"
                data-has-slide="${garden.hasSlide}"
                data-has-carrousel="${garden.hasCarrousel}"
                data-has-swings="${garden.hasSwings}"
                data-has-spring-horse="${garden.hasSpringHorse}"
                data-has-public-books-shelf="${garden.hasPublicBooksShelf}"
                data-has-ping-pong-table="${garden.hasPingPongTable}"
                data-has-public-gym="${garden.hasPublicGym}"
                data-has-basketball-field="${garden.hasBasketballField}"
                data-has-football-field="${garden.hasFootballField}"
                data-has-space-for-dogs="${garden.hasSpaceForDogs}">✨ Imagine Your Visit ✨
            </button>
        </div>
        <div class="mt-2">
            <button class="w-full text-center bg-green-500 text-white font-bold py-2 px-4 rounded-full hover:bg-green-600 transition-colors share-garden-btn" data-id="${garden._id}" data-name="${garden.customName || garden.address || 'Public Garden'}">
                🔗 Share Garden 🔗
            </button>
        </div>
    `;
    return el;
}

function attachPublicCardEventListeners() {
    document.querySelectorAll('.garden-card').forEach(card => {
        card.addEventListener('click', (event) => {
            if (event.target.closest('.kids-count-input, .update-kids-btn, .directions-btn, .gemini-insight-btn, .share-garden-btn')) return;
            const gardenId = card.dataset.gardenId;
            const marker = window.gardenMarkers.find(m => m.gardenId === gardenId);
            if (marker) {
                document.getElementById('map').scrollIntoView({ behavior: 'smooth' });
                window.map.panTo(marker.getPosition());
                google.maps.event.trigger(marker, 'click');
            }
        });
    });

    document.querySelectorAll('.kids-count-input').forEach(input => {
        const initialValue = input.value;
        input.addEventListener('input', (e) => {
            const updateBtn = e.target.closest('.garden-card').querySelector('.update-kids-btn');
            updateBtn.classList.toggle('hidden', e.target.value === initialValue);
        });
    });
}

window.scrollToCard = function(gardenId) {
    const cardElement = document.getElementById(`card-${gardenId}`);
    if (cardElement) {
        cardElement.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
}

window.shareGarden = async function(gardenId, gardenName) {
    const shareData = {
        title: 'Public Garden Locator',
        text: `Check out this garden: ${gardenName}`,
        url: `${window.location.origin}/share.html?id=${gardenId}`
    };

    try {
        if (navigator.share) {
            await navigator.share(shareData);
        } else {
            navigator.clipboard.writeText(shareData.url).then(() => {
                alert('Share feature not supported. Link copied to clipboard!');
            }).catch(err => {
                console.error('Could not copy link: ', err);
                alert('Could not copy link. Please copy this manually:\n' + shareData.url);
            });
        }
    } catch (err) {
        console.log('Share action was cancelled or failed.', err);
    }
};

// --- ✨ START: Gemini Animation Logic with Softer Transitions ✨ ---

function playAnimation(animationScript) {
    const container = document.getElementById('geminiAnimationContainer');
    const loadingIndicator = document.getElementById('geminiLoadingIndicator');

    loadingIndicator.classList.add('hidden');
    container.innerHTML = ''; // Clear any previous content
    container.classList.remove('hidden');

    if (activeAnimationTimeout) {
        clearTimeout(activeAnimationTimeout);
    }

    let sceneIndex = 0;
    const iconsShown = [];

    function showNextScene() {
        const oldScene = container.querySelector('.scene.active');

        // --- Logic for the final summary slide ---
        if (sceneIndex >= animationScript.length) {
            const finalElement = document.createElement('div');
            finalElement.className = 'scene animated-background';
            const iconsHTML = iconsShown.map(src => `<img src="${src}" class="w-10 h-10 object-contain">`).join('');
            finalElement.innerHTML = `
                <p class="scene-description mb-4 font-bold">This park has it all!</p>
                <div class="flex flex-wrap justify-center items-center gap-4">
                    ${iconsHTML}
                </div>`;
            container.appendChild(finalElement);
            
            setTimeout(() => {
                if (oldScene) oldScene.classList.remove('active');
                finalElement.classList.add('active');
            }, 50);

            if (oldScene) {
                setTimeout(() => oldScene.remove(), 550); // Clean up after transition
            }
            return; // End of animation
        }

        // --- Logic for regular feature slides ---
        const sceneData = animationScript[sceneIndex];
        const sceneElement = document.createElement('div');
        sceneElement.className = 'scene animated-background';

        const iconMap = {
            'slide': '/icons/slide-icon.jpg', 'swing': '/icons/swing-icon.jpg',
            'carousel': '/icons/carousel-icon.jpeg', 'spring_horse': '/icons/spring-horse.png',
            'kids_playing': '/icons/kids-playing.jpg', 'dog_park': '/icons/dogs.jpg',
            'basketball': '/icons/basketball-field.png', 'football': '/icons/football-field.jpg',
            'gym': '/icons/public-gym-icon.png', 'ping_pong': '/icons/ping-pong.jpg',
            'books': '/icons/public-books.jpg', 'water_tap': '/icons/water-tap-icon.png',
            'park_entrance': '/icons/park-entrence.jpg'
        };
        const iconSrc = iconMap[sceneData.icon] || '/icons/slide-icon.jpg';

        if (sceneData.icon !== 'park_entrance' && sceneData.icon !== 'kids_playing') {
            iconsShown.push(iconSrc);
        }

        sceneElement.innerHTML = `
            <img src="${iconSrc}" alt="${sceneData.description}" class="scene-icon">
            <p class="scene-description">${sceneData.description}</p>`;
        
        container.appendChild(sceneElement);

        // Cross-fade logic
        setTimeout(() => {
            if (oldScene) oldScene.classList.remove('active'); // Fade out old
            sceneElement.classList.add('active'); // Fade in new
        }, 50);

        if (oldScene) {
            setTimeout(() => oldScene.remove(), 550); // Remove old scene after fade
        }

        sceneIndex++;
        activeAnimationTimeout = setTimeout(showNextScene, sceneData.duration);
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

document.getElementById('closeGeminiModalBtn').addEventListener('click', () => {
    const container = document.getElementById('geminiAnimationContainer');
    if (activeAnimationTimeout) {
        clearTimeout(activeAnimationTimeout);
    }
    container.innerHTML = '';
    document.getElementById('geminiModal').classList.add('hidden');
});

// --- ✨ END: Gemini Animation Logic ✨ ---


// --- Navigation, Filter Menu, and Statistics ---
document.getElementById('hamburger-btn').addEventListener('click', () => {
    document.getElementById('main-nav').classList.toggle('open');
});

document.getElementById('show-gardens-menu-btn').addEventListener('click', () => {
    document.getElementById('main-nav').classList.add('submenu-active');
});

document.querySelectorAll('.filter-option').forEach(button => {
    button.addEventListener('click', (e) => {
        const filterValue = e.currentTarget.dataset.filter;
        const mainNav = document.getElementById('main-nav');
        if (filterValue === 'back') {
            mainNav.classList.remove('submenu-active');
            return;
        }

        window.activeFilter = filterValue;

        const isAdminPageVisible = !document.getElementById('admin-page-content').classList.contains('hidden');

        if (isAdminPageVisible) {
            window.renderFilteredAdminGardens();
        } else {
            if (filterValue !== 'all') {
                fetch('/api/stats/filter-click', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ filterName: filterValue })
                });
            }
            window.renderFilteredGardens();
        }

        mainNav.classList.remove('submenu-active', 'open');
    });
});

document.getElementById('app-stats-nav-btn').addEventListener('click', async () => {
    const statsContent = document.getElementById('stats-content');
    const statsModal = document.getElementById('stats-modal');
    statsContent.innerHTML = '<p>Loading stats...</p>';
    statsModal.classList.remove('hidden');

    try {
        const response = await fetch('/api/stats/filter-clicks');
        if (!response.ok) throw new Error('Failed to fetch stats');
        renderStats(await response.json());
    } catch (error) {
        statsContent.innerHTML = `<p class="text-red-500">${error.message}</p>`;
    }
});

function renderStats(stats) {
    const statsContent = document.getElementById('stats-content');

    const filterLabels = {
        hasWaterTap: `<img src="/icons/water-tap-icon.png" class="w-5 h-5 mr-2" alt="Water Tap Icon"> Water Tap`,
        hasSlide: `<img src="/icons/slide-icon.jpg" class="w-5 h-5 mr-2" alt="Slide Icon"> Slide`,
        hasCarrousel: `<img src="/icons/carousel-icon.jpeg" class="w-5 h-5 mr-2" alt="Carrousel Icon"> Carrousel`,
        hasSwings: `<img src="/icons/swing-icon.jpg" class="w-5 h-5 mr-2" alt="Swings Icon"> Swings`,
        hasSpringHorse: `<img src="/icons/spring-horse.png" class="w-5 h-5 mr-2" alt="Spring Horse Icon"> Spring Horse`,
        hasPublicBooksShelf: `<img src="/icons/public-books.jpg" class="w-5 h-5 mr-2" alt="Public Books Shelf Icon"> Public Books Shelf`,
        hasPingPongTable: `<img src="/icons/ping-pong.jpg" class="w-5 h-5 mr-2" alt="Ping Pong Table Icon"> Ping Pong Table`,
        hasPublicGym: `<img src="/icons/public-gym-icon.png" class="w-5 h-5 mr-2" alt="Public Gym Icon"> Public Gym`,
        hasBasketballField: `<img src="/icons/basketball-field.png" class="w-5 h-5 mr-2" alt="Basketball Field Icon"> Basketball Field`,
        hasFootballField: `<img src="/icons/football-field.jpg" class="w-5 h-5 mr-2" alt="Football Field Icon"> Football Field`,
        hasSpaceForDogs: `<img src="/icons/dogs.jpg" class="w-5 h-5 mr-2" alt="Dogs Space Icon"> Space for Dogs`,
    };

    const createStatsHtml = (title, data) => {
        let listItems;
        if (data.length > 0) {
            listItems = data.map(item => {
                const label = filterLabels[item._id] || item._id;
                return `
                    <li class="flex justify-between items-center text-sm">
                        <span class="flex items-center">${label}</span>
                        <strong class="font-semibold">${item.count}</strong>
                    </li>
                `;
            }).join('');
        } else {
            listItems = '<p class="text-sm text-gray-500">No data for this period.</p>';
        }

        return `
            <div class="p-2 border rounded-lg">
                <h4 class="font-bold text-gray-800 mb-2">${title}</h4>
                <ul class="space-y-1">${listItems}</ul>
            </div>
        `;
    };

    statsContent.innerHTML = `
        ${createStatsHtml('📅 Last 24 Hours', stats.lastDay)}
        ${createStatsHtml('📅 Last 7 Days', stats.lastWeek)}
        ${createStatsHtml('📅 Last 30 Days', stats.lastMonth)}
    `;
}

document.getElementById('close-stats-modal-btn').addEventListener('click', () => {
    document.getElementById('stats-modal').classList.add('hidden');
    document.getElementById('main-nav').classList.remove('open');
});

// --- Initial Load ---
document.addEventListener('DOMContentLoaded', () => {
    window.loadGoogleMapsScript();

    document.getElementById('gardens-list').addEventListener('click', async (e) => {
        if (e.target.classList.contains('update-kids-btn')) {
            const button = e.target;
            const gardenId = button.dataset.id;
            const input = document.querySelector(`.kids-count-input[data-id="${gardenId}"]`);
            const newCount = parseInt(input.value, 10);

            button.disabled = true;
            button.textContent = '...';
            try {
                const response = await fetch(`/api/gardens/${gardenId}/kidscount`, {
                    method: 'PUT',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ kidsCount: newCount })
                });
                if (!response.ok) throw new Error((await response.json()).message || 'Update failed');
                window.loadGardens(false);
            } catch (error) {
                alert('Update failed: ' + error.message);
                const garden = window.allGardens.find(g => g._id === gardenId);
                if (garden) {
                    input.value = garden.kidsCount;
                }
                button.textContent = 'Update';
                button.disabled = false;
                button.classList.add('hidden');
            }
        }
        else if (e.target.classList.contains('gemini-insight-btn')) {
            const gardenData = e.target.dataset;
            requestGardenAnimation(gardenData);
        }
        else if (e.target.classList.contains('share-garden-btn')) {
            const button = e.target;
            const gardenId = button.dataset.id;
            const gardenName = button.dataset.name;
            window.shareGarden(gardenId, gardenName);
        }
    });
});