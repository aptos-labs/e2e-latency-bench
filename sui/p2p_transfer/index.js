import { getFullnodeUrl, SuiClient } from '@mysten/sui.js/client';
import { TransactionBlock } from '@mysten/sui.js/transactions';
import { Ed25519Keypair } from '@mysten/sui.js/keypairs/ed25519';
import { decodeSuiPrivateKey } from '@mysten/sui.js/cryptography';
import { getMetricPayload, pushMetrics, sleepAsync } from './common.js';

const COIN_TRANSFER_LATENCY_METRIC_NAME = "e2e_p2p_txn_latency_sui";
const COIN_TRANSFER_SUCCESS_METRIC_NAME = COIN_TRANSFER_LATENCY_METRIC_NAME + "_success";
const CHAIN_NAME = process.env.CHAIN_NAME;
const PING_INTERVAL = process.env.PING_INTERVAL * 1000;
const URL_OVERRIDE = process.env.URL;

function getKeyPairFromExportedPrivateKey(privateKey) {
  let parsedKeyPair = decodeSuiPrivateKey(privateKey);
  return Ed25519Keypair.fromSecretKey(parsedKeyPair.secretKey);
}

const main = async () => {
  const SENDER_PRIVATE_KEY = process.env.ACC1_PRIVATE_KEY;
  const sender_keypair = getKeyPairFromExportedPrivateKey(SENDER_PRIVATE_KEY);

  const RECIEVER_PRIVATE_KEY = process.env.ACC2_PRIVATE_KEY;
  const receiver_keypair = getKeyPairFromExportedPrivateKey(RECIEVER_PRIVATE_KEY);
  const receiver_address = receiver_keypair.getPublicKey().toSuiAddress();


  // create a new SuiClient object pointing to the network you want to use
  let url = getFullnodeUrl('mainnet');
  if (URL_OVERRIDE) {
      url = URL_OVERRIDE;
  }
  const suiClient = new SuiClient({ url: url });

  while (true) {
    try {
      const txb = new TransactionBlock();
      const [coin] = txb.splitCoins(txb.gas, [txb.pure(1)]);
      txb.transferObjects([coin], receiver_address);

      const startTime = performance.now();
      const transfer_resp = await suiClient.signAndExecuteTransactionBlock({signer: sender_keypair, transactionBlock: txb, 	options: {
          showBalanceChanges: true,
          showEffects: true,
          showEvents: true,
          showInput: true,
          showObjectChanges: true,
          showRawInput: true,
      },});
      const wait_resp = await suiClient.waitForTransactionBlock({ digest: transfer_resp.digest, options: {
          showBalanceChanges: true,
          showEffects: true,
          showEvents: true,
          showInput: true,
          showObjectChanges: true,
          showRawInput: true,
      }, })
      const endTime = performance.now();
      const latency = (endTime - startTime) / 1000;
      console.log(`E2E latency for p2p transfer: ${latency} s`);

      const latency_metrics_payload = getMetricPayload(COIN_TRANSFER_LATENCY_METRIC_NAME, {"chain_name": CHAIN_NAME}, latency);
      pushMetrics(latency_metrics_payload);
      pushMetrics(getMetricPayload(COIN_TRANSFER_SUCCESS_METRIC_NAME, {"chain_name": CHAIN_NAME}, 0));
    } catch (error) {
      console.log('Error:', error.message);
      pushMetrics(getMetricPayload(COIN_TRANSFER_SUCCESS_METRIC_NAME, {"chain_name": CHAIN_NAME}, 0));
    }
    await sleepAsync(PING_INTERVAL);
  }
};

main();