/**
 * ============================================================================
 * FILE: expert-profile.js
 * PLATFORM: UniEngineers (Apple-Inspired Cupertino Build)
 * DESCRIPTION: Fetches and displays real-time expert data from Firebase Firestore.
 *              Handles dynamic DOM injection, portfolio rendering, reviews display,
 *              and secure routing to the booking module.
 * ============================================================================
 */

import { initializeApp } from "https://www.gstatic.com/firebasejs/12.19.0/firebase-app.js";
import { getAuth, onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/12.19.0/firebase-auth.js";
import { getFirestore, doc, getDoc, collection, getDocs, query, where } from "https://www.gstatic.com/firebasejs/12.19.0/firebase-firestore.js";

// ============================================================================
// 1. FIREBASE CONFIGURATION & INITIALIZATION
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

// Global State
const ProfileState = {
    user: null,
    expertId: null,
    expertData: null
};

// ============================================================================
// 2. AUTHENTICATION & SESSION MANAGEMENT
// ============================================================================

function initializeSessionSecurity() {
    onAuthStateChanged(auth, (user) => {
        if (!user) {
            window.location.replace("index.html");
        } else {
            ProfileState.user = user;
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
// 3. URL PARSING (GET EXPERT ID)
// ============================================================================

function parseExpertIdFromURL() {
    const params = new URLSearchParams(window.location.search);
    ProfileState.expertId = params.get('id');

    if (!ProfileState.expertId) {
        renderErrorState("No expert specified. Please select an expert from the search page.");
        return;
    }

    fetchExpertDetailsFromDB(ProfileState.expertId);
}

// ============================================================================
// 4. FIRESTORE DATA FETCHING (STRICTLY NO DUMMY DATA)
// ============================================================================

async function fetchExpertDetailsFromDB(expertId) {
    try {
        // Fetch expert document by ID from Firestore 'experts' collection
        const expertDocRef = doc(db, "experts", expertId);
        const expertSnap = await getDoc(expertDocRef);

        if (!expertSnap.exists()) {
            renderErrorState("Expert profile not found or removed from database.");
            return;
        }

        ProfileState.expertData = expertSnap.data();
        ProfileState.expertData.id = expertSnap.id;

        // Render everything onto the DOM
        renderExpertProfile(ProfileState.expertData);

        // Fetch subcollection reviews or reviews array if applicable
        fetchExpertReviews(expertId);

    } catch (error) {
        console.error("Error fetching expert details:", error);
        renderErrorState("Failed to load expert profile. Please check your network connection.");
    }
}

async function fetchExpertReviews(expertId) {
    const reviewsContainer = document.getElementById('reviews-container');

    try {
        // Query reviews subcollection or field
        const reviewsRef = collection(db, "experts", expertId, "reviews");
        const reviewsSnap = await getDocs(reviewsRef);

        reviewsContainer.innerHTML = '';

        if (reviewsSnap.empty) {
            reviewsContainer.innerHTML = `<div class="stat-box" style="grid-column: span 3; text-align: center; color: var(--sys-text-secondary);">No reviews yet for this expert. Be the first to book!</div>`;
            return;
        }

        reviewsSnap.forEach(doc => {
            const review = doc.data();
            const card = document.createElement('div');
            card.className = 'review-card';

            const stars = "⭐".repeat(review.rating || 5);

            card.innerHTML = `
                <div class="review-top">
                    <span class="reviewer-name">${review.userName || 'Anonymous User'}</span>
                    <span class="review-stars">${stars}</span>
                </div>
                <div class="review-text">${review.comment || ''}</div>
            `;
            reviewsContainer.appendChild(card);
        });

    } catch (e) {
        console.warn("Could not fetch reviews subcollection, checking main doc array...", e);
        // Fallback if reviews are stored directly in the expert document as an array
        if (ProfileState.expertData && ProfileState.expertData.reviewsArray) {
            renderReviewsFromArray(ProfileState.expertData.reviewsArray);
        } else {
            reviewsContainer.innerHTML = `<div class="stat-box" style="text-align: center; color: var(--sys-text-secondary);">No reviews available.</div>`;
        }
    }
}

function renderReviewsFromArray(reviewsArray) {
    const reviewsContainer = document.getElementById('reviews-container');
    reviewsContainer.innerHTML = '';

    if (!reviewsArray || reviewsArray.length === 0) {
        reviewsContainer.innerHTML = `<div style="color: var(--sys-text-secondary); text-align: center;">No reviews yet.</div>`;
        return;
    }

    reviewsArray.forEach(review => {
        const card = document.createElement('div');
        card.className = 'review-card';
        card.innerHTML = `
            <div class="review-top">
                <span class="reviewer-name">${review.userName}</span>
                <span class="review-stars">⭐ ${review.rating}</span>
            </div>
            <div class="review-text">${review.comment}</div>
        `;
        reviewsContainer.appendChild(card);
    });
}

// ============================================================================
// 5. DYNAMIC DOM RENDERING (REPLACING SKELETONS)
// ============================================================================

function renderExpertProfile(expert) {
    // 1. Hero Header Section
    const headerContainer = document.getElementById('expert-header-container');
    const safeImg = expert.profilePic || `https://ui-avatars.com/api/?name=${encodeURIComponent(expert.name)}&background=F2F2F7&color=007AFF&bold=true`;

    headerContainer.innerHTML = `
        <img src="${safeImg}" alt="${expert.name}" class="expert-dp">
        <div class="expert-hero-info">
            <h2>
                ${expert.name} 
                <span class="verified-shield">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>
                    Verified Expert
                </span>
            </h2>
            <p style="color: var(--sys-text-secondary); font-size: 15px; margin-bottom: 8px;">
                Specialized in <strong style="color: var(--sys-text-primary);">${expert.category ? expert.category.replace('-', ' ') : 'General Engineering'}</strong>
            </p>
            <span class="expert-category-tag">★ ${expert.rating || 'New'} Rating</span>
        </div>
    `;

    // 2. Stats Grid Section
    const statsContainer = document.getElementById('expert-stats-container');
    statsContainer.innerHTML = `
        <div class="stat-box">
            <div class="stat-value">${expert.experience || 0} Yrs</div>
            <div class="stat-label">Experience</div>
        </div>
        <div class="stat-box">
            <div class="stat-value">${expert.jobsCompleted || 0}+</div>
            <div class="stat-label">Jobs Done</div>
        </div>
        <div class="stat-box">
            <div class="stat-value">${expert.rating || 'New'}</div>
            <div class="stat-label">Customer Score</div>
        </div>
    `;

    // 3. Portfolio Grid Section
    const portfolioContainer = document.getElementById('portfolio-container');
    portfolioContainer.innerHTML = '';

    if (expert.portfolioImages && expert.portfolioImages.length > 0) {
        expert.portfolioImages.forEach(imgUrl => {
            const img = document.createElement('img');
            img.src = imgUrl;
            img.alt = "Past work portfolio";
            img.className = 'portfolio-img';
            portfolioContainer.appendChild(img);
        });
    } else {
        portfolioContainer.innerHTML = `<div style="color: var(--sys-text-secondary); font-size: 14px;">No portfolio photos uploaded yet.</div>`;
    }

    // 4. Rating summary header
    const ratingSummary = document.getElementById('rating-summary-top');
    if (expert.rating && expert.rating !== "New") {
        ratingSummary.innerText = `⭐ ${expert.rating} / 5.0`;
    }

    // 5. Bottom Floating Action Bar (Visiting Fee & Booking trigger)
    const visitingFeeEl = document.getElementById('visiting-fee');
    const proceedBtn = document.getElementById('btn-proceed-booking');

    const visitingFee = expert.visitingFee || 299; // Default fallback fee if missing
    visitingFeeEl.innerText = `₹${visitingFee}`;

    proceedBtn.disabled = false;
    proceedBtn.addEventListener('click', () => {
        // Navigate to booking page with expert ID and visiting fee parameters
        window.location.href = `booking.html?expertId=${expert.id}&fee=${visitingFee}`;
    });
}

function renderErrorState(message) {
    const mainContent = document.querySelector('.main-content');
    mainContent.innerHTML = `
        <header class="inner-header">
            <button onclick="window.history.back()" class="back-btn">←</button>
            <h1 class="page-title">Profile Error</h1>
        </header>
        <div class="stat-box" style="padding: 40px; text-align: center; color: #FF3B30; font-weight: 600;">
            ${message}
        </div>
    `;
}

// ============================================================================
// 6. SYSTEM BOOTSTRAP
// ============================================================================

document.addEventListener('DOMContentLoaded', () => {
    console.log("Initializing Expert Profile Engine...");
    initializeSessionSecurity();
    parseExpertIdFromURL();
});

// ============================================================================
// END OF FILE
// ============================================================================