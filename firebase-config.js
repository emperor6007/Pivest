// ===================================
// FIREBASE CONFIGURATION
// ===================================
// Replace these values with your actual Firebase project credentials

const firebaseConfig = {
  apiKey: "AIzaSyBbcXU4zoe2n0-vhaQLj3w7AoXWxm7q-2s",
  authDomain: "pivest-c8d37.firebaseapp.com",
  projectId: "pivest-c8d37",
  storageBucket: "pivest-c8d37.firebasestorage.app",
  messagingSenderId: "23171846063",
  appId: "1:23171846063:web:4b2889d6930a7ebb8ce95a"
};

// Initialize Firebase
firebase.initializeApp(firebaseConfig);

// Initialize Firebase services
const auth = firebase.auth();
const db = firebase.firestore();

// Admin email (change this to your admin email)
const ADMIN_EMAIL = "admin@piinvestment.com";

// Platform wallet address will be stored in Firestore
// This is just a fallback default
const DEFAULT_PLATFORM_WALLET = "PLATFORM_PI_WALLET_ADDRESS_HERE";