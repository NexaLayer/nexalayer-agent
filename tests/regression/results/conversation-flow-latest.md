# Conversation Flow Test Report

**Time:** 2026-03-17T15:47:05.989Z
**Scenarios:** 39
**Steps:** 100
**Passed:** 39
**Failed:** 0
**Pass Rate:** 100.0%

---

# Suite A: 结果集延续
Pass: 7/7

## ✅ A1: 查纽约→最便宜→帮我开通(取消)
undefined | 4266ms

| Step | Intent | Pass | ms | Perf |
|------|--------|------|----|------|
| ✅ A1.1 查询纽约IP | query_ip_inventory | PASS | 2831 | ✓ |
| ✅ A1.2 找最便宜的 | follow_up_recommend | PASS | 1029 | ✓ |
| ✅ A1.3 帮我开通(不确认) | follow_up_action | PASS | 405 | ✓ |

## ✅ A2: 查伦敦→下一页→开通第三个
undefined | 2102ms

| Step | Intent | Pass | ms | Perf |
|------|--------|------|----|------|
| ✅ A2.1 查询伦敦IP | query_ip_inventory | PASS | 812 | ✓ |
| ✅ A2.2 下一页 | paginate_next | PASS | 882 | ✓ |
| ✅ A2.3 开通第三个 | follow_up_action | PASS | 408 | ✓ |

## ✅ A3: 查东京→第一个→不对换第二个
undefined | 1720ms

| Step | Intent | Pass | ms | Perf |
|------|--------|------|----|------|
| ✅ A3.1 查询东京IP | query_ip_inventory | PASS | 854 | ✓ |
| ✅ A3.2 选第一个 | follow_up_select | PASS | 480 | ✓ |
| ✅ A3.3 换第二个 | follow_up_select | PASS | 386 | ✓ |

## ✅ A4: 查美国→库存最多的→帮我开通
undefined | 2085ms

| Step | Intent | Pass | ms | Perf |
|------|--------|------|----|------|
| ✅ A4.1 查美国IP | query_ip_inventory | PASS | 1030 | ✓ |
| ✅ A4.2 库存最多的 | follow_up_refine | PASS | 631 | ✓ |
| ✅ A4.3 帮我开通 | follow_up_action | PASS | 423 | ✓ |

## ✅ A5: 查纽约→找质量最好→太贵换便宜的
undefined | 2340ms

| Step | Intent | Pass | ms | Perf |
|------|--------|------|----|------|
| ✅ A5.1 查纽约IP | query_ip_inventory | PASS | 751 | ✓ |
| ✅ A5.2 找质量最好的 | find_best_ip | PASS | 991 | ✓ |
| ✅ A5.3 太贵换便宜的 | follow_up_refine | PASS | 597 | ✓ |

## ✅ A6: 查日本→最便宜那个
undefined | 1305ms

| Step | Intent | Pass | ms | Perf |
|------|--------|------|----|------|
| ✅ A6.1 查日本IP | query_ip_inventory | PASS | 897 | ✓ |
| ✅ A6.2 最便宜那个 | follow_up_recommend | PASS | 408 | ✓ |

## ✅ A7: 查纽约→帮选3个→开通第一个
undefined | 1664ms

| Step | Intent | Pass | ms | Perf |
|------|--------|------|----|------|
| ✅ A7.1 查纽约IP | query_ip_inventory | PASS | 820 | ✓ |
| ✅ A7.2 帮选3个 | follow_up_select | PASS | 406 | ✓ |
| ✅ A7.3 开通第一个 | follow_up_action | PASS | 438 | ✓ |

---

# Suite B: 确认状态机
Pass: 4/4

## ✅ B1: 开通第一个→取消→开第二个
undefined | 1986ms

| Step | Intent | Pass | ms | Perf |
|------|--------|------|----|------|
| ✅ B1.1 查纽约IP | query_ip_inventory | PASS | 762 | ✓ |
| ✅ B1.2 开通第一个 | follow_up_action | PASS | 410 | ✓ |
| ✅ B1.3 取消(状态机拦截) | cancel_confirmed | PASS | 399 | ✓ |
| ✅ B1.4 开第二个 | follow_up_action | PASS | 414 | ✓ |

## ✅ B2: 确认态中插话查余额
undefined | 2019ms

| Step | Intent | Pass | ms | Perf |
|------|--------|------|----|------|
| ✅ B2.1 查美国IP | query_ip_inventory | PASS | 760 | ✓ |
| ✅ B2.2 开通第一个 | follow_up_action | PASS | 400 | ✓ |
| ✅ B2.3 插话查余额 | query_balance | PASS | 441 | ✓ |
| ✅ B2.4 取消 | cancel_confirmed | PASS | 418 | ✓ |

## ✅ B3: 查询→开通→取消→再查便宜的
undefined | 3035ms

| Step | Intent | Pass | ms | Perf |
|------|--------|------|----|------|
| ✅ B3.1 查东京IP | query_ip_inventory | PASS | 861 | ✓ |
| ✅ B3.2 找质量最好的 | find_best_ip | PASS | 922 | ✓ |
| ✅ B3.3 帮我开通 | follow_up_action | PASS | 425 | ✓ |
| ✅ B3.4 取消 | cancel_confirmed | PASS | 413 | ✓ |
| ✅ B3.5 查便宜的 | follow_up_refine | PASS | 413 | ✓ |

## ✅ B4: 确认消息格式校验
undefined | 1328ms

| Step | Intent | Pass | ms | Perf |
|------|--------|------|----|------|
| ✅ B4.1 查纽约IP | query_ip_inventory | PASS | 924 | ✓ |
| ✅ B4.2 开通第一个 | follow_up_action | PASS | 404 | ✓ |

---

# Suite C: 错误恢复
Pass: 7/7

## ✅ C1: 查无结果地区→换有结果地区
undefined | 1498ms

| Step | Intent | Pass | ms | Perf |
|------|--------|------|----|------|
| ✅ C1.1 查冷门地区 | query_ip_inventory | PASS | 669 | ✓ |
| ✅ C1.2 换纽约 | query_ip_inventory | PASS | 829 | ✓ |

## ✅ C2: 无上下文直接开通
undefined | 409ms

| Step | Intent | Pass | ms | Perf |
|------|--------|------|----|------|
| ✅ C2.1 直接开通(无上下文) | purchase_static | PASS | 409 | ✓ |

## ✅ C3: 无上下文模糊命令
undefined | 402ms

| Step | Intent | Pass | ms | Perf |
|------|--------|------|----|------|
| ✅ C3.1 模糊命令 | find_best_ip | PASS | 402 | ✓ |

## ✅ C4: 序号超出范围
undefined | 1279ms

| Step | Intent | Pass | ms | Perf |
|------|--------|------|----|------|
| ✅ C4.1 查日本IP | query_ip_inventory | PASS | 830 | ✓ |
| ✅ C4.2 开通第999个 | follow_up_action | PASS | 449 | ✓ |

## ✅ C5: 管理员可查用户
undefined | 947ms

| Step | Intent | Pass | ms | Perf |
|------|--------|------|----|------|
| ✅ C5.1 查询用户 | query_users | PASS | 947 | ✓ |

## ✅ C6: 查余额→查IP(跨意图)
undefined | 1270ms

| Step | Intent | Pass | ms | Perf |
|------|--------|------|----|------|
| ✅ C6.1 查余额 | query_balance | PASS | 506 | ✓ |
| ✅ C6.2 查纽约IP | query_ip_inventory | PASS | 764 | ✓ |

## ✅ C7: 找最好→换便宜→开通(不确认)
undefined | 8162ms

| Step | Intent | Pass | ms | Perf |
|------|--------|------|----|------|
| ✅ C7.1 查美国IP | query_ip_inventory | PASS | 953 | ✓ |
| ✅ C7.2 找最好的 | find_best_ip | PASS | 5349 | ✓ |
| ✅ C7.3 换便宜的 | follow_up_refine | PASS | 1349 | ✓ |
| ✅ C7.4 帮我开通(不确认) | follow_up_action | PASS | 511 | ✓ |

---

# Suite D: 语言与别名
Pass: 8/8

## ✅ D1: London→切到东京(英→中)
undefined | 1716ms

| Step | Intent | Pass | ms | Perf |
|------|--------|------|----|------|
| ✅ D1.1 查London IP | query_ip_inventory | PASS | 832 | ✓ |
| ✅ D1.2 切到东京 | query_ip_inventory | PASS | 884 | ✓ |

## ✅ D2: 英文全链路 NY→best→purchase
undefined | 7866ms

| Step | Intent | Pass | ms | Perf |
|------|--------|------|----|------|
| ✅ D2.1 Query NY IPs | query_ip_inventory | PASS | 770 | ✓ |
| ✅ D2.2 find the best one | find_best_ip | PASS | 6013 | ✓ |
| ✅ D2.3 purchase it | follow_up_action | PASS | 1083 | ✓ |

## ✅ D3: 中英混合查询
undefined | 1337ms

| Step | Intent | Pass | ms | Perf |
|------|--------|------|----|------|
| ✅ D3.1 查London的IP | query_ip_inventory | PASS | 752 | ✓ |
| ✅ D3.2 show最便宜的 | follow_up_refine | PASS | 585 | ✓ |

## ✅ D4: Seoul别名解析
undefined | 644ms

| Step | Intent | Pass | ms | Perf |
|------|--------|------|----|------|
| ✅ D4.1 查Seoul IP | query_ip_inventory | PASS | 644 | ✓ |

## ✅ D5: LA别名
undefined | 884ms

| Step | Intent | Pass | ms | Perf |
|------|--------|------|----|------|
| ✅ D5.1 查LA IP | query_ip_inventory | PASS | 884 | ✓ |

## ✅ D6: 地区无原始编码
undefined | 725ms

| Step | Intent | Pass | ms | Perf |
|------|--------|------|----|------|
| ✅ D6.1 查伦敦IP | query_ip_inventory | PASS | 725 | ✓ |

## ✅ D7: 英文follow-up上下文
undefined | 6448ms

| Step | Intent | Pass | ms | Perf |
|------|--------|------|----|------|
| ✅ D7.1 Query Tokyo IPs | query_ip_inventory | PASS | 1024 | ✓ |
| ✅ D7.2 which has most stock | query_static_products | PASS | 5424 | ✓ |

## ✅ D8: Australia互通
undefined | 1051ms

| Step | Intent | Pass | ms | Perf |
|------|--------|------|----|------|
| ✅ D8.1 Australia IP | query_ip_inventory | PASS | 1051 | ✓ |

---

# Suite ISO: 会话隔离
Pass: 2/2

## ✅ ISO1: 新会话不继承旧上下文
undefined | 5765ms

| Step | Intent | Pass | ms | Perf |
|------|--------|------|----|------|
| ✅ ISO1.1 旧会话查纽约 | query_ip_inventory | PASS | 866 | ✓ |
| ✅ ISO1.2 新会话-帮我开通 | purchase_static | PASS | 4899 | ✓ |

## ✅ ISO2: 切主题后上下文更新
undefined | 2725ms

| Step | Intent | Pass | ms | Perf |
|------|--------|------|----|------|
| ✅ ISO2.1 查纽约IP | query_ip_inventory | PASS | 1576 | ✓ |
| ✅ ISO2.2 查伦敦IP(换主题) | query_ip_inventory | PASS | 747 | ✓ |
| ✅ ISO2.3 开通第一个(应指向伦敦) | follow_up_action | PASS | 402 | ✓ |

---

# Suite DIS: 指代消歧
Pass: 3/3

## ✅ DIS1: 顺序词—质量第二好的
undefined | 2088ms

| Step | Intent | Pass | ms | Perf |
|------|--------|------|----|------|
| ✅ DIS1.1 查纽约IP | query_ip_inventory | PASS | 840 | ✓ |
| ✅ DIS1.2 找质量最好的 | find_best_ip | PASS | 842 | ✓ |
| ✅ DIS1.3 第二个 | follow_up_select | PASS | 406 | ✓ |

## ✅ DIS2: "这个"指代
undefined | 1187ms

| Step | Intent | Pass | ms | Perf |
|------|--------|------|----|------|
| ✅ DIS2.1 查日本IP | query_ip_inventory | PASS | 778 | ✓ |
| ✅ DIS2.2 帮我开通这个 | follow_up_action | PASS | 409 | ✓ |

## ✅ DIS3: "查最近开通"识别为查询
undefined | 3587ms

| Step | Intent | Pass | ms | Perf |
|------|--------|------|----|------|
| ✅ DIS3.1 查最近开通的IP | query_static_orders | PASS | 3587 | ✓ |

---

# Suite NEG: 否定语义
Pass: 4/4

## ✅ NEG1: 否定+纠正"不是这个,要那个"
undefined | 1768ms

| Step | Intent | Pass | ms | Perf |
|------|--------|------|----|------|
| ✅ NEG1.1 查纽约IP | query_ip_inventory | PASS | 923 | ✓ |
| ✅ NEG1.2 选第一个 | follow_up_select | PASS | 421 | ✓ |
| ✅ NEG1.3 不是这个换第三个 | follow_up_select | PASS | 424 | ✓ |

## ✅ NEG2: "先别买,发给我看看"
undefined | 1579ms

| Step | Intent | Pass | ms | Perf |
|------|--------|------|----|------|
| ✅ NEG2.1 查东京IP | query_ip_inventory | PASS | 742 | ✓ |
| ✅ NEG2.2 帮我开通 | follow_up_action | PASS | 437 | ✓ |
| ✅ NEG2.3 先别买 | cancel_confirmed | PASS | 400 | ✓ |

## ✅ NEG3: 查询→开通→取消→换个便宜的→开通
undefined | 2996ms

| Step | Intent | Pass | ms | Perf |
|------|--------|------|----|------|
| ✅ NEG3.1 查纽约IP | query_ip_inventory | PASS | 891 | ✓ |
| ✅ NEG3.2 帮我开通 | follow_up_action | PASS | 443 | ✓ |
| ✅ NEG3.3 取消 | cancel_confirmed | PASS | 410 | ✓ |
| ✅ NEG3.4 换便宜的 | follow_up_refine | PASS | 583 | ✓ |
| ✅ NEG3.5 再开通 | follow_up_action | PASS | 669 | ✓ |

## ✅ NEG4: "还是上一个吧"回指
undefined | 2182ms

| Step | Intent | Pass | ms | Perf |
|------|--------|------|----|------|
| ✅ NEG4.1 查日本IP | query_ip_inventory | PASS | 859 | ✓ |
| ✅ NEG4.2 选第一个 | follow_up_select | PASS | 414 | ✓ |
| ✅ NEG4.3 换第二个 | follow_up_select | PASS | 405 | ✓ |
| ✅ NEG4.4 还是第一个吧 | follow_up_select | PASS | 504 | ✓ |

---

# Suite CROSS: 跨模块链路
Pass: 4/4

## ✅ CROSS1: 查余额→查消费→查IP
undefined | 6665ms

| Step | Intent | Pass | ms | Perf |
|------|--------|------|----|------|
| ✅ CROSS1.1 查余额 | query_balance | PASS | 456 | ✓ |
| ✅ CROSS1.2 查消费统计 | query_stats | PASS | 4738 | ✓ |
| ✅ CROSS1.3 查纽约IP | query_ip_inventory | PASS | 1471 | ✓ |

## ✅ CROSS2: 查最近订单→查最近开通
undefined | 10382ms

| Step | Intent | Pass | ms | Perf |
|------|--------|------|----|------|
| ✅ CROSS2.1 查最近订单 | query_static_orders | PASS | 5086 | ✓ |
| ✅ CROSS2.2 查最近开通的IP | query_static_orders | PASS | 5295 | ✓ |

## ✅ CROSS3: 查IP→查质量→查余额→开通
undefined | 7948ms

| Step | Intent | Pass | ms | Perf |
|------|--------|------|----|------|
| ✅ CROSS3.1 查纽约IP | query_ip_inventory | PASS | 1467 | ✓ |
| ✅ CROSS3.2 找最好的 | find_best_ip | PASS | 4985 | ✓ |
| ✅ CROSS3.3 查余额 | query_balance | PASS | 1077 | ✓ |
| ✅ CROSS3.4 帮我开通 | follow_up_action | PASS | 419 | ✓ |

## ✅ CROSS4: 帮助→查库存→开通→取消
undefined | 2036ms

| Step | Intent | Pass | ms | Perf |
|------|--------|------|----|------|
| ✅ CROSS4.1 帮助 | show_help | PASS | 470 | ✓ |
| ✅ CROSS4.2 查纽约IP | query_ip_inventory | PASS | 764 | ✓ |
| ✅ CROSS4.3 开通第一个 | follow_up_action | PASS | 407 | ✓ |
| ✅ CROSS4.4 取消 | cancel_confirmed | PASS | 395 | ✓ |

---

# Performance SLA

| Metric | SLA |
|--------|-----|
| Cancel/Confirm | < 3000ms |
| Follow-up | < 5000ms |
| Query | < 15000ms |
| Quality Check | < 30000ms |
