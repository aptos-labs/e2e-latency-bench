import { getFullnodeUrl, SuiClient } from '@mysten/sui.js/client';
import { TransactionBlock } from '@mysten/sui.js/transactions';
import { Ed25519Keypair } from '@mysten/sui.js/keypairs/ed25519';
import { decodeSuiPrivateKey } from '@mysten/sui.js/cryptography';
import { getPrometheusMetricPushPayload, pushPrometheusMetricsToVM, sleepAsync } from './common.js';

const COIN_TRANSFER_LATENCY_METRIC_NAME = "e2e_shared_obj_incr_txn_latency_sui";
const COIN_TRANSFER_SUCCESS_METRIC_NAME = COIN_TRANSFER_LATENCY_METRIC_NAME + "_success";
const CHAIN_NAME = process.env.CHAIN_NAME;
const PING_INTERVAL = process.env.PING_INTERVAL * 1000;
const SMART_CONTRACT = process.env.SMART_CONTRACT;
const SHARED_OBJ_ON_CHAIN = process.env.SHARED_OBJ_ON_CHAIN;
const URL_OVERRIDE = process.env.URL;

function getKeyPairFromExportedPrivateKey(privateKey) {
    let parsedKeyPair = decodeSuiPrivateKey(privateKey);
    return Ed25519Keypair.fromSecretKey(parsedKeyPair.secretKey);
}

const main = async () => {
    const SENDER_PRIVATE_KEY = process.env.ACC1_PRIVATE_KEY;
    const sender_keypair = getKeyPairFromExportedPrivateKey(SENDER_PRIVATE_KEY);

    // create a new SuiClient object pointing to the network you want to use
    let url = getFullnodeUrl('mainnet');
    if (URL_OVERRIDE) {
        url = URL_OVERRIDE;
    }
    const suiClient = new SuiClient({ url: url });

    while (true) {
        try {
            const txb = new TransactionBlock();
            // txb.object automaically converts the object ID to receiving transaction arguments if the moveCall expects it
            txb.moveCall({
                target: `${SMART_CONTRACT}::counter::increment`,
                // 0xSomeAddress::example::receive_object expects a receiving argument and has a Move definition that looks like this:
                // public fun receive_object<T: key>(parent_object: &mut ParentObjectType, receiving_object: Receiving<ChildObjectType>) { ... }
                arguments: [txb.object(SHARED_OBJ_ON_CHAIN)],
            });

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
            console.log(`E2E latency for shared obj increment: ${latency} s`);

            const latency_metrics_payload = getPrometheusMetricPushPayload(COIN_TRANSFER_LATENCY_METRIC_NAME, {"chain_name": CHAIN_NAME}, latency);
            pushPrometheusMetricsToVM(latency_metrics_payload);
            pushPrometheusMetricsToVM(getPrometheusMetricPushPayload(COIN_TRANSFER_SUCCESS_METRIC_NAME, {"chain_name": CHAIN_NAME}, 1));
        } catch (error) {
            console.log('Error:', error.message);
            pushPrometheusMetricsToVM(getPrometheusMetricPushPayload(COIN_TRANSFER_SUCCESS_METRIC_NAME, {"chain_name": CHAIN_NAME}, 0));
        }
    
        await sleepAsync(PING_INTERVAL);
    }

};

main();