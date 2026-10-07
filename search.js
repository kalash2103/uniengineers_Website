/**
 * ============================================================================
 * FILE: search.js
 * PLATFORM: UniEngineers (Premium Apple-Inspired Build)
 * DESCRIPTION: Core logic for the Discovery & Map Engine. 
 *              Handles Firebase Auth, Firestore real-time queries, 
 *              Google Maps dynamic rendering with custom Apple-like styling,
 *              Geolocation, Haversine distance calculations, and UI generation.
 * ============================================================================
 */

import { initializeApp } from "https://www.gstatic.com/firebasejs/12.19.0/firebase-app.js";
import { getAuth, onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/12.19.0/firebase-auth.js";
import { getFirestore, collection, query, where, getDocs } from "https://www.gstatic.com/firebasejs/12.19.0/firebase-firestore.js";

// ============================================================================
// 1. SYSTEM CONFIGURATION & GLOBAL STATE
// ============================================================================

const firebaseConfig = {
    apiKey: "AIzaSyCnlvOWk8G_WOoWo1EGpplcpo3gzMrdOEQ",
    authDomain: "unie-d2c7b.firebaseapp.com",
    projectId: "unie-d2c7b",
    storageBucket: "unie-d2c7b.firebasestorage.app",
    messagingSenderId: "385687385356",
    appId: "1:385687385356:web:499d16af8d6e5fc0508529"
};

// Initialize Firebase Core Services
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

/**
 * Global Application State for Search Module
 * Keeps track of data across functions to avoid redundant API calls.
 */
const AppState = {
    user: null,
    userLocation: null, // { lat: number, lng: number }
    searchIntent: {
        rawQuery: null,
        categorySought: null,
        isAutoDiagnosed: false
    },
    mapEngine: {
        instance: null,
        userMarker: null,
        expertMarkers: []
    },
    expertsData: [], // Stores real data fetched from Firestore
    currentFilter: 'nearest',
    isDataLoaded: false
};

// ============================================================================
// 2. AUTHENTICATION & SESSION MANAGEMENT
// ============================================================================

/**
 * Verifies if the user is authenticated.
 * Redirects to the onboarding gateway if no valid session is found.
 */
function initializeSessionSecurity() {
    onAuthStateChanged(auth, (user) => {
        if (!user) {
            console.warn("Security Event: Unauthenticated access attempt. Redirecting...");
            window.location.replace("index.html");
        } else {
            AppState.user = user;
            updateSidebarProfile(user);
        }
    });
    
    // Bind Sidebar Logout (PC & Mobile)
    const logoutBtnPc = document.getElementById('btn-logout');
    const logoutBtnMob = document.getElementById('mob-btn-logout');
    
    const handleLogout = () => {
        signOut(auth).then(() => {
            localStorage.removeItem('uniengineers_user_location');
            window.location.replace("index.html");
        }).catch(err => console.error("Logout failed:", err));
    };

    if (logoutBtnPc) logoutBtnPc.addEventListener('click', handleLogout);
    if (logoutBtnMob) logoutBtnMob.addEventListener('click', handleLogout);
}

/**
 * Populates the desktop sidebar with the user's information.
 * @param {Object} user - Firebase Auth User Object
 */
function updateSidebarProfile(user) {
    const nameEl = document.getElementById('sidebar-user-name');
    const avatarEl = document.getElementById('avatar-initial');
    if (nameEl && avatarEl) {
        let displayName = user.displayName || user.email.split('@')[0];
        displayName = displayName.charAt(0).toUpperCase() + displayName.slice(1);
        
        nameEl.innerText = displayName;
        avatarEl.innerText = displayName.charAt(0).toUpperCase();
    }
}

// ============================================================================
// 3. INTENT PARSING & UI HEADER CONFIGURATION
// ============================================================================

/**
 * Parses URL search parameters to understand what the user is looking for.
 * Configures the page title and the dynamic AI diagnosis banner.
 */
function parseUserIntent() {
    const urlParams = new URLSearchParams(window.location.search);
    
    AppState.searchIntent.rawQuery = urlParams.get('query');
    
    // Check if the query came through the AI NLP engine (home.js)
    if (urlParams.get('autoCategory')) {
        AppState.searchIntent.categorySought = urlParams.get('autoCategory');
        AppState.searchIntent.isAutoDiagnosed = true;
    } else if (urlParams.get('category')) {
        AppState.searchIntent.categorySought = urlParams.get('category');
    }

    configureDynamicHeaders();
}

/**
 * Updates DOM elements (Titles, Banners) based on the parsed intent.
 */
function configureDynamicHeaders() {
    const titleEl = document.getElementById('dynamic-page-title');
    const bannerEl = document.getElementById('ai-diagnosis-banner');
    const resultTextEl = document.getElementById('ai-result-text');

    // Title Formatting
    if (AppState.searchIntent.categorySought) {
        // Formatting e.g., "AC-Repair" to "AC Repair Experts"
        const formattedCat = AppState.searchIntent.categorySought.replace('-', ' ');
        titleEl.innerText = `${formattedCat} Experts`;
    } else {
        titleEl.innerText = "Available Experts";
    }

    // AI Banner Formatting
    if (AppState.searchIntent.rawQuery) {
        bannerEl.style.display = 'block';
        
        if (AppState.searchIntent.isAutoDiagnosed && AppState.searchIntent.categorySought) {
            const formattedCat = AppState.searchIntent.categorySought.replace('-', ' ');
            resultTextEl.innerText = `Diagnosis complete: You need a ${formattedCat}. Finding nearby professionals.`;
        } else {
            resultTextEl.innerText = `Searching for: "${AppState.searchIntent.rawQuery}"`;
            // Fallback if no specific category was found
            if (!AppState.searchIntent.categorySought) {
                AppState.searchIntent.categorySought = "General"; 
            }
        }
    }
}

// ============================================================================
// 4. GEOLOCATION & APPLE-STYLE MAPS RENDERING
// ============================================================================

/**
 * Attempts to locate the user using Cached Data first, then HTML5 Geolocation.
 */
function bootstrapLocationServices() {
    const loadingOverlay = document.getElementById('map-loading');
    
    // 1. Check LocalStorage Cache (Set in home.js)
    const cachedLocationJSON = localStorage.getItem('uniengineers_user_location');
    
    if (cachedLocationJSON) {
        try {
            const parsedData = JSON.parse(cachedLocationJSON);
            // Check if cache is fresh (less than 2 hours old)
            const now = new Date().getTime();
            if (now - parsedData.timestamp < 2 * 60 * 60 * 1000) {
                AppState.userLocation = { lat: parsedData.lat, lng: parsedData.lng };
                initializePremiumMap();
                loadingOverlay.style.display = 'none';
                return; // Exit early, we have location
            }
        } catch (e) {
            console.warn("Corrupted location cache. Falling back to GPS.");
        }
    }

    // 2. Request Fresh GPS Location
    if (navigator.geolocation) {
        navigator.geolocation.getCurrentPosition(
            (position) => {
                AppState.userLocation = { lat: position.coords.latitude, lng: position.coords.longitude };
                
                // Cache it for the session
                localStorage.setItem('uniengineers_user_location', JSON.stringify({
                    lat: AppState.userLocation.lat,
                    lng: AppState.userLocation.lng,
                    timestamp: new Date().getTime()
                }));

                initializePremiumMap();
                loadingOverlay.style.display = 'none';
            },
            (error) => handleLocationError(error, loadingOverlay),
            { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 }
        );
    } else {
        handleLocationError({ code: 0, message: "Browser does not support Geolocation" }, loadingOverlay);
    }
}

/**
 * Handles errors gracefully if the user denies location or GPS fails.
 */
function handleLocationError(error, loadingOverlay) {
    console.error("Geolocation Error:", error.message);
    loadingOverlay.innerHTML = `
        <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#FF3B30" stroke-width="2" style="margin-bottom:8px">
            <circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/>
        </svg>
        <div style="color:#1C1C1E; font-weight:600">Location Access Required</div>
        <div style="color:#8E8E93; font-size:13px; margin-top:4px">Please enable location to find nearby experts.</div>
    `;
    
    // Default to a central location (e.g., Pune center) so the map doesn't stay grey
    AppState.userLocation = { lat: 18.5204, lng: 73.8567 }; 
    initializePremiumMap();
}

/**
 * Initializes Google Maps with a custom Apple Maps inspired JSON theme.
 * Focuses on minimalism, soft colors, and removing clutter (POIs).
 */
function initializePremiumMap() {
    if (typeof google === 'undefined' || !google.maps) {
        console.error("Google Maps SDK not loaded.");
        return;
    }

    const mapElement = document.getElementById("google-map");
    
    // Apple-inspired minimalist map style
    const appleStyleMap = [
        { "featureType": "administrative", "elementType": "labels.text.fill", "stylers": [{ "color": "#444444" }] },
        { "featureType": "landscape", "elementType": "all", "stylers": [{ "color": "#f2f2f6" }] }, // Apple Light Gray
        { "featureType": "poi", "elementType": "all", "stylers": [{ "visibility": "off" }] }, // Remove POI clutter
        { "featureType": "road", "elementType": "all", "stylers": [{ "saturation": -100 }, { "lightness": 45 }] },
        { "featureType": "road.highway", "elementType": "all", "stylers": [{ "visibility": "simplified" }, { "color": "#ffffff" }] },
        { "featureType": "road.arterial", "elementType": "labels.icon", "stylers": [{ "visibility": "off" }] },
        { "featureType": "transit", "elementType": "all", "stylers": [{ "visibility": "off" }] },
        { "featureType": "water", "elementType": "all", "stylers": [{ "color": "#90c6f9" }, { "visibility": "on" }] } // Apple Water Blue
    ];

    AppState.mapEngine.instance = new google.maps.Map(mapElement, {
        center: AppState.userLocation,
        zoom: 14,
        disableDefaultUI: true, // Hide all Google controls for a native app feel
        zoomControl: true, // Only keep zoom
        zoomControlOptions: { position: google.maps.ControlPosition.RIGHT_CENTER },
        styles: appleStyleMap
    });

    // Create a pulsing Blue Dot for User Location (iOS Style)
    const userIconSVG = `
        <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24">
            <circle cx="12" cy="12" r="10" fill="rgba(0, 122, 255, 0.2)" />
            <circle cx="12" cy="12" r="6" fill="#007AFF" stroke="white" stroke-width="2" />
        </svg>
    `;

    AppState.mapEngine.userMarker = new google.maps.Marker({
        position: AppState.userLocation,
        map: AppState.mapEngine.instance,
        title: "You are here",
        icon: {
            url: 'data:image/svg+xml;charset=UTF-8,' + encodeURIComponent(userIconSVG),
            anchor: new google.maps.Point(12, 12)
        },
        zIndex: 999
    });
}

/**
 * Plots the fetched experts on the map and automatically adjusts the zoom 
 * to ensure all experts and the user are visible (Bounds fitting).
 */
function plotExpertsOnMap() {
    if (!AppState.mapEngine.instance) return;

    // Clear existing markers
    AppState.mapEngine.expertMarkers.forEach(marker => marker.setMap(null));
    AppState.mapEngine.expertMarkers = [];

    const bounds = new google.maps.LatLngBounds();
    bounds.extend(AppState.userLocation); // Include user in bounds

    // Premium Expert Marker SVG (Dark Slate Pin)
    const expertIconSVG = `
        <svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 24 24">
            <path fill="#1C1C1E" d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z"/>
        </svg>
    `;

    AppState.expertsData.forEach(expert => {
        if (expert.lat && expert.lng) {
            const position = { lat: expert.lat, lng: expert.lng };
            
            const marker = new google.maps.Marker({
                position: position,
                map: AppState.mapEngine.instance,
                title: expert.name,
                icon: {
                    url: 'data:image/svg+xml;charset=UTF-8,' + encodeURIComponent(expertIconSVG),
                    anchor: new google.maps.Point(16, 24)
                },
                animation: google.maps.Animation.DROP
            });

            // Add click listener to center map on expert
            marker.addListener('click', () => {
                AppState.mapEngine.instance.panTo(position);
                AppState.mapEngine.instance.setZoom(16);
            });

            AppState.mapEngine.expertMarkers.push(marker);
            bounds.extend(position);
        }
    });

    // Auto-fit map to show user and all experts gracefully
    if (AppState.expertsData.length > 0) {
        AppState.mapEngine.instance.fitBounds(bounds);
        
        // Prevent map from zooming in too uncomfortably close if only 1 expert is nearby
        const listener = google.maps.event.addListener(AppState.mapEngine.instance, "idle", function() { 
            if (AppState.mapEngine.instance.getZoom() > 15) {
                AppState.mapEngine.instance.setZoom(15);
            }
            google.maps.event.removeListener(listener); 
        });
    }
}

// ============================================================================
// 5. FIRESTORE DATABASE ENGINE (STRICTLY NO DUMMY DATA)
// ============================================================================

/**
 * Queries the Firebase Firestore database for real experts based on category.
 * Calculates dynamic distances using the Haversine formula.
 */
async function fetchRealExpertsFromDB() {
    const listContainer = document.getElementById('experts-list');

    if (!AppState.searchIntent.categorySought) {
        renderEmptyState("No service category specified. Please return home and try again.");
        return;
    }

    try {
        const expertsRef = collection(db, "experts");
        
        // Strict database query: Match Category AND must be Verified
        const q = query(
            expertsRef, 
            where("category", "==", AppState.searchIntent.categorySought),
            where("isVerified", "==", true)
        );
        
        const querySnapshot = await getDocs(q);
        
        if (querySnapshot.empty) {
            renderEmptyState(`Currently, no verified ${AppState.searchIntent.categorySought.replace('-', ' ')}s are available in your vicinity.`);
            return;
        }

        const rawData = [];
        querySnapshot.forEach((doc) => {
            let data = doc.data();
            data.id = doc.id; // Crucial for routing to expert-profile.html
            
            // Mathematics: Haversine Distance Calculation
            if (AppState.userLocation && data.lat && data.lng) {
                data.distanceValue = calculateHaversineDistance(
                    AppState.userLocation.lat, AppState.userLocation.lng,
                    data.lat, data.lng
                );
                data.displayDistance = data.distanceValue.toFixed(1) + " km";
            } else {
                data.distanceValue = 999; 
                data.displayDistance = "Distance Unknown";
            }
            
            // Data Sanitization / Defaults if DB misses fields
            data.experience = data.experience || 0;
            data.rating = data.rating || "New";
            data.jobsCompleted = data.jobsCompleted || 0;
            
            rawData.push(data);
        });

        AppState.expertsData = rawData;
        AppState.isDataLoaded = true;

        // Apply default filter (Nearest First) and render
        executeFilterAlgorithm(AppState.currentFilter);
        
        // Update map pins
        setTimeout(plotExpertsOnMap, 300); // Slight delay for UI smoothness

    } catch (error) {
        console.error("Firestore Query Error:", error);
        renderEmptyState("We are unable to connect to our secure servers right now. Please check your internet connection.", true);
    }
}

/**
 * Mathematical formula to calculate shortest over-earth distance.
 * @returns {number} Distance in kilometers
 */
function calculateHaversineDistance(lat1, lon1, lat2, lon2) {
    const R = 6371; // Earth Radius in km
    const dLat = (lat2 - lat1) * (Math.PI/180);
    const dLon = (lon2 - lon1) * (Math.PI/180); 
    const a = 
        Math.sin(dLat/2) * Math.sin(dLat/2) +
        Math.cos(lat1 * (Math.PI/180)) * Math.cos(lat2 * (Math.PI/180)) * 
        Math.sin(dLon/2) * Math.sin(dLon/2); 
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a)); 
    return R * c;
}

// ============================================================================
// 6. DYNAMIC UI GENERATION & ANIMATION
// ============================================================================

/**
 * Generates the HTML for the expert cards dynamically and injects them into the DOM.
 * Utilizes Intersection Observer for smooth, staggered fade-in animations (Apple Style).
 */
function renderExpertCards(dataArray) {
    const container = document.getElementById('experts-list');
    
    // Wipe Skeletons / Previous data
    container.innerHTML = ''; 

    if (dataArray.length === 0) {
        renderEmptyState("No experts match your current filter criteria.");
        return;
    }

    // Prepare an Intersection Observer for smooth reveal animations
    const observerOptions = {
        root: null,
        rootMargin: '0px',
        threshold: 0.1
    };
    
    const cardObserver = new IntersectionObserver((entries, observer) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                // Apply a smooth fade-up animation via inline styles
                entry.target.style.opacity = '1';
                entry.target.style.transform = 'translateY(0)';
                observer.unobserve(entry.target);
            }
        });
    }, observerOptions);

    // Build the DOM nodes
    dataArray.forEach((expert, index) => {
        const card = document.createElement('a');
        card.href = `expert-profile.html?id=${expert.id}`;
        card.className = 'expert-card';
        
        // Initial state for animation
        card.style.opacity = '0';
        card.style.transform = 'translateY(20px)';
        // Stagger transition based on index to create a "waterfall" effect
        card.style.transition = `all 0.5s cubic-bezier(0.25, 1, 0.5, 1) ${index * 0.05}s`;

        // Handle profile picture fallback securely
        const safeImgUrl = expert.profilePic ? expert.profilePic : 
            `https://ui-avatars.com/api/?name=${encodeURIComponent(expert.name)}&background=F2F2F7&color=007AFF&bold=true`;

        // Determine Rating Color logic
        let ratingHTML = '';
        if(expert.rating === "New") {
            ratingHTML = `<span style="color:#8E8E93">New Expert</span>`;
        } else {
            ratingHTML = `⭐ ${expert.rating}`;
        }

        card.innerHTML = `
            <img src="${safeImgUrl}" alt="${expert.name}" class="expert-photo" loading="lazy">
            <div class="expert-info">
                <div class="expert-name">
                    ${expert.name} 
                    <svg class="verified-badge" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>
                </div>
                <div class="expert-meta">
                    ${expert.experience} Yrs Exp • ${expert.jobsCompleted} Jobs Completed
                </div>
                <div class="expert-rating">
                    ${ratingHTML}
                </div>
            </div>
            <div class="expert-distance">
                ${expert.displayDistance}
            </div>
        `;

        container.appendChild(card);
        cardObserver.observe(card); // Attach observer
    });
}

/**
 * Helper function to render a clean, premium empty/error state.
 */
function renderEmptyState(message, isError = false) {
    const container = document.getElementById('experts-list');
    const icon = isError 
        ? `<svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="#FF3B30" stroke-width="1.5" style="margin-bottom:16px"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>`
        : `<svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="#8E8E93" stroke-width="1.5" style="margin-bottom:16px"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>`;

    container.innerHTML = `
        <div class="status-message">
            ${icon}
            <div>${message}</div>
        </div>
    `;
}

// ============================================================================
// 7. SORTING & FILTERING ENGINE
// ============================================================================

/**
 * Executes a sorting algorithm over the fetched data without calling the DB again.
 * @param {string} filterType - 'nearest', 'top-rated', 'experienced'
 */
function executeFilterAlgorithm(filterType) {
    if (!AppState.isDataLoaded || AppState.expertsData.length === 0) return;

    AppState.currentFilter = filterType;
    let dataToRender = [...AppState.expertsData]; // Deep clone array to avoid mutating original state

    switch (filterType) {
        case 'nearest':
            // Sort ascending by numerical distance
            dataToRender.sort((a, b) => a.distanceValue - b.distanceValue);
            break;
        case 'top-rated':
            // Sort descending by rating. "New" experts go to the bottom.
            dataToRender.sort((a, b) => {
                const ratingA = a.rating === "New" ? 0 : parseFloat(a.rating);
                const ratingB = b.rating === "New" ? 0 : parseFloat(b.rating);
                return ratingB - ratingA;
            });
            break;
        case 'experienced':
            // Sort descending by years of experience
            dataToRender.sort((a, b) => parseInt(b.experience) - parseInt(a.experience));
            break;
        default:
            break; // Retain default order
    }

    renderExpertCards(dataToRender);
    updateFilterUIState(filterType);
}

/**
 * Updates the visual styling of the Pill filters at the top of the list.
 */
function updateFilterUIState(activeFilterType) {
    const tabs = document.querySelectorAll('.filter-tab');
    tabs.forEach(tab => {
        if (tab.dataset.filter === activeFilterType) {
            tab.classList.add('active');
        } else {
            tab.classList.remove('active');
        }
    });
}

/**
 * Attaches event listeners to the Filter Tabs.
 */
function bindFilterEvents() {
    document.querySelectorAll('.filter-tab').forEach(tab => {
        tab.addEventListener('click', (e) => {
            // Prevent redundant sorting if already active
            if (e.target.dataset.filter !== AppState.currentFilter) {
                // Haptic feedback simulation for mobile
                if(navigator.vibrate) navigator.vibrate(10);
                
                executeFilterAlgorithm(e.target.dataset.filter);
            }
        });
    });
}

// ============================================================================
// 8. SYSTEM BOOTSTRAP
// ============================================================================

/**
 * Master Controller initialization.
 * Waits for DOM content to ensure elements exist before manipulating them.
 */
document.addEventListener('DOMContentLoaded', () => {
    console.log("Initializing UniEngineers Discovery Engine...");

    // 1. Enforce Authentication
    initializeSessionSecurity();

    // 2. Decode user request from URL
    parseUserIntent();

    // 3. Initialize Interactive Map & Geolocation
    bootstrapLocationServices();

    // 4. Bind Interactions
    bindFilterEvents();

    // 5. Fetch Production Data from Firebase
    // 600ms artificial delay to allow skeleton loaders to demonstrate 
    // the premium UI feel before data overwrites them.
    setTimeout(() => {
        fetchRealExpertsFromDB();
    }, 600);
});

// ============================================================================
// END OF FILE
// ============================================================================