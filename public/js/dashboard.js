document.addEventListener('DOMContentLoaded', async () => {
    const userBalanceSpan = document.getElementById('user-balance');
    const sendMoneyForm = document.getElementById('send-money-form');
    const recipientAddressInput = document.getElementById('recipient-address');
    const amountInput = document.getElementById('amount');
    const sendMoneyMessage = document.getElementById('send-money-message');
    const transactionHistoryTableBody = document.querySelector('#transaction-history-table tbody');
    const noTransactionsMessage = document.getElementById('no-transactions-message');

    // QR Code elements (Image Upload)
    const uploadQrButton = document.getElementById('upload-qr-button');
    const qrCodeFileInput = document.getElementById('qr-code-file-input');
    const qrScanMessage = document.getElementById('qr-scan-message');

    // QR Code elements (Webcam Scan)
    const startWebcamScanButton = document.getElementById('start-webcam-scan-button');
    const stopWebcamScanButton = document.getElementById('stop-webcam-scan-button');
    const webcamScanMessage = document.getElementById('webcam-scan-message');
    const qrReaderDiv = document.getElementById('qr-reader'); // The div for the scanner

    let html5QrCodeScanner; // Declare a variable for the scanner instance

    const web3Initialized = await initWeb3();
    if (!web3Initialized || !accounts || accounts.length === 0) {
        displayMessage("Please connect MetaMask to view your dashboard.");
        window.location.href = 'index.html';
        return;
    }

    const currentUserAddress = accounts[0];

    async function loadDashboardData() {
        try {
            // Check if user is registered
            const isRegistered = await contract.methods.isUserRegistered(currentUserAddress).call({ from: currentUserAddress });
            if (!isRegistered) {
                displayMessage("You are not a registered user. Please contact the Bank Admin to register first.");
                window.location.href = 'register.html';
                return;
            }

            // Get balance
            let balanceWei = '0';
            try {
                balanceWei = await contract.methods.getBalance(currentUserAddress).call({ from: currentUserAddress });
            } catch (err) {
                console.warn("Failed to get user balance:", err);
                displayMessage("Failed to load your balance. Please check your connection.");
            }
            userBalanceSpan.textContent = `${web3.utils.fromWei(balanceWei.toString(), 'ether')} ETH`;

            let combinedTransactions = [];
            const processedTransactionHashes = new Set(); // For deduplication

            // --- 1. Fetch 'DepositMade' Events ---
            try {
                const depositEvents = await contract.getPastEvents('DepositMade', {
                    fromBlock: 0,
                    toBlock: 'latest',
                    filter: { toUser: currentUserAddress }
                });

                depositEvents.forEach(event => {
                    if (!processedTransactionHashes.has(event.transactionHash)) {
                        combinedTransactions.push({
                            from: event.returnValues.byAdmin,
                            to: event.returnValues.toUser,
                            amount: event.returnValues.amount,
                            timestamp: event.returnValues.timestamp,
                            type: 'Deposit',
                            transactionHash: event.transactionHash
                        });
                        processedTransactionHashes.add(event.transactionHash);
                    }
                });
            } catch (err) {
                console.error("Error fetching DepositMade events for user:", err);
                displayMessage("Error fetching deposit history for your account.");
            }

            // --- 2. Fetch 'Transfer' Events ---
            try {
                const outgoingTransferEvents = await contract.getPastEvents('Transfer', {
                    fromBlock: 0,
                    toBlock: 'latest',
                    filter: { from: currentUserAddress }
                });

                const incomingTransferEvents = await contract.getPastEvents('Transfer', {
                    fromBlock: 0,
                    toBlock: 'latest',
                    filter: { to: currentUserAddress }
                });

                const allRelevantTransferEvents = [...outgoingTransferEvents, ...incomingTransferEvents];

                const blockTimestampPromises = {};
                for (const event of allRelevantTransferEvents) {
                    if (!blockTimestampPromises[event.blockNumber]) {
                        blockTimestampPromises[event.blockNumber] = web3.eth.getBlock(event.blockNumber).then(block => block ? block.timestamp : null);
                    }
                }

                const blockTimestamps = {};
                await Promise.all(Object.keys(blockTimestampPromises).map(async blockNum => {
                    blockTimestamps[blockNum] = await blockTimestampPromises[blockNum];
                }));


                for (const event of allRelevantTransferEvents) {
                    if (!processedTransactionHashes.has(event.transactionHash)) {
                        const eventTimestamp = blockTimestamps[event.blockNumber];

                        combinedTransactions.push({
                            from: event.returnValues.from,
                            to: event.returnValues.to,
                            amount: event.returnValues.amount,
                            timestamp: eventTimestamp,
                            type: 'Transfer',
                            transactionHash: event.transactionHash
                        });
                        processedTransactionHashes.add(event.transactionHash);
                    }
                }

            } catch (err) {
                console.error("Error fetching 'Transfer' events for user:", err);
                displayMessage("Error fetching transfer event history.");
            }


            // Sort combined transactions by timestamp (most recent first)
            combinedTransactions.sort((a, b) => {
                const tsA = Number(a.timestamp) || 0;
                const tsB = Number(b.timestamp) || 0;
                return tsB - tsA;
            });

            transactionHistoryTableBody.innerHTML = '';
            if (combinedTransactions.length === 0) {
                noTransactionsMessage.style.display = 'block';
            } else {
                noTransactionsMessage.style.display = 'none';
                for (const tx of combinedTransactions) {
                    const row = transactionHistoryTableBody.insertRow();
                    const fromCell = row.insertCell(0);
                    const toCell = row.insertCell(1);
                    const amountCell = row.insertCell(2);
                    const timestampCell = row.insertCell(3);
                    const typeCell = row.insertCell(4);

                    fromCell.textContent = tx.from.substring(0, 8) + '...';
                    toCell.textContent = tx.to.substring(0, 8) + '...';
                    amountCell.textContent = web3.utils.fromWei(tx.amount.toString(), 'ether');

                    let dateString = "Invalid Date";
                    try {
                        const date = new Date(Number(tx.timestamp) * 1000);
                        if (!isNaN(date.getTime())) {
                            dateString = date.toLocaleString();
                        }
                    } catch (e) {
                        console.warn("Failed to parse date for transaction:", tx.timestamp, e);
                    }
                    timestampCell.textContent = dateString;
                    typeCell.textContent = tx.type;
                }
            }

        } catch (error) {
            console.error("Error in loadDashboardData's outer try-catch:", error);
            displayMessage(`Error loading dashboard data: ${error.message || error}`);
        }
    }

    sendMoneyForm.addEventListener('submit', async (event) => {
        event.preventDefault();
        sendMoneyMessage.textContent = "";

        const recipientAddress = recipientAddressInput.value;
        const amountEth = amountInput.value;

        await executeSendMoney(recipientAddress, amountEth);
    });

    // Helper function to execute the send money transaction
    async function executeSendMoney(recipientAddress, amountEth) {
        if (!web3.utils.isAddress(recipientAddress)) {
            sendMoneyMessage.textContent = "Invalid recipient address.";
            sendMoneyMessage.style.color = "red";
            return false;
        }
        if (recipientAddress.toLowerCase() === currentUserAddress.toLowerCase()) {
            sendMoneyMessage.textContent = "Cannot send money to yourself.";
            sendMoneyMessage.style.color = "red";
            return false;
        }
        if (parseFloat(amountEth) <= 0) {
            sendMoneyMessage.textContent = "Amount must be greater than zero.";
            sendMoneyMessage.style.color = "red";
            return false;
        }

        const amountWei = web3.utils.toWei(amountEth.toString(), 'ether');

        try {
            sendMoneyMessage.textContent = "Sending money... Please confirm in MetaMask.";
            sendMoneyMessage.style.color = "blue";

            await contract.methods.sendMoney(recipientAddress).send({ from: currentUserAddress, value: amountWei });

            sendMoneyMessage.textContent = "Money sent successfully!";
            sendMoneyMessage.style.color = "green";
            recipientAddressInput.value = '';
            amountInput.value = '';
            loadDashboardData();
            return true;
        } catch (error) {
            console.error("Error sending money:", error);
            let errorMessage = "Transaction failed. Please check console for details.";
            if (error.message.includes("User denied transaction signature")) {
                errorMessage = "Transaction cancelled by user in MetaMask.";
            } else if (error.message.includes("revert")) {
                const revertReasonMatch = error.message.match(/revert: (.*)/);
                if (revertReasonMatch && revertReasonMatch[1]) {
                    errorMessage = `Transaction failed: ${revertReasonMatch[1]}`;
                } else {
                    errorMessage = "Transaction failed: Check contract requirements (e.g., insufficient balance, unregistered user).";
                }
            }
            displayMessage(errorMessage);
            sendMoneyMessage.textContent = errorMessage;
            sendMoneyMessage.style.color = "red";
            return false;
        }
    }

    // --- QR Code Scanning from Image Logic ---
    uploadQrButton.addEventListener('click', () => {
        qrCodeFileInput.click(); // Trigger the hidden file input click
    });

    qrCodeFileInput.addEventListener('change', async (event) => {
        const file = event.target.files[0];
        if (!file) {
            qrScanMessage.textContent = "No file selected.";
            qrScanMessage.style.color = "orange";
            return;
        }

        qrScanMessage.textContent = "Scanning QR code from image...";
        qrScanMessage.style.color = "blue";

        const reader = new FileReader();
        reader.onload = async (e) => {
            const imageDataUrl = e.target.result;
            const img = new Image();
            img.onload = async () => {
                const canvas = document.createElement('canvas');
                const ctx = canvas.getContext('2d');
                canvas.width = img.width;
                canvas.height = img.height;
                ctx.drawImage(img, 0, 0, img.width, img.height);

                const imageData = ctx.getImageData(0, 0, img.width, img.height);
                const code = jsQR(imageData.data, imageData.width, imageData.height);

                if (code) {
                    const scannedAddress = code.data.trim();
                    if (web3.utils.isAddress(scannedAddress)) {
                        recipientAddressInput.value = scannedAddress; // Populate the input field
                        qrScanMessage.textContent = `QR code scanned from image successfully! Address: ${scannedAddress.substring(0, 8)}...`;
                        qrScanMessage.style.color = "green";
                        amountInput.focus(); // Focus on amount input
                    } else {
                        qrScanMessage.textContent = "QR code from image contains invalid Ethereum address.";
                        qrScanMessage.style.color = "red";
                    }
                } else {
                    qrScanMessage.textContent = "No QR code found in the image.";
                    qrScanMessage.style.color = "red";
                }
            };
            img.onerror = () => {
                qrScanMessage.textContent = "Could not load image.";
                qrScanMessage.style.color = "red";
            };
            img.src = imageDataUrl;
        };
        reader.readAsDataURL(file);
    });
    // --- End QR Code Scanning from Image Logic ---

    // --- Live Webcam QR Code Scanning Logic ---
    let html5QrCode; // Instance of the scanner

    startWebcamScanButton.addEventListener('click', async () => {
        webcamScanMessage.textContent = "Starting webcam...";
        webcamScanMessage.style.color = "blue";
        startWebcamScanButton.style.display = 'none';
        stopWebcamScanButton.style.display = 'block';

        if (!html5QrCode) {
            // Instantiate once
            html5QrCode = new Html5Qrcode("qr-reader");
        }

        try {
            // Request camera permissions and get available cameras
            const cameras = await Html5Qrcode.getCameras();
            if (cameras && cameras.length) {
                // Use the first available camera (you can add a dropdown to select if multiple)
                await html5QrCode.start(
                    cameras[0].id, // cameraDeviceId
                    {
                        fps: 10,    // frames per second
                        qrbox: { width: 250, height: 250 } // size of scan region
                    },
                    (decodedText, decodedResult) => {
                        // On successful scan
                        webcamScanMessage.textContent = `QR code scanned successfully!`;
                        webcamScanMessage.style.color = "green";

                        const scannedAddress = decodedText.trim();
                        if (web3.utils.isAddress(scannedAddress)) {
                            recipientAddressInput.value = scannedAddress; // Populate input field
                            displayMessage(`Address scanned: ${scannedAddress.substring(0, 8)}...`);
                            amountInput.focus(); // Focus on amount
                            stopScanner(); // Stop scanner after successful scan
                        } else {
                            displayMessage("Scanned QR code is not a valid Ethereum address.");
                        }
                    },
                    (errorMessage) => {
                        // On error during scan (e.g., no QR found in frame, or decoding error)
                        // console.warn(`QR Scan Error: ${errorMessage}`);
                        webcamScanMessage.textContent = `Scanning... (Move QR code into view)`;
                        webcamScanMessage.style.color = "gray";
                    }
                );
                webcamScanMessage.textContent = "Webcam started. Scanning for QR code...";
                webcamScanMessage.style.color = "blue";
            } else {
                webcamScanMessage.textContent = "No cameras found on this device.";
                webcamScanMessage.style.color = "red";
                startWebcamScanButton.style.display = 'block'; // Show start button again
                stopWebcamScanButton.style.display = 'none';
            }
        } catch (err) {
            console.error("Error starting webcam scan:", err);
            webcamScanMessage.textContent = `Error: ${err.message || 'Could not start webcam.'}`;
            webcamScanMessage.style.color = "red";
            startWebcamScanButton.style.display = 'block';
            stopWebcamScanButton.style.display = 'none';
        }
    });

    stopWebcamScanButton.addEventListener('click', () => {
        stopScanner();
    });

    async function stopScanner() {
        // Corrected check for scanner state
        if (html5QrCode && html5QrCode.isScanning) {
            try {
                await html5QrCode.stop();
                webcamScanMessage.textContent = "Webcam stopped.";
                webcamScanMessage.style.color = "black";
                startWebcamScanButton.style.display = 'block';
                stopWebcamScanButton.style.display = 'none';
            } catch (err) {
                console.error("Error stopping webcam:", err);
                webcamScanMessage.textContent = `Error stopping webcam: ${err.message}`;
                webcamScanMessage.style.color = "red";
            }
        } else {
            webcamScanMessage.textContent = "Scanner not active.";
            webcamScanMessage.style.color = "orange";
        }
    }

    // --- New: Logic for Quick Action Buttons to trigger Send Money ---
    const quickActionButtons = document.querySelectorAll('.quick-action-item');

    quickActionButtons.forEach(button => {
        if (button.id !== 'quick-scan-qr') { // Exclude the QR scan button as it has its own logic
            button.addEventListener('click', async () => {
                const actionText = button.querySelector('span').textContent.trim();
                console.log(`Clicked: ${actionText}`);

                displayPrompt(`Enter recipient address for "${actionText}":`, async (recipientAddress) => {
                    if (!recipientAddress) {
                        sendMoneyMessage.textContent = "Transaction cancelled: No recipient address provided.";
                        sendMoneyMessage.style.color = "orange";
                        return;
                    }

                    if (!web3.utils.isAddress(recipientAddress)) {
                        sendMoneyMessage.textContent = "Invalid recipient address entered.";
                        sendMoneyMessage.style.color = "red";
                        return;
                    }

                    displayPrompt(`Enter amount (ETH) for "${actionText}" to ${recipientAddress.substring(0,8)}...:`, async (amountEth) => {
                        if (!amountEth || isNaN(parseFloat(amountEth)) || parseFloat(amountEth) <= 0) {
                            sendMoneyMessage.textContent = "Transaction cancelled: Invalid or no amount provided.";
                            sendMoneyMessage.style.color = "orange";
                            return;
                        }

                        // Optionally, pre-fill the send money form fields
                        recipientAddressInput.value = recipientAddress;
                        amountInput.value = amountEth;

                        // Trigger the send money function
                        await executeSendMoney(recipientAddress, amountEth);
                    });
                });
            });
        }
    });

    // Initial load
    loadDashboardData();

    // Listen for Transfer events for live updates (if needed, but getPastEvents covers historical)
    contract.events.Transfer({
        filter: { from: currentUserAddress, to: currentUserAddress },
        fromBlock: 'latest'
    })
    .on('data', function(event){
        console.log("Live Transfer event detected:", event);
        loadDashboardData();
    })
    .on('error', console.error);
});