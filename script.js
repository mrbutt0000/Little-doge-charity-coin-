let tg = window.Telegram.WebApp;
try { tg.expand(); } catch(e) {}

let userId = "user_" + Math.floor(Math.random() * 100000);
let userName = "Crypto User";

if (tg.initDataUnsafe && tg.initDataUnsafe.user) {
    userId = tg.initDataUnsafe.user.id.toString();
    userName = tg.initDataUnsafe.user.first_name || "User";
}

// Safely set UI text if elements exist
if(document.getElementById('user-name')) document.getElementById('user-name').innerText = userName;
if(document.getElementById('profile-id')) document.getElementById('profile-id').innerText = userId;
if(document.getElementById('profile-name')) document.getElementById('profile-name').innerText = userName;

let userData = {
    name: userName,
    balance: 10,
    lastClaim: 0,
    lastCheckInDate: "",
    streakDays: 0,
    checkInReward: 3,
    tasks: { tg: false, x: false },
    baseWallet: "",
    tonWallet: "",
    invitesCount: 0
};

// Initialize App Data
async function init() {
    let remoteData = await fetchUserData(userId);
    if (remoteData) {
        userData = remoteData;
    } else {
        await updateUserData(userId, userData);
    }
    updateUI();
}

function updateUI() {
    if(document.getElementById('balance')) document.getElementById('balance').innerText = userData.balance + " LDOGE";
    if(document.getElementById('profile-bal')) document.getElementById('profile-bal').innerText = userData.balance + " LDOGE";
    if(document.getElementById('profile-invites')) document.getElementById('profile-invites').innerText = (userData.invitesCount || 0) + " / 3 (Req)";
    if(document.getElementById('profile-base')) document.getElementById('profile-base').innerText = userData.baseWallet || "Not Connected";
    
    checkDailyCheckInStatus();
    checkClaimTimer();
}

// Tab Switching Logic
function switchTab(tabName) {
    document.querySelectorAll('.app-section').forEach(sec => sec.style.display = 'none');
    document.querySelectorAll('.nav-item').forEach(item => item.classList.remove('active'));

    const targetSection = document.getElementById('section-' + tabName);
    const targetNav = document.getElementById('nav-' + tabName);

    if (targetSection) targetSection.style.display = 'block';
    if (targetNav) targetNav.classList.add('active');

    if (tabName === 'leaderboard') {
        loadLeaderboard();
    }
}

// 1. Claim Timer Logic (3 Hours)
const CLAIM_COOLDOWN = 3 * 60 * 60 * 1000;

function checkClaimTimer() {
    let now = Date.now();
    let last = userData.lastClaim || 0;
    let elapsed = now - last;
    
    let btn = document.getElementById('claim-btn');
    let timerText = document.getElementById('claim-timer');
    if (!btn || !timerText) return;

    if (last === 0 || elapsed >= CLAIM_COOLDOWN) {
        btn.disabled = false;
        btn.innerText = "🎁 Claim 5 LDOGE";
        timerText.innerText = "Status: Ready to Claim! ✅";
    } else {
        let timeLeft = CLAIM_COOLDOWN - elapsed;
        let hours = Math.floor(timeLeft / (60 * 60 * 1000));
        let mins = Math.floor((timeLeft % (60 * 60 * 1000)) / (60 * 1000));
        let secs = Math.floor((timeLeft % (60 * 1000)) / 1000);
        
        btn.disabled = true;
        btn.innerText = "⏳ Claim in Progress...";
        timerText.innerText = `Available in: ${hours}h ${mins}m ${secs}s`;
    }
}

async function claimReward() {
    userData.balance += 5;
    userData.lastClaim = Date.now();
    await updateUserData(userId, userData);
    updateUI();
    alert("🎉 Successfully claimed 5 LDOGE!");
}

setInterval(checkClaimTimer, 1000);

// 2. Daily Check-In Logic
function checkDailyCheckInStatus() {
    let todayStr = new Date().toDateString();
    let checkBtn = document.getElementById('checkin-btn');
    if (!checkBtn) return;
    
    if (userData.lastCheckInDate === todayStr) {
        checkBtn.innerText = "✅ Checked In Today";
        checkBtn.disabled = true;
    } else {
        checkBtn.innerText = `📅 Claim Daily Check-in (${userData.checkInReward || 3} LDOGE)`;
        checkBtn.disabled = false;
    }
}

async function claimDailyCheckIn() {
    let today = new Date();
    let todayStr = today.toDateString();
    
    if (userData.lastCheckInDate) {
        let lastDate = new Date(userData.lastCheckInDate);
        let diffTime = Math.abs(today - lastDate);
        let diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

        if (diffDays > 2) {
            userData.streakDays = 0;
            userData.checkInReward = 3;
        } else if (diffDays === 2) {
            userData.checkInReward = Math.round(userData.checkInReward * 1.10);
        }
    }

    userData.balance += userData.checkInReward;
    userData.lastCheckInDate = todayStr;
    await updateUserData(userId, userData);
    updateUI();
    alert(`🎉 Daily Check-in success! +${userData.checkInReward} LDOGE added.`);
}

// 3. Task Center
async function verifyTask(taskId, reward) {
    if (userData.tasks && userData.tasks[taskId]) {
        alert("✅ Task already completed!");
        return;
    }

    if (taskId === 'tg') {
        window.open("https://t.me/Little_Doge_coin", "_blank");
    } else if (taskId === 'x') {
        window.open("https://x.com/LittleDogecoin", "_blank");
    }

    userData.balance += reward;
    if (!userData.tasks) userData.tasks = {};
    userData.tasks[taskId] = true;
    await updateUserData(userId, userData);
    updateUI();
    alert(`🎉 Task verified! +${reward} LDOGE added.`);
}

// 4. Manual Base Wallet
async function saveBaseWallet() {
    let inputEl = document.getElementById('base-wallet-input');
    if (!inputEl) return;
    let addr = inputEl.value.trim();
    if (!addr.startsWith('0x') || addr.length < 10) {
        alert("❌ Please enter a valid Base wallet address (starts with 0x)");
        return;
    }
    userData.baseWallet = addr;
    await updateUserData(userId, userData);
    updateUI();
    alert("✅ Base wallet saved successfully!");
}

// 5. Referral Link
function copyRefLink() {
    let refLink = `https://t.me/Little_doge_charity_bot?start=${userId}`;
    navigator.clipboard.writeText(refLink);
    alert("🔗 Referral link copied to clipboard!");
}

// Load Leaderboard
async function loadLeaderboard() {
    let listEl = document.getElementById('leaderboard-list');
    if (!listEl) return;
    listEl.innerHTML = "<p style='color:#94a3b8;'>Loading top users...</p>";
    
    let topUsers = await fetchLeaderboard();
    if (topUsers.length === 0) {
        listEl.innerHTML = "<p style='color:#94a3b8;'>No users found.</p>";
        return;
    }

    let html = "";
    topUsers.forEach((u, i) => {
        html += `<div class="lb-item"><span>#${i+1} ${u.name}</span><span style="color:#f59e0b; font-weight:bold;">${u.balance} LDOGE</span></div>`;
    });
    listEl.innerHTML = html;
}

// Safe TON Connect Initialization
window.addEventListener('DOMContentLoaded', () => {
    try {
        if (typeof TON_CONNECT_UI !== 'undefined') {
            const tonConnectUI = new TON_CONNECT_UI.TonConnectUI({
                manifestUrl: 'https://raw.githubusercontent.com/ton-connect/docs/main/media/manifest_example.json',
                buttonRootId: 'ton-connect-button'
            });

            tonConnectUI.onStatusChange(walletInfo => {
                if (walletInfo) {
                    userData.tonWallet = walletInfo.account.address;
                    updateUserData(userId, userData);
                    let profileTon = document.getElementById('profile-ton');
                    if (profileTon) profileTon.innerText = walletInfo.account.address.slice(0, 6) + '...';
                    alert("💎 TON Wallet Connected Successfully!");
                }
            });
        }
    } catch (e) {
        console.log("TON Connect init notice:", e);
    }
});

// Run Init
init();
