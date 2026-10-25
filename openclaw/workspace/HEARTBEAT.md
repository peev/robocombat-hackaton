# Heartbeat checklist

- Run `curl -s http://localhost:3000/api/agent/brief`.
- If the last report is older than 30 minutes, run a regression sweep for one mission and file a short shift report with `"source":"openclaw-heartbeat"`.
- Otherwise reply HEARTBEAT_OK.
