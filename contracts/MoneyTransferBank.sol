// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

contract MoneyTransferBank {
    address private immutable i_owner; // The contract owner, representing the Bank Admin

    // Mapping to store registration status. true means the address is registered.
    mapping(address => bool) private s_isRegistered;
    // Array to store all registered user addresses for easy retrieval by the Bank.
    address[] private s_registeredUsersArray;

    // Mapping to store internal balances of registered users.
    mapping(address => uint) private s_balances;

    // Struct to represent a transaction
    struct Transaction {
        address from;
        address to;
        uint amount;
        uint timestamp;
    }

    // Array to store all transactions made through the contract.
    Transaction[] private s_allTransactions;
    // Mapping to link a user's address to the indices of their transactions in s_allTransactions.
    mapping(address => uint[]) private s_userTransactionIds;

    // Event emitted when money is transferred
    event Transfer(address indexed from, address indexed to, uint amount);
    // NEW: Event emitted when a deposit is made by the admin
    event DepositMade(address indexed byAdmin, address indexed toUser, uint amount, uint timestamp);

    // Modifier to restrict function access to the contract owner (Bank Admin)
    modifier onlyOwner() {
        require(msg.sender == i_owner, "MoneyTransferBank: Caller is not the owner (Bank Admin).");
        _;
    }

    constructor() {
        i_owner = msg.sender; // The deployer of the contract is the Bank Admin
    }

    /**
     * @dev Registers a new user in the bank system. Only the contract owner (Bank Admin) can call this.
     * @param _user The MetaMask address of the user to register.
     */
    function registerUser(address _user) public onlyOwner {
        require(!s_isRegistered[_user], "MoneyTransferBank: User is already registered.");
        s_isRegistered[_user] = true;
        s_balances[_user] = 0; // Initialize balance to 0 for new users
        s_registeredUsersArray.push(_user); // Add user to the list of registered users
    }

    /**
     * @dev Sends Ether (internal balance) from the caller to a recipient.
     * The sender and recipient must be registered users.
     * The `payable` keyword is used to allow a value to be sent with the transaction,
     * which in this bank model represents the amount to be transferred on the ledger.
     * @param _to The recipient's MetaMask address.
     */
    function sendMoney(address payable _to) public payable {
        require(s_isRegistered[msg.sender], "MoneyTransferBank: Sender is not a registered user.");
        require(s_isRegistered[_to], "MoneyTransferBank: Recipient is not a registered user.");
        require(msg.value > 0, "MoneyTransferBank: Amount must be greater than zero.");
        require(s_balances[msg.sender] >= msg.value, "MoneyTransferBank: Insufficient balance.");

        s_balances[msg.sender] -= msg.value;
        s_balances[_to] += msg.value;

        // Record transaction
        s_allTransactions.push(Transaction(msg.sender, _to, msg.value, block.timestamp));
        uint transactionId = s_allTransactions.length - 1; // Get the index of the newly added transaction
        s_userTransactionIds[msg.sender].push(transactionId);
        s_userTransactionIds[_to].push(transactionId);

        emit Transfer(msg.sender, _to, msg.value);
    }

    /**
     * @dev Returns the internal balance of a given user.
     * @param _user The MetaMask address of the user.
     * @return balance The balance of the user in Wei (as stored in the contract's ledger).
     */
    function getBalance(address _user) public view returns (uint balance) {
        return s_balances[_user];
    }

    /**
     * @dev Returns the contract owner's address (the Bank Admin).
     * @return ownerAddress The address of the contract owner.
     */
    function getOwner() public view returns (address ownerAddress) {
        return i_owner;
    }

    /**
     * @dev Returns a list of all registered user addresses. Only callable by the Bank Admin.
     * @return registeredUsers An array of all registered user addresses.
     */
    function getAllRegisteredUsers() public view onlyOwner returns (address[] memory registeredUsers) {
        return s_registeredUsersArray;
    }

    /**
     * @dev Returns the transaction history for a given user.
     * @param _user The MetaMask address of the user.
     * @return fromAddresses Arrays of from addresses.
     * @return toAddresses Arrays of to addresses.
     * @return amounts Arrays of amounts.
     * @return timestamps Arrays of timestamps for the user's transactions.
     */
    function getTransactionHistory(address _user) public view returns (
        address[] memory fromAddresses,
        address[] memory toAddresses,
        uint[] memory amounts,
        uint[] memory timestamps
    ) {
        uint[] memory userTxIds = s_userTransactionIds[_user];
        uint numTx = userTxIds.length;

        fromAddresses = new address[](numTx);
        toAddresses = new address[](numTx);
        amounts = new uint[](numTx);
        timestamps = new uint[](numTx);

        for (uint i = 0; i < numTx; i++) {
            uint txId = userTxIds[i];
            Transaction storage transactionData = s_allTransactions[txId];
            fromAddresses[i] = transactionData.from;
            toAddresses[i] = transactionData.to;
            amounts[i] = transactionData.amount;
            timestamps[i] = transactionData.timestamp;
        }
        return (fromAddresses, toAddresses, amounts, timestamps);
    }

    /**
     * @dev Allows the Bank Admin to view all transactions recorded in the contract.
     * @return fromAddresses Arrays of from addresses.
     * @return toAddresses Arrays of to addresses.
     * @return amounts Arrays of amounts.
     * @return timestamps Arrays of timestamps for all transactions.
     */
    function getAllTransactions() public view onlyOwner returns (
        address[] memory fromAddresses,
        address[] memory toAddresses,
        uint[] memory amounts,
        uint[] memory timestamps
    ) {
        uint numTx = s_allTransactions.length;

        fromAddresses = new address[](numTx);
        toAddresses = new address[](numTx);
        amounts = new uint[](numTx);
        timestamps = new uint[](numTx);

        for (uint i = 0; i < numTx; i++) {
            Transaction storage transactionData = s_allTransactions[i];
            fromAddresses[i] = transactionData.from;
            toAddresses[i] = transactionData.to;
            amounts[i] = transactionData.amount;
            timestamps[i] = transactionData.timestamp;
        }
        return (fromAddresses, toAddresses, amounts, timestamps);
    }

    /**
     * @dev Allows the Bank Admin to deposit Ether into a user's internal balance (for initial funding or testing).
     * @param _user The address of the user to deposit for.
     * @param _amount The amount in Wei to deposit.
     */
    function depositForUser(address _user, uint _amount) public onlyOwner {
        require(s_isRegistered[_user], "MoneyTransferBank: User is not registered.");
        s_balances[_user] += _amount;
        // NEW: Emit DepositMade event
        emit DepositMade(msg.sender, _user, _amount, block.timestamp);
    }

    /**
     * @dev Checks if a user is registered. Public view for frontend check.
     * @param _user The address to check.
     * @return isRegistered True if the user is registered, false otherwise.
     */
    function isUserRegistered(address _user) public view returns (bool isRegistered) {
        return s_isRegistered[_user];
    }
}