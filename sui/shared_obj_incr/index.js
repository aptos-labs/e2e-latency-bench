import { getFullnodeUrl, SuiClient } from '@mysten/sui.js/client';
import { TransactionBlock } from '@mysten/sui.js/transactions';
import { Ed25519Keypair } from '@mysten/sui.js/keypairs/ed25519';
import { decodeSuiPrivateKey } from '@mysten/sui.js/cryptography';
import { getMetricPayload, pushMetrics, sleepAsync } from './common.js';

const SHARED_OBJ_INCR_LATENCY_METRIC_NAME = "e2e_shared_obj_incr_txn_latency_sui";
const SHARED_OBJ_INCR_BUILD_LATENCY_METRIC_NAME = "e2e_shared_obj_incr_txn_latency_build_sui";
const SHARED_OBJ_INCR_SUCCESS_METRIC_NAME = SHARED_OBJ_INCR_LATENCY_METRIC_NAME + "_success";
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
    const gasPrice = await suiClient.getReferenceGasPrice()
    const sharedObject = await suiClient.getObject({
        id: SHARED_OBJ_ON_CHAIN,
        options: {
            showOwner: true
        }
    })

    while (true) {
        try {
            const txb = new TransactionBlock();
            txb.setSender(sender_keypair.toSuiAddress());
            txb.setGasPrice(gasPrice);

            txb.setGasBudget(5_000_000)

            // txb.object automatically converts the object ID to receiving transaction arguments if the moveCall expects it
            txb.moveCall({
                target: `${SMART_CONTRACT}::counter::increment`,
                // 0xSomeAddress::example::receive_object expects a receiving argument and has a Move definition that looks like this:
                // public fun receive_object<T: key>(parent_object: &mut ParentObjectType, receiving_object: Receiving<ChildObjectType>) { ... }
                arguments: [txb.sharedObjectRef({
                    objectId: sharedObject.data.objectId,
                    initialSharedVersion: sharedObject.data.owner.Shared.initial_shared_version,
                    mutable: true
                })],
            });

            const buildStartTime = performance.now();
            const bytes = await txb.build({ client: suiClient, limits: {} });

            const startTime = performance.now();
            await suiClient.signAndExecuteTransactionBlock({signer: sender_keypair, transactionBlock: bytes, options: {
                showEffects: true,
            } });

            const endTime = performance.now();

            const buildLatency = (startTime - buildStartTime) / 1000;
            const latency = (endTime - startTime) / 1000;
            console.log(`Build latency for shared obj increment: ${buildLatency} s; E2E latency for shared obj increment: ${latency} s`);

            pushMetrics(getMetricPayload(SHARED_OBJ_INCR_LATENCY_METRIC_NAME, {"chain_name": CHAIN_NAME}, latency));
            pushMetrics(getMetricPayload(SHARED_OBJ_INCR_SUCCESS_METRIC_NAME, {"chain_name": CHAIN_NAME}, 1));
            pushMetrics(getMetricPayload(SHARED_OBJ_INCR_BUILD_LATENCY_METRIC_NAME, {"chain_name": CHAIN_NAME}, buildLatency));
        } catch (error) {
            console.log('Error:', error.message);
            pushMetrics(getMetricPayload(SHARED_OBJ_INCR_SUCCESS_METRIC_NAME, {"chain_name": CHAIN_NAME}, 0));
        }

        await sleepAsync(PING_INTERVAL);
    }

};

main();
