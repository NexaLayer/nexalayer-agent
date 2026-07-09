# Conversation Flow Test Report

**Time:** 2026-03-16T15:54:17.214Z
**Scenarios:** 39
**Steps:** 100
**Passed:** 38
**Failed:** 1
**Pass Rate:** 97.4%
**Perf Warnings:** 6

---

# Suite A: 结果集延续
Pass: 7/7

## ✅ A1: 查纽约→最便宜→帮我开通(取消)
undefined | 5133ms

| Step | Intent | Pass | ms | Perf |
|------|--------|------|----|------|
| ✅ A1.1 查询纽约IP | query_ip_inventory | PASS | 3916 | ✓ |
| ✅ A1.2 找最便宜的 | follow_up_recommend | PASS | 1105 | ✓ |
| ✅ A1.3 帮我开通(不确认) | follow_up_action | PASS | 111 | ✓ |

## ✅ A2: 查伦敦→下一页→开通第三个
undefined | 1155ms

| Step | Intent | Pass | ms | Perf |
|------|--------|------|----|------|
| ✅ A2.1 查询伦敦IP | query_ip_inventory | PASS | 771 | ✓ |
| ✅ A2.2 下一页 | paginate_next | PASS | 105 | ✓ |
| ✅ A2.3 开通第三个 | follow_up_action | PASS | 279 | ✓ |

## ✅ A3: 查东京→第一个→不对换第二个
undefined | 697ms

| Step | Intent | Pass | ms | Perf |
|------|--------|------|----|------|
| ✅ A3.1 查询东京IP | query_ip_inventory | PASS | 337 | ✓ |
| ✅ A3.2 选第一个 | follow_up_select | PASS | 258 | ✓ |
| ✅ A3.3 换第二个 | follow_up_select | PASS | 101 | ✓ |

## ✅ A4: 查美国→库存最多的→帮我开通
undefined | 1284ms

| Step | Intent | Pass | ms | Perf |
|------|--------|------|----|------|
| ✅ A4.1 查美国IP | query_ip_inventory | PASS | 739 | ✓ |
| ✅ A4.2 库存最多的 | follow_up_refine | PASS | 264 | ✓ |
| ✅ A4.3 帮我开通 | follow_up_action | PASS | 281 | ✓ |

## ✅ A5: 查纽约→找质量最好→太贵换便宜的
undefined | 1778ms

| Step | Intent | Pass | ms | Perf |
|------|--------|------|----|------|
| ✅ A5.1 查纽约IP | query_ip_inventory | PASS | 346 | ✓ |
| ✅ A5.2 找质量最好的 | find_best_ip | PASS | 1308 | ✓ |
| ✅ A5.3 太贵换便宜的 | follow_up_refine | PASS | 124 | ✓ |

## ✅ A6: 查日本→最便宜那个
undefined | 542ms

| Step | Intent | Pass | ms | Perf |
|------|--------|------|----|------|
| ✅ A6.1 查日本IP | query_ip_inventory | PASS | 432 | ✓ |
| ✅ A6.2 最便宜那个 | follow_up_recommend | PASS | 110 | ✓ |

## ✅ A7: 查纽约→帮选3个→开通第一个
undefined | 853ms

| Step | Intent | Pass | ms | Perf |
|------|--------|------|----|------|
| ✅ A7.1 查纽约IP | query_ip_inventory | PASS | 490 | ✓ |
| ✅ A7.2 帮选3个 | follow_up_select | PASS | 101 | ✓ |
| ✅ A7.3 开通第一个 | follow_up_action | PASS | 262 | ✓ |

---

# Suite B: 确认状态机
Pass: 3/4 (1 failed)

## ❌ B1: 开通第一个→取消→开第二个
undefined | 8327ms

| Step | Intent | Pass | ms | Perf |
|------|--------|------|----|------|
| ✅ B1.1 查纽约IP | query_ip_inventory | PASS | 340 | ✓ |
| ✅ B1.2 开通第一个 | follow_up_action | PASS | 266 | ✓ |
| ❌ B1.3 取消(状态机拦截) | unknown | FAIL | 7384 | ⚠️ |
| ✅ B1.4 开第二个 | follow_up_action | PASS | 337 | ✓ |

### Failures

**B1.3 取消(状态机拦截):**
- [SEMANTIC] intent should be "cancel_confirmed" but got "unknown"
- Preview: 好的，已取消刚才的购买操作。

您可以随时重新查询或选择其他产品。

**相关命令：**
- `/query_ip_inventory 纽约` - 重新查询纽约IP库存
- `/query_ip_inventory` - 查看所有可用IP
- `/help` - 查看完整命令列表

💡 输入 "帮助" 查看所有可用命令

### Performance Warnings

**B1.3 取消(状态机拦截):** [PERF] 7384ms > 3000ms SLA

## ✅ B2: 确认态中插话查余额
undefined | 8168ms

| Step | Intent | Pass | ms | Perf |
|------|--------|------|----|------|
| ✅ B2.1 查美国IP | query_ip_inventory | PASS | 421 | ✓ |
| ✅ B2.2 开通第一个 | follow_up_action | PASS | 103 | ✓ |
| ✅ B2.3 插话查余额 | query_balance | PASS | 162 | ✓ |
| ✅ B2.4 取消 | unknown | PASS | 7482 | ⚠️ |

### Performance Warnings

**B2.4 取消:** [PERF] 7482ms > 3000ms SLA

## ✅ B3: 查询→开通→取消→再查便宜的
undefined | 10153ms

| Step | Intent | Pass | ms | Perf |
|------|--------|------|----|------|
| ✅ B3.1 查东京IP | query_ip_inventory | PASS | 1357 | ✓ |
| ✅ B3.2 找质量最好的 | find_best_ip | PASS | 996 | ✓ |
| ✅ B3.3 帮我开通 | follow_up_action | PASS | 283 | ✓ |
| ✅ B3.4 取消 | unknown | PASS | 6570 | ⚠️ |
| ✅ B3.5 查便宜的 | follow_up_refine | PASS | 947 | ✓ |

### Performance Warnings

**B3.4 取消:** [PERF] 6570ms > 3000ms SLA

## ✅ B4: 确认消息格式校验
undefined | 899ms

| Step | Intent | Pass | ms | Perf |
|------|--------|------|----|------|
| ✅ B4.1 查纽约IP | query_ip_inventory | PASS | 618 | ✓ |
| ✅ B4.2 开通第一个 | follow_up_action | PASS | 280 | ✓ |

---

# Suite C: 错误恢复
Pass: 7/7

## ✅ C1: 查无结果地区→换有结果地区
undefined | 851ms

| Step | Intent | Pass | ms | Perf |
|------|--------|------|----|------|
| ✅ C1.1 查冷门地区 | query_ip_inventory | PASS | 338 | ✓ |
| ✅ C1.2 换纽约 | query_ip_inventory | PASS | 513 | ✓ |

## ✅ C2: 无上下文直接开通
undefined | 147ms

| Step | Intent | Pass | ms | Perf |
|------|--------|------|----|------|
| ✅ C2.1 直接开通(无上下文) | purchase_static | PASS | 147 | ✓ |

## ✅ C3: 无上下文模糊命令
undefined | 439ms

| Step | Intent | Pass | ms | Perf |
|------|--------|------|----|------|
| ✅ C3.1 模糊命令 | find_best_ip | PASS | 439 | ✓ |

## ✅ C4: 序号超出范围
undefined | 623ms

| Step | Intent | Pass | ms | Perf |
|------|--------|------|----|------|
| ✅ C4.1 查日本IP | query_ip_inventory | PASS | 370 | ✓ |
| ✅ C4.2 开通第999个 | follow_up_action | PASS | 253 | ✓ |

## ✅ C5: 管理员可查用户
undefined | 268ms

| Step | Intent | Pass | ms | Perf |
|------|--------|------|----|------|
| ✅ C5.1 查询用户 | query_users | PASS | 268 | ✓ |

## ✅ C6: 查余额→查IP(跨意图)
undefined | 676ms

| Step | Intent | Pass | ms | Perf |
|------|--------|------|----|------|
| ✅ C6.1 查余额 | query_balance | PASS | 305 | ✓ |
| ✅ C6.2 查纽约IP | query_ip_inventory | PASS | 371 | ✓ |

## ✅ C7: 找最好→换便宜→开通(不确认)
undefined | 5972ms

| Step | Intent | Pass | ms | Perf |
|------|--------|------|----|------|
| ✅ C7.1 查美国IP | query_ip_inventory | PASS | 647 | ✓ |
| ✅ C7.2 找最好的 | find_best_ip | PASS | 4781 | ✓ |
| ✅ C7.3 换便宜的 | follow_up_refine | PASS | 406 | ✓ |
| ✅ C7.4 帮我开通(不确认) | follow_up_action | PASS | 138 | ✓ |

---

# Suite D: 语言与别名
Pass: 8/8

## ✅ D1: London→切到东京(英→中)
undefined | 716ms

| Step | Intent | Pass | ms | Perf |
|------|--------|------|----|------|
| ✅ D1.1 查London IP | query_ip_inventory | PASS | 352 | ✓ |
| ✅ D1.2 切到东京 | query_ip_inventory | PASS | 364 | ✓ |

## ✅ D2: 英文全链路 NY→best→purchase
undefined | 6013ms

| Step | Intent | Pass | ms | Perf |
|------|--------|------|----|------|
| ✅ D2.1 Query NY IPs | query_ip_inventory | PASS | 418 | ✓ |
| ✅ D2.2 find the best one | find_best_ip | PASS | 5159 | ✓ |
| ✅ D2.3 purchase it | follow_up_action | PASS | 436 | ✓ |

## ✅ D3: 中英混合查询
undefined | 29520ms

| Step | Intent | Pass | ms | Perf |
|------|--------|------|----|------|
| ✅ D3.1 查London的IP | query_ip_inventory | PASS | 19593 | ✓ |
| ✅ D3.2 show最便宜的 | follow_up_refine | PASS | 9927 | ✓ |

## ✅ D4: Seoul别名解析
undefined | 2693ms

| Step | Intent | Pass | ms | Perf |
|------|--------|------|----|------|
| ✅ D4.1 查Seoul IP | query_ip_inventory | PASS | 2693 | ✓ |

## ✅ D5: LA别名
undefined | 696ms

| Step | Intent | Pass | ms | Perf |
|------|--------|------|----|------|
| ✅ D5.1 查LA IP | query_ip_inventory | PASS | 696 | ✓ |

## ✅ D6: 地区无原始编码
undefined | 569ms

| Step | Intent | Pass | ms | Perf |
|------|--------|------|----|------|
| ✅ D6.1 查伦敦IP | query_ip_inventory | PASS | 569 | ✓ |

## ✅ D7: 英文follow-up上下文
undefined | 5262ms

| Step | Intent | Pass | ms | Perf |
|------|--------|------|----|------|
| ✅ D7.1 Query Tokyo IPs | query_ip_inventory | PASS | 658 | ✓ |
| ✅ D7.2 which has most stock | query_static_products | PASS | 4604 | ✓ |

## ✅ D8: Australia互通
undefined | 2385ms

| Step | Intent | Pass | ms | Perf |
|------|--------|------|----|------|
| ✅ D8.1 Australia IP | query_ip_inventory | PASS | 2385 | ✓ |

---

# Suite ISO: 会话隔离
Pass: 2/2

## ✅ ISO1: 新会话不继承旧上下文
undefined | 12489ms

| Step | Intent | Pass | ms | Perf |
|------|--------|------|----|------|
| ✅ ISO1.1 旧会话查纽约 | query_ip_inventory | PASS | 2735 | ✓ |
| ✅ ISO1.2 新会话-帮我开通 | unknown | PASS | 9754 | ✓ |

## ✅ ISO2: 切主题后上下文更新
undefined | 2005ms

| Step | Intent | Pass | ms | Perf |
|------|--------|------|----|------|
| ✅ ISO2.1 查纽约IP | query_ip_inventory | PASS | 1321 | ✓ |
| ✅ ISO2.2 查伦敦IP(换主题) | query_ip_inventory | PASS | 426 | ✓ |
| ✅ ISO2.3 开通第一个(应指向伦敦) | follow_up_action | PASS | 258 | ✓ |

---

# Suite DIS: 指代消歧
Pass: 3/3

## ✅ DIS1: 顺序词—质量第二好的
undefined | 1132ms

| Step | Intent | Pass | ms | Perf |
|------|--------|------|----|------|
| ✅ DIS1.1 查纽约IP | query_ip_inventory | PASS | 354 | ✓ |
| ✅ DIS1.2 找质量最好的 | find_best_ip | PASS | 673 | ✓ |
| ✅ DIS1.3 第二个 | follow_up_select | PASS | 104 | ✓ |

## ✅ DIS2: "这个"指代
undefined | 569ms

| Step | Intent | Pass | ms | Perf |
|------|--------|------|----|------|
| ✅ DIS2.1 查日本IP | query_ip_inventory | PASS | 453 | ✓ |
| ✅ DIS2.2 帮我开通这个 | follow_up_action | PASS | 116 | ✓ |

## ✅ DIS3: "查最近开通"识别为查询
undefined | 4109ms

| Step | Intent | Pass | ms | Perf |
|------|--------|------|----|------|
| ✅ DIS3.1 查最近开通的IP | query_static_orders | PASS | 4108 | ✓ |

---

# Suite NEG: 否定语义
Pass: 4/4

## ✅ NEG1: 否定+纠正"不是这个,要那个"
undefined | 1061ms

| Step | Intent | Pass | ms | Perf |
|------|--------|------|----|------|
| ✅ NEG1.1 查纽约IP | query_ip_inventory | PASS | 708 | ✓ |
| ✅ NEG1.2 选第一个 | follow_up_select | PASS | 245 | ✓ |
| ✅ NEG1.3 不是这个换第三个 | follow_up_select | PASS | 108 | ✓ |

## ✅ NEG2: "先别买,发给我看看"
undefined | 8566ms

| Step | Intent | Pass | ms | Perf |
|------|--------|------|----|------|
| ✅ NEG2.1 查东京IP | query_ip_inventory | PASS | 472 | ✓ |
| ✅ NEG2.2 帮我开通 | follow_up_action | PASS | 97 | ✓ |
| ✅ NEG2.3 先别买 | unknown | PASS | 7997 | ⚠️ |

### Performance Warnings

**NEG2.3 先别买:** [PERF] 7997ms > 3000ms SLA

## ✅ NEG3: 查询→开通→取消→换个便宜的→开通
undefined | 11547ms

| Step | Intent | Pass | ms | Perf |
|------|--------|------|----|------|
| ✅ NEG3.1 查纽约IP | query_ip_inventory | PASS | 1535 | ✓ |
| ✅ NEG3.2 帮我开通 | follow_up_action | PASS | 246 | ✓ |
| ✅ NEG3.3 取消 | unknown | PASS | 8422 | ⚠️ |
| ✅ NEG3.4 换便宜的 | follow_up_refine | PASS | 1045 | ✓ |
| ✅ NEG3.5 再开通 | follow_up_action | PASS | 298 | ✓ |

### Performance Warnings

**NEG3.3 取消:** [PERF] 8422ms > 3000ms SLA

## ✅ NEG4: "还是上一个吧"回指
undefined | 1314ms

| Step | Intent | Pass | ms | Perf |
|------|--------|------|----|------|
| ✅ NEG4.1 查日本IP | query_ip_inventory | PASS | 453 | ✓ |
| ✅ NEG4.2 选第一个 | follow_up_select | PASS | 353 | ✓ |
| ✅ NEG4.3 换第二个 | follow_up_select | PASS | 225 | ✓ |
| ✅ NEG4.4 还是第一个吧 | follow_up_select | PASS | 283 | ✓ |

---

# Suite CROSS: 跨模块链路
Pass: 4/4

## ✅ CROSS1: 查余额→查消费→查IP
undefined | 5645ms

| Step | Intent | Pass | ms | Perf |
|------|--------|------|----|------|
| ✅ CROSS1.1 查余额 | query_balance | PASS | 277 | ✓ |
| ✅ CROSS1.2 查消费统计 | query_stats | PASS | 4227 | ✓ |
| ✅ CROSS1.3 查纽约IP | query_ip_inventory | PASS | 1141 | ✓ |

## ✅ CROSS2: 查最近订单→查最近开通
undefined | 9112ms

| Step | Intent | Pass | ms | Perf |
|------|--------|------|----|------|
| ✅ CROSS2.1 查最近订单 | query_static_orders | PASS | 3996 | ✓ |
| ✅ CROSS2.2 查最近开通的IP | query_static_orders | PASS | 5116 | ✓ |

## ✅ CROSS3: 查IP→查质量→查余额→开通
undefined | 5931ms

| Step | Intent | Pass | ms | Perf |
|------|--------|------|----|------|
| ✅ CROSS3.1 查纽约IP | query_ip_inventory | PASS | 513 | ✓ |
| ✅ CROSS3.2 找最好的 | find_best_ip | PASS | 4496 | ✓ |
| ✅ CROSS3.3 查余额 | query_balance | PASS | 675 | ✓ |
| ✅ CROSS3.4 帮我开通 | follow_up_action | PASS | 247 | ✓ |

## ✅ CROSS4: 帮助→查库存→开通→取消
undefined | 8368ms

| Step | Intent | Pass | ms | Perf |
|------|--------|------|----|------|
| ✅ CROSS4.1 帮助 | show_help | PASS | 93 | ✓ |
| ✅ CROSS4.2 查纽约IP | query_ip_inventory | PASS | 417 | ✓ |
| ✅ CROSS4.3 开通第一个 | follow_up_action | PASS | 103 | ✓ |
| ✅ CROSS4.4 取消 | unknown | PASS | 7755 | ⚠️ |

### Performance Warnings

**CROSS4.4 取消:** [PERF] 7755ms > 3000ms SLA

---

# Performance SLA

| Metric | SLA |
|--------|-----|
| Cancel/Confirm | < 3000ms |
| Follow-up | < 5000ms |
| Query | < 15000ms |
| Quality Check | < 30000ms |
