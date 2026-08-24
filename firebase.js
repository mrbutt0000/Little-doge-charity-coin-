const DB_URL = "https://cyrusprotocol-b3080-default-rtdb.firebaseio.com";

async function fetchUserData(userId) {
    try {
        let res = await fetch(`${DB_URL}/users/${userId}.json`);
        return await res.json();
    } catch (e) {
        console.error("Firebase read error:", e);
        return null;
    }
}

async function updateUserData(userId, data) {
    try {
        await fetch(`${DB_URL}/users/${userId}.json`, {
            method: 'PUT',
            body: JSON.stringify(data)
        });
    } catch (e) {
        console.error("Firebase write error:", e);
    }
}

async function fetchLeaderboard() {
    try {
        let res = await fetch(`${DB_URL}/users.json`);
        let users = await res.json();
        if (!users) return [];

        let list = Object.keys(users).map(id => ({
            id: id,
            name: users[id].name || 'User',
            balance: users[id].balance || 0
        }));

        list.sort((a, b) => b.balance - a.balance);
        return list.slice(0, 100);
    } catch (e) {
        console.error("Leaderboard error:", e);
        return [];
    }
                          }
