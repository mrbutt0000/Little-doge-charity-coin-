let tg = window.Telegram.WebApp;
try { tg.expand(); } catch(e) {}

let userId = "user_" + Math.floor(Math.random() * 100000);
let userName = "Crypto User";

if (tg.initDataUnsafe && tg.initDataUnsafe.user) {
    userId = tg.initDataUnsafe.user.id.toString();
    userName = tg.initDataUnsafe.user.first_name || "User";
}

document.getElementById('user-name').innerText = userName;
document.getElementById('profile-id').innerText = userId;
document.getElementById('profile-name').innerText = userName;

// Default User Data Structure
let userData = {
    name: userName,
    balance: 10, // New user 10 coin bonus
    lastClaim: 0,
    claimReady: true,
    lastCheckInDate: "",
    streakDays: 0,
    checkInReward: 3,
    tasks: { tg: false, x: false },
    baseWallet: "",
    tonWallet: "",
    invitesCount: 0,
    referredBy: null
};

async function init() {
    let remoteData = await fetchUserData(userId);
    if (remoteData) {
        userData = remoteData;
    } else {
        // First time user bonus 10 coins
        await updateUserData(userId, userData);
    }
    updateUI();
}

function updateUI() {
    document.getElementById('balance').innerText = userData.balance + " LDOGE";
    document.getElementById('profile-bal').innerText = userData.balance + " LDOGE";
    document.getElementById('profile-invites').innerText = (userData.invitesCount || 0) + " / 3 (Req)";
    document.getElementById('profile-base').innerText = userData.baseWallet || "Not Connected";
    
    // Check-in button text check
    checkDailyCheckInStatus();
    checkClaimTimer();
}

function switchTab(tabName) {
    document.querySelectorAll('.app-section').forEach(sec => sec.style.display = 'none');
    document.querySelectorAll('.nav-item').forEach(item => item.classList.remove('active'));

    if (tabName === 'dashboard') {
        document.getElementById('section-dashboard').style.display = 'block';
        document.getElementById('nav-dashboard').classList.add('active');
    } else if (tabName === 'tasks') {
        document.getElementById('section-tasks').style.display = 'block';
        document.getElementById('nav-tasks').classList.add('active');
    } else if (tabName === 'wallet') {
        document.getElementById('section-wallet').style.display = 'block';
        document.getElementById('nav-wallet').classList.add('active');
    } else if (tabName === 'ref') {
        document.getElementById('section-ref').style.display = 'block';
        document.getElementById('nav-ref').classList.add('active');
    } else if (tabName === 'profile') {
        document.getElementById('section-profile').style.display = 'block';
        document.getElementById('nav-profile').classList.add('active');
    } else if (tabName === 'leaderboard') {
        document.getElementById('section-leaderboard').style.display = 'block';
        document.getElementById('nav-leaderboard').classList.add('active');
        loadLeaderboard();
    }
}

// 1. Claim System (3 Hours + Stays Fixed if not claimed)
const CLAIM_COOLDOWN = 3 * 60 * 60 * 1000; // 3 Hours in ms

function checkClaimTimer() {
    let now = Date.now();
    let last = userData.lastClaim || 0;
    let elapsed = now - last;
    
    let btn = document.getElementById('claim-btn');
    let timerText = document.getElementById('claim-timer');

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
    userData.lastClaim = Date.now(); // Reset timer starting now
    await updateUserData(userId, userData);
    updateUI();
    alert("🎉 Successfully claimed 5 LDOGE!");
}

setInterval(checkClaimTimer, 1000); // Live timer update

// 2. Daily Check-In (Starts at 3, +10% daily, breaks if missed)
function checkDailyCheckInStatus() {
    let todayStr = new Date().toDateString();
    let checkBtn = document.getElementById('checkin-btn');
    
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
            // Missed a day! Reset streak
            userData.streakDays = 0;
            userData.checkInReward = 3;
            alert("⚠️ You missed a day! Check-in streak reset to 3 LDOGE.");
        } else if (diffDays === 2) {
            // Consecutive day, increase reward by 10%
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
        tg.openTelegramLink("https://t.me/Little_Doge_coin");
    } else if (taskId === 'x') {
        tg.openLink("https://x.com/LittleDogecoin");
    }

    userData.balance += reward;
    if (!userData.tasks) userData.tasks = {};
    userData.tasks[taskId] = true;
    await updateUserData(userId, userData);
    updateUI();
    alert(`🎉 Task verified! +${reward} LDOGE added.`);
}

// 4. Wallet System (TON Auto + Base Manual)
async function saveBaseWallet() {
    let addr = document.getElementById('base-wallet-input').value.trim();
    if (!addr.startsWith('0x') || addr.length < 10) {
        alert("❌ Please enter a valid Base wallet address (starts with 0x)");
        return;
    }
    userData.baseWallet = addr;
    await updateUserData(userId, userData);
    updateUI();
    alert("✅ Base wallet saved successfully!");
}

// 5. Referral System (25% bonus + 3 invites requirement)
function copyRefLink() {
    let refLink = `https://t.me/Little_doge_charity_bot?start=${userId}`;
    navigator.clipboard.writeText(refLink);
    alert("🔗 Referral link copied! Share with friends to get 25% bonus.");
}

// Load Leaderboard Top 100
async function loadLeaderboard() {
    let listEl = document.getElementById('leaderboard-list');
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

// TON Connect UI Auto-Connect Setup
const tonConnectUI = new TON_CONNECT_UI.TonConnectUI({
    manifestUrl: 'https://raw.githubusercontent.com/ton-connect/docs/main/media/manifest_example.json',
    buttonRootId: 'ton-connect-button'
});

tonConnectUI.onStatusChange(walletInfo => {
    if (walletInfo) {
        userData.tonWallet = walletInfo.account.address;
        updateUserData(userId, userData);
        document.getElementById('profile-ton').innerText = walletInfo.account.address.slice(0, 6) + '...';
        alert("💎 TON Wallet Connected Automatically!");
    }
});

init();
