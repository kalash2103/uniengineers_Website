// index.js

// 1. Import Firebase Core and Auth
import { initializeApp } from "https://www.gstatic.com/firebasejs/12.19.0/firebase-app.js";
import { getAuth, createUserWithEmailAndPassword, signInWithEmailAndPassword, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/12.19.0/firebase-auth.js";

// 2. Firebase Configuration (Provided by you)
const firebaseConfig = {
    apiKey: "AIzaSyCnlvOWk8G_WOoWo1EGpplcpo3gzMrdOEQ",
    authDomain: "unie-d2c7b.firebaseapp.com",
    projectId: "unie-d2c7b",
    storageBucket: "unie-d2c7b.firebasestorage.app",
    messagingSenderId: "385687385356",
    appId: "1:385687385356:web:499d16af8d6e5fc0508529"
};

// 3. Initialize Firebase & Auth
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);

// ----------------------------------------------------
// PERSISTENT LOGIN CHECK (Dobara login page na aaye)
// ----------------------------------------------------
onAuthStateChanged(auth, (user) => {
    if (user) {
        // Agar user already logged in hai, direct Dashboard par bhej do
        window.location.replace("home.html");
    }
});

// ----------------------------------------------------
// UI TOGGLE LOGIC (Login <--> Signup)
// ----------------------------------------------------
const loginSection = document.getElementById('login-section');
const signupSection = document.getElementById('signup-section');
const goToSignupBtn = document.getElementById('go-to-signup');
const goToLoginBtn = document.getElementById('go-to-login');

goToSignupBtn.addEventListener('click', () => {
    loginSection.classList.add('hidden');
    signupSection.classList.remove('hidden');
});

goToLoginBtn.addEventListener('click', () => {
    signupSection.classList.add('hidden');
    loginSection.classList.remove('hidden');
});

// ----------------------------------------------------
// FIREBASE AUTHENTICATION LOGIC
// ----------------------------------------------------

// SIGN UP
document.getElementById('btn-signup').addEventListener('click', () => {
    const email = document.getElementById('signup-email').value;
    const password = document.getElementById('signup-password').value;
    const name = document.getElementById('signup-name').value; // We can save this to DB later

    if (email && password) {
        createUserWithEmailAndPassword(auth, email, password)
            .then((userCredential) => {
                alert("Account created successfully!");
                // onAuthStateChanged automatically redirect kar dega home.html par
            })
            .catch((error) => {
                alert("Error: " + error.message);
            });
    } else {
        alert("Please fill all details!");
    }
});

// LOGIN
document.getElementById('btn-login').addEventListener('click', () => {
    const email = document.getElementById('login-email').value;
    const password = document.getElementById('login-password').value;

    if (email && password) {
        signInWithEmailAndPassword(auth, email, password)
            .then((userCredential) => {
                // Logged in! onAuthStateChanged automatically redirect kar dega home.html par
            })
            .catch((error) => {
                alert("Invalid Credentials or Error: " + error.message);
            });
    } else {
        alert("Please enter email and password!");
    }
});