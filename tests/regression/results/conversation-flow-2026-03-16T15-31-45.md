# Conversation Flow Test Report

**Time:** 2026-03-16T15:31:45.830Z
**Total Scenarios:** 31
**Passed:** 31
**Failed:** 0
**Pass Rate:** 100.0%
**Total Steps:** 72

---

# Suite A: 结果集延续
Pass: 7/7

## ✅ A1: 查纽约→最便宜→帮我开通(取消)
undefined | 3021ms

| Step | Intent | Pass | Duration |
|------|--------|------|----------|
| ✅ A1.1 查询纽约IP | query_ip_inventory | PASS | 1580ms |
| ✅ A1.2 找最便宜的 | follow_up_recommend | PASS | 1072ms |
| ✅ A1.3 帮我开通(不确认) | follow_up_action | PASS | 369ms |

## ✅ A2: 查伦敦→下一页→开通第三个
undefined | 1512ms

| Step | Intent | Pass | Duration |
|------|--------|------|----------|
| ✅ A2.1 查询伦敦IP | query_ip_inventory | PASS | 819ms |
| ✅ A2.2 下一页 | paginate_next | PASS | 355ms |
| ✅ A2.3 开通第三个 | follow_up_select | PASS | 338ms |

## ✅ A3: 查东京→第一个→不对换第二个
undefined | 1604ms

| Step | Intent | Pass | Duration |
|------|--------|------|----------|
| ✅ A3.1 查询东京IP | query_ip_inventory | PASS | 946ms |
| ✅ A3.2 选第一个 | follow_up_select | PASS | 322ms |
| ✅ A3.3 换第二个 | follow_up_select | PASS | 336ms |

## ✅ A4: 查美国→库存最多的→帮我开通
undefined | 1719ms

| Step | Intent | Pass | Duration |
|------|--------|------|----------|
| ✅ A4.1 查美国IP | query_ip_inventory | PASS | 777ms |
| ✅ A4.2 库存最多的 | follow_up_refine | PASS | 566ms |
| ✅ A4.3 帮我开通 | follow_up_action | PASS | 376ms |

## ✅ A5: 查纽约→找质量最好→太贵换便宜的
undefined | 1636ms

| Step | Intent | Pass | Duration |
|------|--------|------|----------|
| ✅ A5.1 查纽约IP | query_ip_inventory | PASS | 562ms |
| ✅ A5.2 找质量最好的 | find_best_ip | PASS | 700ms |
| ✅ A5.3 太贵换便宜的 | follow_up_refine | PASS | 374ms |

## ✅ A6: 查日本→只看静态的→最便宜那个
undefined | 1102ms

| Step | Intent | Pass | Duration |
|------|--------|------|----------|
| ✅ A6.1 查日本IP | query_ip_inventory | PASS | 760ms |
| ✅ A6.2 最便宜那个 | follow_up_recommend | PASS | 342ms |

## ✅ A7: 查纽约→帮选3个→开通第一个
undefined | 1245ms

| Step | Intent | Pass | Duration |
|------|--------|------|----------|
| ✅ A7.1 查纽约IP | query_ip_inventory | PASS | 565ms |
| ✅ A7.2 帮选3个 | follow_up_select | PASS | 338ms |
| ✅ A7.3 开通第一个 | follow_up_select | PASS | 342ms |

---

# Suite B: 确认状态机
Pass: 4/4

## ✅ B1: 开通第一个→取消→开第二个
undefined | 21250ms

| Step | Intent | Pass | Duration |
|------|--------|------|----------|
| ✅ B1.1 查纽约IP | query_ip_inventory | PASS | 597ms |
| ✅ B1.2 开通第一个 | follow_up_select | PASS | 336ms |
| ✅ B1.3 取消 | unknown | PASS | 19677ms |
| ✅ B1.4 开第二个 | follow_up_select | PASS | 640ms |

## ✅ B2: 确认态中插话查余额
undefined | 19129ms

| Step | Intent | Pass | Duration |
|------|--------|------|----------|
| ✅ B2.1 查美国IP | query_ip_inventory | PASS | 915ms |
| ✅ B2.2 开通第一个 | follow_up_select | PASS | 199ms |
| ✅ B2.3 插话查余额 | query_balance | PASS | 398ms |
| ✅ B2.4 取消后继续 | unknown | PASS | 17617ms |

## ✅ B3: 查询→开通→取消→再查同地区便宜的
undefined | 20103ms

| Step | Intent | Pass | Duration |
|------|--------|------|----------|
| ✅ B3.1 查东京IP | query_ip_inventory | PASS | 2154ms |
| ✅ B3.2 找质量最好的 | find_best_ip | PASS | 557ms |
| ✅ B3.3 帮我开通 | follow_up_action | PASS | 191ms |
| ✅ B3.4 取消 | unknown | PASS | 16557ms |
| ✅ B3.5 查同地区便宜的 | follow_up_refine | PASS | 644ms |

## ✅ B4: 购买确认消息格式校验
undefined | 601ms

| Step | Intent | Pass | Duration |
|------|--------|------|----------|
| ✅ B4.1 查纽约IP | query_ip_inventory | PASS | 418ms |
| ✅ B4.2 开通第一个 | follow_up_select | PASS | 183ms |

---

# Suite C: 错误恢复
Pass: 7/7

## ✅ C1: 查无结果地区→换有结果地区
undefined | 743ms

| Step | Intent | Pass | Duration |
|------|--------|------|----------|
| ✅ C1.1 查冷门地区 | query_ip_inventory | PASS | 336ms |
| ✅ C1.2 换纽约 | query_ip_inventory | PASS | 407ms |

## ✅ C2: 无上下文直接开通→引导查询
undefined | 202ms

| Step | Intent | Pass | Duration |
|------|--------|------|----------|
| ✅ C2.1 直接开通(无上下文) | purchase_static | PASS | 202ms |

## ✅ C3: 无上下文模糊命令不报错
undefined | 180ms

| Step | Intent | Pass | Duration |
|------|--------|------|----------|
| ✅ C3.1 模糊命令 | find_best_ip | PASS | 180ms |

## ✅ C4: 查询→开通→序号超出范围
undefined | 567ms

| Step | Intent | Pass | Duration |
|------|--------|------|----------|
| ✅ C4.1 查日本IP | query_ip_inventory | PASS | 389ms |
| ✅ C4.2 开通第999个 | follow_up_select | PASS | 178ms |

## ✅ C5: 权限测试-管理员可查用户
undefined | 359ms

| Step | Intent | Pass | Duration |
|------|--------|------|----------|
| ✅ C5.1 查询用户 | query_users | PASS | 359ms |

## ✅ C6: 查询余额后建议查IP
undefined | 584ms

| Step | Intent | Pass | Duration |
|------|--------|------|----------|
| ✅ C6.1 查余额 | query_balance | PASS | 213ms |
| ✅ C6.2 查纽约IP | query_ip_inventory | PASS | 371ms |

## ✅ C7: 查询→找最好→换便宜→开通(不确认)
undefined | 13141ms

| Step | Intent | Pass | Duration |
|------|--------|------|----------|
| ✅ C7.1 查美国IP | query_ip_inventory | PASS | 418ms |
| ✅ C7.2 找最好的 | find_best_ip | PASS | 11745ms |
| ✅ C7.3 换便宜的 | follow_up_refine | PASS | 711ms |
| ✅ C7.4 帮我开通(不确认) | follow_up_action | PASS | 267ms |

---

# Suite D: 语言与别名
Pass: 8/8

## ✅ D1: London→切换到东京(英→中)
undefined | 762ms

| Step | Intent | Pass | Duration |
|------|--------|------|----------|
| ✅ D1.1 查London IP | query_ip_inventory | PASS | 352ms |
| ✅ D1.2 切换到东京 | query_ip_inventory | PASS | 410ms |

## ✅ D2: 英文全链路 NY→best→purchase
undefined | 13164ms

| Step | Intent | Pass | Duration |
|------|--------|------|----------|
| ✅ D2.1 Query NY IPs | query_ip_inventory | PASS | 346ms |
| ✅ D2.2 find the best one | find_best_ip | PASS | 11761ms |
| ✅ D2.3 purchase it | follow_up_action | PASS | 1057ms |

## ✅ D3: 中英混合查询
undefined | 2218ms

| Step | Intent | Pass | Duration |
|------|--------|------|----------|
| ✅ D3.1 查London的IP | query_ip_inventory | PASS | 681ms |
| ✅ D3.2 show最便宜的 | follow_up_refine | PASS | 1537ms |

## ✅ D4: 首尔/Seoul别名解析
undefined | 341ms

| Step | Intent | Pass | Duration |
|------|--------|------|----------|
| ✅ D4.1 查Seoul IP | query_ip_inventory | PASS | 341ms |

## ✅ D5: 洛杉矶/LA/Los Angeles别名
undefined | 904ms

| Step | Intent | Pass | Duration |
|------|--------|------|----------|
| ✅ D5.1 查LA IP | query_ip_inventory | PASS | 904ms |

## ✅ D6: 地区显示格式(非英文代码)
undefined | 368ms

| Step | Intent | Pass | Duration |
|------|--------|------|----------|
| ✅ D6.1 查伦敦IP | query_ip_inventory | PASS | 368ms |

## ✅ D7: 英文follow-up上下文保持
undefined | 11560ms

| Step | Intent | Pass | Duration |
|------|--------|------|----------|
| ✅ D7.1 Query Tokyo IPs | query_ip_inventory | PASS | 721ms |
| ✅ D7.2 which has most stock | query_static_products | PASS | 10839ms |

## ✅ D8: 查Australia/澳大利亚互通
undefined | 1196ms

| Step | Intent | Pass | Duration |
|------|--------|------|----------|
| ✅ D8.1 Australia IP | query_ip_inventory | PASS | 1196ms |

---

# Suite ISO: 会话隔离
Pass: 2/2

## ✅ ISO1: 新会话不继承旧上下文
undefined | 11969ms

| Step | Intent | Pass | Duration |
|------|--------|------|----------|
| ✅ ISO1.1 旧会话查纽约 | query_ip_inventory | PASS | 432ms |
| ✅ ISO1.2 新会话-帮我开通 | purchase_static | PASS | 11537ms |

## ✅ ISO2: 切换主题后旧上下文不干扰
undefined | 2120ms

| Step | Intent | Pass | Duration |
|------|--------|------|----------|
| ✅ ISO2.1 查纽约IP | query_ip_inventory | PASS | 1412ms |
| ✅ ISO2.2 查伦敦IP(换主题) | query_ip_inventory | PASS | 359ms |
| ✅ ISO2.3 开通第一个(应指向伦敦) | follow_up_select | PASS | 349ms |

---

# Suite DIS: 指代消歧
Pass: 3/3

## ✅ DIS1: 顺序词—质量第二好的
undefined | 1244ms

| Step | Intent | Pass | Duration |
|------|--------|------|----------|
| ✅ DIS1.1 查纽约IP | query_ip_inventory | PASS | 361ms |
| ✅ DIS1.2 找质量最好的 | find_best_ip | PASS | 715ms |
| ✅ DIS1.3 第二个 | follow_up_select | PASS | 168ms |

## ✅ DIS2: "这个""那个"指代
undefined | 725ms

| Step | Intent | Pass | Duration |
|------|--------|------|----------|
| ✅ DIS2.1 查日本IP | query_ip_inventory | PASS | 541ms |
| ✅ DIS2.2 帮我开通这个 | follow_up_action | PASS | 184ms |

## ✅ DIS3: "查最近开通的IP"识别为查询非购买
undefined | 3675ms

| Step | Intent | Pass | Duration |
|------|--------|------|----------|
| ✅ DIS3.1 查最近开通的IP | query_static_orders | PASS | 3675ms |

