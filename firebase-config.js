// ===================================
// FIREBASE CONFIGURATION
// ===================================

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

// Platform wallet address stored in Firestore (settings/platform)
// Default wallet if Firestore setting not found
const DEFAULT_PLATFORM_WALLET = "MD5HGPHVL73EBDUD2Z4K2VDRLUBC4FFN7GOBLKPK6OPPXH6TED4TQAAAAGMZJCJF363XM";
