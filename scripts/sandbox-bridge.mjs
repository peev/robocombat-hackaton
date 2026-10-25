#!/usr/bin/env node
// Expose the lab API to the NemoClaw/OpenShell sandbox only: listen on the Docker
// bridge address (host.openshell.internal) and relay to the app on loopback.
// The sandbox's network policy further restricts traffic to /api/agent/** via curl.
import net from "node:net";

const LISTEN_HOST = process.env.BRIDGE_HOST ?? "172.18.0.1";
const PORT = Number(process.env.BRIDGE_PORT ?? 3000);
const TARGET_PORT = Number(process.env.APP_PORT ?? 3000);

net
  .createServer((client) => {
    const upstream = net.connect(TARGET_PORT, "127.0.0.1");
    client.pipe(upstream).pipe(client);
    const close = () => {
      client.destroy();
      upstream.destroy();
    };
    client.on("error", close);
    upstream.on("error", close);
  })
  .listen(PORT, LISTEN_HOST, () => console.log(`sandbox bridge ${LISTEN_HOST}:${PORT} -> 127.0.0.1:${TARGET_PORT}`));
