import Web3 from 'web3';
import { TransactionNotFound } from 'web3-errors';
import { getPrometheusMetricPushPayload, pushPrometheusMetricsToVM, sleepAsync } from './common.js';

let GAS_UNITS = 500000;
if (process.env.GAS_UNITS) {
    GAS_UNITS = parseInt(process.env.GAS_UNITS);
}
const COIN_TRANSFER_LATENCY_METRIC_NAME = process.env.COIN_TRANSFER_LATENCY_METRIC_NAME;
const COIN_TRANSFER_SUCCESS_METRIC_NAME = COIN_TRANSFER_LATENCY_METRIC_NAME + "_success";
const CHAIN_NAME = process.env.CHAIN_NAME;
const PING_INTERVAL = process.env.PING_INTERVAL * 1000;
const SENDER_PRIVATE_KEY = process.env.ACC1_PRIVATE_KEY;
const SENDER_ADDR = process.env.ACC1_ADDR;
const RECIEVER_ADDR = process.env.ACC2_ADDR;
const URL = process.env.URL;
const TRANSFER_AMT = process.env.TRANSFER_AMT; // '1'

async function checkTransactionConfirmationWithTimeout(web3, txHash, timeout = 120000) { // Timeout in milliseconds (default 120 seconds)
    let startTime = Date.now();
  
    while (Date.now() - startTime < timeout) {
        try {
            const receipt = await web3.eth.getTransactionReceipt(txHash);
            if (receipt) {
                if (receipt.blockNumber !== null) {
                    return; // Exit the loop on confirmation
                } else {
                    console.log('Transaction pending...');
                }
            }
        } catch (error) {
            if (error instanceof TransactionNotFound) {
                console.log('Transaction not found. Waiting for block confirmation...');
            } else {
                console.log('Error checking transaction confirmation:', error.message);
                throw error; // Rethrow unexpected error
            }
        }
        await new Promise(resolve => setTimeout(resolve, 100)); // Wait 100ms between checks
    }
    throw new Error('Transaction confirmation timed out after ' + timeout / 1000 + ' seconds');
}

async function getRecommendedGasPrice(web3) {
    const currentGasPrice = await web3.eth.getGasPrice();
    const safeGasPrice =  Math.floor(Number(currentGasPrice) * 1.1); // 10% higher and rounded down to the nearest whole number (in Wei)
    return safeGasPrice.toString();
}

const main = async () => {
    console.log(`Starting the E2E latency job ....`);
    // Create a Web3 instance
    const web3 = new Web3(new Web3.providers.HttpProvider(URL));

    while (true) {
        try {
            // Get gas price (optional, estimate gas price before sending)
            let gasPrice = await getRecommendedGasPrice(web3);

            let nonce = await web3.eth.getTransactionCount(SENDER_ADDR);
            // Build the transaction object
            const txData = {
                from: SENDER_ADDR,
                to: RECIEVER_ADDR,
                // (use default GAS_UNITS) gas: GAS_UNITS,
                gasPrice,
                value: TRANSFER_AMT,
                nonce,
            };

            const startTime = performance.now();
            // Sign the transaction with your private key
            const signedTx = await web3.eth.accounts.signTransaction(txData, SENDER_PRIVATE_KEY);

            const txHash = await web3.eth.sendSignedTransaction(signedTx.rawTransaction);

            // Wait for transaction
            checkTransactionConfirmationWithTimeout(web3, txHash.transactionHash);
        
            const endTime = performance.now();

            const latency = (endTime - startTime) / 1000;
            console.log(`E2E latency for p2p transfer: ${latency} s`);

            const latency_metrics_payload = getPrometheusMetricPushPayload(COIN_TRANSFER_LATENCY_METRIC_NAME, {"chain_name": CHAIN_NAME}, latency);
            pushPrometheusMetricsToVM(latency_metrics_payload);

            pushPrometheusMetricsToVM(getPrometheusMetricPushPayload(COIN_TRANSFER_SUCCESS_METRIC_NAME, {"chain_name": CHAIN_NAME}, 1));
        } catch (error) {
            console.log('Error:', error.message);
            pushPrometheusMetricsToVM(getPrometheusMetricPushPayload(COIN_TRANSFER_SUCCESS_METRIC_NAME, {"chain_name": CHAIN_NAME}, 0));
        }
        await sleepAsync(PING_INTERVAL);
    }
}

main();