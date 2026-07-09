# Conversation Flow Test Report

**Time:** 2026-03-16T15:58:50.350Z
**Scenarios:** 39
**Steps:** 100
**Passed:** 39
**Failed:** 0
**Pass Rate:** 100.0%

---

# Suite A: 结果集延续
Pass: 7/7

## ✅ A1: 查纽约→最便宜→帮我开通(取消)
undefined | 3900ms

| Step | Intent | Pass | ms | Perf |
|------|--------|------|----|------|
| ✅ A1.1 查询纽约IP | query_ip_inventory | PASS | 2697 | ✓ |
| ✅ A1.2 找最便宜的 | follow_up_recommend | PASS | 339 | ✓ |
| ✅ A1.3 帮我开通(不确认) | follow_up_action | PASS | 863 | ✓ |

## ✅ A2: 查伦敦→下一页→开通第三个
undefined | 715ms

| Step | Intent | Pass | ms | Perf |
|------|--------|------|----|------|
| ✅ A2.1 查询伦敦IP | query_ip_inventory | PASS | 340 | ✓ |
| ✅ A2.2 下一页 | paginate_next | PASS | 257 | ✓ |
| ✅ A2.3 开通第三个 | follow_up_action | PASS | 117 | ✓ |

## ✅ A3: 查东京→第一个→不对换第二个
undefined | 834ms

| Step | Intent | Pass | ms | Perf |
|------|--------|------|----|------|
| ✅ A3.1 查询东京IP | query_ip_inventory | PASS | 475 | ✓ |
| ✅ A3.2 选第一个 | follow_up_select | PASS | 101 | ✓ |
| ✅ A3.3 换第二个 | follow_up_select | PASS | 258 | ✓ |

## ✅ A4: 查美国→库存最多的→帮我开通
undefined | 1097ms

| Step | Intent | Pass | ms | Perf |
|------|--------|------|----|------|
| ✅ A4.1 查美国IP | query_ip_inventory | PASS | 324 | ✓ |
| ✅ A4.2 库存最多的 | follow_up_refine | PASS | 676 | ✓ |
| ✅ A4.3 帮我开通 | follow_up_action | PASS | 96 | ✓ |

## ✅ A5: 查纽约→找质量最好→太贵换便宜的
undefined | 1245ms

| Step | Intent | Pass | ms | Perf |
|------|--------|------|----|------|
| ✅ A5.1 查纽约IP | query_ip_inventory | PASS | 518 | ✓ |
| ✅ A5.2 找质量最好的 | find_best_ip | PASS | 459 | ✓ |
| ✅ A5.3 太贵换便宜的 | follow_up_refine | PASS | 268 | ✓ |

## ✅ A6: 查日本→最便宜那个
undefined | 570ms

| Step | Intent | Pass | ms | Perf |
|------|--------|------|----|------|
| ✅ A6.1 查日本IP | query_ip_inventory | PASS | 320 | ✓ |
| ✅ A6.2 最便宜那个 | follow_up_recommend | PASS | 250 | ✓ |

## ✅ A7: 查纽约→帮选3个→开通第一个
undefined | 698ms

| Step | Intent | Pass | ms | Perf |
|------|--------|------|----|------|
| ✅ A7.1 查纽约IP | query_ip_inventory | PASS | 300 | ✓ |
| ✅ A7.2 帮选3个 | follow_up_select | PASS | 270 | ✓ |
| ✅ A7.3 开通第一个 | follow_up_action | PASS | 128 | ✓ |

---

# Suite B: 确认状态机
Pass: 4/4

## ✅ B1: 开通第一个→取消→开第二个
undefined | 925ms

| Step | Intent | Pass | ms | Perf |
|------|--------|------|----|------|
| ✅ B1.1 查纽约IP | query_ip_inventory | PASS | 469 | ✓ |
| ✅ B1.2 开通第一个 | follow_up_action | PASS | 85 | ✓ |
| ✅ B1.3 取消(状态机拦截) | cancel_confirmed | PASS | 250 | ✓ |
| ✅ B1.4 开第二个 | follow_up_action | PASS | 121 | ✓ |

## ✅ B2: 确认态中插话查余额
undefined | 1045ms

| Step | Intent | Pass | ms | Perf |
|------|--------|------|----|------|
| ✅ B2.1 查美国IP | query_ip_inventory | PASS | 529 | ✓ |
| ✅ B2.2 开通第一个 | follow_up_action | PASS | 98 | ✓ |
| ✅ B2.3 插话查余额 | query_balance | PASS | 302 | ✓ |
| ✅ B2.4 取消 | cancel_confirmed | PASS | 116 | ✓ |

## ✅ B3: 查询→开通→取消→再查便宜的
undefined | 2182ms

| Step | Intent | Pass | ms | Perf |
|------|--------|------|----|------|
| ✅ B3.1 查东京IP | query_ip_inventory | PASS | 465 | ✓ |
| ✅ B3.2 找质量最好的 | find_best_ip | PASS | 510 | ✓ |
| ✅ B3.3 帮我开通 | follow_up_action | PASS | 261 | ✓ |
| ✅ B3.4 取消 | cancel_confirmed | PASS | 119 | ✓ |
| ✅ B3.5 查便宜的 | follow_up_refine | PASS | 827 | ✓ |

## ✅ B4: 确认消息格式校验
undefined | 583ms

| Step | Intent | Pass | ms | Perf |
|------|--------|------|----|------|
| ✅ B4.1 查纽约IP | query_ip_inventory | PASS | 333 | ✓ |
| ✅ B4.2 开通第一个 | follow_up_action | PASS | 249 | ✓ |

---

# Suite C: 错误恢复
Pass: 7/7

## ✅ C1: 查无结果地区→换有结果地区
undefined | 1654ms

| Step | Intent | Pass | ms | Perf |
|------|--------|------|----|------|
| ✅ C1.1 查冷门地区 | query_ip_inventory | PASS | 664 | ✓ |
| ✅ C1.2 换纽约 | query_ip_inventory | PASS | 989 | ✓ |

## ✅ C2: 无上下文直接开通
undefined | 101ms

| Step | Intent | Pass | ms | Perf |
|------|--------|------|----|------|
| ✅ C2.1 直接开通(无上下文) | purchase_static | PASS | 101 | ✓ |

## ✅ C3: 无上下文模糊命令
undefined | 341ms

| Step | Intent | Pass | ms | Perf |
|------|--------|------|----|------|
| ✅ C3.1 模糊命令 | find_best_ip | PASS | 341 | ✓ |

## ✅ C4: 序号超出范围
undefined | 595ms

| Step | Intent | Pass | ms | Perf |
|------|--------|------|----|------|
| ✅ C4.1 查日本IP | query_ip_inventory | PASS | 306 | ✓ |
| ✅ C4.2 开通第999个 | follow_up_action | PASS | 289 | ✓ |

## ✅ C5: 管理员可查用户
undefined | 363ms

| Step | Intent | Pass | ms | Perf |
|------|--------|------|----|------|
| ✅ C5.1 查询用户 | query_users | PASS | 363 | ✓ |

## ✅ C6: 查余额→查IP(跨意图)
undefined | 687ms

| Step | Intent | Pass | ms | Perf |
|------|--------|------|----|------|
| ✅ C6.1 查余额 | query_balance | PASS | 336 | ✓ |
| ✅ C6.2 查纽约IP | query_ip_inventory | PASS | 351 | ✓ |

## ✅ C7: 找最好→换便宜→开通(不确认)
undefined | 6528ms

| Step | Intent | Pass | ms | Perf |
|------|--------|------|----|------|
| ✅ C7.1 查美国IP | query_ip_inventory | PASS | 847 | ✓ |
| ✅ C7.2 找最好的 | find_best_ip | PASS | 4368 | ✓ |
| ✅ C7.3 换便宜的 | follow_up_refine | PASS | 1209 | ✓ |
| ✅ C7.4 帮我开通(不确认) | follow_up_action | PASS | 104 | ✓ |

---

# Suite D: 语言与别名
Pass: 8/8

## ✅ D1: London→切到东京(英→中)
undefined | 729ms

| Step | Intent | Pass | ms | Perf |
|------|--------|------|----|------|
| ✅ D1.1 查London IP | query_ip_inventory | PASS | 471 | ✓ |
| ✅ D1.2 切到东京 | query_ip_inventory | PASS | 257 | ✓ |

## ✅ D2: 英文全链路 NY→best→purchase
undefined | 5383ms

| Step | Intent | Pass | ms | Perf |
|------|--------|------|----|------|
| ✅ D2.1 Query NY IPs | query_ip_inventory | PASS | 508 | ✓ |
| ✅ D2.2 find the best one | find_best_ip | PASS | 4598 | ✓ |
| ✅ D2.3 purchase it | follow_up_action | PASS | 276 | ✓ |

## ✅ D3: 中英混合查询
undefined | 504ms

| Step | Intent | Pass | ms | Perf |
|------|--------|------|----|------|
| ✅ D3.1 查London的IP | query_ip_inventory | PASS | 351 | ✓ |
| ✅ D3.2 show最便宜的 | follow_up_refine | PASS | 153 | ✓ |

## ✅ D4: Seoul别名解析
undefined | 347ms

| Step | Intent | Pass | ms | Perf |
|------|--------|------|----|------|
| ✅ D4.1 查Seoul IP | query_ip_inventory | PASS | 347 | ✓ |

## ✅ D5: LA别名
undefined | 317ms

| Step | Intent | Pass | ms | Perf |
|------|--------|------|----|------|
| ✅ D5.1 查LA IP | query_ip_inventory | PASS | 317 | ✓ |

## ✅ D6: 地区无原始编码
undefined | 358ms

| Step | Intent | Pass | ms | Perf |
|------|--------|------|----|------|
| ✅ D6.1 查伦敦IP | query_ip_inventory | PASS | 358 | ✓ |

## ✅ D7: 英文follow-up上下文
undefined | 4649ms

| Step | Intent | Pass | ms | Perf |
|------|--------|------|----|------|
| ✅ D7.1 Query Tokyo IPs | query_ip_inventory | PASS | 316 | ✓ |
| ✅ D7.2 which has most stock | query_static_products | PASS | 4333 | ✓ |

## ✅ D8: Australia互通
undefined | 978ms

| Step | Intent | Pass | ms | Perf |
|------|--------|------|----|------|
| ✅ D8.1 Australia IP | query_ip_inventory | PASS | 978 | ✓ |

---

# Suite ISO: 会话隔离
Pass: 2/2

## ✅ ISO1: 新会话不继承旧上下文
undefined | 10540ms

| Step | Intent | Pass | ms | Perf |
|------|--------|------|----|------|
| ✅ ISO1.1 旧会话查纽约 | query_ip_inventory | PASS | 314 | ✓ |
| ✅ ISO1.2 新会话-帮我开通 | unknown | PASS | 10225 | ✓ |

## ✅ ISO2: 切主题后上下文更新
undefined | 24269ms

| Step | Intent | Pass | ms | Perf |
|------|--------|------|----|------|
| ✅ ISO2.1 查纽约IP | query_ip_inventory | PASS | 10720 | ✓ |
| ✅ ISO2.2 查伦敦IP(换主题) | query_ip_inventory | PASS | 12777 | ✓ |
| ✅ ISO2.3 开通第一个(应指向伦敦) | follow_up_action | PASS | 772 | ✓ |

---

# Suite DIS: 指代消歧
Pass: 3/3

## ✅ DIS1: 顺序词—质量第二好的
undefined | 2315ms

| Step | Intent | Pass | ms | Perf |
|------|--------|------|----|------|
| ✅ DIS1.1 查纽约IP | query_ip_inventory | PASS | 766 | ✓ |
| ✅ DIS1.2 找质量最好的 | find_best_ip | PASS | 1122 | ✓ |
| ✅ DIS1.3 第二个 | follow_up_select | PASS | 426 | ✓ |

## ✅ DIS2: "这个"指代
undefined | 836ms

| Step | Intent | Pass | ms | Perf |
|------|--------|------|----|------|
| ✅ DIS2.1 查日本IP | query_ip_inventory | PASS | 558 | ✓ |
| ✅ DIS2.2 帮我开通这个 | follow_up_action | PASS | 278 | ✓ |

## ✅ DIS3: "查最近开通"识别为查询
undefined | 3746ms

| Step | Intent | Pass | ms | Perf |
|------|--------|------|----|------|
| ✅ DIS3.1 查最近开通的IP | query_static_orders | PASS | 3746 | ✓ |

---

# Suite NEG: 否定语义
Pass: 4/4

## ✅ NEG1: 否定+纠正"不是这个,要那个"
undefined | 1936ms

| Step | Intent | Pass | ms | Perf |
|------|--------|------|----|------|
| ✅ NEG1.1 查纽约IP | query_ip_inventory | PASS | 1442 | ✓ |
| ✅ NEG1.2 选第一个 | follow_up_select | PASS | 256 | ✓ |
| ✅ NEG1.3 不是这个换第三个 | follow_up_select | PASS | 237 | ✓ |

## ✅ NEG2: "先别买,发给我看看"
undefined | 2243ms

| Step | Intent | Pass | ms | Perf |
|------|--------|------|----|------|
| ✅ NEG2.1 查东京IP | query_ip_inventory | PASS | 1739 | ✓ |
| ✅ NEG2.2 帮我开通 | follow_up_action | PASS | 267 | ✓ |
| ✅ NEG2.3 先别买 | cancel_confirmed | PASS | 237 | ✓ |

## ✅ NEG3: 查询→开通→取消→换个便宜的→开通
undefined | 1390ms

| Step | Intent | Pass | ms | Perf |
|------|--------|------|----|------|
| ✅ NEG3.1 查纽约IP | query_ip_inventory | PASS | 419 | ✓ |
| ✅ NEG3.2 帮我开通 | follow_up_action | PASS | 233 | ✓ |
| ✅ NEG3.3 取消 | cancel_confirmed | PASS | 236 | ✓ |
| ✅ NEG3.4 换便宜的 | follow_up_refine | PASS | 264 | ✓ |
| ✅ NEG3.5 再开通 | follow_up_action | PASS | 237 | ✓ |

## ✅ NEG4: "还是上一个吧"回指
undefined | 1478ms

| Step | Intent | Pass | ms | Perf |
|------|--------|------|----|------|
| ✅ NEG4.1 查日本IP | query_ip_inventory | PASS | 740 | ✓ |
| ✅ NEG4.2 选第一个 | follow_up_select | PASS | 264 | ✓ |
| ✅ NEG4.3 换第二个 | follow_up_select | PASS | 232 | ✓ |
| ✅ NEG4.4 还是第一个吧 | follow_up_select | PASS | 242 | ✓ |

---

# Suite CROSS: 跨模块链路
Pass: 4/4

## ✅ CROSS1: 查余额→查消费→查IP
undefined | 5776ms

| Step | Intent | Pass | ms | Perf |
|------|--------|------|----|------|
| ✅ CROSS1.1 查余额 | query_balance | PASS | 271 | ✓ |
| ✅ CROSS1.2 查消费统计 | query_stats | PASS | 4219 | ✓ |
| ✅ CROSS1.3 查纽约IP | query_ip_inventory | PASS | 1286 | ✓ |

## ✅ CROSS2: 查最近订单→查最近开通
undefined | 6845ms

| Step | Intent | Pass | ms | Perf |
|------|--------|------|----|------|
| ✅ CROSS2.1 查最近订单 | query_static_orders | PASS | 3054 | ✓ |
| ✅ CROSS2.2 查最近开通的IP | query_static_orders | PASS | 3791 | ✓ |

## ✅ CROSS3: 查IP→查质量→查余额→开通
undefined | 6646ms

| Step | Intent | Pass | ms | Perf |
|------|--------|------|----|------|
| ✅ CROSS3.1 查纽约IP | query_ip_inventory | PASS | 511 | ✓ |
| ✅ CROSS3.2 找最好的 | find_best_ip | PASS | 4915 | ✓ |
| ✅ CROSS3.3 查余额 | query_balance | PASS | 922 | ✓ |
| ✅ CROSS3.4 帮我开通 | follow_up_action | PASS | 298 | ✓ |

## ✅ CROSS4: 帮助→查库存→开通→取消
undefined | 1949ms

| Step | Intent | Pass | ms | Perf |
|------|--------|------|----|------|
| ✅ CROSS4.1 帮助 | show_help | PASS | 274 | ✓ |
| ✅ CROSS4.2 查纽约IP | query_ip_inventory | PASS | 1166 | ✓ |
| ✅ CROSS4.3 开通第一个 | follow_up_action | PASS | 259 | ✓ |
| ✅ CROSS4.4 取消 | cancel_confirmed | PASS | 249 | ✓ |

---

# Performance SLA

| Metric | SLA |
|--------|-----|
| Cancel/Confirm | < 3000ms |
| Follow-up | < 5000ms |
| Query | < 15000ms |
| Quality Check | < 30000ms |
