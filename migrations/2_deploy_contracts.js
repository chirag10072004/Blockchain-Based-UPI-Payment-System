const MoneyTransferBank = artifacts.require("MoneyTransferBank");

module.exports = function (deployer) {
  deployer.deploy(MoneyTransferBank);
};