// ============================================
// APP LOGIC
// ============================================

// ====== DEBUG FUNCTION ======
function log(msg, isError) {
    var el = document.getElementById('debugBox');
    if (!el) return;
    var t = new Date().toLocaleTimeString();
    el.innerText = '[' + t + '] ' + msg;
    el.className = 'debug-box' + (isError ? ' error' : '');
    console.log(msg);
}

log('🚀 App started');

// ====== TELEGRAM ======
var tg = window.Telegram?.WebApp;
var tgUser = null;
var startParam = null;
if (tg) {
    tg.expand();
    tgUser = tg.initDataUnsafe?.user;
    startParam = tg.initDataUnsafe?.start_param;
}
if (!tgUser) {
    tgUser = { id: 123456789, first_name: "Test", username: "test" };
    log('⚠️ Browser test mode', true);
}

var userId = tgUser.id.toString();
var userRef = db ? db.ref('users/' + userId) : null;
var allUsersRef = db ? db.ref('users') : null;

// ====== APP STATE ======
var userData = null;
var COOLDOWN_MS = 3 * 60 * 60 * 1000;
var TASK_WAIT_MS = 5 * 60 * 1000;

// ====== DOM HELPERS ======
function $(id) { return document.getElementById(id); }

// ====== LEVEL SYSTEM ======
function getLevel(mined) {
    if (mined >= 100000) return { name: 'Diamond', key: 'diamond' };
    if (mined >= 25000) return { name: 'Platinum', key: 'platinum' };
    if (mined >= 5000) return { name: 'Gold', key: 'gold' };
    if (mined >= 1000) return { name: 'Bronze', key: 'bronze' };
    return { name: 'Silver', key: 'silver' };
}
function getNextLevel(mined) {
    var levels = [{ threshold: 1000, name: 'Bronze' }, { threshold: 5000, name: 'Gold' }, { threshold: 25000, name: 'Platinum' }, { threshold: 100000, name: 'Diamond' }];
    for (var i = 0; i < levels.length; i++) {
        if (mined < levels[i].threshold) return levels[i];
    }
    return null;
}
function getProgress(mined) {
    var lv = getLevel(mined);
    var next = getNextLevel(mined);
    if (!next) return 100;
    var prev = 0;
    if (lv.key === 'bronze') prev = 1000;
    else if (lv.key === 'gold') prev = 5000;
    else if (lv.key === 'platinum') prev = 25000;
    var range = next.threshold - prev;
    if (range <= 0) return 100;
    return Math.min(((mined - prev) / range) * 100, 100);
}

// ====== UPDATE UI ======
function updateUI() {
    if (!userData) return;
    var d = userData;
    var balance = d.balance || 0;
    var mined = d.minedCoins || 0;
    var levelObj = getLevel(mined);
    var next = getNextLevel(mined);

    $('balance').innerText = balance.toFixed(2);
    $('statMined').innerText = mined;
    $('statLevel').innerText = levelObj.name;
    $('statRefs').innerText = d.referralCount || 0;

    $('levelTag').innerText = levelObj.name;
    $('levelTag').className = 'level-badge' + (levelObj.key !== 'silver' ? ' ' + levelObj.key : '');
    $('missedDaysDisplay').innerText = '🔥 ' + (d.missedDays || 0) + ' days missed';

    var prog = getProgress(mined);
    $('levelProgress').style.width = prog + '%';
    if (next) $('nextLevelText').innerText = 'Next: ' + next.name + ' (' + next.threshold + ' mined)';
    else $('nextLevelText').innerText = '🏆 Max Level!';

    if (d.hasClaimedWelcome) {
        $('welcomeBtn').disabled = true;
        $('welcomeBtn').innerText = '✅ Claimed';
        $('welcomeMsg').innerText = 'Welcome bonus claimed!';
    } else {
        $('welcomeBtn').disabled = false;
        $('welcomeBtn').innerText = '🎁 Claim 20 Coins';
        $('welcomeMsg').innerText = 'Claim your 20 $LDOGE welcome bonus!';
    }

    // Referral
    $('refCount').innerText = d.referralCount || 0;
    $('refEarnings').innerText = (d.referralEarnings || 0).toFixed(2);
    var cap = Math.min(100, ((d.referralEarnings || 0) / (d.minedCoins * 0.5 || 1)) * 100);
    $('refCap').innerText = Math.min(cap, 100).toFixed(0) + '%';

    // Profile
    $('profileName').innerText = (tgUser && tgUser.first_name !== 'Blocked') ? tgUser.first_name : 'User';
    $('profileLevelTag').innerText = levelObj.name;
    $('profileLevelTag').className = 'level-badge' + (levelObj.key !== 'silver' ? ' ' + levelObj.key : '');
    $('profileTgId').innerText = userId;
    $('profileMined').innerText = mined;
    $('profileBalance').innerText = balance.toFixed(2);
    $('profileBurned').innerText = d.totalBurned || 0;
    $('profileMissed').innerText = d.missedDays || 0;
    $('profileRefs').innerText = d.referralCount || 0;
    $('profileLevel').innerText = levelObj.name;

    // Wallet
    $('walletSolana').value = d.walletSolana || '';
    $('walletBase').value = d.walletBase || '';

    // Referral link
    var link = 'https://t.me/Littledogecoinbot?start=ref_' + userId;
    $('refLinkDisplay').innerText = link;

    checkCooldown();
    renderTasks();
    loadReferralList();
    log('✅ UI updated');
}

// ====== COOLDOWN ======
function checkCooldown() {
    if (!userData) return;
    var last = userData.lastClaimTime || 0;
    var diff = Date.now() - last;
    if (diff >= COOLDOWN_MS) {
        $('mineBtn').disabled = false;
        $('timer').innerText = '✅ Ready';
    } else {
        $('mineBtn').disabled = true;
        var rem = COOLDOWN_MS - diff;
        var h = Math.floor(rem / 3600000);
        var m = Math.floor((rem % 3600000) / 60000);
        var s = Math.floor((rem % 60000) / 1000);
        $('timer').innerText = '⏳ ' + h + 'h ' + m + 'm ' + s + 's';
        setTimeout(checkCooldown, 1000);
    }
}

// ====== BURN ======
function checkBurn() {
    if (!userData) return;
    var today = new Date().toISOString().split('T')[0];
    var lastLogin = userData.lastLoginDate || today;
    if (lastLogin !== today) {
        var diff = Math.floor((new Date(today) - new Date(lastLogin)) / 86400000);
        if (diff > 0) {
            var burnAmount = diff * 10;
            var actualBurn = Math.min(burnAmount, userData.balance || 0);
            userData.balance = (userData.balance || 0) - actualBurn;
            userData.totalBurned = (userData.totalBurned || 0) + actualBurn;
            userData.missedDays = (userData.missedDays || 0) + diff;
            userData.lastLoginDate = today;
            saveData();
            log('🔥 Burned ' + actualBurn + ' coins for ' + diff + ' days');
        } else {
            userData.lastLoginDate = today;
            saveData();
        }
    }
}

// ====== SAVE ======
function saveData() {
    if (!userData || !userRef) return;
    if (userId === "123456789") {
        try { localStorage.setItem('ldoge_test', JSON.stringify(userData)); } catch (e) {}
        return;
    }
    userRef.set(userData).then(function() {
        log('✅ Data saved');
    }).catch(function(e) {
        log('❌ Save error: ' + e.message, true);
    });
}

// ====== LOAD USER ======
function loadData() {
    if (!userRef) { log('❌ userRef null', true); return; }

    if (userId === "123456789") {
        log('🔍 Test user mode');
        var local = localStorage.getItem('ldoge_test');
        if (local) { try { userData = JSON.parse(local); } catch (e) {} }
        if (!userData) {
            userData = {
                balance: 0, minedCoins: 0, hasClaimedWelcome: false,
                walletSolana: '', walletBase: '',
                referralCount: 0, referralList: [], referredBy: null,
                lastClaimTime: 0, lastLoginDate: new Date().toISOString().split('T')[0],
                missedDays: 0, tasksClaimed: {}, tasksPending: {}, totalBurned: 0,
                referralEarnings: 0
            };
        }
        updateUI();
        log('✅ Test user loaded');
        return;
    }

    log('⏳ Loading user...');
    userRef.once('value').then(function(snap) {
        var val = snap.val();
        if (!val) {
            log('🆕 New user');
            userData = {
                firstName: tgUser.first_name || 'User',
                username: tgUser.username || '',
                createdAt: Date.now(),
                balance: 0,
                minedCoins: 0,
                totalBurned: 0,
                referralEarnings: 0,
                referralCount: 0,
                referralList: [],
                referredBy: null,
                lastClaimTime: 0,
                lastLoginDate: new Date().toISOString().split('T')[0],
                missedDays: 0,
                tasksClaimed: {},
                tasksPending: {},
                walletSolana: '',
                walletBase: '',
                hasClaimedWelcome: false
            };
            if (startParam && startParam.startsWith('ref_')) {
                var refId = startParam.replace('ref_', '');
                if (refId !== userId) {
                    userData.referredBy = refId;
                    var refRef = db.ref('users/' + refId);
                    refRef.once('value').then(function(s) {
                        var rd = s.val();
                        if (rd) {
                            var list = rd.referralList || [];
                            if (list.indexOf(userId) === -1) {
                                list.push(userId);
                                rd.referralCount = (rd.referralCount || 0) + 1;
                                rd.balance = (rd.balance || 0) + 10;
                                refRef.update({ referralList: list, referralCount: rd.referralCount, balance: rd.balance });
                                log('✅ Referral bonus given');
                            }
                        }
                    });
                }
            }
            userRef.set(userData);
            updateUI();
            checkBurn();
            log('✅ New user created');
        } else {
            userData = val;
            var changed = false;
            if (userData.hasClaimedWelcome === undefined) { userData.hasClaimedWelcome = false; changed = true; }
            if (userData.tasksClaimed === undefined) { userData.tasksClaimed = {}; changed = true; }
            if (userData.tasksPending === undefined) { userData.tasksPending = {}; changed = true; }
            if (userData.referralList === undefined) { userData.referralList = []; changed = true; }
            if (userData.totalBurned === undefined) { userData.totalBurned = 0; changed = true; }
            if (userData.missedDays === undefined) { userData.missedDays = 0; changed = true; }
            if (userData.walletSolana === undefined) { userData.walletSolana = ''; changed = true; }
            if (userData.walletBase === undefined) { userData.walletBase = ''; changed = true; }
            if (userData.referralEarnings === undefined) { userData.referralEarnings = 0; changed = true; }
            if (changed) { userRef.update(userData); log('⚠️ Fixed missing fields'); }
            updateUI();
            checkBurn();
            log('✅ User loaded');
        }
    }).catch(function(e) {
        log('❌ Load error: ' + e.message, true);
        alert('Firebase load error: ' + e.message + '\nCheck Authorized Domains.');
    });
}

// ====== MINE ======
function mine() {
    log('⛏️ Mine clicked');
    if (!userData) return;
    var now = Date.now();
    if (now - (userData.lastClaimTime || 0) < COOLDOWN_MS) { $('timer').innerText = '⏳ Wait!'; return; }
    var reward = 5;
    userData.balance = (userData.balance || 0) + reward;
    userData.minedCoins = (userData.minedCoins || 0) + reward;
    userData.lastClaimTime = now;

    if (userData.referredBy && userId !== "123456789") {
        var refId = userData.referredBy;
        var refRef = db.ref('users/' + refId);
        refRef.once('value').then(function(s) {
            var rd = s.val();
            if (rd) {
                var bonus = reward * 0.10;
                var earn = (rd.referralEarnings || 0) + bonus;
                var cap = (rd.minedCoins || 0) * 0.5;
                if (earn > cap) earn = cap;
                var actual = earn - (rd.referralEarnings || 0);
                if (actual > 0) {
                    rd.balance = (rd.balance || 0) + actual;
                    rd.referralEarnings = earn;
                    refRef.update({ balance: rd.balance, referralEarnings: earn });
                }
            }
        });
    }

    saveData();
    updateUI();
    $('timer').innerText = '✅ Mined 5 Coins!';
    $('mineBtn').disabled = true;
    setTimeout(checkCooldown, 1000);
}

// ====== WELCOME ======
function claimWelcome() {
    log('🎁 Welcome clicked');
    if (!userData || userData.hasClaimedWelcome) return;
    userData.balance = (userData.balance || 0) + 20;
    userData.hasClaimedWelcome = true;
    saveData();
    updateUI();
}

// ====== TASKS ======
var TASKS = [
    { id: 't1', label: 'Join Telegram', desc: 'Join our community', url: 'https://t.me/Little_Doge_coin' },
    { id: 't2', label: 'Follow Twitter', desc: 'Follow us on X', url: 'https://x.com/LittleDogecoin' },
    { id: 't3', label: 'Visit Website', desc: 'Check our project', url: 'https://littledogecharity.online/' },
    { id: 't4', label: 'Share Post', desc: 'Share our pinned tweet' },
    { id: 't5', label: 'Watch Video', desc: 'Watch intro on YouTube' }
];

function renderTasks() {
    if (!userData) return;
    if (!userData.tasksClaimed) userData.tasksClaimed = {};
    if (!userData.tasksPending) userData.tasksPending = {};

    var now = Date.now();
    var html = '';
    var needUpdate = false;

    for (var i = 0; i < TASKS.length; i++) {
        var task = TASKS[i];
        var isClaimed = userData.tasksClaimed[task.id] === true;
        var pendingUntil = userData.tasksPending[task.id] || 0;
        var isPending = pendingUntil > 0 && now < pendingUntil;
        var isReady = pendingUntil > 0 && now >= pendingUntil && !isClaimed;

        var btnText, btnClass, disabled, action, statusMsg;

        if (isClaimed) {
            btnText = '✅ Done';
            btnClass = 'done';
            disabled = true;
            action = null;
            statusMsg = '';
        } else if (isPending) {
            var remaining = Math.ceil((pendingUntil - now) / 1000);
            var min = Math.floor(remaining / 60);
            var sec = remaining % 60;
            btnText = '⏳ Pending (' + min + 'm ' + sec + 's)';
            btnClass = 'pending';
            disabled = true;
            action = null;
            statusMsg = '<span class="status-msg" style="color:#f0b90b;">🕒 Under review (5 mins)</span>';
            needUpdate = true;
        } else if (isReady) {
            btnText = '🎁 Claim 5 Coins';
            btnClass = 'ready';
            disabled = false;
            action = 'claim';
            statusMsg = '<span class="status-msg" style="color:#3ddc84;">✅ Verified! Claim now</span>';
        } else {
            btnText = '+5 Coins';
            btnClass = '';
            disabled = false;
            action = 'start';
            statusMsg = '';
        }

        var hasUrl = task.url ? true : false;
        html += '<div class="task-item">';
        html += '<div class="task-info">';
        html += '<h4>' + task.label + '</h4>';
        html += '<p>' + task.desc + '</p>';
        if (hasUrl) html += '<a href="' + task.url + '" target="_blank">🔗 ' + task.url + '</a>';
        html += statusMsg;
        html += '</div>';
        html += '<button class="task-btn ' + btnClass + '" data-task="' + task.id + '" data-action="' + action + '" ' + (disabled ? 'disabled' : '') + '>';
        html += btnText;
        html += '</button>';
        html += '</div>';
    }

    $('taskList').innerHTML = html;

    var btns = document.querySelectorAll('.task-btn:not([disabled])');
    for (var j = 0; j < btns.length; j++) {
        (function(btn) {
            btn.onclick = function() {
                var taskId = this.dataset.task;
                var action = this.dataset.action;
                if (action === 'claim') claimTaskReward(taskId);
                else startTaskTimer(taskId);
            };
        })(btns[j]);
    }

    if (needUpdate) {
        setTimeout(function() {
            if (document.getElementById('pageTasks').classList.contains('active')) renderTasks();
        }, 1000);
    }
}

function startTaskTimer(taskId) {
    if (!userData) return;
    var task = null;
    for (var i = 0; i < TASKS.length; i++) {
        if (TASKS[i].id === taskId) { task = TASKS[i]; break; }
    }
    if (!task) return;

    if (task.url) {
        if (tg) tg.openLink(task.url);
        else window.open(task.url);
    }

    if (!userData.tasksPending) userData.tasksPending = {};
    userData.tasksPending[taskId] = Date.now() + TASK_WAIT_MS;
    saveData();
    renderTasks();
    log('⏳ Task "' + task.label + '" pending');
}

function claimTaskReward(taskId) {
    if (!userData) return;
    var pendingUntil = (userData.tasksPending || {})[taskId] || 0;
    if (Date.now() < pendingUntil) {
        log('⏳ Not ready', true);
        return;
    }
    if (userData.tasksClaimed && userData.tasksClaimed[taskId]) return;

    userData.balance = (userData.balance || 0) + 5;
    if (!userData.tasksClaimed) userData.tasksClaimed = {};
    userData.tasksClaimed[taskId] = true;
    delete userData.tasksPending[taskId];

    saveData();
    updateUI();
    renderTasks();
    log('✅ Task claimed! +5 coins');
}

// ====== REFERRAL LIST ======
function loadReferralList() {
    if (!userData) return;
    var list = userData.referralList || [];
    if (list.length === 0) { $('referralListContainer').innerHTML = '<p class="text-muted">No referrals yet.</p>'; return; }
    var html = '';
    var count = 0;
    list.forEach(function(id) {
        db.ref('users/' + id).once('value').then(function(s) {
            var d = s.val();
            if (d) {
                html += '<div class="admin-row"><span>🐶 ' + (d.firstName || id) + '</span><span class="text-muted">⛏️ ' + (d.minedCoins || 0) + '</span></div>';
            }
            count++;
            if (count >= list.length) {
                $('referralListContainer').innerHTML = html || '<p class="text-muted">No referrals.</p>';
            }
        });
    });
    if (list.length > 0) $('referralListContainer').innerHTML = '<p class="text-muted">Loading...</p>';
}

// ====== WALLET ======
function saveWallet() {
    log('💳 Save wallet');
    if (!userData) return;
    var sol = $('walletSolana').value.trim();
    var base = $('walletBase').value.trim();
    if (sol && !/^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(sol)) {
        $('walletStatus').innerText = '❌ Invalid Solana';
        $('walletStatus').style.color = '#ff4444';
        return;
    }
    if (base && !/^0x[a-fA-F0-9]{40}$/.test(base)) {
        $('walletStatus').innerText = '❌ Invalid Base';
        $('walletStatus').style.color = '#ff4444';
        return;
    }
    if ((sol || base) && !confirm('⚠️ Only personal wallets allowed?')) return;
    userData.walletSolana = sol;
    userData.walletBase = base;
    saveData();
    $('walletStatus').innerText = '✅ Saved!';
    $('walletStatus').style.color = '#3ddc84';
}

// ====== ADMIN ======
function loadAdmin() {
    if (!allUsersRef) return;
    log('📊 Loading admin...');
    $('adminUserList').innerHTML = '<p class="text-muted">Loading...</p>';
    allUsersRef.once('value').then(function(snap) {
        var data = snap.val();
        if (!data) {
            $('adminUsers').innerText = '0';
            $('adminMined').innerText = '0';
            $('adminBalance').innerText = '0';
            $('adminUserList').innerHTML = '<p class="text-muted">No users</p>';
            return;
        }
        var keys = Object.keys(data);
        var totalMined = 0,
            totalBalance = 0;
        var html = '<div style="font-weight:700;padding:6px 0;border-bottom:2px solid #f0b90b;display:flex;justify-content:space-between;"><span>User</span><span>Mined | Balance</span></div>';
        var count = 0;
        keys.forEach(function(id) {
            if (id === "123456789") return;
            var u = data[id];
            var mined = u.minedCoins || 0;
            var bal = u.balance || 0;
            totalMined += min
