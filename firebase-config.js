// =====================================================
// LEBARTO ELECTRONICS
// FIREBASE CONFIGURATION
// =====================================================


// Firebase App
import { initializeApp } from 
"https://www.gstatic.com/firebasejs/12.1.0/firebase-app.js";


// Firebase Authentication
import { getAuth } from 
"https://www.gstatic.com/firebasejs/12.1.0/firebase-auth.js";


// Firebase Firestore
import { getFirestore } from 
"https://www.gstatic.com/firebasejs/12.1.0/firebase-firestore.js";


// Firebase Storage
import { getStorage } from 
"https://www.gstatic.com/firebasejs/12.1.0/firebase-storage.js";


// =====================================================
// FIREBASE CONFIGURATION
// =====================================================

const firebaseConfig = {

    apiKey: "AIzaSyD43Cn-zvC9IIh_amDilx39HttDft1c550",

    authDomain: "lebarto-electronics.firebaseapp.com",

    projectId: "lebarto-electronics",

    storageBucket: "lebarto-electronics.firebasestorage.app",

    messagingSenderId: "563671774874",

    appId: "1:563671774874:web:fe8637ce5f03716e691123",

    measurementId: "G-LQR3KG7ZFZ"

};


// =====================================================
// INITIALIZE FIREBASE
// =====================================================

const app = initializeApp(firebaseConfig);


// =====================================================
// FIREBASE SERVICES
// =====================================================


// Authentication
const auth = getAuth(app);


// Firestore Database
const db = getFirestore(app);


// Storage (Product Images)
const storage = getStorage(app);


// =====================================================
// EXPORT SERVICES
// =====================================================

export {
    auth,
    db,
    storage
};
