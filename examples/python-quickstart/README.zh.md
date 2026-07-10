# Python 中文 Quick Start

这个示例演示最小 Agent 流程：

1. 使用已有 API Key，或注册一个测试 Agent。
2. 查询 dynamic 产品。
3. 创建 dynamic Session。
4. 轮询到 `active`。
5. 使用 `proxy.full_url` 请求 `https://httpbin.org/ip`。
6. 上报 `success` / `http_error` / `timeout`。
7. 读取 health recommendation 和余额。

## 运行

```bash
cd examples/python-quickstart
python3 -m venv .venv
. .venv/bin/activate
pip install requests

export NEXALAYER_BASE_URL=https://api.nexalayer.net/v1
export NEXALAYER_API_KEY=agk_your_key
export NEXALAYER_PRODUCT_NO=dynamic_ipweb
python main.py
```

没有 API Key 时，可以注册一个测试 Agent：

```bash
export NEXALAYER_REGISTER=1
export NEXALAYER_AGENT_NAME=python-quickstart-demo
python main.py
```

注册响应里必须看到 `backend_ready=true`。如果不是 true，说明后端账号还没有准备好，不能继续创建 Session。

## 关键点

- `X-API-Key` 是 Agent API 的认证方式。
- `Idempotency-Key` 用于创建 Session 时的安全重试。
- `proxy.full_url` 可以直接给 `requests` 的 `proxies` 使用。
- `timeout`、`http_error`、`captcha`、`block` 都应该上报，NexaLayer 会用它们更新健康评分和轮换建议。
