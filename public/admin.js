// --- Global State for Admin View ---
window.allAdminGardens = [];

// --- DOM Element References ---
const adminRegisterModal = document.getElementById('admin-register-modal');
const adminRegisterForm = document.getElementById('admin-register-form');
const adminLoginModal = document.getElementById('admin-login-modal');
const adminLoginForm = document.getElementById('admin-login-form');
const editGardenModal = document.getElementById('edit-garden-modal');
const editGardenForm = document.getElementById('edit-garden-form');

// --- Authentication & UI Control ---
window.checkAdminStatus = async function() {
    const token = localStorage.getItem('adminToken');
    if (token) {
        try {
            const response = await fetch('/api/auth/check-admin', { headers: window.getAuthHeaders() });
            window.isAdmin = response.ok;
            if (!response.ok) localStorage.removeItem('adminToken');
        } catch (error) {
            console.error("Admin check failed:", error);
            window.isAdmin = false;
        }
    }
    window.updateUIForAdminStatus();
};

window.updateUIForAdminStatus = function() {
    const adminPageNavBtn = document.getElementById('admin-page-nav-btn');
    const adminRegisterNavBtn = document.getElementById('admin-register-nav-btn');
    const logoutAdminBtn = document.getElementById('logout-admin-btn');
    const mainAppContent = document.getElementById('main-app-content');
    const adminPageContent = document.getElementById('admin-page-content');

    if (window.isAdmin) {
        adminPageNavBtn.textContent = '🔐Admin Page🔑';
        adminRegisterNavBtn.classList.add('hidden');
        logoutAdminBtn.classList.remove('hidden');
    } else {
        adminPageNavBtn.textContent = '🔐Admin Login🔑';
        adminRegisterNavBtn.classList.remove('hidden');
        logoutAdminBtn.classList.add('hidden');
        if (!adminPageContent.classList.contains('hidden')) {
            mainAppContent.classList.remove('hidden');
            adminPageContent.classList.add('hidden');
        }
    }
};

window.showAdminPage = function() {
    document.getElementById('main-app-content').classList.add('hidden');
    document.getElementById('admin-page-content').classList.remove('hidden');
    document.getElementById('admin-message-container').textContent = 'Logged in as Admin!';
    window.loadAdminGardens();
    if (window.adminMap) {
        google.maps.event.trigger(window.adminMap, 'resize');
        window.adminMap.setCenter(window.currentLocation);
    }
};

window.showMainPage = function() {
    document.getElementById('admin-page-content').classList.add('hidden');
    document.getElementById('main-app-content').classList.remove('hidden');
    window.activeFilter = 'all';
    window.loadGardens(false);
    if (window.map) {
        google.maps.event.trigger(window.map, 'resize');
        window.map.setCenter(window.currentLocation);
    }
};

// --- Admin CRUD Operations ---
window.loadAdminGardens = async function() {
    const adminGardensList = document.getElementById('admin-gardens-list');
    adminGardensList.innerHTML = `<p class="text-center text-gray-600">Loading gardens for admin...</p>`;
    try {
        const response = await fetch('/api/gardens', { headers: window.getAuthHeaders() });
        if (!response.ok) throw new Error((await response.json()).message || 'Failed to fetch');

        window.allAdminGardens = await response.json();

        window.allAdminGardens.forEach(garden => {
            garden.distance = window.calculateDistance(window.currentLocation.lat, window.currentLocation.lng, garden.latitude, garden.longitude);
        });
        window.allAdminGardens.sort((a, b) => a.distance - b.distance);

        window.renderFilteredAdminGardens();
    } catch (error) {
        adminGardensList.innerHTML = `<p class="text-center text-red-500">Error: ${error.message}</p>`;
        if (error.message.includes('Unauthorized')) {
            localStorage.removeItem('adminToken');
            window.isAdmin = false;
            window.updateUIForAdminStatus();
        }
    }
};

window.renderFilteredAdminGardens = function() {
    const adminGardensList = document.getElementById('admin-gardens-list');
    adminGardensList.innerHTML = '';

    const filteredGardens = window.allAdminGardens.filter(garden => {
        if (window.activeFilter === 'all') return true;
        return garden[window.activeFilter] === true;
    });

    if (filteredGardens.length === 0) {
        adminGardensList.innerHTML = `<p class="text-center text-gray-700 font-semibold bg-white/50 p-3 rounded-lg">No gardens found with this feature.</p>`;
    }

    window.adminGardenMarkers.forEach(marker => marker.setMap(null));
    window.adminGardenMarkers = [];

    filteredGardens.forEach(garden => {
        if (window.adminMap) {
            const adminMarker = new google.maps.Marker({
                position: { lat: garden.latitude, lng: garden.longitude },
                map: window.adminMap,
                title: garden.customName || `Admin Garden: ${garden.address || 'Unknown'}`,
                icon: {
                    url: 'data:image/svg+xml;charset=UTF-8,' + encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="#8B5CF6" width="48px" height="48px"><path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z"/><path d="M0 0h24v24H0z" fill="none"/></svg>'),
                    scaledSize: new google.maps.Size(40, 40)
                }
            });

            adminMarker.gardenId = garden._id;
            const infoWindowTitle = `${garden.city || 'Unknown'} - ${garden.customName ? `${garden.customName}, ` : ''}${garden.address || 'Address not found'}`;
            const adminInfoWindow = new google.maps.InfoWindow({
                content: `<div class="text-gray-800 cursor-pointer" style="max-width: 250px;" onclick="window.scrollToAdminCard('${garden._id}')">
                                      <h3 class="font-bold mb-0.5">${infoWindowTitle}</h3>
                                      <p class="text-sm mb-1">Kids Now: ${garden.kidsCount}</p>
                                      <p class="text-blue-600 text-xs font-semibold">Click to scroll to card</p>
                                  </div>`
            });
            adminMarker.addListener('click', () => { adminInfoWindow.open(window.adminMap, adminMarker); });
            window.adminGardenMarkers.push(adminMarker);
        }

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

        const gardenAdminEl = document.createElement('div');
        gardenAdminEl.id = `admin-card-${garden._id}`;
        gardenAdminEl.dataset.gardenId = garden._id;
        gardenAdminEl.className = 'bg-white p-4 rounded-lg shadow admin-garden-card cursor-pointer hover:bg-gray-100 transition-colors';
        const titleText = `${garden.city || 'Unknown'} - ${garden.customName ? `<strong>${garden.customName}</strong>, ` : ''}${garden.address || 'Address not found'}`;

        gardenAdminEl.innerHTML = `
            <div class="flex items-center justify-between mb-2">
                <h3 class="text-lg font-bold text-gray-700">${titleText}</h3>
                <span class="text-sm font-semibold text-blue-600">${garden.distance.toFixed(1)} km</span>
            </div>
            <p class="text-sm text-gray-600">Kids: ${garden.kidsCount}</p>
            <div class="space-y-1 mt-2 text-gray-600">
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
            <div class="mt-4 pt-4 border-t border-gray-200 space-y-2">
                <button class="w-full text-center bg-blue-500 text-white font-bold py-2 px-4 rounded-full hover:bg-blue-600 transition-colors edit-garden-btn" data-id="${garden._id}" data-custom-name="${garden.customName || ''}" data-city="${garden.city || ''}" data-address="${garden.address || ''}" data-lat="${garden.latitude}" data-lng="${garden.longitude}" data-water-tap="${garden.hasWaterTap}" data-slide="${garden.hasSlide}" data-carrousel="${garden.hasCarrousel}" data-swings="${garden.hasSwings}" data-spring-horse="${garden.hasSpringHorse}" data-has-public-books-shelf="${garden.hasPublicBooksShelf}" data-ping-pong-table="${garden.hasPingPongTable}" data-public-gym="${garden.hasPublicGym}" data-basketball-field="${garden.hasBasketballField}" data-football-field="${garden.hasFootballField}" data-space-for-dogs="${garden.hasSpaceForDogs}" data-kids-count="${garden.kidsCount}">Edit</button>
                
                <button class="w-full text-center bg-green-500 text-white font-bold py-2 px-4 rounded-full hover:bg-green-600 transition-colors share-garden-btn" data-id="${garden._id}" data-name="${garden.customName || garden.address || 'Public Garden'}">🔗 Share Garden 🔗</button>
                
                <button class="w-full text-center bg-red-500 text-white font-bold py-2 px-4 rounded-full hover:bg-red-600 transition-colors delete-garden-btn" data-id="${garden._id}">Delete</button>
            </div>
        `;
        adminGardensList.appendChild(gardenAdminEl);
    });

    adminGardensList.querySelectorAll('.edit-garden-btn').forEach(b => b.addEventListener('click', e => window.openEditGardenModal(e.target.dataset)));

    adminGardensList.querySelectorAll('.delete-garden-btn').forEach(button => {
        button.addEventListener('click', async (e) => {
            if (confirm('Are you sure you want to delete this garden?')) {
                const gardenId = e.target.dataset.id;
                const originalButtonText = button.textContent;
                button.textContent = 'Deleting...';
                button.disabled = true;
                try {
                    const response = await fetch(`/api/gardens/${gardenId}`, {
                        method: 'DELETE',
                        headers: window.getAuthHeaders()
                    });
                    if (!response.ok) {
                        throw new Error((await response.json()).message || 'Failed to delete');
                    }
                    alert('Garden deleted successfully');
                    window.loadGardens(false);
                    window.loadAdminGardens();
                } catch (error) {
                    alert("Could not delete garden: " + error.message);
                    button.textContent = originalButtonText;
                    button.disabled = false;
                }
            }
        });
    });

    adminGardensList.querySelectorAll('.share-garden-btn').forEach(button => {
        button.addEventListener('click', (e) => {
            const gardenId = e.target.dataset.id;
            const gardenName = e.target.dataset.name;
            // The shareGarden function is global, defined in script2.js
            window.shareGarden(gardenId, gardenName);
        });
    });

    adminGardensList.querySelectorAll('.admin-garden-card').forEach(card => {
        card.addEventListener('click', (event) => {
            if (event.target.closest('button')) {
                return;
            }
            const gardenId = card.dataset.gardenId;
            const marker = window.adminGardenMarkers.find(m => m.gardenId === gardenId);
            if (marker) {
                document.getElementById('admin-map').scrollIntoView({ behavior: 'smooth' });
                window.adminMap.panTo(marker.getPosition());
                google.maps.event.trigger(marker, 'click');
            }
        });
    });
};

window.scrollToAdminCard = function(gardenId) {
    const cardElement = document.getElementById(`admin-card-${gardenId}`);
    if (cardElement) {
        cardElement.scrollIntoView({ behavior: 'smooth', block: 'center' });
        cardElement.style.transition = 'background-color 0.5s';
        cardElement.style.backgroundColor = '#ffffffff';
        setTimeout(() => {
            cardElement.style.backgroundColor = '';
        }, 2000);
    }
}

window.openEditGardenModal = function(garden) {
    document.getElementById('edit-garden-id').value = garden.id;
    document.getElementById('edit-custom-name').value = garden.customName || '';
    document.getElementById('edit-city').value = garden.city;
    document.getElementById('edit-address').value = garden.address;
    document.getElementById('edit-latitude').value = garden.lat;
    document.getElementById('edit-longitude').value = garden.lng;
    document.getElementById('edit-kids-count').value = garden.kidsCount;
    document.getElementById('edit-has-water-tap').checked = garden.waterTap === 'true';
    document.getElementById('edit-has-slide').checked = garden.slide === 'true';
    document.getElementById('edit-has-carrousel').checked = garden.carrousel === 'true';
    document.getElementById('edit-has-swings').checked = garden.swings === 'true';
    document.getElementById('edit-has-spring-horse').checked = garden.springHorse === 'true';
    document.getElementById('edit-has-public-books-shelf').checked = garden.hasPublicBooksShelf === 'true';
    document.getElementById('edit-has-ping-pong-table').checked = garden.pingPongTable === 'true';
    document.getElementById('edit-has-public-gym').checked = garden.publicGym === 'true';
    document.getElementById('edit-has-basketball-field').checked = garden.basketballField === 'true';
    document.getElementById('edit-has-football-field').checked = garden.footballField === 'true';
    document.getElementById('edit-has-space-for-dogs').checked = garden.spaceForDogs === 'true';
    editGardenModal.classList.remove('hidden');
};

// --- Event Listeners for Modals and Navigation ---
document.getElementById('admin-page-nav-btn').addEventListener('click', () => {
    document.getElementById('main-nav').classList.remove('open');
    if (!window.isAdmin) adminLoginModal.classList.remove('hidden');
    else window.showAdminPage();
});

document.getElementById('main-page-nav-btn-menu').addEventListener('click', () => {
    document.getElementById('main-nav').classList.remove('open');
    window.showMainPage();
});

document.getElementById('admin-register-nav-btn').addEventListener('click', () => {
    document.getElementById('main-nav').classList.remove('open');
    adminRegisterModal.classList.remove('hidden');
});

document.getElementById('logout-admin-btn').addEventListener('click', () => {
    localStorage.removeItem('adminToken');
    window.isAdmin = false;
    window.updateUIForAdminStatus();
    window.showMainPage();
    document.getElementById('main-nav').classList.remove('open');
    alert('Logged out successfully!');
});

document.getElementById('close-admin-register-modal-btn').addEventListener('click', () => adminRegisterModal.classList.add('hidden'));
document.getElementById('close-admin-login-modal-btn').addEventListener('click', () => adminLoginModal.classList.add('hidden'));
document.getElementById('close-edit-modal-btn').addEventListener('click', () => editGardenModal.classList.add('hidden'));

adminRegisterForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const messageEl = document.getElementById('admin-register-message');
    const formData = Object.fromEntries(new FormData(e.target));
    const registerButton = e.submitter;
    const originalButtonText = registerButton.textContent;
    registerButton.textContent = '...';
    registerButton.disabled = true;
    if (formData.secretCode !== '202507') {
        messageEl.textContent = 'Invalid secret code!';
        registerButton.textContent = originalButtonText;
        registerButton.disabled = false;
        return;
    }
    try {
        const response = await fetch('/api/auth/register', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(formData) });
        const data = await response.json();
        if (!response.ok) throw new Error(data.message);
        alert(data.message);
        adminRegisterModal.classList.add('hidden');
        adminLoginModal.classList.remove('hidden');
    } catch (error) {
        messageEl.textContent = error.message;
    } finally {
        registerButton.textContent = originalButtonText;
        registerButton.disabled = false;
    }
});

adminLoginForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const messageEl = document.getElementById('admin-login-message');
    const formData = Object.fromEntries(new FormData(e.target));
    const loginButton = e.submitter;
    const originalButtonText = loginButton.textContent;
    loginButton.textContent = '...';
    loginButton.disabled = true;
    try {
        const response = await fetch('/api/auth/login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(formData) });
        const data = await response.json();
        if (!response.ok) throw new Error(data.message);
        localStorage.setItem('adminToken', data.token);
        window.isAdmin = true;
        window.updateUIForAdminStatus();
        adminLoginModal.classList.add('hidden');
        document.getElementById('main-nav').classList.remove('open');
        window.showAdminPage();
    } catch (error) {
        messageEl.textContent = error.message;
    } finally {
        loginButton.textContent = originalButtonText;
        loginButton.disabled = false;
    }
});

editGardenForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const gardenId = document.getElementById('edit-garden-id').value;
    const saveButton = e.submitter;
    const originalButtonText = saveButton.textContent;
    saveButton.textContent = 'Saving...';
    saveButton.disabled = true;
    const updatedData = {
        customName: document.getElementById('edit-custom-name').value,
        city: document.getElementById('edit-city').value,
        address: document.getElementById('edit-address').value,
        latitude: parseFloat(document.getElementById('edit-latitude').value),
        longitude: parseFloat(document.getElementById('edit-longitude').value),
        kidsCount: parseInt(document.getElementById('edit-kids-count').value),
        hasWaterTap: document.getElementById('edit-has-water-tap').checked,
        hasSlide: document.getElementById('edit-has-slide').checked,
        hasCarrousel: document.getElementById('edit-has-carrousel').checked,
        hasSwings: document.getElementById('edit-has-swings').checked,
        hasSpringHorse: document.getElementById('edit-has-spring-horse').checked,
        hasPublicBooksShelf: document.getElementById('edit-has-public-books-shelf').checked,
        hasPingPongTable: document.getElementById('edit-has-ping-pong-table').checked,
        hasPublicGym: document.getElementById('edit-has-public-gym').checked,
        hasBasketballField: document.getElementById('edit-has-basketball-field').checked,
        hasFootballField: document.getElementById('edit-has-football-field').checked,
        hasSpaceForDogs: document.getElementById('edit-has-space-for-dogs').checked,
    };
    try {
        const response = await fetch(`/api/gardens/${gardenId}`, { method: 'PUT', headers: window.getAuthHeaders(), body: JSON.stringify(updatedData) });
        if (!response.ok) throw new Error((await response.json()).message);
        alert('Garden updated successfully!');
        editGardenModal.classList.add('hidden');
        window.loadGardens(false);
        window.loadAdminGardens();
    } catch (error) {
        document.getElementById('edit-garden-message').textContent = error.message;
    } finally {
        saveButton.textContent = originalButtonText;
        saveButton.disabled = false;
    }
});

// --- Initial Load ---
document.addEventListener('DOMContentLoaded', () => {
    window.checkAdminStatus();
});