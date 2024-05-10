import { clusterApiUrl, Connection, Keypair, Transaction, sendAndConfirmTransaction, SystemProgram } from '@solana/web3.js';
import base58 from 'bs58';
import { getMetricPayload, pushMetrics, sleepAsync } from './common.js';

const COIN_TRANSFER_LATENCY_METRIC_NAME = "e2e_p2p_txn_latency_solana";
const COIN_TRANSFER_SUCCESS_METRIC_NAME = COIN_TRANSFER_LATENCY_METRIC_NAME + "_success";
const CHAIN_NAME = process.env.CHAIN_NAME;
const PING_INTERVAL = process.env.PING_INTERVAL * 1000;
const SENDER_PRIVATE_KEY = process.env.ACC1_PRIVATE_KEY;
const RECIEVER_PRIVATE_KEY = process.env.ACC2_PRIVATE_KEY;
const COMMITMENT_LEVEL = process.env.COMMITMENT_LEVEL;
const URL_OVERRIDE = process.env.URL;

function getKeyPairFromBase58PrivateKey(base58PrivateKey) {
    const privateKeyBytes = base58.decode(base58PrivateKey);
    return Keypair.fromSecretKey(privateKeyBytes);
}

const main = async () => {
    let sender_keypair = getKeyPairFromBase58PrivateKey(SENDER_PRIVATE_KEY);
    let receiver_keypair = getKeyPairFromBase58PrivateKey(RECIEVER_PRIVATE_KEY);
    let transaction = new Transaction().add(
        SystemProgram.transfer({
            fromPubkey: sender_keypair.publicKey,
            toPubkey: receiver_keypair.publicKey,
            lamports: 1,
        }),
    );

    // Specify the confirmation strategy
    const confirmOptions = {
        commitment: COMMITMENT_LEVEL,
        skipPreflight: true,
    };

    // https://api.mainnet-beta.solana.com/
    // https://solana-mainnet.phantom.app/YBPpkkN4g91xDiAnTE9r0RcMkjg0sKUIWvAfoFVJ
    let URL = clusterApiUrl(CHAIN_NAME);
    if (URL_OVERRIDE) {
        URL = URL_OVERRIDE;
    }
    console.log(`Using URL: ${URL}`);
    let connection = new Connection(URL);

    while (true) {
        try {
            const startTime = performance.now();

            await sendAndConfirmTransaction(connection, transaction, [sender_keypair], confirmOptions);

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