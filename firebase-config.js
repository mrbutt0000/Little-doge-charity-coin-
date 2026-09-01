// ============================================
// FIREBASE CONFIGURATION
// ============================================
const firebaseConfig = {
    apiKey: "AIzaSyBr3myUI6FhyShlG5lrD_8LZtzvXszK2xw",
    authDomain: "cyrusprotocol-b3080.firebaseapp.com",
    databaseURL: "https://cyrusprotocol-b3080-default-rtdb.firebaseio.com",
    projectId: "cyrusprotocol-b3080",
    storageBucket: "cyrusprotocol-b3080.firebasestorage.app",
    messagingSenderId: "457843406848",
    appId: "1:457843406848:web:1e345eb2a0ce1a2bf280e5"
};

// Initialize Firebase
firebase.initializeApp(firebaseConfig);
const db = firebase.database();

console.log("🔥 Firebase initialized");
