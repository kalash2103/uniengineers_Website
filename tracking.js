/**
 * ============================================================================
 * FILE: tracking.js
 * PLATFORM: UniEngineers (Apple-Inspired Cupertino Build)
 * DESCRIPTION: Manages live map tracking, ETA countdowns, Firestore booking state,
 *              and dispatch communication simulations.
 * ============================================================================
 */

import { initializeApp } from "https://www.gstatic.com/firebasejs/12.19.0/firebase-app.js";
import { getAuth, onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/12.19.0/firebase-auth.js";
import { getFirestore, doc, getDoc, updateDoc } from "https://www.gstatic.com/firebasejs/12.19.0/firebase-firestore.js";

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

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

const TrackingState = {
    user: null,
    bookingId: null,
    bookingData: null,
    mapInstance: null,
    userMarker: null,
    expertMarker: null,
    etaMinutes: 15
};

// ============================================================================
// 2. AUTHENTICATION & SESSION MANAGEMENT
// ============================================================================

function initializeSessionSecurity() {
    onAuthStateChanged(auth, (user) => {
        if (!user) {
            window.location.replace("index.html");
        } else {
            TrackingState.user = user;
            updateSidebarProfile(user);
        }
    });

    const logoutBtn = document.getElementById('btn-logout');
    if (logoutBtn) {
        logoutBtn.addEventListener('click', () => {
            signOut(auth).then(() => {
                localStorage.removeItem('uniengineers_user_location');
                window.location.replace("index.html");
            }).catch(err => console.error("Logout error:", err));
        });
    }
}

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
// 3. BOOKING FETCH & MAP INITIALIZATION
// ============================================================================

function loadActiveBookingInfo() {
    const activeJobJSON = localStorage.getItem('uniengineers_active_job');

    if (!activeJobJSON) {
        // Fallback if no active job in localStorage
        renderNoActiveJobState();
        return;
    }

    try {
        const jobInfo = JSON.parse(activeJobJSON);
        TrackingState.bookingId = jobInfo.bookingId;

        if (TrackingState.bookingId) {
            fetchBookingFromFirestore(TrackingState.bookingId);
        } else {
            renderMockTrackingState(jobInfo);
        }
    } catch (e) {
        console.error("Error parsing local active job:", e);
        renderNoActiveJobState();
    }
}

async function fetchBookingFromFirestore(bookingId) {
    try {
        const docRef = doc(db, "bookings", bookingId);
        const docSnap = await getDoc(docRef);

        if (docSnap.exists()) {
            TrackingState.bookingData = docSnap.data();

            // Fetch assigned expert details if expertId exists
            if (TrackingState.bookingData.expertId) {
                const expertSnap = await getDoc(doc(db, "experts", TrackingState.bookingData.expertId));
                if (expertSnap.exists()) {
                    TrackingState.expertData = expertSnap.data();
                    updateDispatchCardUI(TrackingState.expertData);
                }
            }

            initAppleStyleMap(TrackingState.bookingData);
        } else {
            renderNoActiveJobState();
        }
    } catch (error) {
        console.error("Error fetching booking from Firestore:", error);
        renderNoActiveJobState();
    }
}

function renderMockTrackingState(jobInfo) {
    document.getElementById('dispatch-name').innerText = "Ramesh Kumar";
    document.getElementById('dispatch-service').innerText = "Senior Electrician • 4.9 ⭐";
    document.getElementById('dispatch-dp').src = "https://ui-avatars.com/api/?name=Ramesh+Kumar&background=007AFF&color=fff";

    // Default location: Pune Center
    const defaultCoords = { lat: 18.5204, lng: 73.8567 };
    initAppleStyleMap({ address: "Pune, Maharashtra" }, defaultCoords);
}

function updateDispatchCardUI(expert) {
    document.getElementById('dispatch-name').innerText = expert.name || "Assigned Expert";
    document.getElementById('dispatch-service').innerText = `${expert.category ? expert.category.replace('-', ' ') : 'Engineering'} Professional • ⭐ ${expert.rating || '4.9'}`;
    if (expert.profilePic) {
        document.getElementById('dispatch-dp').src = expert.profilePic;
    }
}

function renderNoActiveJobState() {
    const mainContent = document.querySelector('.main-content');
    mainContent.innerHTML = `
        <header class="inner-header">
            <button onclick="window.location.href='home.html'" class="back-btn">←</button>
            <h1 class="page-title">Live Execution</h1>
        </header>
        <div style="background: var(--sys-card-bg); border-radius: var(--radius-lg); padding: 60px 20px; text-align: center; border: 1px solid var(--sys-border);">
            <h3 style="font-size: 20px; font-weight: 700; margin-bottom: 8px;">No Active Bookings Found</h3>
            <p style="color: var(--sys-text-secondary); margin-bottom: 24px; font-size: 14px;">You do not have any active service jobs right now. Book an expert from the dashboard to start tracking.</p>
            <a href="home.html" style="background: var(--sys-blue); color: white; padding: 12px 28px; border-radius: 20px; font-weight: 600; display: inline-block;">Go to Dashboard</a>
        </div>
    `;
}

// ============================================================================
// 4. APPLE-INSPIRED MAP & LIVE MARKERS
// ============================================================================

function initAppleStyleMap(booking, customCoords = null) {
    if (typeof google === 'undefined' || !google.maps) return;

    // Default center or user cached location
    let centerCoords = customCoords;
    if (!centerCoords) {
        const cached = localStorage.getItem('uniengineers_user_location');
        if (cached) {
            try {
                const parsed = JSON.parse(cached);
                centerCoords = { lat: parsed.lat, lng: parsed.lng };
            } catch (e) {
                centerCoords = { lat: 18.5204, lng: 73.8567 };
            }
        } else {
            centerCoords = { lat: 18.5204, lng: 73.8567 };
        }
    }

    const appleStyleMap = [
        { "featureType": "administrative", "elementType": "labels.text.fill", "stylers": [{ "color": "#444444" }] },
        { "featureType": "landscape", "elementType": "all", "stylers": [{ "color": "#f2f2f6" }] },
        { "featureType": "poi", "elementType": "all", "stylers": [{ "visibility": "off" }] },
        { "featureType": "road", "elementType": "all", "stylers": [{ "saturation": -100 }, { "lightness": 45 }] },
        { "featureType": "road.highway", "elementType": "all", "stylers": [{ "visibility": "simplified" }, { "color": "#ffffff" }] },
        { "featureType": "water", "elementType": "all", "stylers": [{ "color": "#90c6f9" }, { "visibility": "on" }] }
    ];

    TrackingState.mapInstance = new google.maps.Map(document.getElementById("google-map"), {
        center: centerCoords,
        zoom: 15,
        disableDefaultUI: true,
        styles: appleStyleMap
    });

    // User Location Marker (Blue Dot)
    const userSVG = `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24"><circle cx="12" cy="12" r="10" fill="rgba(0, 122, 255, 0.2)" /><circle cx="12" cy="12" r="6" fill="#007AFF" stroke="white" stroke-width="2" /></svg>`;
    TrackingState.userMarker = new google.maps.Marker({
        position: centerCoords,
        map: TrackingState.mapInstance,
        title: "Your Location",
        icon: { url: 'data:image/svg+xml;charset=UTF-8,' + encodeURIComponent(userSVG), anchor: new google.maps.Point(12, 12) }
    });

    // Expert Marker (Slightly offset to simulate distance)
    const expertCoords = { lat: centerCoords.lat + 0.008, lng: centerCoords.lng + 0.006 };
    const expertSVG = `<svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 24 24"><path fill="#1C1C1E" d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z"/></svg>`;

    TrackingState.expertMarker = new google.maps.Marker({
        position: expertCoords,
        map: TrackingState.mapInstance,
        title: "Expert En Route",
        icon: { url: 'data:image/svg+xml;charset=UTF-8,' + encodeURIComponent(expertSVG), anchor: new google.maps.Point(16, 24) }
    });

    // Start live simulation countdown
    startLiveTrackingSimulation();
}

// ============================================================================
// 5. LIVE SIMULATION & TIMELINE UPDATES
// ============================================================================

function startLiveTrackingSimulation() {
    const etaDisplay = document.getElementById('eta-display');

    let currentEta = 12; // Start from 12 mins

    const countdownInterval = setInterval(() => {
        if (currentEta > 1) {
            currentEta -= 1;
            etaDisplay.innerText = `${currentEta} mins`;
        } else {
            etaDisplay.innerText = "Arriving now";
            document.getElementById('job-status-text').innerText = "Expert Arrived";
            updateTimelineProgress(3);
            clearInterval(countdownInterval);
        }
    }, 15000); // Reduce 1 min every 15 seconds for demo feel

    // Bind call and chat triggers
    document.getElementById('btn-call').addEventListener('click', () => {
        alert("Connecting secure voice call with expert...");
    });

    document.getElementById('btn-chat').addEventListener('click', () => {
        alert("Opening secure dispatch chat window...");
    });
}

function updateTimelineProgress(stepNumber) {
    for (let i = 1; i <= 4; i++) {
        const circle = document.getElementById(`step-${i}`);
        if (!circle) continue;

        if (i < stepNumber) {
            circle.className = "step-circle completed";
            circle.innerText = "✓";
        } else if (i === stepNumber) {
            circle.className = "step-circle active";
            circle.innerText = i;
        } else {
            circle.className = "step-circle";
            circle.innerText = i;
        }
    }
}

// ============================================================================
// 6. SYSTEM BOOTSTRAP
// ============================================================================

document.addEventListener('DOMContentLoaded', () => {
    console.log("Initializing Live Tracking Engine...");
    initializeSessionSecurity();
    loadActiveBookingInfo();
});

// ============================================================================
// END OF FILE
// ============================================================================