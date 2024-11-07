import axios from 'axios';

const METRICS_TAG = process.env.METRICS_TAG;

// Metrics helper functions
function getMetricPayload(name, labels, value) {
    const labelsStrs = [];

    for (const [k, v] of Object.entries(labels)) {
        if (!v) {
            continue;
        }
        labelsStrs.push(`${k}="${v}"`);
    }

    const allLabelsStr = labelsStrs.join(",");
    return `${name}{${allLabelsStr}} ${value}`;
}

function getMetricsConfig() {
    const metricsConfigs = [];

    // URL and Token
    const firstUrl = process.env.METRICS_URL;
    const firstToken = process.env.METRICS_AUTH_TOKEN;

    if (firstUrl && firstToken) {
        metricsConfigs.push({ url: firstUrl, token: firstToken });
    }

    // Additional URLs and Tokens with index (_2, _3, etc.)
    let index = 2;

    while (true) {
        const url = process.env[`METRICS_URL_${index}`];
        const token = process.env[`METRICS_AUTH_TOKEN_${index}`];

        if (!url || !token) {
            break; // Stop if either the URL or token is missing for the current index
        }

        metricsConfigs.push({ url, token });
        index++;
    }

    return metricsConfigs;
}

async function pushMetrics(payloads) {
    const metricsConfigs = getMetricsConfig();

    if (metricsConfigs.length === 0) {
        console.log("No valid METRICS_URL and METRICS_AUTH_TOKEN pairs! Skipping dump...");
        return;
    }

    for (const { url, token } of metricsConfigs) {
        const headers = {
            "Authorization": `Bearer ${token}`,
            "apikey": `${token}`
        };

        const fullUrl = `${url}/api/v1/import/prometheus/metrics/job/e2elatency-${METRICS_TAG}/`;
        const data = payloads + '\n';
        try {
            await axios.post(fullUrl, data, { headers });
        } catch (error) {
            console.error(`Error pushing metrics to ${fullUrl}: `, error.message);
        }
    }
    return 200;
}

async function sleepAsync(milliseconds) {
    return new Promise(resolve => setTimeout(resolve, milliseconds));
}

export { getMetricPayload, pushMetrics, sleepAsync };
