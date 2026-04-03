document.addEventListener('DOMContentLoaded', async () => {
    const adminLoginFormArea = document.getElementById('admin-login-form-area');
    const adminInputAddress = document.getElementById('admin-input-address');
    const adminLoginBtn = document.getElementById('admin-login-btn');
    const adminLoginMessage = document.getElementById('admin-login-message');
    const adminContent = document.getElementById('admin-content');

    const registerUserForm = document.getElementById('register-user-form');
    const newUserAddressInput = document.getElementById('new-user-address');
    const registerUserMessage = document.getElementById('register-user-message');
    const registeredUsersTableBody = document.querySelector('#registered-users-table tbody');
    const allTransactionsTableBody = document.querySelector('#all-transactions-table tbody'); // Get the tbody
    const depositForm = document.getElementById('deposit-form');
    const depositUserAddressInput = document.getElementById('deposit-user-address');
    const depositAmountInput = document.getElementById('deposit-amount');
    const depositMessage = document.getElementById('deposit-message');
    const noRegisteredUsersMessage = document.getElementById('no-registered-users-message');
    const noAllTransactionsMessage = document.getElementById('no-all-transactions-message');

    let currentAdminInputAddress = '';
    let currentlyExpandedTransactionRow = null; // To keep track of the currently expanded row

    // Function to handle Admin Login via input address
    adminLoginBtn.addEventListener('click', async () => {
        const inputAddress = adminInputAddress.value.trim();

        if (!web3.utils.isAddress(inputAddress)) {
            adminLoginMessage.textContent = "Please enter a valid Ethereum address.";
            adminLoginMessage.style.color = "red";
            return;
        }

        const web3Initialized = await initWeb3();
        if (!web3Initialized || !accounts || accounts.length === 0) {
            displayMessage("Please connect MetaMask first.");
            return;
        }

        currentAdminInputAddress = inputAddress;
        adminLoginMessage.textContent = "";
        
        if (adminLoginFormArea) {
            adminLoginFormArea.style.display = 'none'; 
        }
        adminContent.style.display = 'block';

        loadAdminData();
    });


    async function loadAdminData() {
        if (adminContent.style.display === 'none') {
            return;
        }

        const web3Initialized = await initWeb3();
        if (!web3Initialized || !accounts || accounts.length === 0) {
            displayMessage("MetaMask not connected. Cannot load admin data.");
            if (adminLoginFormArea) {
                adminLoginFormArea.style.display = 'block';
            }
            adminContent.style.display = 'none';
            return;
        }

        const currentMetaMaskAccount = accounts[0];

        try {
            const contractOwnerAddress = await contract.methods.getOwner().call({ from: currentMetaMaskAccount });
            if (currentMetaMaskAccount.toLowerCase() !== contractOwnerAddress.toLowerCase()) {
                displayMessage("Warning: Your connected MetaMask account is NOT the actual contract owner. You will not be able to perform administrative transactions (e.g., register users, deposit funds). You can only view data.", 'orange');
                if (registerUserForm) registerUserForm.style.display = 'none';
                if (depositForm) depositForm.style.display = 'none';
            } else {
                displayMessage("Connected as contract owner. Full admin access.", 'green');
                if (registerUserForm) registerUserForm.style.display = 'block';
                if (depositForm) depositForm.style.display = 'block';
            }
        } catch (error) {
            console.error("Error verifying contract owner:", error);
            displayMessage(`Could not verify contract owner. Ensure your MetaMask is connected to the deployer account. Details: ${error.message}`, 'red');
            if (registerUserForm) registerUserForm.style.display = 'none';
            if (depositForm) depositForm.style.display = 'none';
        }


        try {
            // Load Registered Users
            let registeredUsers = [];
            try {
                registeredUsers = await contract.methods.getAllRegisteredUsers().call({ from: currentMetaMaskAccount });
            } catch (err) {
                console.warn("Failed to get registered users (might not be owner).", err);
                displayMessage("Failed to load registered users. Ensure you are the contract owner.", 'red');
                registeredUsers = [];
            }

            if (registeredUsersTableBody) {
                registeredUsersTableBody.innerHTML = '';
                if (registeredUsers.length === 0) {
                    if (noRegisteredUsersMessage) noRegisteredUsersMessage.style.display = 'block';
                } else {
                    if (noRegisteredUsersMessage) noRegisteredUsersMessage.style.display = 'none';
                    for (const userAddress of registeredUsers) {
                        const row = registeredUsersTableBody.insertRow();
                        const addressCell = row.insertCell(0);
                        const balanceCell = row.insertCell(1);

                        addressCell.textContent = userAddress; // Display full address
                        let balanceWei = '0';
                        try {
                            balanceWei = await contract.methods.getBalance(userAddress).call({ from: currentMetaMaskAccount });
                        } catch (err) {
                            console.warn(`Failed to get balance for ${userAddress}`, err);
                        }
                        balanceCell.textContent = `${web3.utils.fromWei(balanceWei.toString(), 'ether')} ETH`;
                    }
                }
            }


            // Load All Transactions (Transfers)
            let allTransfers = [];
            try {
                const allTransactionsResult = await contract.methods.getAllTransactions().call({ from: currentMetaMaskAccount });
                if (Array.isArray(allTransactionsResult) && allTransactionsResult.length === 4) {
                    allTransfers = allTransactionsResult;
                } else if (allTransactionsResult && typeof allTransactionsResult === 'object' &&
                           Array.isArray(allTransactionsResult.fromAddresses)) {
                    allTransfers = [
                        allTransactionsResult.fromAddresses,
                        allTransactionsResult.toAddresses,
                        allTransactionsResult.amounts,
                        allTransactionsResult.timestamps
                    ];
                } else {
                    console.warn("Unexpected return format for getAllTransactions:", allTransactionsResult);
                    displayMessage("Failed to load transfer history: Unexpected data format.", 'orange');
                }
            } catch (err) {
                console.error("Failed to get all transfers (might not be owner).", err);
                displayMessage("Failed to load transfer history. Ensure you are the contract owner.", 'red');
            }

            // Load Deposit Made Events
            let allDeposits = [];
            try {
                const events = await contract.getPastEvents('DepositMade', {
                    fromBlock: 0,
                    toBlock: 'latest',
                });

                allDeposits = events.map(event => ({
                    byAdmin: event.returnValues.byAdmin,
                    toUser: event.returnValues.toUser,
                    amount: event.returnValues.amount,
                    timestamp: event.returnValues.timestamp,
                    type: 'Deposit'
                }));
            } catch (err) {
                console.error("Failed to get DepositMade events:", err);
                displayMessage("Failed to load deposit history.", 'red');
            }

            // Combine and sort all transactions/deposits
            let combinedTransactions = [];
            if (allTransfers.length > 0 && allTransfers[0].length > 0) {
                for (let i = 0; i < allTransfers[0].length; i++) {
                    combinedTransactions.push({
                        from: allTransfers[0][i],
                        to: allTransfers[1][i],
                        amount: allTransfers[2][i],
                        timestamp: allTransfers[3][i],
                        type: 'Transfer'
                    });
                }
            }

            allDeposits.forEach(deposit => {
                combinedTransactions.push({
                    from: deposit.byAdmin,
                    to: deposit.toUser,
                    amount: deposit.amount,
                    timestamp: deposit.timestamp,
                    type: 'Deposit'
                });
            });

            // Sort combined transactions by timestamp (most recent first)
            combinedTransactions.sort((a, b) => Number(b.timestamp) - Number(a.timestamp));

            if (allTransactionsTableBody) {
                allTransactionsTableBody.innerHTML = '';
                if (combinedTransactions.length === 0) {
                    if (noAllTransactionsMessage) noAllTransactionsMessage.style.display = 'block';
                } else {
                    if (noAllTransactionsMessage) noAllTransactionsMessage.style.display = 'none';
                    for (const tx of combinedTransactions) {
                        const row = allTransactionsTableBody.insertRow();
                        row.classList.add('transaction-row'); // Add class for styling and event listener
                        row.dataset.from = tx.from; // Store full data in dataset
                        row.dataset.to = tx.to;
                        row.dataset.amount = web3.utils.fromWei(tx.amount.toString(), 'ether');
                        row.dataset.timestamp = new Date(Number(tx.timestamp) * 1000).toLocaleString();
                        row.dataset.type = tx.type;

                        const fromCell = row.insertCell(0);
                        const toCell = row.insertCell(1);
                        const amountCell = row.insertCell(2);
                        const timestampCell = row.insertCell(3);
                        const typeCell = row.insertCell(4);

                        fromCell.textContent = tx.from.substring(0, 8) + '...'; // Truncate for summary view
                        toCell.textContent = tx.to.substring(0, 8) + '...'; // Truncate for summary view
                        amountCell.textContent = `${web3.utils.fromWei(tx.amount.toString(), 'ether')} ETH`;
                        const date = new Date(Number(tx.timestamp) * 1000);
                        timestampCell.textContent = date.toLocaleString();
                        typeCell.textContent = tx.type;
                    }
                }
            }


        } catch (error) {
            console.error("Critical error in loadAdminData's outer try-catch:", error);
            displayMessage(`An unexpected error occurred while loading admin data: ${error.message || error}`, 'red');
            if (registerUserForm) registerUserForm.style.display = 'none';
            if (depositForm) depositForm.style.display = 'none';
        }
    }

    // New: Event listener for expanding transaction details
    if (allTransactionsTableBody) {
        allTransactionsTableBody.addEventListener('click', (event) => {
            let targetRow = event.target.closest('.transaction-row');
            if (!targetRow) return; // Clicked outside a transaction row

            if (currentlyExpandedTransactionRow && currentlyExpandedTransactionRow !== targetRow) {
                // Collapse the previously expanded row
                const prevDetailsRow = currentlyExpandedTransactionRow.nextElementSibling;
                if (prevDetailsRow && prevDetailsRow.classList.contains('transaction-details-row')) {
                    prevDetailsRow.remove();
                }
                currentlyExpandedTransactionRow.classList.remove('expanded');
            }

            if (targetRow.classList.contains('expanded')) {
                // If clicked row is already expanded, collapse it
                targetRow.classList.remove('expanded');
                const detailsRow = targetRow.nextElementSibling;
                if (detailsRow && detailsRow.classList.contains('transaction-details-row')) {
                    detailsRow.remove();
                }
                currentlyExpandedTransactionRow = null;
            } else {
                // Expand the clicked row
                targetRow.classList.add('expanded');
                const detailsRow = allTransactionsTableBody.insertRow(targetRow.rowIndex); // Insert after targetRow
                detailsRow.classList.add('transaction-details-row');
                const detailsCell = detailsRow.insertCell(0);
                detailsCell.colSpan = 5; // Span all 5 columns

                // Populate with full details from dataset
                detailsCell.innerHTML = `
                    <div class="transaction-details-content">
                        <div><strong>From:</strong> <span>${targetRow.dataset.from}</span></div>
                        <div><strong>To:</strong> <span>${targetRow.dataset.to}</span></div>
                        <div><strong>Amount:</strong> <span>${targetRow.dataset.amount} ETH</span></div>
                        <div><strong>Timestamp:</strong> <span>${targetRow.dataset.timestamp}</span></div>
                        <div><strong>Type:</strong> <span>${targetRow.dataset.type}</span></div>
                    </div>
                `;
                currentlyExpandedTransactionRow = targetRow;
            }
        });
    }


    registerUserForm.addEventListener('submit', async (event) => {
        event.preventDefault();
        registerUserMessage.textContent = "";

        const userAddressToRegister = newUserAddressInput.value;

        if (!web3.utils.isAddress(userAddressToRegister)) {
            registerUserMessage.textContent = "Invalid user address.";
            registerUserMessage.className = "message-red";
            return;
        }

        try {
            registerUserMessage.textContent = "Registering user... Please confirm in MetaMask if prompted.";
            registerUserMessage.className = "message-blue";

            await contract.methods.registerUser(userAddressToRegister).send({ from: accounts[0] });

            registerUserMessage.textContent = `User ${userAddressToRegister} registered successfully!`;
            registerUserMessage.className = "message-green";
            newUserAddressInput.value = '';
            loadAdminData();
        } catch (error) {
            console.error("Error registering user:", error);
            let errorMessage = `Registration failed: ${error.message || error}`;
            if (error.message.includes("User is already registered")) {
                errorMessage = `User ${userAddressToRegister} is already registered.`;
            } else if (error.message.includes("User denied transaction signature")) {
                errorMessage = "Registration cancelled by user in MetaMask.";
            } else if (error.message.includes("Caller is not the owner")) {
                errorMessage = "Registration failed: Only the contract owner can register users. Please ensure your connected MetaMask account is the contract deployer.";
            }
            registerUserMessage.textContent = errorMessage;
            registerUserMessage.className = "message-red";
        }
    });

    depositForm.addEventListener('submit', async (event) => {
        event.preventDefault();
        depositMessage.textContent = "";

        const userAddressToDeposit = depositUserAddressInput.value;
        const amountEth = depositAmountInput.value;

        if (!web3.utils.isAddress(userAddressToDeposit)) {
            depositMessage.textContent = "Invalid user address.";
            depositMessage.className = "message-red";
            return;
        }
        if (parseFloat(amountEth) <= 0) {
            depositMessage.textContent = "Amount must be greater than zero.";
            depositMessage.className = "message-red";
            return;
        }

        const amountWei = web3.utils.toWei(amountEth.toString(), 'ether');

        try {
            depositMessage.textContent = "Depositing Ether... Please confirm in MetaMask.";
            depositMessage.className = "message-blue";

            await contract.methods.depositForUser(userAddressToDeposit, amountWei).send({ from: accounts[0] });

            depositMessage.textContent = "Deposit successful!";
            depositMessage.className = "message-green";
            depositUserAddressInput.value = '';
            depositAmountInput.value = '';
            loadAdminData();
        } catch (error) {
            console.error("Error depositing Ether:", error);
            let errorMessage = `Deposit failed: ${error.message || error}`;
            if (error.message.includes("User is not registered")) {
                errorMessage = `Deposit failed: User ${userAddressToDeposit} is not registered.`;
            } else if (error.message.includes("User denied transaction signature")) {
                errorMessage = "Deposit cancelled by user in MetaMask.";
            } else if (error.message.includes("Caller is not the owner")) {
                errorMessage = "Deposit failed: Only the contract owner can deposit funds. Please ensure your connected MetaMask account is the contract deployer.";
            }
            depositMessage.textContent = errorMessage;
            depositMessage.className = "message-red";
        }
    });

    // Helper function for displaying messages with consistent styling
    function displayMessage(message, type = 'blue') {
        const globalMessageArea = document.getElementById('admin-login-message');
        if (globalMessageArea) {
            globalMessageArea.textContent = message;
            globalMessageArea.className = `message-${type}`;
        }
    }


    // Initial setup on page load: check MetaMask status and prepare for login or display content
    initWeb3().then(initialized => {
        if (initialized && accounts && accounts.length > 0) {
            if (adminInputAddress) {
                adminInputAddress.value = accounts[0];
            }
            displayMessage("MetaMask connected. Enter your admin address to proceed.", 'blue');
            if (adminLoginBtn) adminLoginBtn.disabled = false;
        } else {
            displayMessage("Please connect MetaMask.", 'red');
            if (adminLoginBtn) adminLoginBtn.disabled = true;
        }
    });
});