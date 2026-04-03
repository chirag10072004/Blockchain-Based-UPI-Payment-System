document.addEventListener('DOMContentLoaded', async () => {
    const checkStatusBtn = document.getElementById('check-status-btn');
    const registrationMessage = document.getElementById('registration-message');

    // Function to check and display registration status
    async function checkRegistrationStatus() {
        const web3Initialized = await initWeb3(); // Ensure web3 is initialized and MetaMask connected

        if (!web3Initialized || !accounts || accounts.length === 0) {
            registrationMessage.textContent = "Please connect MetaMask to check your status.";
            registrationMessage.style.color = "red";
            checkStatusBtn.disabled = true;
            return;
        }

        const currentUserAddress = accounts[0];
        registrationMessage.textContent = "Checking registration status for " + currentUserAddress + "...";
        registrationMessage.style.color = "blue";
        checkStatusBtn.disabled = true; // Disable button while checking

        try {
            const isRegistered = await contract.methods.isUserRegistered(currentUserAddress).call();
            if (isRegistered) {
                registrationMessage.textContent = "You are a registered user! Redirecting to dashboard...";
                registrationMessage.style.color = "green";
                setTimeout(() => { window.location.href = 'dashboard.html'; }, 2000);
            } else {
                registrationMessage.textContent = "You are not yet registered. Please contact the Bank Admin to register your address.";
                registrationMessage.style.color = "orange";
                checkStatusBtn.disabled = false; // Re-enable if not registered
            }
        } catch (error) {
            console.error("Error checking registration status:", error);
            registrationMessage.textContent = `Error checking status: ${error.message || error}`;
            registrationMessage.style.color = "red";
            checkStatusBtn.disabled = false; // Re-enable on error
        }
    }

    checkStatusBtn.addEventListener('click', checkRegistrationStatus);

    // Initial check on page load if MetaMask is already connected
    // This handles cases where user navigates directly or refreshes
    initWeb3().then(initialized => {
        if (initialized && accounts && accounts.length > 0) {
            checkRegistrationStatus();
        } else {
            registrationMessage.textContent = "Connect MetaMask to proceed.";
            registrationMessage.style.color = "gray";
            checkStatusBtn.disabled = true;
        }
    });
});