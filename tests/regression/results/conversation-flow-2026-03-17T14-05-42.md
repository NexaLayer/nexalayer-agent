# Conversation Flow Test Report

**Time:** 2026-03-17T14:05:42.729Z
**Scenarios:** 39
**Steps:** 100
**Passed:** 39
**Failed:** 0
**Pass Rate:** 100.0%
**Perf Warnings:** 1

---

# Suite A: 结果集延续
Pass: 7/7

## ✅ A1: 查纽约→最便宜→帮我开通(取消)
undefined | 7132ms

| Step | Intent | Pass | ms | Perf |
|------|--------|------|----|------|
| ✅ A1.1 查询纽约IP | query_ip_inventory | PASS | 5478 | ✓ |
| ✅ A1.2 找最便宜的 | follow_up_recommend | PASS | 1051 | ✓ |
| ✅ A1.3 帮我开通(不确认) | follow_up_action | PASS | 602 | ✓ |

## ✅ A2: 查伦敦→下一页→开通第三个
undefined | 6562ms

| Step | Intent | Pass | ms | Perf |
|------|--------|------|----|------|
| ✅ A2.1 查询伦敦IP | query_ip_inventory | PASS | 855 | ✓ |
| ✅ A2.2 下一页 | paginate_next | PASS | 4642 | ✓ |
| ✅ A2.3 开通第三个 | follow_up_action | PASS | 1065 | ✓ |

## ✅ A3: 查东京→第一个→不对换第二个
undefined | 1934ms

| Step | Intent | Pass | ms | Perf |
|------|--------|------|----|------|
| ✅ A3.1 查询东京IP | query_ip_inventory | PASS | 861 | ✓ |
| ✅ A3.2 选第一个 | follow_up_select | PASS | 504 | ✓ |
| ✅ A3.3 换第二个 | follow_up_select | PASS | 568 | ✓ |

## ✅ A4: 查美国→库存最多的→帮我开通
undefined | 2326ms

| Step | Intent | Pass | ms | Perf |
|------|--------|------|----|------|
| ✅ A4.1 查美国IP | query_ip_inventory | PASS | 1129 | ✓ |
| ✅ A4.2 库存最多的 | follow_up_refine | PASS | 791 | ✓ |
| ✅ A4.3 帮我开通 | follow_up_action | PASS | 405 | ✓ |

## ✅ A5: 查纽约→找质量最好→太贵换便宜的
undefined | 2590ms

| Step | Intent | Pass | ms | Perf |
|------|--------|------|----|------|
| ✅ A5.1 查纽约IP | query_ip_inventory | PASS | 887 | ✓ |
| ✅ A5.2 找质量最好的 | find_best_ip | PASS | 969 | ✓ |
| ✅ A5.3 太贵换便宜的 | follow_up_refine | PASS | 734 | ✓ |

## ✅ A6: 查日本→最便宜那个
undefined | 1186ms

| Step | Intent | Pass | ms | Perf |
|------|--------|------|----|------|
| ✅ A6.1 查日本IP | query_ip_inventory | PASS | 788 | ✓ |
| ✅ A6.2 最便宜那个 | follow_up_recommend | PASS | 398 | ✓ |

## ✅ A7: 查纽约→帮选3个→开通第一个
undefined | 1647ms

| Step | Intent | Pass | ms | Perf |
|------|--------|------|----|------|
| ✅ A7.1 查纽约IP | query_ip_inventory | PASS | 841 | ✓ |
| ✅ A7.2 帮选3个 | follow_up_select | PASS | 408 | ✓ |
| ✅ A7.3 开通第一个 | follow_up_action | PASS | 398 | ✓ |

---

# Suite B: 确认状态机
Pass: 4/4

## ✅ B1: 开通第一个→取消→开第二个
undefined | 2007ms

| Step | Intent | Pass | ms | Perf |
|------|--------|------|----|------|
| ✅ B1.1 查纽约IP | query_ip_inventory | PASS | 751 | ✓ |
| ✅ B1.2 开通第一个 | follow_up_action | PASS | 407 | ✓ |
| ✅ B1.3 取消(状态机拦截) | cancel_confirmed | PASS | 462 | ✓ |
| ✅ B1.4 开第二个 | follow_up_action | PASS | 386 | ✓ |

## ✅ B2: 确认态中插话查余额
undefined | 2249ms

| Step | Intent | Pass | ms | Perf |
|------|--------|------|----|------|
| ✅ B2.1 查美国IP | query_ip_inventory | PASS | 860 | ✓ |
| ✅ B2.2 开通第一个 | follow_up_action | PASS | 531 | ✓ |
| ✅ B2.3 插话查余额 | query_balance | PASS | 449 | ✓ |
| ✅ B2.4 取消 | cancel_confirmed | PASS | 409 | ✓ |

## ✅ B3: 查询→开通→取消→再查便宜的
undefined | 10595ms

| Step | Intent | Pass | ms | Perf |
|------|--------|------|----|------|
| ✅ B3.1 查东京IP | query_ip_inventory | PASS | 821 | ✓ |
| ✅ B3.2 找质量最好的 | find_best_ip | PASS | 4580 | ✓ |
| ✅ B3.3 帮我开通 | follow_up_action | PASS | 1024 | ✓ |
| ✅ B3.4 取消 | cancel_confirmed | PASS | 3737 | ⚠️ |
| ✅ B3.5 查便宜的 | follow_up_refine | PASS | 433 | ✓ |

### Performance Warnings

**B3.4 取消:** [PERF] 3737ms > 3000ms SLA

## ✅ B4: 确认消息格式校验
undefined | 3064ms

| Step | Intent | Pass | ms | Perf |
|------|--------|------|----|------|
| ✅ B4.1 查纽约IP | query_ip_inventory | PASS | 2673 | ✓ |
| ✅ B4.2 开通第一个 | follow_up_action | PASS | 391 | ✓ |

---

# Suite C: 错误恢复
Pass: 7/7

## ✅ C1: 查无结果地区→换有结果地区
undefined | 1326ms

| Step | Intent | Pass | ms | Perf |
|------|--------|------|----|------|
| ✅ C1.1 查冷门地区 | query_ip_inventory | PASS | 550 | ✓ |
| ✅ C1.2 换纽约 | query_ip_inventory | PASS | 776 | ✓ |

## ✅ C2: 无上下文直接开通
undefined | 642ms

| Step | Intent | Pass | ms | Perf |
|------|--------|------|----|------|
| ✅ C2.1 直接开通(无上下文) | purchase_static | PASS | 642 | ✓ |

## ✅ C3: 无上下文模糊命令
undefined | 474ms

| Step | Intent | Pass | ms | Perf |
|------|--------|------|----|------|
| ✅ C3.1 模糊命令 | find_best_ip | PASS | 474 | ✓ |

## ✅ C4: 序号超出范围
undefined | 1246ms

| Step | Intent | Pass | ms | Perf |
|------|--------|------|----|------|
| ✅ C4.1 查日本IP | query_ip_inventory | PASS | 838 | ✓ |
| ✅ C4.2 开通第999个 | follow_up_action | PASS | 408 | ✓ |

## ✅ C5: 管理员可查用户
undefined | 1181ms

| Step | Intent | Pass | ms | Perf |
|------|--------|------|----|------|
| ✅ C5.1 查询用户 | query_users | PASS | 1181 | ✓ |

## ✅ C6: 查余额→查IP(跨意图)
undefined | 1413ms

| Step | Intent | Pass | ms | Perf |
|------|--------|------|----|------|
| ✅ C6.1 查余额 | query_balance | PASS | 448 | ✓ |
| ✅ C6.2 查纽约IP | query_ip_inventory | PASS | 965 | ✓ |

## ✅ C7: 找最好→换便宜→开通(不确认)
undefined | 8447ms

| Step | Intent | Pass | ms | Perf |
|------|--------|------|----|------|
| ✅ C7.1 查美国IP | query_ip_inventory | PASS | 1329 | ✓ |
| ✅ C7.2 找最好的 | find_best_ip | PASS | 5326 | ✓ |
| ✅ C7.3 换便宜的 | follow_up_refine | PASS | 1401 | ✓ |
| ✅ C7.4 帮我开通(不确认) | follow_up_action | PASS | 391 | ✓ |

---

# Suite D: 语言与别名
Pass: 8/8

## ✅ D1: London→切到东京(英→中)
undefined | 1589ms

| Step | Intent | Pass | ms | Perf |
|------|--------|------|----|------|
| ✅ D1.1 查London IP | query_ip_inventory | PASS | 849 | ✓ |
| ✅ D1.2 切到东京 | query_ip_inventory | PASS | 740 | ✓ |

## ✅ D2: 英文全链路 NY→best→purchase
undefined | 8810ms

| Step | Intent | Pass | ms | Perf |
|------|--------|------|----|------|
| ✅ D2.1 Query NY IPs | query_ip_inventory | PASS | 756 | ✓ |
| ✅ D2.2 find the best one | find_best_ip | PASS | 6848 | ✓ |
| ✅ D2.3 purchase it | follow_up_action | PASS | 1206 | ✓ |

## ✅ D3: 中英混合查询
undefined | 1377ms

| Step | Intent | Pass | ms | Perf |
|------|--------|------|----|------|
| ✅ D3.1 查London的IP | query_ip_inventory | PASS | 793 | ✓ |
| ✅ D3.2 show最便宜的 | follow_up_refine | PASS | 584 | ✓ |

## ✅ D4: Seoul别名解析
undefined | 623ms

| Step | Intent | Pass | ms | Perf |
|------|--------|------|----|------|
| ✅ D4.1 查Seoul IP | query_ip_inventory | PASS | 623 | ✓ |

## ✅ D5: LA别名
undefined | 948ms

| Step | Intent | Pass | ms | Perf |
|------|--------|------|----|------|
| ✅ D5.1 查LA IP | query_ip_inventory | PASS | 948 | ✓ |

## ✅ D6: 地区无原始编码
undefined | 866ms

| Step | Intent | Pass | ms | Perf |
|------|--------|------|----|------|
| ✅ D6.1 查伦敦IP | query_ip_inventory | PASS | 866 | ✓ |

## ✅ D7: 英文follow-up上下文
undefined | 5842ms

| Step | Intent | Pass | ms | Perf |
|------|--------|------|----|------|
| ✅ D7.1 Query Tokyo IPs | query_ip_inventory | PASS | 744 | ✓ |
| ✅ D7.2 which has most stock | query_static_products | PASS | 5098 | ✓ |

## ✅ D8: Australia互通
undefined | 1245ms

| Step | Intent | Pass | ms | Perf |
|------|--------|------|----|------|
| ✅ D8.1 Australia IP | query_ip_inventory | PASS | 1245 | ✓ |

---

# Suite ISO: 会话隔离
Pass: 2/2

## ✅ ISO1: 新会话不继承旧上下文
undefined | 5341ms

| Step | Intent | Pass | ms | Perf |
|------|--------|------|----|------|
| ✅ ISO1.1 旧会话查纽约 | query_ip_inventory | PASS | 772 | ✓ |
| ✅ ISO1.2 新会话-帮我开通 | purchase_static | PASS | 4569 | ✓ |

## ✅ ISO2: 切主题后上下文更新
undefined | 5846ms

| Step | Intent | Pass | ms | Perf |
|------|--------|------|----|------|
| ✅ ISO2.1 查纽约IP | query_ip_inventory | PASS | 1824 | ✓ |
| ✅ ISO2.2 查伦敦IP(换主题) | query_ip_inventory | PASS | 3298 | ✓ |
| ✅ ISO2.3 开通第一个(应指向伦敦) | follow_up_action | PASS | 724 | ✓ |

---

# Suite DIS: 指代消歧
Pass: 3/3

## ✅ DIS1: 顺序词—质量第二好的
undefined | 38108ms

| Step | Intent | Pass | ms | Perf |
|------|--------|------|----|------|
| ✅ DIS1.1 查纽约IP | query_ip_inventory | PASS | 3892 | ✓ |
| ✅ DIS1.2 找质量最好的 | find_best_ip | PASS | 33641 | ✓ |
| ✅ DIS1.3 第二个 | follow_up_select | PASS | 575 | ✓ |

## ✅ DIS2: "这个"指代
undefined | 1307ms

| Step | Intent | Pass | ms | Perf |
|------|--------|------|----|------|
| ✅ DIS2.1 查日本IP | query_ip_inventory | PASS | 888 | ✓ |
| ✅ DIS2.2 帮我开通这个 | follow_up_action | PASS | 419 | ✓ |

## ✅ DIS3: "查最近开通"识别为查询
undefined | 3870ms

| Step | Intent | Pass | ms | Perf |
|------|--------|------|----|------|
| ✅ DIS3.1 查最近开通的IP | query_static_orders | PASS | 3870 | ✓ |

---

# Suite NEG: 否定语义
Pass: 4/4

## ✅ NEG1: 否定+纠正"不是这个,要那个"
undefined | 3131ms

| Step | Intent | Pass | ms | Perf |
|------|--------|------|----|------|
| ✅ NEG1.1 查纽约IP | query_ip_inventory | PASS | 2232 | ✓ |
| ✅ NEG1.2 选第一个 | follow_up_select | PASS | 463 | ✓ |
| ✅ NEG1.3 不是这个换第三个 | follow_up_select | PASS | 436 | ✓ |

## ✅ NEG2: "先别买,发给我看看"
undefined | 1633ms

| Step | Intent | Pass | ms | Perf |
|------|--------|------|----|------|
| ✅ NEG2.1 查东京IP | query_ip_inventory | PASS | 767 | ✓ |
| ✅ NEG2.2 帮我开通 | follow_up_action | PASS | 435 | ✓ |
| ✅ NEG2.3 先别买 | cancel_confirmed | PASS | 431 | ✓ |

## ✅ NEG3: 查询→开通→取消→换个便宜的→开通
undefined | 2576ms

| Step | Intent | Pass | ms | Perf |
|------|--------|------|----|------|
| ✅ NEG3.1 查纽约IP | query_ip_inventory | PASS | 763 | ✓ |
| ✅ NEG3.2 帮我开通 | follow_up_action | PASS | 412 | ✓ |
| ✅ NEG3.3 取消 | cancel_confirmed | PASS | 408 | ✓ |
| ✅ NEG3.4 换便宜的 | follow_up_refine | PASS | 587 | ✓ |
| ✅ NEG3.5 再开通 | follow_up_action | PASS | 406 | ✓ |

## ✅ NEG4: "还是上一个吧"回指
undefined | 2024ms

| Step | Intent | Pass | ms | Perf |
|------|--------|------|----|------|
| ✅ NEG4.1 查日本IP | query_ip_inventory | PASS | 754 | ✓ |
| ✅ NEG4.2 选第一个 | follow_up_select | PASS | 410 | ✓ |
| ✅ NEG4.3 换第二个 | follow_up_select | PASS | 447 | ✓ |
| ✅ NEG4.4 还是第一个吧 | follow_up_select | PASS | 413 | ✓ |

---

# Suite CROSS: 跨模块链路
Pass: 4/4

## ✅ CROSS1: 查余额→查消费→查IP
undefined | 6000ms

| Step | Intent | Pass | ms | Perf |
|------|--------|------|----|------|
| ✅ CROSS1.1 查余额 | query_balance | PASS | 441 | ✓ |
| ✅ CROSS1.2 查消费统计 | query_stats | PASS | 4067 | ✓ |
| ✅ CROSS1.3 查纽约IP | query_ip_inventory | PASS | 1491 | ✓ |

## ✅ CROSS2: 查最近订单→查最近开通
undefined | 6380ms

| Step | Intent | Pass | ms | Perf |
|------|--------|------|----|------|
| ✅ CROSS2.1 查最近订单 | query_static_orders | PASS | 3165 | ✓ |
| ✅ CROSS2.2 查最近开通的IP | query_static_orders | PASS | 3215 | ✓ |

## ✅ CROSS3: 查IP→查质量→查余额→开通
undefined | 7079ms

| Step | Intent | Pass | ms | Perf |
|------|--------|------|----|------|
| ✅ CROSS3.1 查纽约IP | query_ip_inventory | PASS | 773 | ✓ |
| ✅ CROSS3.2 找最好的 | find_best_ip | PASS | 4737 | ✓ |
| ✅ CROSS3.3 查余额 | query_balance | PASS | 1159 | ✓ |
| ✅ CROSS3.4 帮我开通 | follow_up_action | PASS | 410 | ✓ |

## ✅ CROSS4: 帮助→查库存→开通→取消
undefined | 2304ms

| Step | Intent | Pass | ms | Perf |
|------|--------|------|----|------|
| ✅ CROSS4.1 帮助 | show_help | PASS | 477 | ✓ |
| ✅ CROSS4.2 查纽约IP | query_ip_inventory | PASS | 905 | ✓ |
| ✅ CROSS4.3 开通第一个 | follow_up_action | PASS | 489 | ✓ |
| ✅ CROSS4.4 取消 | cancel_confirmed | PASS | 433 | ✓ |

---

# Performance SLA

| Metric | SLA |
|--------|-----|
| Cancel/Confirm | < 3000ms |
| Follow-up | < 5000ms |
| Query | < 15000ms |
| Quality Check | < 30000ms |
