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

require("dotenv").config({ path: "../.env" });

const operatorId = AccountId.fromString(process.env.OPERATOR_ID);
const operatorKey = PrivateKey.fromStringECDSA(process.env.OPERATOR_KEY);
const contractId = "0.0.5640053";
const tokenId = "0.0.5630530";

async function main() {
  const client = Client.forTestnet();
  client.setOperator(operatorId, operatorKey);
  const adapterPrivateKey = PrivateKey.generateECDSA();
  const adapterPublicKey = adapterPrivateKey.publicKey;

  // Create Adapter Account
  const createAdapterAccountTx = await new AccountCreateTransaction()
    .setKeyWithoutAlias(adapterPublicKey)
    .setInitialBalance(new Hbar(10))
    .execute(client);

  const adapterAccountReceipt = await createAdapterAccountTx.getReceipt(client);
  const adapterAccountId = adapterAccountReceipt.accountId;
  console.log("Adapter Account ID:", adapterAccountId.toString());
  console.log("Adapter Private Key:", adapterPrivateKey.toString());

  // Create User Account
  const userPrivateKey = PrivateKey.generateED25519();
  const userPublicKey = userPrivateKey.publicKey;

  const createUserAccountTx = await new AccountCreateTransaction()
    .setKeyWithoutAlias(userPublicKey)
    .setInitialBalance(new Hbar(10))
    .execute(client);

  const userAccountReceipt = await createUserAccountTx.getReceipt(client);
  const userAccountId = userAccountReceipt.accountId;
  console.log("User Account ID:", userAccountId.toString());
  console.log("User Private Key:", userPrivateKey.toString());

  console.log(`🔑 Authorizing admin...`);
  const authAdapterTx = await new ContractExecuteTransaction()
    .setContractId(contractId)
    .setGas(500000)
    .setFunction(
      "addAdmin",
      new ContractFunctionParameters().addAddress(
        adapterAccountId.toSolidityAddress()
      )
    )
    .execute(client);

  await authAdapterTx.getReceipt(client);
  console.log("✅ Admin authorized!");

  client.setOperator(adapterAccountId, adapterPrivateKey);

  // Associate token with Adapter Account
  const adapterTokenAssociateTx = await new TokenAssociateTransaction()
    .setAccountId(adapterAccountId)
    .setTokenIds([tokenId])
    .execute(client);

  const adapterTokenAssociateReceipt = await adapterTokenAssociateTx.getReceipt(
    client
  );
  console.log(
    "Adapter Token Association Status:",
    adapterTokenAssociateReceipt.status.toString()
  );

  client.setOperator(userAccountId, userPrivateKey);

  // Associate token with User Account
  const userTokenAssociateTx = await new TokenAssociateTransaction()
    .setAccountId(userAccountId)
    .setTokenIds([tokenId])
    .execute(client);

  const userTokenAssociateReceipt = await userTokenAssociateTx.getReceipt(
    client
  );
  console.log(
    "User Token Association Status:",
    userTokenAssociateReceipt.status.toString()
  );
}

main();
