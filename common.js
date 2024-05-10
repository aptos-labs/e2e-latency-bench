import axios from 'axios';

const METRICS_URL = process.env.METRICS_URL;
const METRICS_AUTH_TOKEN = process.env.METRICS_AUTH_TOKEN;
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
  
  async function pushMetrics(payloads) {
    if (!METRICS_URL) {
        console.log("No METRICS_URL specified! Skipping dump...");
        return;
    }
  
    const headers = {
        "Authorization": `Bearer ${METRICS_AUTH_TOKEN}`,
    };
  
    const url = `${METRICS_URL}/api/v1/import/prometheus/metrics/job/e2elatency-${METRICS_TAG}/`;
    const data = payloads + '\n';
  
    try {
        const response = await axios.post(url, data, { headers });
        return response.status;
    } catch (error) {
        console.error("Error pushing metrics ", error.message);
        return 500;  // Return a default status code in case of an error
    }
  }
  
  async function sleepAsync(milliseconds) {
    return new Promise(resolve => setTimeout(resolve, milliseconds));
  }

  export { getMetricPayload, pushMetrics, sleepAsync }