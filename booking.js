/**
 * ============================================================================
 * FILE: booking.js
 * PLATFORM: UniEngineers (Apple-Inspired Cupertino Build)
 * DESCRIPTION: Handles appointment scheduling, date/slot selection, fee calculation,
 *              and writing secure booking documents to Firebase Firestore.
 * ============================================================================
 */

import { initializeApp } from "https://www.gstatic.com/firebasejs/12.19.0/firebase-app.js";
import { getAuth, onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/12.19.0/firebase-auth.js";
import { getFirestore, collection, addDoc, serverTimestamp } from "https://www.gstatic.com/firebasejs/12.19.0/firebase-firestore.js";

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

// Booking State Management
const BookingState = {
    user: null,
    expertId: null,
    visitingFee: 299,
    selectedDate: null,
    selectedSlot: null,
    userAddress: "Pune, Maharashtra"
};

// ============================================================================
// 2. AUTHENTICATION & SESSION MANAGEMENT
// ============================================================================

function initializeSessionSecurity() {
    onAuthStateChanged(auth, (user) => {
        if (!user) {
            window.location.replace("index.html");
        } else {
            BookingState.user = user;
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
// 3. URL PARSING & FEE SETUP
// ============================================================================

function parseURLParameters() {
    const params = new URLSearchParams(window.location.search);
    BookingState.expertId = params.get('expertId');
    const feeParam = params.get('fee');

    if (!BookingState.expertId) {
        alert("No expert selected. Returning to home.");
        window.location.replace("home.html");
        return;
    }

    if (feeParam) {
        BookingState.visitingFee = parseInt(feeParam, 10);
    }

    updateCostBreakdownUI();
}

function updateCostBreakdownUI() {
    document.getElementById('breakdown-fee').innerText = `₹${BookingState.visitingFee}`;
    document.getElementById('breakdown-total').innerText = `₹${BookingState.visitingFee}`;
    document.getElementById('footer-total-amount').innerText = `₹${BookingState.visitingFee}`;
}

// ============================================================================
// 4. DATE & TIME SLOT ENGINE
// ============================================================================

function generateDateScroller() {
    const container = document.getElementById('date-scroller-container');
    container.innerHTML = '';

    const daysOfWeek = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

    // Generate next 7 days
    for (let i = 0; i < 7; i++) {
        const d = new Date();
        d.setDate(d.getDate() + i);

        const dayName = i === 0 ? 'Today' : daysOfWeek[d.getDay()];
        const dayNum = d.getDate();
        const monthStr = months[d.getMonth()];
        const fullDateString = `${dayNum} ${monthStr} ${d.getFullYear()}`;

        const card = document.createElement('div');
        card.className = `date-card ${i === 0 ? 'active' : ''}`; // Default select today
        if (i === 0) BookingState.selectedDate = fullDateString;

        card.innerHTML = `
            <div class="day-name">${dayName}</div>
            <div class="day-num">${dayNum}</div>
            <div style="font-size: 10px; opacity: 0.7; margin-top: 2px;">${monthStr}</div>
        `;

        card.addEventListener('click', () => {
            document.querySelectorAll('.date-card').forEach(c => c.classList.remove('active'));
            card.classList.add('active');
            BookingState.selectedDate = fullDateString;
            validateBookingForm();
        });

        container.appendChild(card);
    }
}

function bindSlotSelection() {
    const slots = document.querySelectorAll('.slot-pill');
    slots.forEach(slot => {
        slot.addEventListener('click', (e) => {
            slots.forEach(s => s.classList.remove('active'));
            e.target.classList.add('active');
            BookingState.selectedSlot = e.target.dataset.slot;
            validateBookingForm();
        });
    });
}

// ============================================================================
// 5. LOCATION LOADER
// ============================================================================

function loadUserLocation() {
    const addressDisplay = document.getElementById('selected-address-display');
    const cachedLoc = localStorage.getItem('uniengineers_user_location');

    if (cachedLoc) {
        try {
            const parsed = JSON.parse(cachedLoc);
            BookingState.userAddress = parsed.address;
            addressDisplay.innerText = parsed.address;
        } catch (e) {
            addressDisplay.innerText = "Pune, Maharashtra (Default)";
        }
    } else {
        addressDisplay.innerText = "Pune, Maharashtra";
    }
}

// ============================================================================
// 6. FORM VALIDATION & SUBMISSION
// ============================================================================

function validateBookingForm() {
    const confirmBtn = document.getElementById('btn-confirm-booking');
    if (BookingState.selectedDate && BookingState.selectedSlot) {
        confirmBtn.disabled = false;
    } else {
        confirmBtn.disabled = true;
    }
}

async function handleBookingSubmission() {
    const confirmBtn = document.getElementById('btn-confirm-booking');
    confirmBtn.disabled = true;
    confirmBtn.innerText = "Securing Appointment...";

    try {
        // Construct Booking Payload
        const bookingPayload = {
            userId: BookingState.user.uid,
            userEmail: BookingState.user.email,
            expertId: BookingState.expertId,
            date: BookingState.selectedDate,
            timeSlot: BookingState.selectedSlot,
            address: BookingState.userAddress,
            visitingFee: BookingState.visitingFee,
            status: "Assigned", // Initial status for tracking
            eta: 15, // Simulated initial ETA in minutes
            createdAt: serverTimestamp()
        };

        // Write to Firestore 'bookings' collection
        const docRef = await addDoc(collection(db, "bookings"), bookingPayload);
        console.log("Booking written with ID: ", docRef.id);

        // Also save active job reference locally so home & tracking modules can read instantly
        localStorage.setItem('uniengineers_active_job', JSON.stringify({
            bookingId: docRef.id,
            expertName: "Assigned Expert",
            eta: 15,
            status: "On the way"
        }));
        localStorage.setItem('simulate_active_job', 'true');

        // Success notification & redirect to tracking
        alert("Booking confirmed successfully!");
        window.location.replace("tracking.html");

    } catch (error) {
        console.error("Error writing booking to Firestore:", error);
        alert("Failed to confirm booking. Please try again.");
        confirmBtn.disabled = false;
        confirmBtn.innerText = "Confirm & Lock Booking";
    }
}

document.getElementById('btn-confirm-booking').addEventListener('click', handleBookingSubmission);

// ============================================================================
// 7. SYSTEM BOOTSTRAP
// ============================================================================

document.addEventListener('DOMContentLoaded', () => {
    console.log("Initializing Booking Engine...");
    initializeSessionSecurity();
    parseURLParameters();
    generateDateScroller();
    bindSlotSelection();
    loadUserLocation();
});

// ============================================================================
// END OF FILE
// ============================================================================