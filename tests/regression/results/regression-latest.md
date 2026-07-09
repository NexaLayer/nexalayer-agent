# NL 意图识别回归测试报告

> 2026-03-12T02:00:45.818Z

## 总览

| 指标 | 值 |
|------|----|
| 总测试用例 | 551 |
| 通过 | 550 |
| 失败 | 1 |
| 总准确率 (意图+槽位) | 99.8% |
| 意图准确率 | 99.8% |

## 各意图结果

| 意图 | 描述 | 总数 | 通过 | 失败 | 准确率 |
|------|------|------|------|------|--------|
| ✅ query_balance | 查询余额 | 30 | 30 | 0 | 100.0% |
| ✅ query_ip_inventory | 查询IP库存/地区IP | 35 | 35 | 0 | 100.0% |
| ✅ find_best_ip | 推荐最优质IP | 35 | 35 | 0 | 100.0% |
| ✅ check_ip_quality | 检测IP质量 | 30 | 30 | 0 | 100.0% |
| ✅ purchase_static | 开通静态代理 | 30 | 30 | 0 | 100.0% |
| ✅ purchase_dynamic | 开通动态代理 | 20 | 20 | 0 | 100.0% |
| ✅ purchase_ip | 购买指定IP | 10 | 10 | 0 | 100.0% |
| ✅ extract_dynamic | 提取动态代理链接 | 20 | 20 | 0 | 100.0% |
| ✅ renew_static | 续费静态代理 | 15 | 15 | 0 | 100.0% |
| ❌ query_stats | 查询消费/利润/充值统计 | 23 | 22 | 1 | 95.7% |
| ✅ query_static_orders | 查询静态订单/已购IP | 30 | 30 | 0 | 100.0% |
| ✅ query_dynamic_orders | 查询动态订单 | 15 | 15 | 0 | 100.0% |
| ✅ query_transactions | 查询交易记录 | 26 | 26 | 0 | 100.0% |
| ✅ query_dynamic_resource | 查询动态资源/流量 | 10 | 10 | 0 | 100.0% |
| ✅ query_expiring_ips | 查询即将到期的IP | 15 | 15 | 0 | 100.0% |
| ✅ query_today_orders | 查询今日消费 | 14 | 14 | 0 | 100.0% |
| ✅ query_static_resource | 查询静态代理资源 | 10 | 10 | 0 | 100.0% |
| ✅ create_session | 创建代理会话 | 10 | 10 | 0 | 100.0% |
| ✅ _suite_A_recommend_boundary | [A] 推荐类边界专项 — 质量/价格/性价比/推荐vs购买 | 15 | 15 | 0 | 100.0% |
| ✅ _suite_B_ambiguity_boundary | [B] 歧义类边界专项 — 同一主体不同动词→不同意图 | 25 | 25 | 0 | 100.0% |
| ✅ _suite_C_noisy_input | [C] 噪声类专项 — 错别字/混语/口语/缩写 | 20 | 20 | 0 | 100.0% |
| ✅ _suite_E_fallback_edge | [E] 失败/边界专项 — 应返回帮助/未知/要求补参 | 15 | 15 | 0 | 100.0% |
| ✅ query_users | 查询用户列表 | 15 | 15 | 0 | 100.0% |
| ✅ query_ip_inventory | 20 real-world user inputs for Washington DC/State to validate geo-mapping robustness | 20 | 20 | 0 | 100.0% |
| ✅ query_ip_inventory | Test geoGroup resolution for semantic geography (west coast, east coast, etc.) | 13 | 13 | 0 | 100.0% |
| ✅ query_ip_inventory | Test query-builder features: excludePrefix, quality, combined filters | 6 | 6 | 0 | 100.0% |
| ✅ find_and_evaluate_ips | Real-world compound queries: location + quality evaluation | 6 | 6 | 0 | 100.0% |
| ✅ recommend_best_match | Purpose-driven IP recommendation | 5 | 5 | 0 | 100.0% |
| ✅ refine_search_results | Multi-turn refinement: reject, next batch, filter | 7 | 7 | 0 | 100.0% |
| ✅ query_ip_inventory | 30 high-frequency real-world user inputs covering geo ambiguity, product types, quality, price | 26 | 26 | 0 | 100.0% |
| ✅ _suite_F_compound_detect | 复合句检测 | 15 | 15 | 0 | 100.0% |

## 失败用例详情

### query_stats (查询消费/利润/充值统计)

| 输入 | 期望意图 | 实际意图 | 实际槽位 | 类型 |
|------|---------|---------|----------|------|
| 今天消费了多少 | query_stats | query_today_orders | {} | - |

