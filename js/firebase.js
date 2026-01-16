// js/firebase.js
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.5/firebase-app.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/10.12.5/firebase-auth.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/10.12.5/firebase-firestore.js";
import { getStorage } from "https://www.gstatic.com/firebasejs/10.12.5/firebase-storage.js";

const firebaseConfig = {
  apiKey: "AIzaSyCogMzgCW9PNgpMv4obRmvxpCMvTAW86I4",
  authDomain: "carwash-app-319c4.firebaseapp.com",
  projectId: "carwash-app-319c4",
  storageBucket: "carwash-app-319c4.firebasestorage.app",
  messagingSenderId: "18322829134",
  appId: "1:18322829134:web:f62eaa60a8c8257dec381f",
};

export const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);
export const storage = getStorage(app);
