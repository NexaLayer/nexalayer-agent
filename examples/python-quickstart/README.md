# Python Quick Start

This example shows the minimum Agent flow:

1. Register or use an existing API key
2. List products
3. Create a dynamic session
4. Poll until the session is active
5. Use `proxy.full_url`
6. Report `success` or `http_error`
7. Read health recommendation and billing state

```bash
python3 -m venv .venv
. .venv/bin/activate
pip install requests

export NEXALAYER_BASE_URL=https://api.nexalayer.net/v1
export NEXALAYER_API_KEY=agk_your_key
export NEXALAYER_PRODUCT_NO=out_dynamic_1
python main.py
```

To register a new Agent from the example, set:

```bash
export NEXALAYER_REGISTER=1
export NEXALAYER_AGENT_NAME=quickstart-demo
python main.py
```
