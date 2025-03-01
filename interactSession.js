const {
  Client,
  PrivateKey,
  AccountId,
  ContractExecuteTransaction,
  ContractCallQuery,
  AccountCreateTransaction,
  ContractFunctionParameters,
  TokenAssociateTransaction,
  Hbar,
} = require("@hashgraph/sdk");

// require("dotenv").config({ path: "../.env" });

const adapterAccountId = AccountId.fromString("0.0.5640055");
const userAccountId = AccountId.fromString("0.0.5640365");
// 0.0.5640056
const operatorKey = PrivateKey.fromStringECDSA(
  "3030020100300706052b8104000a042204205a06bb89b28a4aefda42217b65cef4ecada0d83d23385e38909968cf7e1bc424"
);
const contractId = "0.0.5640053";

async function main() {
  const client = Client.forTestnet();
  client.setOperator(adapterAccountId, operatorKey);

  console.log("Creating Parking Session....");
  const startTime = Math.floor(Date.now() / 1000) + 3600;
  const endTime = startTime + 2 * 60 * 60;
  const spotBookerWallet = "0.0.5616371";

  const startSessionTx = await new ContractExecuteTransaction()
    .setContractId(contractId)
    .setGas(500000)
    .setFunction(
      "createParkingSession",
      new ContractFunctionParameters()
        .addInt64(startTime)
        .addInt64(endTime)
        .addAddress(userAccountId.toSolidityAddress())
        .addAddress(AccountId.fromString(spotBookerWallet).toSolidityAddress())
    )
    .execute(client);

  const startSessionReceipt = await startSessionTx.getReceipt(client);
  console.log("Session Start Status:", startSessionReceipt.status.toString());

  //   // Retrieve the session ID
  const startSessionRecord = await startSessionTx.getRecord(client);
  const sessionId = startSessionRecord.contractFunctionResult
    .getUint256(0)
    .toString();
  console.log("Generated Session ID:", sessionId);

  console.log(`Parking session created with ID: ${sessionId}`);

  const endSessionTx = new ContractExecuteTransaction()
    .setContractId(contractId)
    .setGas(500000)
    .setFunction(
      "endParkingSession",
      new ContractFunctionParameters().addUint256(sessionId).addInt64(1)
    );

  const txResponseEnd = await endSessionTx.execute(client);
  const receiptEnd = await txResponseEnd.getReceipt(client);

  console.log(
    `Parking session ${sessionId} ended with status: ${receiptEnd.status}`
  );

  const transaction = new ContractExecuteTransaction()
    .setContractId(contractId)
    .setGas(900000)
    .setFunction(
      "distributeRewards",
      new ContractFunctionParameters().addUint256(sessionId)
    );

  const txResponsee = await transaction.execute(client);
  const record = await txResponsee.getRecord(client);

  console.log(`\n✅ Rewards distributed successfully!`);
  console.log(
    `- Hashscan URL: https://hashscan.io/testnet/tx/${txResponsee.transactionId.toString()}`
  );
}

main();
