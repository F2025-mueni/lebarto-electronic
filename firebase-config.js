// ===========================================
// LEBARTO ELECTRONICS SALES SYSTEM
// firebase-config.js
// ===========================================

import { initializeApp } from "https://www.gstatic.com/firebasejs/12.1.0/firebase-app.js";

import { getAuth } from "https://www.gstatic.com/firebasejs/12.1.0/firebase-auth.js";

import { getFirestore } from "https://www.gstatic.com/firebasejs/12.1.0/firebase-firestore.js";


// ===========================================
// FIREBASE CONFIGURATION
// ===========================================

const firebaseConfig = {

    apiKey: "AIzaSyD43Cn-zvC9IIh_amDilx39HttDft1c550",

    authDomain: "lebarto-electronics.firebaseapp.com",

    projectId: "lebarto-electronics",

    storageBucket: "lebarto-electronics.firebasestorage.app",

    messagingSenderId: "563671774874",

    appId: "1:563671774874:web:fe8637ce5f03716e691123",

    measurementId: "G-LQR3KG7ZFZ"

};


// ===========================================
// INITIALIZE FIREBASE
// ===========================================

const app = initializeApp(firebaseConfig);


// Authentication

const auth = getAuth(app);


// Firestore

const db = getFirestore(app);


// Export

export { auth, db };