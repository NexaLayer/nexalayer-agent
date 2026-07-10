import os
import time
import uuid

import requests


BASE_URL = os.getenv(
    "NEXALAYER_BASE_URL", "https://api.nexalayer.net/v1"
)
PRODUCT_NO = os.getenv("NEXALAYER_PRODUCT_NO")


def register_agent() -> str:
    name = os.getenv(
        "NEXALAYER_AGENT_NAME",
        f"quickstart-{uuid.uuid4().hex[:8]}",
    )
    res = requests.post(
        f"{BASE_URL}/account/register",
        json={"name": name},
        timeout=30,
    )
    res.raise_for_status()
    data = res.json()["data"]
    print("api_key:", data["api_key"])
    print("backend_ready:", data.get("backend_ready"))
    if not data.get("backend_ready"):
        raise RuntimeError(
            "Agent registered but backend is not ready: "
            f"{data.get('backend_sync_error')}"
        )
    return data["api_key"]


def request(api_key: str, method: str, path: str, **kwargs):
    headers = kwargs.pop("headers", {})
    headers["X-API-Key"] = api_key
    res = requests.request(
        method,
        f"{BASE_URL}{path}",
        headers=headers,
        timeout=kwargs.pop("timeout", 30),
        **kwargs,
    )
    res.raise_for_status()
    return res.json()["data"]


def wait_for_active(api_key: str, session_id: str):
    for _ in range(30):
        session = request(api_key, "GET", f"/sessions/{session_id}")
        if session["status"] == "active":
            return session
        if session["status"] == "error":
            raise RuntimeError(f"Session failed: {session}")
        time.sleep(2)
    raise TimeoutError("Session did not become active within 60s")


def pick_dynamic_product(api_key: str) -> str:
    if PRODUCT_NO:
        return PRODUCT_NO

    products = request(api_key, "GET", "/products?type=dynamic")
    print("dynamic_products:", products["total"])
    items = sorted(
        [p for p in products.get("items", []) if p.get("product_no")],
        key=lambda p: float(p.get("price") or 0),
    )
    if not items:
        raise RuntimeError("No dynamic product available")
    product_no = items[0]["product_no"]
    print("selected_product:", product_no)
    return product_no


def main():
    api_key = os.getenv("NEXALAYER_API_KEY")
    if not api_key and os.getenv("NEXALAYER_REGISTER") == "1":
        api_key = register_agent()
    if not api_key:
        raise RuntimeError(
            "Set NEXALAYER_API_KEY or NEXALAYER_REGISTER=1"
        )

    product_no = pick_dynamic_product(api_key)
    session_id = None
    event_type = "success"
    status_code = 200

    try:
        created = request(
            api_key,
            "POST",
            "/sessions",
            headers={"Idempotency-Key": f"create-{uuid.uuid4()}"},
            json={
                "session_type": "dynamic",
                "product_no": product_no,
                "quantity": 1,
                "protocol": "socks5",
                "rotation_mode": "on_demand",
            },
        )
        session_id = created["session_id"]
        print("session_id:", session_id)

        session = wait_for_active(api_key, session_id)
        proxy_url = session.get("proxy", {}).get("full_url")
        if not proxy_url:
            raise RuntimeError(
                f"Active session has no proxy.full_url: {session}"
            )

        try:
            res = requests.get(
                "https://httpbin.org/ip",
                proxies={"http": proxy_url, "https": proxy_url},
                timeout=30,
            )
            event_type = "success" if res.ok else "http_error"
            status_code = res.status_code
            print("httpbin:", res.text[:120])
        except requests.Timeout:
            event_type = "timeout"
            status_code = 0
        except requests.RequestException as exc:
            event_type = "http_error"
            status_code = 0
            print("request_error:", exc)

        request(
            api_key,
            "POST",
            f"/sessions/{session_id}/report-event",
            json={
                "event_type": event_type,
                "status_code": status_code,
                "target_host": "httpbin.org",
            },
        )

        health = request(api_key, "GET", f"/sessions/{session_id}/health")
        print("recommendation:", health["recommendation"])

        balance = request(api_key, "GET", "/billing/balance")
        print("balance:", balance)
    finally:
        if session_id:
            try:
                request(api_key, "DELETE", f"/sessions/{session_id}")
                print("terminated:", session_id)
            except requests.RequestException as exc:
                print("terminate_failed:", exc)


if __name__ == "__main__":
    main()
