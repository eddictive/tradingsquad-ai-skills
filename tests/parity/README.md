# Parity Tests (optional)

JS/Python parity tests compare API script output for the same ticker and mode.
They require a valid `.stockbit_token.json` and network access.

Run manually when token is present:

```bash
node skills/institutional-analyst/scripts/institutional-api.js broker BBCA > .data/temp/bbca_broker_js.json
python skills/institutional-analyst/scripts/institutional-api.py broker BBCA > .data/temp/bbca_broker_py.json
```

Automated parity suite is planned for Phase 3 CI integration.