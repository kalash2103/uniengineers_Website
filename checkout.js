/**
 * ============================================================================
 * FILE: checkout.js
 * PLATFORM: UniEngineers (Apple-Inspired Cupertino Build)
 * DESCRIPTION: Handles final billing calculations, payment gateway simulation,
 *              expert rating submissions, updating booking status to completed,
 *              and archiving records into the user's service vault.
 * ============================================================================
 */

import { initializeApp } from "https://www.gstatic.com/firebasejs/12.19.0/firebase-app.js";
import { getAuth, onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/12.19.0/firebase-auth.js";
import { getFirestore, doc, updateDoc, addDoc, collection, serverTimestamp } from "https://www.gstatic.com/firebasejs/12.19.0/firebase-firestore.js";

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

const CheckoutState = {
    user: null,
    bookingId: null,
    expertId: null,
    visitingFee: 299,
    laborFee: 450,
    taxAmount: 134,
    totalAmount: 883,
    selectedPaymentMethod: 'upi',
    selectedRating: 5
};

// ============================================================================
// 2. AUTHENTICATION & SESSION MANAGEMENT
// ============================================================================

function initializeSessionSecurity() {
    onAuthStateChanged(auth, (user) => {
        if (!user) {
            window.location.replace("index.html");
        } else {
            CheckoutState.user = user;
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
// 3. INVOICE SETUP & STATE PARSING
// ============================================================================

function loadActiveJobBilling() {
    const activeJobJSON = localStorage.getItem('uniengineers_active_job');

    if (activeJobJSON) {
        try {
            const jobInfo = JSON.parse(activeJobJSON);
            CheckoutState.bookingId = jobInfo.bookingId;
            CheckoutState.expertId = jobInfo.expertId;
        } catch (e) {
            console.error("Error reading active job cache");
        }
    }

    // Calculate totals dynamically
    CheckoutState.totalAmount = CheckoutState.visitingFee + CheckoutState.laborFee + CheckoutState.taxAmount;

    document.getElementById('bill-visiting-fee').innerText = `₹${CheckoutState.visitingFee}`;
    document.getElementById('bill-labor-fee').innerText = `₹${CheckoutState.laborFee}`;
    document.getElementById('bill-tax').innerText = `₹${CheckoutState.taxAmount}`;
    document.getElementById('bill-total').innerText = `₹${CheckoutState.totalAmount}`;
    document.getElementById('footer-total').innerText = `₹${CheckoutState.totalAmount}`;
}

// ============================================================================
// 4. INTERACTIVE PAYMENT & RATING BINDINGS
// ============================================================================

function bindInteractiveComponents() {
    // Payment method selection
    const paymentOptions = document.querySelectorAll('.payment-option');
    paymentOptions.forEach(opt => {
        opt.addEventListener('click', () => {
            paymentOptions.forEach(o => {
                o.classList.remove('selected');
                o.querySelector('input').checked = false;
            });
            opt.classList.add('selected');
            opt.querySelector('input').checked = true;
            CheckoutState.selectedPaymentMethod = opt.dataset.method;
        });
    });

    // Star rating selection
    const starBtns = document.querySelectorAll('.star-btn');
    starBtns.forEach(btn => {
        btn.addEventListener('click', (e) => {
            const val = parseInt(e.target.dataset.val, 10);
            CheckoutState.selectedRating = val;

            starBtns.forEach(b => {
                if (parseInt(b.dataset.val, 10) <= val) {
                    b.classList.add('active');
                } else {
                    b.classList.remove('active');
                }
            });
        });
    });
}

// ============================================================================
// 5. SETTLEMENT & DATABASE SUBMISSION
// ============================================================================

async function handleServiceSettlement() {
    const payBtn = document.getElementById('btn-pay-complete');
    payBtn.disabled = true;
    payBtn.innerText = "Processing Payment...";

    try {
        const comment = document.getElementById('review-comment').value.trim();

        // 1. Update Booking Status to Completed in Firestore if bookingId exists
        if (CheckoutState.bookingId) {
            const bookingRef = doc(db, "bookings", CheckoutState.bookingId);
            await updateDoc(bookingRef, {
                status: "Completed",
                paymentMethod: CheckoutState.selectedPaymentMethod,
                totalPaid: CheckoutState.totalAmount,
                completedAt: serverTimestamp()
            });
        }

        // 2. Submit Review to Expert's subcollection if expertId exists
        if (CheckoutState.expertId) {
            const reviewPayload = {
                userId: CheckoutState.user.uid,
                userName: CheckoutState.user.displayName || CheckoutState.user.email.split('@')[0],
                rating: CheckoutState.selectedRating,
                comment: comment || "Great service!",
                timestamp: serverTimestamp()
            };
            await addDoc(collection(db, "experts", CheckoutState.expertId, "reviews"), reviewPayload);
        }

        // 3. Clear active job session flag so tracking stops showing active state
        localStorage.removeItem('uniengineers_active_job');
        localStorage.removeItem('simulate_active_job');

        alert("Payment successful! Service completed and review submitted.");

        // 4. Redirect to Service Vault (History & Profile Page)
        window.location.replace("vault.html");

    } catch (error) {
        console.error("Settlement error:", error);
        alert("Payment processing failed. Please try again.");
        payBtn.disabled = false;
        payBtn.innerText = "Pay & Complete Service";
    }
}

document.getElementById('btn-pay-complete').addEventListener('click', handleServiceSettlement);

// ============================================================================
// 6. SYSTEM BOOTSTRAP
// ============================================================================

document.addEventListener('DOMContentLoaded', () => {
    console.log("Initializing Checkout & Settlement Engine...");
    initializeSessionSecurity();
    loadActiveJobBilling();
    bindInteractiveComponents();
});

// ============================================================================
// END OF FILE
// ============================================================================