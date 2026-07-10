# NexaLayer 中文文档

NexaLayer 是面向 AI Agent、Playwright、Puppeteer、Browser-use、爬虫和自动化脚本的网络执行层。它不是普通代理 IP 网站，也不是指纹浏览器，而是把动态/静态代理资源封装成可创建、可查询、可轮换、可观测、可恢复的 Session。

传统代理解决“从哪里访问”。
指纹浏览器解决“看起来像谁”。
NexaLayer 解决“这次会话如何持续可用”。

## 推荐阅读顺序

1. [中文 Quick Start](./quick-start.md)
2. [Playwright 中文 Demo](./playwright-demo.md)

## 最小产品闭环

当前已验证的核心链路：

```text
注册 Agent
  -> 获取 API Key
  -> 查询产品
  -> 创建 Session
  -> 获取 proxy.full_url
  -> 浏览器自动化任务使用代理
  -> 上报 success / http_error / timeout / captcha / block
  -> 查询 health recommendation
  -> 查询余额 / 交易
  -> terminate / release / cleanup
```

## 基础地址

```text
https://api.nexalayer.net/v1
```

所有 Agent API 默认使用 `X-API-Key`：

```bash
curl "https://api.nexalayer.net/v1/account/info" \
  -H "X-API-Key: agk_your_key"
```
