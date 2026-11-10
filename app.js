import { auth, database } from './firebase.js';
import {
    createUserWithEmailAndPassword,
    signInWithEmailAndPassword,
    signOut,
    onAuthStateChanged
} from "https://www.gstatic.com/firebasejs/10.11.0/firebase-auth.js";

import {
    ref,
    push,
    remove,
    onValue,
    set,
    get
} from "https://www.gstatic.com/firebasejs/10.11.0/firebase-database.js";

// DOM Elements
const emailInput = document.getElementById('email');
const passwordInput = document.getElementById('password');
const errorMsg = document.getElementById('auth-error');
const chatBox = document.getElementById('chat-box');
const chatInput = document.getElementById('user-input');
const sendBtn = document.getElementById('send-button');
const authSection = document.getElementById('auth-section');
const appShell = document.querySelector('.app-shell');
const chatSection = document.getElementById('chat-section');
const historySection = document.getElementById('history-section');
const progressSection = document.getElementById('progress-section');
const chatHistoryList = document.getElementById('chat-history-list');
const progressBar = document.getElementById('progress-fill');
const progressDayText = document.getElementById('progress-day');
const timerText = document.getElementById('timer');
const chatStatus = document.getElementById('chat-status');

let currentUser = null;
let currentChat = [];
let currentDay = 0;
let timerInterval = null;
let startTime = null;

// --- AUTH FUNCTIONS ---
window.signUp = async function () {
    const email = emailInput.value;
    const password = passwordInput.value;
    if (password.length < 6) return showError("Password must be at least 6 characters");

    try {
        await createUserWithEmailAndPassword(auth, email, password);
        errorMsg.innerText = '';
    } catch (error) {
        showError("Signup error: " + error.message);
    }
};

window.login = async function () {
    const email = emailInput.value;
    const password = passwordInput.value;

    try {
        await signInWithEmailAndPassword(auth, email, password);
        errorMsg.innerText = '';
    } catch (error) {
        showError("Wrong email or password.");
    }
};

window.logout = async function () {
    await signOut(auth);
    emailInput.value = '';
    passwordInput.value = '';
    authSection.style.display = 'block';
    chatSection.style.display = 'none';
    historySection.style.display = 'none';
    progressSection.style.display = 'none';
    stopTimer();
};
function showError(msg) {
    errorMsg.innerText = msg;
    errorMsg.style.color = 'red';
}

// --- USER STATE ---
onAuthStateChanged(auth, async (user) => {
    if (user) {
        currentUser = user;
        authSection.style.display = 'none';
        appShell.style.display = 'flex';
        chatSection.style.display = 'block';
        await loadProgress();
        loadChatHistory();
    } else {
        currentUser = null;
        stopTimer();
        authSection.style.display = 'block';
        appShell.style.display = 'none';
        chatSection.style.display = 'none';
        historySection.style.display = 'none';
        progressSection.style.display = 'none';
    }
});

// --- CHAT FUNCTIONS ---
function appendMessage(sender, msg) {
    const div = document.createElement("div");
    div.className = "message";
    if (sender === "You") div.classList.add("user-message");
    const label = document.createElement("strong");
    label.textContent = `${sender}:`;
    div.append(label, document.createTextNode(` ${msg}`));
    chatBox.appendChild(div);
    chatBox.scrollTop = chatBox.scrollHeight;
}

window.sendMessage = async function () {
    const userInput = chatInput.value.trim();
    if (!userInput) return;

    chatBox.querySelector(".welcome-card")?.remove();
    appendMessage("You", userInput);
    chatInput.value = "";
    sendBtn.disabled = true;
    chatStatus.innerText = "Thinking through your question…";

    try {
        const res = await fetch("/api/chat", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                messages: [
                    ...currentChat.map((message) => ({
                        role: message.role === "bot" ? "assistant" : "user",
                        content: message.message
                    })),
                    { role: "user", content: userInput }
                ]
            })
        });
        const data = await res.json();

        if (!res.ok) {
            throw new Error(data.error || `Chat request failed (${res.status})`);
        }

        if (data.choices && data.choices.length > 0) {
            const reply = data.choices[0].message.content;
            appendMessage("Bot", reply);
            currentChat.push({ role: "user", message: userInput });
            currentChat.push({ role: "bot", message: reply });
            chatStatus.innerText = "";
        } else {
            throw new Error("The AI returned an empty response. Please try again.");
        }
    } catch (error) {
        appendMessage("Bot", `Error: ${error.message}`);
        chatStatus.innerText = "";
    } finally {
        sendBtn.disabled = false;
    }
};

window.askSuggestion = function (question) {
    chatInput.value = question;
    window.sendMessage();
};

window.startNewChat = function () {
    if (currentUser && currentChat.length > 0) {
        const chatRef = ref(database, 'users/' + currentUser.uid + '/history');
        push(chatRef, currentChat);
    }
    chatBox.innerHTML = '';
    currentChat = [];
    chatStatus.innerText = "";
    const welcome = document.createElement("div");
    welcome.className = "welcome-card";
    welcome.innerHTML = '<span class="welcome-spark">✦</span><h3>What would you like to feel better about?</h3><p>I can help you explore everyday nutrition questions. I’m an AI assistant, not a medical professional.</p><div class="suggestions"><button onclick="askSuggestion(\'What does a balanced lunch look like?\')">🥗 Balanced lunch ideas</button><button onclick="askSuggestion(\'Suggest some healthy high-protein snacks.\')">🥜 High-protein snacks</button><button onclick="askSuggestion(\'How can I build a healthier eating habit?\')">🌱 Build a healthy habit</button></div>';
    chatBox.appendChild(welcome);
};

window.openChatHistory = function () {
    chatSection.style.display = 'none';
    historySection.style.display = 'block';
    progressSection.style.display = 'none';
    loadChatHistory();
};
window.goBackToChat = function () {
    historySection.style.display = 'none';
    progressSection.style.display = 'none';
    chatSection.style.display = 'block';
};
window.goToProgress = function () {
    chatSection.style.display = 'none';
    historySection.style.display = 'none';
    progressSection.style.display = 'block';
};

function loadChatHistory() {
    const userRef = ref(database, 'users/' + currentUser.uid + '/history');
    onValue(userRef, (snapshot) => {
        chatHistoryList.innerHTML = '';
        const data = snapshot.val();
        if (!data) return;

        const keys = Object.keys(data).reverse();
        keys.forEach((key, idx) => {
            const li = document.createElement('li');
            li.innerText = `CHAT-${idx + 1}`;
            li.onclick = () => showChat(data[key]);

            const delBtn = document.createElement('button');
            delBtn.innerText = '🗑️';
            delBtn.onclick = (e) => {
                e.stopPropagation();
                remove(ref(database, 'users/' + currentUser.uid + '/history/' + key));
            };

            li.appendChild(delBtn);
            chatHistoryList.appendChild(li);
        });
    });
}

function showChat(messages) {
    chatBox.innerHTML = '';
    currentChat = messages;
    messages.forEach((msg) => {
        const sender = msg.role === 'user' ? "You" : "Bot";
        appendMessage(sender, msg.message);
    });
    historySection.style.display = 'none';
    chatSection.style.display = 'block';
}

// --- PROGRESS TRACKER ---
window.startProgress = async function () {
    if (currentDay === 0) {
        currentDay = 1;
        startTime = Date.now();
        alert("Progress tracking started!");
        await saveProgress();
        updateProgressBar();
        startTimer();
    }
};

window.resetProgress = async function () {
    currentDay = 0;
    startTime = null;
    await saveProgress();
    updateProgressBar();
    resetTimerDisplay();
    stopTimer();
};

function updateProgressBar() {
    const percent = (currentDay / 30) * 100;
    progressBar.style.width = `${percent}%`;
    progressDayText.innerText = `Day ${currentDay} of 30`;
}

// --- TIMER FUNCTIONS ---
function startTimer() {
    stopTimer();
    timerInterval = setInterval(() => {
        const elapsed = Date.now() - startTime;
        const totalSeconds = Math.floor(elapsed / 1000);
        const hours = Math.floor(totalSeconds / 3600);
        const minutes = Math.floor((totalSeconds % 3600) / 60);
        const seconds = totalSeconds % 60;

        timerText.innerText = `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;

        if (totalSeconds >= 86400) {
            currentDay++;
            startTime = Date.now();
            saveProgress();
            updateProgressBar();
        }
    }, 1000);
}

function stopTimer() {
    if (timerInterval) clearInterval(timerInterval);
}

function resetTimerDisplay() {
    timerText.innerText = "00:00:00";
}

// --- FIREBASE PERSISTENCE ---
async function saveProgress() {
    if (!currentUser) return;
    await set(ref(database, 'users/' + currentUser.uid + '/progress'), {
        currentDay,
        startTime
    });
}

async function loadProgress() {
    if (!currentUser) return;
    const snapshot = await get(ref(database, 'users/' + currentUser.uid + '/progress'));
    const data = snapshot.val();
    if (data) {
        currentDay = data.currentDay || 0;
        startTime = data.startTime || null;
        updateProgressBar();
        if (startTime) startTimer();
        else resetTimerDisplay();
    } else {
        currentDay = 0;
        startTime = null;
        updateProgressBar();
        resetTimerDisplay();
    }
}

// --- DARK MODE ---
window.toggleDarkMode = function () {
    document.body.classList.toggle("dark-mode");
};
