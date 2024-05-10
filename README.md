# E2E Latency Comparison Benchmark
This benchmark measures E2E Latency across several blockchains. The numbers produced by the benchmark represent an end user’s observed latency from submitting a transaction to getting a transaction confirmation back. We compared the latency of coin transfer transactions across multiple blockchain networks in their mainnet environments. Coin transfer is a straightforward and cost-effective transaction type that is widely supported by SDKs.

The benchmark leverages TS SDKs for the respective blockchains. The logic of 'Coin transfer' transaction for a blockchain is present in the corresponding 'index.js' file. Some common helper functions are present in 'common.js'.

To collect metrics we are using a timeseries database that supports the prometheus remote_write protocol: https://prometheus.io/docs/concepts/remote_write_spec/. 

## Prerequisites
* Using a wallet (or client), setup Web3 accounts on the corresponding blockchain(s).
* Add funds necessary for gas fees and the actual p2p transfer.
* You will need the private and public keys of the web3 accounts. Be careful not to expose the private keys of the accounts!
* [Optional] If metrics collection is desired then, a timeseries database that supports prometheus remote_write protocol or something similar will have to be set up.

## Install
* Install Node.js and npm
* Copy index.js, common.js and package.json to a folder
* Install the required dependecies. Some examples are:
    `npm i @aptos-labs/ts-sdk`
    `npm i @solana/web3.js`
    `npm i near-api-js`
    `npm i axios`

## Run an e2e test of the script locally
Pass the env variables and run using node. Some examples are below:
* Aptos: `PING_INTERVAL=900 CHAIN_NAME=mainnet METRICS_URL=<url> METRICS_AUTH_TOKEN=<token> METRICS_TAG=<tag> ACC1_PRIVATE_KEY=<priv_key_sender> ACC2_PRIVATE_KEY=<priv_key_receiver> node index.js`
* Solana: `PING_INTERVAL=900 CHAIN_NAME=mainnet-beta METRICS_URL=<url> METRICS_AUTH_TOKEN=<token> METRICS_TAG=<tag> ACC1_PRIVATE_KEY=<priv_key_sender> ACC2_PRIVATE_KEY=<priv_key_receiver> COMMITMENT_LEVEL=confirmed node index.js`
* ETH_BASED_CHAINS (Optimism): `PING_INTERVAL=900 CHAIN_NAME=mainnet METRICS_URL=<url> METRICS_AUTH_TOKEN=<token> METRICS_TAG=<tag> COIN_TRANSFER_LATENCY_METRIC_NAME=e2e_p2p_txn_latency_optimism ACC1_PRIVATE_KEY=<priv_key_sender> ACC1_ADDR=<public_addr_sender> ACC2_ADDR=<public_addr_receiver> URL=https://mainnet.optimism.io TRANSFER_AMT=<amt> node index.js`
* NEAR: `PING_INTERVAL=900 CHAIN_NAME=mainnet METRICS_URL=<url> METRICS_AUTH_TOKEN=<token> METRICS_TAG=<tag> ACC1_PRIVATE_KEY=<priv_key_sender> ACC1_ID=<public_addr_sender> ACC2_ID=<public_addr_receiver> URL=https://rpc.mainnet.near.org node index.js`

Note: Some env variables are optional, and env variables needed might change based on the script

## Smart Contract
Using the `*.move` and `Move.toml` build and deploy the smart contract on the CLI by following steps in the documentation of the blockchain.

## Benchmark Results

Live E2E Latency Numbers are displayed [here](https://aptoslabs.grafana.net/public-dashboards/f32a07a7ef01456cbb9f79ac975fb00e?orgId=1&refresh=15m).

Below are E2E Latency Numbers snapshotted at 3PM on May 9, 2024:

|Blockchain           |E2E Latency in seconds
|---------------------|----------------------|
|Aptos                |0.95                  |
|Arbitrum             |2.55                  |
|Avalanche-C          |4.21                  |
|Base                 |3.96                  |
|Near                 |4.74                  |
|Optimism             |4.08                  |
|Polygon              |7.06                  |
|Solana (confirmed)   |10.20                 |
|Solana (finalized)   |25.40                 |
|Sui (fast path - 20%)|1.92                  |
|Sui (slow path - 80%)|4.35                  |
