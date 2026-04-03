document.addEventListener('DOMContentLoaded', async () => {
    const connectMetamaskBtn = document.getElementById('connect-metamask-btn');
    const goToDashboardBtn = document.getElementById('go-to-dashboard-btn');
    const goToRegisterStatusBtn = document.getElementById('go-to-register-status-btn');
    const goToAdminBtn = document.getElementById('go-to-admin-btn');

    async function checkMetaMaskAndRedirect() {
        // Ensure Web3 is initialized and accounts are fetched
        const web3Initialized = await initWeb3();

        if (!web3Initialized || !accounts || accounts.length === 0) {
            // MetaMask not connected or no accounts available
            updateMetaMaskStatus(false, "MetaMask not connected or no accounts selected.");
            connectMetamaskBtn.style.display = 'block';
            goToDashboardBtn.style.display = 'none';
            goToRegisterStatusBtn.style.display = 'none';
            goToAdminBtn.style.display = 'none';
            return;
        }

        const currentAccount = accounts[0];
        updateMetaMaskStatus(true); // Update status with connected account

        // Check if current user is the owner (Bank Admin)
        try {
            const ownerAddress = await contract.methods.getOwner().call();
            if (currentAccount.toLowerCase() === ownerAddress.toLowerCase()) {
                goToAdminBtn.style.display = 'block';
                goToDashboardBtn.style.display = 'none';
                goToRegisterStatusBtn.style.display = 'none';
                connectMetamaskBtn.style.display = 'none';
                return; // Stop here if admin
            }
        } catch (error) {
            console.error("Error getting contract owner:", error);
            // If there's an error getting owner, proceed as a regular user
        }

        // Check if the user is registered
        try {
            const isRegistered = await contract.methods.isUserRegistered(currentAccount).call();
            if (isRegistered) {
                goToDashboardBtn.style.display = 'block';
                goToRegisterStatusBtn.style.display = 'none';
            } else {
                goToRegisterStatusBtn.style.display = 'block';
                goToDashboardBtn.style.display = 'none';
            }
            connectMetamaskBtn.style.display = 'none';
        } catch (error) {
            console.error("Error checking user registration:", error);
            // If contract call fails, assume not registered or contract not deployed
            goToRegisterStatusBtn.style.display = 'block';
            goToDashboardBtn.style.display = 'none';
            connectMetamaskBtn.style.display = 'none';
        }
    }

    connectMetamaskBtn.addEventListener('click', checkMetaMaskAndRedirect);
    goToDashboardBtn.addEventListener('click', () => { window.location.href = 'dashboard.html'; });
    goToRegisterStatusBtn.addEventListener('click', () => { window.location.href = 'register.html'; });
    goToAdminBtn.addEventListener('click', () => { window.location.href = 'admin.html'; });

    // Initial check on page load
    checkMetaMaskAndRedirect();
});