// firebase.js

import { initializeApp } from "https://www.gstatic.com/firebasejs/10.11.0/firebase-app.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/10.11.0/firebase-auth.js";
import { getDatabase } from "https://www.gstatic.com/firebasejs/10.11.0/firebase-database.js";

// ✅ Your actual Firebase config with correct API key
const firebaseConfig = {
    apiKey: "AIzaSyAJYG_Zl9cTnp1iemj2qdTtYDoSLJqPHkY", // Replace with your actual API key
    authDomain: "nutrition-chatbot-85644.firebaseapp.com", // Replace with your auth domain
    projectId: "nutrition-chatbot-85644", // Replace with your project ID
    storageBucket: "nutrition-chatbot-85644.appspot.com", // Replace with your storage bucket
    messagingSenderId: "76719755111", // Replace with your messaging sender ID
    appId: "1:76719755111:web:56bacd8f5f26fa0ac0a9c2", // Replace with your app ID
    measurementId: "G-WS4Z999JV6", // Replace with your measurement ID (optional)
    databaseURL: "https://nutrition-chatbot-85644-default-rtdb.firebaseio.com" // Replace with your database URL
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const database = getDatabase(app);

export { auth, database };
