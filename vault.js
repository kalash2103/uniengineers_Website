/**
 * ============================================================================
 * FILE: vault.js
 * PLATFORM: UniEngineers (Apple-Inspired Cupertino Build)
 * DESCRIPTION: Manages editable user profiles, live Google Maps Geocoding API address
 *              resolution, profile updates in Firebase Auth/Firestore, and fetching
 *              historical completed service records.
 * ============================================================================
 */

import { initializeApp } from "https://www.gstatic.com/firebasejs/12.19.0/firebase-app.js";
import { getAuth, onAuthStateChanged, updateProfile, signOut } from "https://www.gstatic.com/firebasejs/12.19.0/firebase-auth.js";
import { getFirestore, collection, query, where, getDocs, doc, setDoc, getDoc } from "https://www.gstatic.com/firebasejs/12.19.0/firebase-firestore.js";

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

const VaultState = {
    user: null,
    currentCoords: null
};

// ============================================================================
// 2. AUTHENTICATION & PROFILE LOADING
// ============================================================================

function initializeSessionSecurity() {
    onAuthStateChanged(auth, (user) => {
        if (!user) {
            window.location.replace("index.html");
        } else {
            VaultState.user = user;
            updateSidebarProfile(user);
            populateProfileForm(user);
            fetchUserHistory(user.uid);
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

function populateProfileForm(user) {
    const nameInput = document.getElementById('input-profile-name');
    const phoneInput = document.getElementById('input-profile-phone');
    const picInput = document.getElementById('input-profile-pic');
    const avatarFallback = document.getElementById('avatar-text-fallback');
    const profileImgPrev = document.getElementById('profile-img-preview');

    if (nameInput) nameInput.value = user.displayName || '';
    if (phoneInput) phoneInput.value = user.phoneNumber || '';
    if (picInput && user.photoURL) picInput.value = user.photoURL;

    if (user.photoURL) {
        profileImgPrev.src = user.photoURL;
        profileImgPrev.style.display = 'block';
        avatarFallback.style.display = 'none';
    } else if (user.displayName) {
        avatarFallback.innerText = user.displayName.charAt(0).toUpperCase();
    }
}

// ============================================================================
// 3. EDIT PROFILE SUBMISSION
// ============================================================================

function bindProfileUpdate() {
    const saveBtn = document.getElementById('btn-save-profile');
    if (!saveBtn) return;

    saveBtn.addEventListener('click', async() => {
        const newName = document.getElementById('input-profile-name').value.trim();
        const newPhone = document.getElementById('input-profile-phone').value.trim();
        const newPic = document.getElementById('input-profile-pic').value.trim();

        if (!newName) {
            alert("Name cannot be empty.");
            return;
        }

        saveBtn.disabled = true;
        saveBtn.innerText = "Saving Changes...";

        try {
            // Update Firebase Auth Profile
            await updateProfile(VaultState.user, {
                displayName: newName,
                photoURL: newPic || null
            });

            // Also save extended profile attributes in Firestore 'users' collection
            const userDocRef = doc(db, "users", VaultState.user.uid);
            await setDoc(userDocRef, {
                name: newName,
                phone: newPhone,
                photoURL: newPic,
                email: VaultState.user.email,
                updatedAt: new Date()
            }, { merge: true });

            alert("Profile updated successfully!");
            location.reload(); // Refresh to reflect all changes

        } catch (error) {
            console.error("Profile update error:", error);
            alert("Failed to update profile. Please try again.");
            saveBtn.disabled = false;
            saveBtn.innerText = "Save Changes";
        }
    });
}

// ============================================================================
// 4. LIVE GEOLOCATION & GOOGLE MAPS GEOCODING API
// ============================================================================

function resolveLiveAddress() {
    const addressEl = document.getElementById('live-api-address');

    // Check cache first
    const cached = localStorage.getItem('uniengineers_user_location');
    if (cached) {
        try {
            const parsed = JSON.parse(cached);
            if (parsed.address) {
                addressEl.innerHTML = `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/></svg> ${parsed.address}`;
                return;
            }
        } catch (e) {}
    }

    if (navigator.geolocation) {
        navigator.geolocation.getCurrentPosition(
            (position) => {
                const lat = position.coords.latitude;
                const lng = position.coords.longitude;
                VaultState.currentCoords = { lat, lng };

                // Use Google Maps Geocoder API to get readable address
                if (typeof google !== 'undefined' && google.maps && google.maps.Geocoder) {
                    const geocoder = new google.maps.Geocoder();
                    geocoder.geocode({ location: { lat, lng } }, (results, status) => {
                        if (status === "OK" && results[0]) {
                            const formattedAddress = results[0].formatted_address;
                            addressEl.innerHTML = `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/></svg> ${formattedAddress}`;

                            // Cache location with address
                            localStorage.setItem('uniengineers_user_location', JSON.stringify({
                                lat,
                                lng,
                                address: formattedAddress,
                                timestamp: new Date().getTime()
                            }));
                        } else {
                            addressEl.innerText = `Lat: ${lat.toFixed(2)}, Lng: ${lng.toFixed(2)} (Pune, MH)`;
                        }
                    });
                } else {
                    addressEl.innerText = "Pune, Maharashtra";
                }
            },
            (error) => {
                addressEl.innerText = "Location permission denied. Showing default: Pune, MH";
            }, { enableHighAccuracy: true }
        );
    } else {
        addressEl.innerText = "Geolocation not supported by browser.";
    }
}

document.getElementById('btn-refresh-location').addEventListener('click', () => {
    document.getElementById('live-api-address').innerHTML = "Refreshing live API address...";
    resolveLiveAddress();
});

// ============================================================================
// 5. FETCH SERVICE HISTORY FROM FIRESTORE
// ============================================================================

async function fetchUserHistory(userId) {
    const historyContainer = document.getElementById('vault-history-container');
    const warrantyContainer = document.getElementById('vault-warranty-container');

    try {
        const bookingsRef = collection(db, "bookings");
        const q = query(bookingsRef, where("userId", "==", userId));
        const querySnapshot = await getDocs(q);

        historyContainer.innerHTML = '';
        warrantyContainer.innerHTML = '';

        if (querySnapshot.empty) {
            historyContainer.innerHTML = `<div style="color: var(--sys-text-secondary); text-align: center; padding: 20px;">No service history records found.</div>`;
            warrantyContainer.innerHTML = `<div style="color: var(--sys-text-secondary); text-align: center; padding: 20px;">No active warranties.</div>`;
            return;
        }

        let hasCompleted = false;

        querySnapshot.forEach((docSnap) => {
            const booking = docSnap.data();

            if (booking.status === "Completed") {
                hasCompleted = true;

                // Render History Item
                const item = document.createElement('div');
                item.className = 'history-item';
                item.innerHTML = `
                    <div>
                        <div class="item-title">Engineering Service #${docSnap.id.substring(0, 6).toUpperCase()}</div>
                        <div class="item-sub">${booking.date || 'Recent'} • Slot: ${booking.timeSlot || 'Standard'} • Paid: ₹${booking.totalPaid || booking.visitingFee || 299}</div>
                    </div>
                    <span class="item-badge">Completed</span>
                `;
                historyContainer.appendChild(item);

                // Render Warranty Item (30-day warranty active for completed jobs)
                const warrantyItem = document.createElement('div');
                warrantyItem.className = 'warranty-item';
                warrantyItem.innerHTML = `
                    <div>
                        <div class="item-title">30-Day Service Guarantee</div>
                        <div class="item-sub">Linked to Job #${docSnap.id.substring(0, 6).toUpperCase()}</div>
                    </div>
                    <span class="item-badge" style="background: rgba(0, 122, 255, 0.1); color: var(--sys-blue);">Active (30 Days Left)</span>
                `;
                warrantyContainer.appendChild(warrantyItem);
            }
        });

        if (!hasCompleted) {
            historyContainer.innerHTML = `<div style="color: var(--sys-text-secondary); text-align: center; padding: 20px;">No completed services yet.</div>`;
            warrantyContainer.innerHTML = `<div style="color: var(--sys-text-secondary); text-align: center; padding: 20px;">No active warranties.</div>`;
        }

    } catch (error) {
        console.error("Error fetching service history:", error);
        historyContainer.innerHTML = `<div style="color: #FF3B30; text-align: center; padding: 20px;">Failed to load service history.</div>`;
    }
}

// ============================================================================
// 6. SYSTEM BOOTSTRAP
// ============================================================================

document.addEventListener('DOMContentLoaded', () => {
    console.log("Initializing Service Vault & Profile Engine...");
    initializeSessionSecurity();
    bindProfileUpdate();
    resolveLiveAddress();
});

// ============================================================================
// END OF FILE
// ============================================================================