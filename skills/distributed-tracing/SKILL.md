---
name: distributed-tracing
description: "OpenTelemetry instrumentation, Jaeger/Tempo backends, trace analysis, and observability patterns for microservices."
metadata: {"moltbot":{"emoji":"🔭","requires":{"anyBins":["docker","curl"]}}}
---

# Distributed Tracing

Trace requests across microservices with OpenTelemetry.

## Quick Start — Jaeger

```bash
# Run Jaeger all-in-one
docker run -d --name jaeger \
  -p 16686:16686 \
  -p 4317:4317 \
  -p 4318:4318 \
  jaegertracing/jaeger:latest

# UI at http://localhost:16686
```

## OpenTelemetry (Node.js)

```bash
# Install
npm install @opentelemetry/sdk-node @opentelemetry/auto-instrumentations-node @opentelemetry/exporter-trace-otlp-grpc
```

```javascript
// tracing.js — load before app code
const { NodeSDK } = require('@opentelemetry/sdk-node');
const { getNodeAutoInstrumentations } = require('@opentelemetry/auto-instrumentations-node');
const { OTLPTraceExporter } = require('@opentelemetry/exporter-trace-otlp-grpc');

const sdk = new NodeSDK({
  traceExporter: new OTLPTraceExporter({ url: 'http://localhost:4317' }),
  instrumentations: [getNodeAutoInstrumentations()],
  serviceName: 'my-service',
});
sdk.start();
```

```bash
# Run with tracing
node -r ./tracing.js app.js
```

## OpenTelemetry (Python)

```bash
# Install
pip install opentelemetry-sdk opentelemetry-exporter-otlp opentelemetry-instrumentation

# Auto-instrument
opentelemetry-instrument --service_name my-service --exporter_otlp_endpoint http://localhost:4317 python app.py
```

## Query Traces

```bash
# Jaeger API — find traces by service
curl -s "http://localhost:16686/api/traces?service=my-service&limit=10" | jq '.data[] | {traceID, spans: (.spans | length), duration: .spans[0].duration}'

# Find slow traces (>1s)
curl -s "http://localhost:16686/api/traces?service=my-service&minDuration=1000000" | jq '.data | length'

# Traces with errors
curl -s "http://localhost:16686/api/traces?service=my-service&tags=%7B%22error%22%3A%22true%22%7D" | jq '.data | length'
```

## Custom Spans

```javascript
const { trace } = require('@opentelemetry/api');
const tracer = trace.getTracer('my-module');

async function processOrder(orderId) {
  return tracer.startActiveSpan('process-order', async (span) => {
    span.setAttribute('order.id', orderId);
    try {
      const result = await db.getOrder(orderId);
      span.setAttribute('order.total', result.total);
      return result;
    } catch (error) {
      span.recordException(error);
      span.setStatus({ code: 2, message: error.message });
      throw error;
    } finally {
      span.end();
    }
  });
}
```

## What to Look For

- **Long spans** — bottleneck identification
- **Error spans** — where requests fail
- **Fan-out** — one request triggering many downstream calls (N+1 at service level)
- **Missing spans** — services not instrumented
- **Trace gaps** — context not propagated between services

## Notes

- Auto-instrumentation covers HTTP, database, and message queue calls automatically.
- Propagate trace context via headers (`traceparent`) between services.
- Sample in production — tracing every request is expensive. Start with 1-10%.
- Jaeger is good for development. Grafana Tempo is better for production (integrates with Grafana dashboards).
- Traces + metrics + logs = full observability. Correlate them with trace IDs.
