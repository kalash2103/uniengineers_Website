/**
 * ============================================================================
 * FILE: home.js
 * DESCRIPTION: Core logic for the Home Dashboard (User Portal).
 * FEATURES: Firebase Auth, Geolocation (Google Maps), Voice Recognition,
 *           Custom Toast Notifications, Local AI Keyword Matching, and
 *           Dynamic UI Rendering.
 * ============================================================================
 */

import { initializeApp } from "https://www.gstatic.com/firebasejs/12.19.0/firebase-app.js";
import { getAuth, onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/12.19.0/firebase-auth.js";

// ============================================================================
// 1. CONFIGURATION & INITIALIZATION
// ============================================================================

const firebaseConfig = {
    apiKey: "AIzaSyCnlvOWk8G_WOoWo1EGpplcpo3gzMrdOEQ",
    authDomain: "unie-d2c7b.firebaseapp.com",
    projectId: "unie-d2c7b",
    storageBucket: "unie-d2c7b.firebasestorage.app",
    messagingSenderId: "385687385356",
    appId: "1:385687385356:web:499d16af8d6e5fc0508529"
};

// Initialize Firebase App & Auth
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);

// Global App State
const AppState = {
    user: null,
    location: null,
    isListening: false,
    activeBooking: null // Can be fetched from DB later
};

// ============================================================================
// 2. UTILITY & UI FUNCTIONS (Premium Experience)
// ============================================================================

/**
 * Creates and displays a Glassmorphism Toast Notification.
 * Avoids using ugly browser alert() boxes.
 * @param {string} message - The message to display.
 * @param {string} type - 'success', 'error', 'info'
 */
function showToast(message, type = 'info') {
    // Check if a toast container exists, if not, create it
    let toastContainer = document.getElementById('toast-container');
    if (!toastContainer) {
        toastContainer = document.createElement('div');
        toastContainer.id = 'toast-container';
        Object.assign(toastContainer.style, {
            position: 'fixed',
            top: '20px',
            left: '50%',
            transform: 'translateX(-50%)',
            zIndex: '9999',
            display: 'flex',
            flexDirection: 'column',
            gap: '10px',
            width: '90%',
            maxWidth: '400px',
            pointerEvents: 'none'
        });
        document.body.appendChild(toastContainer);
    }

    // Create the toast element
    const toast = document.createElement('div');

    // Glassmorphism styling for Toast
    Object.assign(toast.style, {
        background: type === 'error' ? 'rgba(255, 77, 79, 0.9)' : type === 'success' ? 'rgba(82, 196, 26, 0.9)' : 'rgba(255, 255, 255, 0.9)',
        color: type === 'info' ? '#333' : '#fff',
        backdropFilter: 'blur(10px)',
        webkitBackdropFilter: 'blur(10px)',
        border: '1px solid rgba(255, 255, 255, 0.3)',
        padding: '12px 20px',
        borderRadius: '12px',
        boxShadow: '0 8px 32px rgba(0, 0, 0, 0.1)',
        fontSize: '14px',
        fontWeight: '600',
        textAlign: 'center',
        opacity: '0',
        transform: 'translateY(-20px)',
        transition: 'all 0.3s cubic-bezier(0.68, -0.55, 0.265, 1.55)'
    });

    toast.innerText = message;
    toastContainer.appendChild(toast);

    // Animate In
    requestAnimationFrame(() => {
        toast.style.opacity = '1';
        toast.style.transform = 'translateY(0)';
    });

    // Remove after 3 seconds
    setTimeout(() => {
        toast.style.opacity = '0';
        toast.style.transform = 'translateY(-20px)';
        setTimeout(() => {
            if (toastContainer.contains(toast)) {
                toastContainer.removeChild(toast);
            }
        }, 300); // Wait for transition
    }, 3000);
}

/**
 * Generates a dynamic greeting based on the user's local time.
 * @returns {string} e.g., "Good Morning", "Good Evening"
 */
function getTimeBasedGreeting() {
    const hour = new Date().getHours();
    if (hour >= 5 && hour < 12) return "Good Morning";
    if (hour >= 12 && hour < 17) return "Good Afternoon";
    if (hour >= 17 && hour < 22) return "Good Evening";
    return "Good Night";
}

// ============================================================================
// 3. AUTHENTICATION MODULE
// ============================================================================

/**
 * Monitors the authentication state.
 * Redirects to index.html if user is not logged in.
 * Updates UI with user's name if logged in.
 */
function initAuthListener() {
    onAuthStateChanged(auth, (user) => {
        if (!user) {
            console.warn("No active session found. Redirecting to Login.");
            window.location.replace("index.html");
        } else {
            AppState.user = user;
            console.log("User authenticated:", user.email);

            // Extract a display name (fallback to email prefix if name is missing)
            let displayName = user.displayName;
            if (!displayName && user.email) {
                displayName = user.email.split('@')[0];
                // Capitalize first letter
                displayName = displayName.charAt(0).toUpperCase() + displayName.slice(1);
            }

            const greeting = getTimeBasedGreeting();
            const greetingElement = document.getElementById('user-greeting');

            if (greetingElement) {
                // Fade effect for smooth text update
                greetingElement.style.opacity = 0;
                setTimeout(() => {
                    greetingElement.innerText = `${greeting}, ${displayName} 👋`;
                    greetingElement.style.transition = 'opacity 0.5s ease';
                    greetingElement.style.opacity = 1;
                }, 200);
            }
        }
    });
}

/**
 * Handles User Logout Process.
 */
function handleLogout() {
    showToast("Logging out...", "info");
    signOut(auth).then(() => {
        // Clear local storage cache to ensure clean state for next user
        localStorage.removeItem('uniengineers_user_location');
        window.location.replace("index.html");
    }).catch((error) => {
        console.error("Logout Error:", error);
        showToast("Error logging out. Try again.", "error");
    });
}

// Bind Logout Event
const logoutBtn = document.getElementById('btn-logout');
if (logoutBtn) {
    logoutBtn.addEventListener('click', handleLogout);
}

// ============================================================================
// 4. GEOLOCATION & GOOGLE MAPS MODULE
// ============================================================================

/**
 * Fetches user's current location using Browser Geolocation API.
 * Uses Google Maps Geocoder API to convert Lat/Lng to a readable neighborhood name.
 * Caches the result in localStorage to save API calls on page reloads.
 */
function initLocationServices() {
    const locationEl = document.getElementById('user-location');
    if (!locationEl) return;

    // Check if location is already cached recently (expires after 1 hour)
    const cachedLocationData = localStorage.getItem('uniengineers_user_location');
    if (cachedLocationData) {
        try {
            const parsedData = JSON.parse(cachedLocationData);
            const now = new Date().getTime();
            // Cache valid for 60 minutes
            if (now - parsedData.timestamp < 60 * 60 * 1000) {
                locationEl.innerText = `📍 ${parsedData.address}`;
                AppState.location = parsedData.address;
                console.log("Loaded location from cache.");
                return;
            }
        } catch (e) {
            console.error("Error parsing cached location", e);
        }
    }

    if (!navigator.geolocation) {
        locationEl.innerText = "📍 Location not supported";
        return;
    }

    locationEl.innerText = "📍 Locating you...";

    navigator.geolocation.getCurrentPosition(
        (position) => {
            const lat = position.coords.latitude;
            const lng = position.coords.longitude;

            // Validate if Google Maps API is loaded properly
            if (typeof google === 'undefined' || typeof google.maps === 'undefined') {
                console.error("Google Maps API not loaded.");
                locationEl.innerText = "📍 Location access limited";
                return;
            }

            const geocoder = new google.maps.Geocoder();
            const latlng = { lat: lat, lng: lng };

            geocoder.geocode({ location: latlng }, (results, status) => {
                if (status === "OK" && results[0]) {
                    // Smart parsing: Try to get the Neighborhood or Sublocality
                    let shortAddress = "";
                    for (let i = 0; i < results.length; i++) {
                        if (results[i].types.includes("sublocality") || results[i].types.includes("neighborhood")) {
                            shortAddress = results[i].formatted_address.split(',')[0];
                            break;
                        }
                    }

                    // Fallback if no sublocality found
                    if (!shortAddress) {
                        let addressParts = results[0].formatted_address.split(',');
                        shortAddress = addressParts.length > 2 ? addressParts[addressParts.length - 3].trim() : results[0].formatted_address;
                    }

                    const finalAddress = shortAddress.substring(0, 25) + (shortAddress.length > 25 ? "..." : "");
                    locationEl.innerText = `📍 ${finalAddress}`;
                    AppState.location = finalAddress;

                    // Cache the location
                    localStorage.setItem('uniengineers_user_location', JSON.stringify({
                        address: finalAddress,
                        lat: lat,
                        lng: lng,
                        timestamp: new Date().getTime()
                    }));

                } else {
                    console.warn("Geocoder failed due to: " + status);
                    locationEl.innerText = "📍 Area Unknown";
                }
            });
        },
        (error) => {
            console.warn("Geolocation Error:", error.message);
            switch (error.code) {
                case error.PERMISSION_DENIED:
                    locationEl.innerText = "📍 Permission Denied";
                    break;
                case error.POSITION_UNAVAILABLE:
                    locationEl.innerText = "📍 Position Unavailable";
                    break;
                case error.TIMEOUT:
                    locationEl.innerText = "📍 Request Timeout";
                    break;
                default:
                    locationEl.innerText = "📍 Location Error";
            }
        }, {
            enableHighAccuracy: true,
            timeout: 10000,
            maximumAge: 0
        }
    );
}

// Allow user to click location text to force refresh
const locationTextEl = document.getElementById('user-location');
if (locationTextEl) {
    locationTextEl.addEventListener('click', () => {
        localStorage.removeItem('uniengineers_user_location');
        showToast("Refreshing location...", "info");
        initLocationServices();
    });
}

// ============================================================================
// 5. VOICE RECOGNITION MODULE (Web Speech API)
// ============================================================================

/**
 * Initializes the microphone feature for voice search.
 * Converts speech to text and places it in the search bar.
 */
function initVoiceSearch() {
    const micBtn = document.querySelector('.mic-btn');
    const searchInput = document.getElementById('ai-search-input');

    if (!micBtn || !searchInput) return;

    // Check browser support for Speech API
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;

    if (!SpeechRecognition) {
        micBtn.style.opacity = '0.5';
        micBtn.title = "Voice search not supported in this browser";
        micBtn.addEventListener('click', () => showToast("Voice search is not supported on this browser.", "error"));
        return;
    }

    const recognition = new SpeechRecognition();
    recognition.continuous = false;
    recognition.interimResults = true;
    recognition.lang = 'en-IN'; // Optimized for Indian English/Hinglish

    // Pulse Animation for Mic
    const pulseKeyframes = [
        { transform: 'scale(1)', backgroundColor: 'transparent' },
        { transform: 'scale(1.2)', backgroundColor: 'rgba(255, 77, 79, 0.2)' },
        { transform: 'scale(1)', backgroundColor: 'transparent' }
    ];
    const pulseTiming = { duration: 1000, iterations: Infinity };
    let pulseAnimation = null;

    micBtn.addEventListener('click', () => {
        if (AppState.isListening) {
            recognition.stop();
            return;
        }

        try {
            recognition.start();
        } catch (e) {
            console.error("Speech Recognition Error:", e);
        }
    });

    recognition.onstart = () => {
        AppState.isListening = true;
        searchInput.placeholder = "Listening... Speak now 🎤";
        searchInput.value = "";
        pulseAnimation = micBtn.animate(pulseKeyframes, pulseTiming);
        showToast("Listening...", "info");
    };

    recognition.onresult = (event) => {
        let interimTranscript = '';
        let finalTranscript = '';

        for (let i = event.resultIndex; i < event.results.length; ++i) {
            if (event.results[i].isFinal) {
                finalTranscript += event.results[i][0].transcript;
            } else {
                interimTranscript += event.results[i][0].transcript;
            }
        }

        searchInput.value = finalTranscript || interimTranscript;
    };

    recognition.onerror = (event) => {
        console.error("Voice Recognition Error:", event.error);
        if (event.error === 'not-allowed') {
            showToast("Microphone access denied.", "error");
        } else {
            showToast("Could not understand. Please try typing.", "error");
        }
        stopListeningState();
    };

    recognition.onend = () => {
        stopListeningState();
        // Auto-trigger search if value exists
        if (searchInput.value.trim().length > 0) {
            handleSearchAction();
        }
    };

    function stopListeningState() {
        AppState.isListening = false;
        searchInput.placeholder = "e.g. AC cooling nahi kar raha...";
        if (pulseAnimation) {
            pulseAnimation.cancel();
        }
    }
}

// ============================================================================
// 6. CLIENT-SIDE AI INTENT MATCHER
// ============================================================================

/**
 * A local Keyword NLP Engine that mimics AI behavior.
 * Analyzes the user's string and predicts the correct category.
 * @param {string} query - The user's input string.
 * @returns {string|null} - The detected category or null.
 */
function analyzeIntentLocally(query) {
    if (!query) return null;

    const lowerQuery = query.toLowerCase();

    // Keyword Dictionary for Indian/Hinglish contexts
    const intentDictionary = {
        'Plumber': ['pipe', 'leak', 'water', 'tap', 'sink', 'paani', 'tapak', 'drain', 'block', 'toilet', 'flush', 'motor'],
        'Electrician': ['wire', 'light', 'shock', 'fuse', 'power', 'bijli', 'switch', 'board', 'short circuit', 'fan', 'mcb'],
        'AC-Repair': ['ac', 'cooling', 'gas', 'compressor', 'thanda', 'air conditioner', 'split', 'window ac', 'service'],
        'Carpenter': ['wood', 'door', 'bed', 'lakdi', 'furniture', 'cabinet', 'hinge', 'table', 'chair', 'sofa']
    };

    let highestMatchCategory = null;
    let highestMatchCount = 0;

    // Scan dictionary
    for (const [category, keywords] of Object.entries(intentDictionary)) {
        let matchCount = 0;
        keywords.forEach(keyword => {
            // Using regex for word boundary matching to avoid partial matches
            const regex = new RegExp(`\\b${keyword}\\b`, 'g');
            const matches = lowerQuery.match(regex);
            if (matches) {
                matchCount += matches.length;
            }
        });

        if (matchCount > highestMatchCount) {
            highestMatchCount = matchCount;
            highestMatchCategory = category;
        }
    }

    // Only return a category if we have a strong enough match
    return highestMatchCount > 0 ? highestMatchCategory : null;
}

// ============================================================================
// 7. SEARCH HANDLING & NAVIGATION
// ============================================================================

/**
 * Processes the input from the search bar and navigates to the search page.
 */
function handleSearchAction() {
    const searchInput = document.getElementById('ai-search-input');
    const query = searchInput.value.trim();

    if (!query) {
        showToast("Please describe your problem first.", "error");

        // Add a slight shake animation to the input for feedback
        searchInput.style.transform = "translateX(-5px)";
        setTimeout(() => searchInput.style.transform = "translateX(5px)", 100);
        setTimeout(() => searchInput.style.transform = "translateX(-5px)", 200);
        setTimeout(() => searchInput.style.transform = "translateX(0)", 300);
        return;
    }

    // Show loading state
    const searchBtn = document.getElementById('btn-search');
    const originalText = searchBtn.innerText;
    searchBtn.innerText = "🔍...";
    searchBtn.disabled = true;

    // Run our local AI matcher
    const predictedCategory = analyzeIntentLocally(query);

    console.log(`User Query: "${query}" | Predicted Category: ${predictedCategory || 'Unknown'}`);

    // Build URL parameters safely
    const searchParams = new URLSearchParams();
    searchParams.append('query', query);

    // If our local engine figured it out, pass it along so search.html doesn't have to guess
    if (predictedCategory) {
        searchParams.append('autoCategory', predictedCategory);
    }

    // Simulate slight network delay for premium "processing" feel (500ms)
    setTimeout(() => {
        window.location.href = `search.html?${searchParams.toString()}`;
    }, 500);
}

// Bind Search Button and Enter Key
const searchBtn = document.getElementById('btn-search');
const searchInput = document.getElementById('ai-search-input');

if (searchBtn) {
    searchBtn.addEventListener('click', handleSearchAction);
}

if (searchInput) {
    searchInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') {
            e.preventDefault();
            handleSearchAction();
        }
    });
}

// ============================================================================
// 8. DYNAMIC UI INJECTION (Active Booking Banner)
// ============================================================================

/**
 * Checks for any active bookings (simulated via localStorage for now).
 * If exists, injects a glowing Glassmorphism banner above the categories.
 */
function checkAndRenderActiveBooking() {
    // In a real app, this data would come from Firebase Firestore
    // e.g. db.collection('bookings').where('userId', '==', AppState.user.uid)...

    // For demonstration, we simulate checking local storage
    const activeJobJSON = localStorage.getItem('uniengineers_active_job');

    if (activeJobJSON) {
        try {
            const activeJob = JSON.parse(activeJobJSON);

            // Find the parent container to inject the banner
            const container = document.querySelector('.search-section');
            if (!container) return;

            // Create the Banner element
            const banner = document.createElement('div');
            Object.assign(banner.style, {
                background: 'linear-gradient(135deg, rgba(0, 82, 204, 0.1), rgba(0, 82, 204, 0.05))',
                backdropFilter: 'blur(12px)',
                webkitBackdropFilter: 'blur(12px)',
                border: '1px solid rgba(0, 82, 204, 0.3)',
                borderRadius: '16px',
                padding: '15px 20px',
                marginTop: '20px',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                boxShadow: '0 4px 15px rgba(0, 82, 204, 0.1)',
                cursor: 'pointer',
                transition: 'transform 0.2s'
            });

            // Hover/Active effect
            banner.onmousedown = () => banner.style.transform = 'scale(0.98)';
            banner.onmouseup = () => banner.style.transform = 'scale(1)';

            banner.innerHTML = `
                <div style="display: flex; align-items: center; gap: 12px;">
                    <div style="font-size: 24px; animation: pulse 2s infinite;">📍</div>
                    <div>
                        <h4 style="margin: 0; font-size: 14px; color: #102a43;">${activeJob.expertName} is on the way</h4>
                        <p style="margin: 3px 0 0; font-size: 12px; color: #0052cc; font-weight: 600;">Arriving in ${activeJob.eta} mins</p>
                    </div>
                </div>
                <div style="background: #0052cc; color: white; padding: 6px 12px; border-radius: 8px; font-size: 12px; font-weight: bold;">
                    Track
                </div>
            `;

            // Add CSS animation keyframes dynamically
            if (!document.getElementById('dynamic-animations')) {
                const style = document.createElement('style');
                style.id = 'dynamic-animations';
                style.innerHTML = `
                    @keyframes pulse {
                        0% { transform: scale(1); opacity: 1; }
                        50% { transform: scale(1.1); opacity: 0.7; }
                        100% { transform: scale(1); opacity: 1; }
                    }
                `;
                document.head.appendChild(style);
            }

            // Clicking banner takes user to tracking page
            banner.addEventListener('click', () => {
                window.location.href = 'tracking.html';
            });

            // Insert directly after the search section
            container.insertAdjacentElement('afterend', banner);

        } catch (e) {
            console.error("Error parsing active job", e);
        }
    }
}

// ============================================================================
// 9. SYSTEM BOOTSTRAP
// ============================================================================

/**
 * Master initialization function.
 * Called when the DOM is fully loaded.
 */
function initializeAppServices() {
    console.log("UniEngineers System Booting...");

    // 1. Start Auth Monitoring
    initAuthListener();

    // 2. Start Geolocation Services
    initLocationServices();

    // 3. Initialize Mic / Voice capabilities
    initVoiceSearch();

    // 4. Check for active background jobs
    // Adding slight delay to ensure smooth page load first
    setTimeout(checkAndRenderActiveBooking, 800);

    console.log("System Ready.");
}

// Bind to Window Load
window.addEventListener('DOMContentLoaded', initializeAppServices);

// ============================================================================
// END OF FILE
// ============================================================================