# Conversation Flow Test Report

**Time:** 2026-03-16T15:23:32.397Z
**Total Scenarios:** 27
**Passed:** 21
**Failed:** 6
**Pass Rate:** 77.8%
**Total Steps:** 60

---

# Suite A: 结果集延续
Pass: 5/6 (1 failed)

## ✅ A2: 查伦敦→下一页→开通第三个
undefined | 16523ms

| Step | Intent | Pass | Duration |
|------|--------|------|----------|
| ✅ A2.1 查询伦敦IP | query_ip_inventory | PASS | 8454ms |
| ✅ A2.2 下一页 | paginate_next | PASS | 4386ms |
| ✅ A2.3 开通第三个 | follow_up_select | PASS | 3683ms |

## ✅ A3: 查东京→第一个→不对换第二个
undefined | 3163ms

| Step | Intent | Pass | Duration |
|------|--------|------|----------|
| ✅ A3.1 查询东京IP | query_ip_inventory | PASS | 1466ms |
| ✅ A3.2 选第一个 | follow_up_select | PASS | 851ms |
| ✅ A3.3 换第二个 | follow_up_select | PASS | 846ms |

## ✅ A4: 查美国→库存最多的→帮我开通
undefined | 5281ms

| Step | Intent | Pass | Duration |
|------|--------|------|----------|
| ✅ A4.1 查美国IP | query_ip_inventory | PASS | 2131ms |
| ✅ A4.2 库存最多的 | follow_up_refine | PASS | 1756ms |
| ✅ A4.3 帮我开通 | follow_up_action | PASS | 1394ms |

## ❌ A5: 查纽约→找质量最好→太贵换便宜的
undefined | 5318ms

| Step | Intent | Pass | Duration |
|------|--------|------|----------|
| ✅ A5.1 查纽约IP | query_ip_inventory | PASS | 1523ms |
| ✅ A5.2 找质量最好的 | find_best_ip | PASS | 2706ms |
| ❌ A5.3 太贵换便宜的 | follow_up_refine | FAIL | 1089ms |

### Failures

**A5.3 太贵换便宜的:**
- message should match ANY of [便宜, cheapest, 推荐, IP段, 位置] (preview: 📋 共 14 个结果：

1. usa  库存: 58  售价: ¥40
2. usa  库存: 218  售价: ¥40
3. usa  库存: 58  售价: ¥42
4. usa  库存: 156  售价: ¥42
5. usa  库存: 44  售价: ¥42
6. usa  库存: 272  售价: ¥42
7. usa  库存: 249  售价: ¥44
8. usa  库存: 10)
- Preview: 📋 共 14 个结果：

1. usa  库存: 58  售价: ¥40
2. usa  库存: 218  售价: ¥40
3. usa  库存: 58  售价: ¥42
4. usa  库存: 156  售价: ¥42
5. usa  库存: 44  售价: ¥42
6. usa  库存: 272  售价: ¥42
7. usa  库存: 249  售价: ¥44
8. usa  库存: 10

## ✅ A6: 查日本→只看静态的→最便宜那个
undefined | 3315ms

| Step | Intent | Pass | Duration |
|------|--------|------|----------|
| ✅ A6.1 查日本IP | query_ip_inventory | PASS | 2474ms |
| ✅ A6.2 最便宜那个 | follow_up_recommend | PASS | 841ms |

## ✅ A7: 查纽约→帮选3个→开通第一个
undefined | 4291ms

| Step | Intent | Pass | Duration |
|------|--------|------|----------|
| ✅ A7.1 查纽约IP | query_ip_inventory | PASS | 1578ms |
| ✅ A7.2 帮选3个 | follow_up_select | PASS | 861ms |
| ✅ A7.3 开通第一个 | follow_up_select | PASS | 1852ms |

---

# Suite B: 确认状态机
Pass: 0/3 (3 failed)

## ❌ B1: 开通第一个→取消→开第二个
undefined | 32153ms

| Step | Intent | Pass | Duration |
|------|--------|------|----------|
| ✅ B1.1 查纽约IP | query_ip_inventory | PASS | 1596ms |
| ❌ B1.2 开通第一个 | follow_up_select | FAIL | 827ms |
| ✅ B1.3 取消 | unknown | PASS | 18999ms |
| ✅ B1.4 开第二个 | follow_up_select | PASS | 10731ms |

### Failures

**B1.2 开通第一个:**
- message should match ANY of [位置, 确认, Selected] (preview: 📋 您选中的 1 个产品：

1. usa  库存: 58  售价: ¥40

输入 "帮我开通" 可直接购买。)
- Preview: 📋 您选中的 1 个产品：

1. usa  库存: 58  售价: ¥40

输入 "帮我开通" 可直接购买。

## ❌ B2: 确认态中插话查余额
undefined | 25695ms

| Step | Intent | Pass | Duration |
|------|--------|------|----------|
| ✅ B2.1 查美国IP | query_ip_inventory | PASS | 12997ms |
| ❌ B2.2 开通第一个 | follow_up_select | FAIL | 4623ms |
| ✅ B2.3 插话查余额 | query_balance | PASS | 4965ms |
| ❌ B2.4 返回继续(取消) | follow_up_action | FAIL | 3110ms |

### Failures

**B2.2 开通第一个:**
- message should match ANY of [位置, 确认, Selected] (preview: 📋 您选中的 1 个产品：

1. usa  库存: 58  售价: ¥40

输入 "帮我开通" 可直接购买。)
- Preview: 📋 您选中的 1 个产品：

1. usa  库存: 58  售价: ¥40

输入 "帮我开通" 可直接购买。

**B2.4 返回继续(取消):**
- message should match ANY of [取消, 已取消, cancel, 帮助, 操作] (preview: 📦 已为您选中产品：
• 位置: 美国-纽约-皇后区
• 价格: ¥40

确认开通吗？(回复"确认"执行购买))
- Preview: 📦 已为您选中产品：
• 位置: 美国-纽约-皇后区
• 价格: ¥40

确认开通吗？(回复"确认"执行购买)

## ❌ B3: 查询→开通→取消→再查同地区便宜的
undefined | 30729ms

| Step | Intent | Pass | Duration |
|------|--------|------|----------|
| ✅ B3.1 查东京IP | query_ip_inventory | PASS | 1270ms |
| ✅ B3.2 找质量最好的 | find_best_ip | PASS | 3837ms |
| ✅ B3.3 帮我开通 | follow_up_action | PASS | 805ms |
| ✅ B3.4 取消 | unknown | PASS | 20604ms |
| ❌ B3.5 查同地区便宜的 | follow_up_refine | FAIL | 4213ms |

### Failures

**B3.5 查同地区便宜的:**
- message should match ANY of [便宜, cheapest, IP, 推荐] (preview: 📋 共 13 个结果：

1. jpn  库存: 248  售价: ¥40
2. jpn  库存: 0  售价: ¥42
3. jpn  库存: 63  售价: ¥42
4. jpn  库存: 29  售价: ¥51
5. jpn  库存: 339  售价: ¥53
6. jpn  库存: 209  售价: ¥55
7. jpn  库存: 707  售价: ¥58
8. jpn  库存: 0  )
- Preview: 📋 共 13 个结果：

1. jpn  库存: 248  售价: ¥40
2. jpn  库存: 0  售价: ¥42
3. jpn  库存: 63  售价: ¥42
4. jpn  库存: 29  售价: ¥51
5. jpn  库存: 339  售价: ¥53
6. jpn  库存: 209  售价: ¥55
7. jpn  库存: 707  售价: ¥58
8. jpn  库存: 0  

---

# Suite C: 错误恢复
Pass: 6/6

## ✅ C1: 查无结果地区→换有结果地区
undefined | 12296ms

| Step | Intent | Pass | Duration |
|------|--------|------|----------|
| ✅ C1.1 查冷门地区 | query_ip_inventory | PASS | 7000ms |
| ✅ C1.2 换纽约 | query_ip_inventory | PASS | 5296ms |

## ✅ C2: 无上下文直接开通→引导查询
undefined | 6194ms

| Step | Intent | Pass | Duration |
|------|--------|------|----------|
| ✅ C2.1 直接开通(无上下文) | purchase_static | PASS | 6194ms |

## ✅ C3: 无上下文模糊命令不报错
undefined | 4309ms

| Step | Intent | Pass | Duration |
|------|--------|------|----------|
| ✅ C3.1 模糊命令 | find_best_ip | PASS | 4309ms |

## ✅ C4: 查询→开通→序号超出范围
undefined | 11500ms

| Step | Intent | Pass | Duration |
|------|--------|------|----------|
| ✅ C4.1 查日本IP | query_ip_inventory | PASS | 4706ms |
| ✅ C4.2 开通第999个 | follow_up_select | PASS | 6794ms |

## ✅ C5: 权限测试-管理员可查用户
undefined | 5401ms

| Step | Intent | Pass | Duration |
|------|--------|------|----------|
| ✅ C5.1 查询用户 | query_users | PASS | 5401ms |

## ✅ C6: 查询余额后建议查IP
undefined | 9712ms

| Step | Intent | Pass | Duration |
|------|--------|------|----------|
| ✅ C6.1 查余额 | query_balance | PASS | 4709ms |
| ✅ C6.2 查纽约IP | query_ip_inventory | PASS | 5003ms |

---

# Suite D: 语言与别名
Pass: 6/8 (2 failed)

## ✅ D1: London→切换到东京(英→中)
undefined | 12989ms

| Step | Intent | Pass | Duration |
|------|--------|------|----------|
| ✅ D1.1 查London IP | query_ip_inventory | PASS | 6160ms |
| ✅ D1.2 切换到东京 | query_ip_inventory | PASS | 6829ms |

## ✅ D2: 英文全链路 NY→best→purchase
undefined | 24965ms

| Step | Intent | Pass | Duration |
|------|--------|------|----------|
| ✅ D2.1 Query NY IPs | query_ip_inventory | PASS | 5148ms |
| ✅ D2.2 find the best one | find_best_ip | PASS | 14764ms |
| ✅ D2.3 purchase it | follow_up_action | PASS | 5053ms |

## ❌ D3: 中英混合查询
undefined | 10866ms

| Step | Intent | Pass | Duration |
|------|--------|------|----------|
| ✅ D3.1 查London的IP | query_ip_inventory | PASS | 5986ms |
| ❌ D3.2 show最便宜的 | follow_up_refine | FAIL | 4880ms |

### Failures

**D3.2 show最便宜的:**
- message should match ANY of [便宜, cheapest, 推荐, IP] (preview: 📋 共 7 个结果：

1. gbr  库存: 0  售价: ¥42
2. gbr  库存: 383  售价: ¥42
3. gbr  库存: 2,775  售价: ¥42
4. gbr  库存: 370  售价: ¥42
5. gbr  库存: 169  售价: ¥48
6. gbr  库存: 0  售价: ¥64
7. gbr  库存: 1,703  售价: ¥65)
- Preview: 📋 共 7 个结果：

1. gbr  库存: 0  售价: ¥42
2. gbr  库存: 383  售价: ¥42
3. gbr  库存: 2,775  售价: ¥42
4. gbr  库存: 370  售价: ¥42
5. gbr  库存: 169  售价: ¥48
6. gbr  库存: 0  售价: ¥64
7. gbr  库存: 1,703  售价: ¥65

## ✅ D4: 首尔/Seoul别名解析
undefined | 12251ms

| Step | Intent | Pass | Duration |
|------|--------|------|----------|
| ✅ D4.1 查Seoul IP | query_ip_inventory | PASS | 12251ms |

## ✅ D5: 洛杉矶/LA/Los Angeles别名
undefined | 5120ms

| Step | Intent | Pass | Duration |
|------|--------|------|----------|
| ✅ D5.1 查LA IP | query_ip_inventory | PASS | 5120ms |

## ✅ D6: 地区显示格式(非英文代码)
undefined | 4090ms

| Step | Intent | Pass | Duration |
|------|--------|------|----------|
| ✅ D6.1 查伦敦IP | query_ip_inventory | PASS | 4090ms |

## ❌ D7: 英文follow-up上下文保持
undefined | 26312ms

| Step | Intent | Pass | Duration |
|------|--------|------|----------|
| ✅ D7.1 Query Tokyo IPs | query_ip_inventory | PASS | 10724ms |
| ❌ D7.2 which has most stock | query_static_products | FAIL | 15588ms |

### Failures

**D7.2 which has most stock:**
- message should match ANY of [stock, 库存, most] (preview: 📦 Static products in 东京 (20 IP ranges):

日本-JPN000-东京 [Pure Static 1]
Stock: 0; Cost: ¥12; Price: ¥42

日本-JPN000-东京 [Pure Static 2] ⚠️停用
Stock: 229; Cost: ¥12; Price: ¥65

日本-JPN000-横滨 [Pure Static 3)
- Preview: 📦 Static products in 东京 (20 IP ranges):

日本-JPN000-东京 [Pure Static 1]
Stock: 0; Cost: ¥12; Price: ¥42

日本-JPN000-东京 [Pure Static 2] ⚠️停用
Stock: 229; Cost: ¥12; Price: ¥65

日本-JPN000-横滨 [Pure Static 3

## ✅ D8: 查Australia/澳大利亚互通
undefined | 6681ms

| Step | Intent | Pass | Duration |
|------|--------|------|----------|
| ✅ D8.1 Australia IP | query_ip_inventory | PASS | 6681ms |

---

# Suite ISO: 会话隔离
Pass: 1/1

## ✅ ISO1: 新会话不继承旧上下文
undefined | 38147ms

| Step | Intent | Pass | Duration |
|------|--------|------|----------|
| ✅ ISO1.1 旧会话查纽约 | query_ip_inventory | PASS | 5975ms |
| ✅ ISO1.2 新会话-帮我开通 | unknown | PASS | 32172ms |

---

# Suite DIS: 指代消歧
Pass: 3/3

## ✅ DIS1: 顺序词—质量第二好的
undefined | 14598ms

| Step | Intent | Pass | Duration |
|------|--------|------|----------|
| ✅ DIS1.1 查纽约IP | query_ip_inventory | PASS | 5211ms |
| ✅ DIS1.2 找质量最好的 | find_best_ip | PASS | 4665ms |
| ✅ DIS1.3 第二个 | follow_up_select | PASS | 4722ms |

## ✅ DIS2: "这个""那个"指代
undefined | 11355ms

| Step | Intent | Pass | Duration |
|------|--------|------|----------|
| ✅ DIS2.1 查日本IP | query_ip_inventory | PASS | 5323ms |
| ✅ DIS2.2 帮我开通这个 | follow_up_action | PASS | 6032ms |

## ✅ DIS3: "查最近开通的IP"识别为查询非购买
undefined | 11812ms

| Step | Intent | Pass | Duration |
|------|--------|------|----------|
| ✅ DIS3.1 查最近开通的IP | query_static_orders | PASS | 11812ms |

