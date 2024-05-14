import {
  Account,
  Aptos,
  APTOS_COIN,
  AptosConfig,
  Ed25519PrivateKey,
  parseTypeTag,
  TypeTagAddress,
  TypeTagU64,
} from "@aptos-labs/ts-sdk";
import { getMetricPayload, pushMetrics, sleepAsync } from './common.js';

const COIN_TRANSFER_LATENCY_METRIC_NAME = "e2e_p2p_txn_latency";
const COIN_TRANSFER_BUILD_LATENCY_METRIC_NAME = "e2e_p2p_txn_latency_build";
const COIN_TRANSFER_SUBMIT_LATENCY_METRIC_NAME = "e2e_p2p_txn_latency_sign_and_submit";
const COIN_TRANSFER_SUCCESS_METRIC_NAME = COIN_TRANSFER_LATENCY_METRIC_NAME + "_success";
const CHAIN_NAME = process.env.CHAIN_NAME;
const PING_INTERVAL = process.env.PING_INTERVAL * 1000;
const CUSTOM_NETWORK = process.env.CUSTOM_NETWORK;
const INDEXER_URL = process.env.INDEXER_URL;

const main = async () => {
  // Setup the client
  let config;
  if (CUSTOM_NETWORK) {
    config = new AptosConfig({
      fullnode: CUSTOM_NETWORK,
      indexer: INDEXER_URL,
  });
  } else {
    config = new AptosConfig({ network: CHAIN_NAME });
  }
  const aptos = new Aptos(config);

  const SENDER_PRIVATE_KEY = process.env.ACC1_PRIVATE_KEY;
  const sender = Account.fromPrivateKey({ privateKey: new Ed25519PrivateKey(SENDER_PRIVATE_KEY) });

  const RECEIVER_PRIVATE_KEY = process.env.ACC2_PRIVATE_KEY;
  const receiver = Account.fromPrivateKey({ privateKey: new Ed25519PrivateKey(RECEIVER_PRIVATE_KEY) });

  const transferAbi = {
    typeParameters: [{ constraints: [] }],
    parameters: [new TypeTagAddress(), new TypeTagU64()],
  };
  const APTOS_COIN_TYPE = parseTypeTag(APTOS_COIN);

  while (true) {
    try {
      const accountData = await aptos.account.getAccountInfo({ accountAddress: sender.accountAddress });
      const sequenceNumber = BigInt(accountData.sequence_number);

      const buildStartTime = performance.now();
      const transaction = await aptos.transaction.build.simple({
          sender: sender.accountAddress,
          data: {
            function: "0x1::coin::transfer",
            typeArguments: [APTOS_COIN_TYPE],
            functionArguments: [receiver.accountAddress, 1],
            abi: transferAbi,
          },
          options: {
            accountSequenceNumber: sequenceNumber,
            gasUnitPrice: 100,
            maxGasAmount: 1000,
          },
      });

      const startTime = performance.now();
      const committedTransaction = await aptos.signAndSubmitTransaction({
          signer: sender,
          transaction,
      });

      const submitEndTime = performance.now();
      await aptos.waitForTransaction({ transactionHash: committedTransaction.hash });

      const endTime = performance.now();

      const buildLatency = (startTime - buildStartTime) / 1000;
      const submitLatency = (submitEndTime - startTime) / 1000;
      const latency = (endTime - startTime) / 1000;
      console.log(`Build latency for p2p transfer: ${buildLatency} s; Submit Latency: ${submitLatency} s; E2E latency for p2p transfer: ${latency} s`);

      pushMetrics(getMetricPayload(COIN_TRANSFER_LATENCY_METRIC_NAME, {"chain_name": CHAIN_NAME}, latency));

      pushMetrics(getMetricPayload(COIN_TRANSFER_SUCCESS_METRIC_NAME, {"chain_name": CHAIN_NAME}, 1));
      pushMetrics(getMetricPayload(COIN_TRANSFER_BUILD_LATENCY_METRIC_NAME, {"chain_name": CHAIN_NAME}, buildLatency));
      pushMetrics(getMetricPayload(COIN_TRANSFER_SUBMIT_LATENCY_METRIC_NAME, {"chain_name": CHAIN_NAME}, submitLatency));
    } catch (error) {
      console.log('Error:', error.message);
      pushMetrics(getMetricPayload(COIN_TRANSFER_SUCCESS_METRIC_NAME, {"chain_name": CHAIN_NAME}, 0));
    }
    await sleepAsync(PING_INTERVAL);
  }
}

main();
