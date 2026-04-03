let web3;
let accounts; // This will store the connected MetaMask accounts
let contract; // This will store the MoneyTransferBank contract instance

// Contract Address and ABI (replace with your actual deployed contract address and ABI)
// IMPORTANT: Update this after deploying your MoneyTransferBank.sol contract!
const contractAddress = "0xA6a66696a3497C0A89BfaC9CE81DDba36F505957"; // This is from your MoneyTransferBank.json
// IMPORTANT: Replace with the actual ABI from your Truffle build output (MoneyTransferBank.json)
const contractABI = [
  {
      "inputs": [],
      "stateMutability": "nonpayable",
      "type": "constructor"
    },
    {
      "anonymous": false,
      "inputs": [
        {
          "indexed": true,
          "internalType": "address",
          "name": "byAdmin",
          "type": "address"
        },
        {
          "indexed": true,
          "internalType": "address",
          "name": "toUser",
          "type": "address"
        },
        {
          "indexed": false,
          "internalType": "uint256",
          "name": "amount",
          "type": "uint256"
        },
        {
          "indexed": false,
          "internalType": "uint256",
          "name": "timestamp",
          "type": "uint256"
        }
      ],
      "name": "DepositMade",
      "type": "event"
    },
    {
      "anonymous": false,
      "inputs": [
        {
          "indexed": true,
          "internalType": "address",
          "name": "from",
          "type": "address"
        },
        {
          "indexed": true,
          "internalType": "address",
          "name": "to",
          "type": "address"
        },
        {
          "indexed": false,
          "internalType": "uint256",
          "name": "amount",
          "type": "uint256"
        }
      ],
      "name": "Transfer",
      "type": "event"
    },
    {
      "inputs": [
        {
          "internalType": "address",
          "name": "_user",
          "type": "address"
        }
      ],
      "name": "registerUser",
      "outputs": [],
      "stateMutability": "nonpayable",
      "type": "function"
    },
    {
      "inputs": [
        {
          "internalType": "address payable",
          "name": "_to",
          "type": "address"
        }
      ],
      "name": "sendMoney",
      "outputs": [],
      "stateMutability": "payable",
      "type": "function"
    },
    {
      "inputs": [
        {
          "internalType": "address",
          "name": "_user",
          "type": "address"
        }
      ],
      "name": "getBalance",
      "outputs": [
        {
          "internalType": "uint256",
          "name": "balance",
          "type": "uint256"
        }
      ],
      "stateMutability": "view",
      "type": "function"
    },
    {
      "inputs": [],
      "name": "getOwner",
      "outputs": [
        {
          "internalType": "address",
          "name": "ownerAddress",
          "type": "address"
        }
      ],
      "stateMutability": "view",
      "type": "function"
    },
    {
      "inputs": [],
      "name": "getAllRegisteredUsers",
      "outputs": [
        {
          "internalType": "address[]",
          "name": "registeredUsers",
          "type": "address[]"
        }
      ],
      "stateMutability": "view",
      "type": "function"
    },
    {
      "inputs": [
        {
          "internalType": "address",
          "name": "_user",
          "type": "address"
        }
      ],
      "name": "getTransactionHistory",
      "outputs": [
        {
          "internalType": "address[]",
          "name": "fromAddresses",
          "type": "address[]"
        },
        {
          "internalType": "address[]",
          "name": "toAddresses",
          "type": "address[]"
        },
        {
          "internalType": "uint256[]",
          "name": "amounts",
          "type": "uint256[]"
        },
        {
          "internalType": "uint256[]",
          "name": "timestamps",
          "type": "uint256[]"
        }
      ],
      "stateMutability": "view",
      "type": "function"
    },
    {
      "inputs": [],
      "name": "getAllTransactions",
      "outputs": [
        {
          "internalType": "address[]",
          "name": "fromAddresses",
          "type": "address[]"
        },
        {
          "internalType": "address[]",
          "name": "toAddresses",
          "type": "address[]"
        },
        {
          "internalType": "uint256[]",
          "name": "amounts",
          "type": "uint256[]"
        },
        {
          "internalType": "uint256[]",
          "name": "timestamps",
          "type": "uint256[]"
        }
      ],
      "stateMutability": "view",
      "type": "function"
    },
    {
      "inputs": [
        {
          "internalType": "address",
          "name": "_user",
          "type": "address"
        },
        {
          "internalType": "uint256",
          "name": "_amount",
          "type": "uint256"
        }
      ],
      "name": "depositForUser",
      "outputs": [],
      "stateMutability": "nonpayable",
      "type": "function"
    },
    {
      "inputs": [
        {
          "internalType": "address",
          "name": "_user",
          "type": "address"
        }
      ],
      "name": "isUserRegistered",
      "outputs": [
        {
          "internalType": "bool",
          "name": "isRegistered",
          "type": "bool"
        }
      ],
      "stateMutability": "view",
      "type": "function"
    }
  ]
// Custom message box function instead of alert()
function displayMessage(message) {
  const messageBox = document.createElement('div');
  messageBox.style.cssText = `
    position: fixed;
    top: 50%;
    left: 50%;
    transform: translate(-50%, -50%);
    background-color: #f0f0f0;
    border: 1px solid #ccc;
    padding: 20px;
    border-radius: 8px;
    box-shadow: 0 4px 8px rgba(0, 0, 0, 0.1);
    z-index: 1000;
    font-family: Arial, sans-serif;
    color: #333;
    text-align: center;
  `;
  messageBox.innerHTML = `
    <p>${message}</p>
    <button onclick="this.parentNode.remove()" style="
      background-color: #007bff;
      color: white;
      border: none;
      padding: 8px 16px;
      margin-top: 10px;
      border-radius: 4px;
      cursor: pointer;
    ">OK</button>
  `;
  document.body.appendChild(messageBox);
}

// Custom confirmation box function instead of confirm()
function displayConfirm(message, callback) {
    const confirmBox = document.createElement('div');
    confirmBox.style.cssText = `
        position: fixed;
        top: 50%;
        left: 50%;
        transform: translate(-50%, -50%);
        background-color: #f0f0f0;
        border: 1px solid #ccc;
        padding: 20px;
        border-radius: 8px;
        box-shadow: 0 4px 8px rgba(0, 0, 0, 0.1);
        z-index: 1000;
        font-family: Arial, sans-serif;
        color: #333;
        text-align: center;
    `;
    confirmBox.innerHTML = `
        <p>${message}</p>
        <button id="confirmYes" style="
            background-color: #007bff;
            color: white;
            border: none;
            padding: 8px 16px;
            margin-top: 10px;
            margin-right: 10px;
            border-radius: 4px;
            cursor: pointer;
        ">Yes</button>
        <button id="confirmNo" style="
            background-color: #e74c3c;
            color: white;
            border: none;
            padding: 8px 16px;
            margin-top: 10px;
            border-radius: 4px;
            cursor: pointer;
        ">No</button>
    `;
    document.body.appendChild(confirmBox);

    document.getElementById('confirmYes').onclick = () => {
        confirmBox.remove();
        callback(true);
    };
    document.getElementById('confirmNo').onclick = () => {
        confirmBox.remove();
        callback(false);
    };
}

// Custom prompt dialog
function displayPrompt(message, callback) {
    const promptBox = document.createElement('div');
    promptBox.style.cssText = `
        position: fixed;
        top: 50%;
        left: 50%;
        transform: translate(-50%, -50%);
        background-color: #f0f0f0;
        border: 1px solid #ccc;
        padding: 20px;
        border-radius: 8px;
        box-shadow: 0 4px 8px rgba(0, 0, 0, 0.1);
        z-index: 1000;
        font-family: Arial, sans-serif;
        color: #333;
        text-align: center;
    `;
    promptBox.innerHTML = `
        <p>${message}</p>
        <input type="text" id="promptInput" style="
            width: 80%;
            padding: 8px;
            margin-bottom: 10px;
            border: 1px solid #ccc;
            border-radius: 4px;
        "/>
        <button id="promptOk" style="
            background-color: #007bff;
            color: white;
            border: none;
            padding: 8px 16px;
            margin-top: 10px;
            border-radius: 4px;
            cursor: pointer;
        ">OK</button>
    `;
    document.body.appendChild(promptBox);

    const promptInput = document.getElementById('promptInput');
    const promptOk = document.getElementById('promptOk');

    promptOk.onclick = () => {
        promptBox.remove();
        callback(promptInput.value);
    };

    promptInput.onkeypress = (e) => {
        if (e.key === 'Enter') {
            promptBox.remove();
            callback(promptInput.value);
        }
    };
    promptInput.focus();
}


// Function to initialize Web3 and MetaMask connection
async function initWeb3() {
    if (window.ethereum) {
        web3 = new Web3(window.ethereum);
        try {
            // Request account access
            accounts = await window.ethereum.request({ method: 'eth_requestAccounts' });
            // Initialize contract here after accounts are available
            contract = new web3.eth.Contract(contractABI, contractAddress);
            updateMetaMaskStatus(true);
            return true;
        } catch (error) {
            console.error("User denied account access or other error:", error);
            updateMetaMaskStatus(false, "Connection rejected or error.");
            return false;
        }
    } else if (window.web3) { // Old DApp browsers
        web3 = new Web3(window.web3.currentProvider);
        accounts = await web3.eth.getAccounts();
        contract = new web3.eth.Contract(contractABI, contractAddress);
        updateMetaMaskStatus(true);
        return true;
    } else {
        console.warn('Non-Ethereum browser detected. You should consider trying MetaMask!');
        updateMetaMaskStatus(false, "MetaMask not detected. Please install it.");
        return false;
    }
}

// Function to update MetaMask status display
function updateMetaMaskStatus(connected, message = "") {
    const statusText = document.getElementById('status-text');
    const accountAddressDisplay = document.getElementById('account-address');

    if (statusText && accountAddressDisplay) { // Check if elements exist
        if (connected && accounts && accounts.length > 0) {
            statusText.textContent = "Connected";
            statusText.style.color = "green";
            accountAddressDisplay.textContent = `Account: ${accounts[0]}`;
        } else {
            statusText.textContent = message || "Not Connected";
            statusText.style.color = "red";
            accountAddressDisplay.textContent = "";
        }
    }
}

// Listen for MetaMask account changes
if (window.ethereum) {
    window.ethereum.on('accountsChanged', async (newAccounts) => {
        accounts = newAccounts;
        if (accounts.length === 0) {
            updateMetaMaskStatus(false, "MetaMask disconnected or no accounts available.");
            // Redirect to login page
            window.location.href = 'index.html';
        } else {
            updateMetaMaskStatus(true);
            // Re-fetch data for the new account if on dashboard/admin
            if (window.location.pathname.includes('dashboard.html')) {
                loadDashboardData();
            } else if (window.location.pathname.includes('admin.html')) {
                loadAdminData();
            } else if (window.location.pathname.includes('register.html')) {
                checkRegistrationStatus(); // Re-check status for the new account
            }
        }
    });

    // Listen for chain changes
    window.ethereum.on('chainChanged', (chainId) => {
        console.log("Chain changed to:", chainId);
        // Reload page to re-initialize Web3 and contract for the new chain
        window.location.reload();
    });
}