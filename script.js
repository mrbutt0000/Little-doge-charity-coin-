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
                    document.getElementById('profile-ton').innerText = walletInfo.account.address.slice(0, 6) + '...';
                    alert("💎 TON Wallet Connected Automatically!");
                }
            });
        }
    } catch (e) {
        console.log("TON Connect load error:", e);
    }
});
