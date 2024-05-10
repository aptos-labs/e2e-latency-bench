import nearAPI from "near-api-js";
import { getMetricPayload, pushMetrics, sleepAsync } from './common.js';
const { connect, KeyPair, keyStores } = nearAPI;

// Documentation: https://docs.near.org/tools/near-api-js/wallet

const COIN_TRANSFER_LATENCY_METRIC_NAME = "e2e_p2p_txn_latency_near";
const COIN_TRANSFER_SUCCESS_METRIC_NAME = COIN_TRANSFER_LATENCY_METRIC_NAME + "_success";
const CHAIN_NAME = process.env.CHAIN_NAME;
const PING_INTERVAL = process.env.PING_INTERVAL * 1000;
const SENDER_PRIVATE_KEY = process.env.ACC1_PRIVATE_KEY;
const SENDER_ID = process.env.ACC1_ID;
const RECIEVER_ID = process.env.ACC2_ID;
const URL = process.env.URL;


const amount = '1'; // smallest unit in NEAR is yoctoNEAR (10 ^ -24))

const main = async () => {
    console.log(`Starting the E2E latency job`);
    const myKeyStore = new keyStores.InMemoryKeyStore();
    const senderKeyPair = KeyPair.fromString(SENDER_PRIVATE_KEY);

    myKeyStore.setKey(CHAIN_NAME, SENDER_ID, senderKeyPair);

    const connectionConfig = {
        networkId: "mainnet",
        keyStore: myKeyStore,
        nodeUrl: URL,
    };
    const nearConnection = await connect(connectionConfig);

    while (true) {
        try {
            const startTime = performance.now();

            const account = await nearConnection.account(SENDER_ID);
            await account.sendMoney(RECIEVER_ID, amount);

            const endTime = performance.now();
            const latency = (endTime - startTime) / 1000;
            console.log(`E2E latency for p2p transfer: ${latency} s`);

            const latency_metrics_payload = getMetricPayload(COIN_TRANSFER_LATENCY_METRIC_NAME, {"chain_name": CHAIN_NAME}, latency);
            pushMetrics(latency_metrics_payload);

            pushMetrics(getMetricPayload(COIN_TRANSFER_SUCCESS_METRIC_NAME, {"chain_name": CHAIN_NAME}, 1));
        } catch (error) {
            console.log('Error:', error.message);
            pushMetrics(getMetricPayload(COIN_TRANSFER_SUCCESS_METRIC_NAME, {"chain_name": CHAIN_NAME}, 0));
        }
        await sleepAsync(PING_INTERVAL);
    }
}

main();