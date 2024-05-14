## Setup

1. Copy the following files into the same directory:
    * `package.json`
    * `index.js`
    * `common.js` from the root of the repo
2. Install dependencies
    * run `npm install`, or use another package manager like `pnpm` or `yarn`
3. Get a private key with some sui for running the transfer test
    * The key should look something like `suiprivkey123abc...`
        * You can export a private key from the sui CLI using `sui keytool export --key-identity your-alias`
    * For testing you can use the sui CLI to create a new keypair with testnet sui:
        1. run `sui client new-address ed25519` to create a new keypair
        2. run `sui client faucet` to request sui
        3. run `sui keytool export --key-identity alias-from-ste-1`  to export the private key in the right format
4. Run `index.ts` with environment variables to run the benchmark
    * To run against testnet run: `ACC1_PRIVATE_KEY=<private-key> URL=https://fullnode.testnet.sui.io:443 node index.js`
    * To run against mainnet remove the URL variable `ACC1_PRIVATE_KEY=<private-key> node index.js`
    * For consistency with other tests, you acn set `ACC2_PRIVATE_KEY` to a second private key.  This shouldn't affect the e2e latency, but ensures the test more accurately reflects the same operation as the benchmarks for other chains.
    * To report the metrics add the appropriate metrics environment variables:
        - `METRICS_URL=<url> METRICS_AUTH_TOKEN=<token> METRICS_TAG=<tag> ACC1_PRIVATE_KEY=<private-key> node index.js`


