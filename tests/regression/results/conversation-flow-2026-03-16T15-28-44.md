# Conversation Flow Test Report

**Time:** 2026-03-16T15:28:44.495Z
**Total Scenarios:** 31
**Passed:** 29
**Failed:** 2
**Pass Rate:** 93.5%
**Total Steps:** 72

---

# Suite A: 结果集延续
Pass: 7/7

## ✅ A1: 查纽约→最便宜→帮我开通(取消)
undefined | 4027ms

| Step | Intent | Pass | Duration |
|------|--------|------|----------|
| ✅ A1.1 查询纽约IP | query_ip_inventory | PASS | 2980ms |
| ✅ A1.2 找最便宜的 | follow_up_recommend | PASS | 726ms |
| ✅ A1.3 帮我开通(不确认) | follow_up_action | PASS | 321ms |

## ✅ A2: 查伦敦→下一页→开通第三个
undefined | 1289ms

| Step | Intent | Pass | Duration |
|------|--------|------|----------|
| ✅ A2.1 查询伦敦IP | query_ip_inventory | PASS | 776ms |
| ✅ A2.2 下一页 | paginate_next | PASS | 325ms |
| ✅ A2.3 开通第三个 | follow_up_select | PASS | 188ms |

## ✅ A3: 查东京→第一个→不对换第二个
undefined | 1143ms

| Step | Intent | Pass | Duration |
|------|--------|------|----------|
| ✅ A3.1 查询东京IP | query_ip_inventory | PASS | 587ms |
| ✅ A3.2 选第一个 | follow_up_select | PASS | 215ms |
| ✅ A3.3 换第二个 | follow_up_select | PASS | 341ms |

## ✅ A4: 查美国→库存最多的→帮我开通
undefined | 2130ms

| Step | Intent | Pass | Duration |
|------|--------|------|----------|
| ✅ A4.1 查美国IP | query_ip_inventory | PASS | 633ms |
| ✅ A4.2 库存最多的 | follow_up_refine | PASS | 916ms |
| ✅ A4.3 帮我开通 | follow_up_action | PASS | 581ms |

## ✅ A5: 查纽约→找质量最好→太贵换便宜的
undefined | 1819ms

| Step | Intent | Pass | Duration |
|------|--------|------|----------|
| ✅ A5.1 查纽约IP | query_ip_inventory | PASS | 540ms |
| ✅ A5.2 找质量最好的 | find_best_ip | PASS | 556ms |
| ✅ A5.3 太贵换便宜的 | follow_up_refine | PASS | 723ms |

## ✅ A6: 查日本→只看静态的→最便宜那个
undefined | 741ms

| Step | Intent | Pass | Duration |
|------|--------|------|----------|
| ✅ A6.1 查日本IP | query_ip_inventory | PASS | 409ms |
| ✅ A6.2 最便宜那个 | follow_up_recommend | PASS | 332ms |

## ✅ A7: 查纽约→帮选3个→开通第一个
undefined | 1150ms

| Step | Intent | Pass | Duration |
|------|--------|------|----------|
| ✅ A7.1 查纽约IP | query_ip_inventory | PASS | 558ms |
| ✅ A7.2 帮选3个 | follow_up_select | PASS | 362ms |
| ✅ A7.3 开通第一个 | follow_up_select | PASS | 230ms |

---

# Suite B: 确认状态机
Pass: 4/4

## ✅ B1: 开通第一个→取消→开第二个
undefined | 19969ms

| Step | Intent | Pass | Duration |
|------|--------|------|----------|
| ✅ B1.1 查纽约IP | query_ip_inventory | PASS | 556ms |
| ✅ B1.2 开通第一个 | follow_up_select | PASS | 206ms |
| ✅ B1.3 取消 | unknown | PASS | 18559ms |
| ✅ B1.4 开第二个 | follow_up_select | PASS | 648ms |

## ✅ B2: 确认态中插话查余额
undefined | 19086ms

| Step | Intent | Pass | Duration |
|------|--------|------|----------|
| ✅ B2.1 查美国IP | query_ip_inventory | PASS | 526ms |
| ✅ B2.2 开通第一个 | follow_up_select | PASS | 186ms |
| ✅ B2.3 插话查余额 | query_balance | PASS | 371ms |
| ✅ B2.4 取消后继续 | unknown | PASS | 18003ms |

## ✅ B3: 查询→开通→取消→再查同地区便宜的
undefined | 21991ms

| Step | Intent | Pass | Duration |
|------|--------|------|----------|
| ✅ B3.1 查东京IP | query_ip_inventory | PASS | 887ms |
| ✅ B3.2 找质量最好的 | find_best_ip | PASS | 580ms |
| ✅ B3.3 帮我开通 | follow_up_action | PASS | 273ms |
| ✅ B3.4 取消 | unknown | PASS | 19594ms |
| ✅ B3.5 查同地区便宜的 | follow_up_refine | PASS | 657ms |

## ✅ B4: 购买确认消息格式校验
undefined | 663ms

| Step | Intent | Pass | Duration |
|------|--------|------|----------|
| ✅ B4.1 查纽约IP | query_ip_inventory | PASS | 468ms |
| ✅ B4.2 开通第一个 | follow_up_select | PASS | 195ms |

---

# Suite C: 错误恢复
Pass: 6/7 (1 failed)

## ✅ C1: 查无结果地区→换有结果地区
undefined | 728ms

| Step | Intent | Pass | Duration |
|------|--------|------|----------|
| ✅ C1.1 查冷门地区 | query_ip_inventory | PASS | 354ms |
| ✅ C1.2 换纽约 | query_ip_inventory | PASS | 374ms |

## ✅ C2: 无上下文直接开通→引导查询
undefined | 202ms

| Step | Intent | Pass | Duration |
|------|--------|------|----------|
| ✅ C2.1 直接开通(无上下文) | purchase_static | PASS | 202ms |

## ✅ C3: 无上下文模糊命令不报错
undefined | 200ms

| Step | Intent | Pass | Duration |
|------|--------|------|----------|
| ✅ C3.1 模糊命令 | find_best_ip | PASS | 200ms |

## ✅ C4: 查询→开通→序号超出范围
undefined | 559ms

| Step | Intent | Pass | Duration |
|------|--------|------|----------|
| ✅ C4.1 查日本IP | query_ip_inventory | PASS | 381ms |
| ✅ C4.2 开通第999个 | follow_up_select | PASS | 178ms |

## ✅ C5: 权限测试-管理员可查用户
undefined | 369ms

| Step | Intent | Pass | Duration |
|------|--------|------|----------|
| ✅ C5.1 查询用户 | query_users | PASS | 369ms |

## ✅ C6: 查询余额后建议查IP
undefined | 953ms

| Step | Intent | Pass | Duration |
|------|--------|------|----------|
| ✅ C6.1 查余额 | query_balance | PASS | 522ms |
| ✅ C6.2 查纽约IP | query_ip_inventory | PASS | 431ms |

## ❌ C7: 查询→找最好→换便宜→开通(不确认)
undefined | 13655ms

| Step | Intent | Pass | Duration |
|------|--------|------|----------|
| ✅ C7.1 查美国IP | query_ip_inventory | PASS | 545ms |
| ✅ C7.2 找最好的 | find_best_ip | PASS | 11082ms |
| ❌ C7.3 换便宜的 | follow_up_refine | FAIL | 1825ms |
| ✅ C7.4 帮我开通(不确认) | follow_up_action | PASS | 203ms |

### Failures

**C7.3 换便宜的:**
- message should match ANY of [便宜, cheapest, IP] (preview: 📋 共 20 个结果：

1. usa  库存: 902  售价: ¥35.5
2. usa  库存: 166  售价: ¥35.5
3. usa  库存: 50  售价: ¥35.5
4. usa  库存: 1,517  售价: ¥36
5. usa  库存: 81  售价: ¥40
6. usa  库存: 58  售价: ¥40
7. usa  库存: 803  售价: ¥40
8. usa)
- Preview: 📋 共 20 个结果：

1. usa  库存: 902  售价: ¥35.5
2. usa  库存: 166  售价: ¥35.5
3. usa  库存: 50  售价: ¥35.5
4. usa  库存: 1,517  售价: ¥36
5. usa  库存: 81  售价: ¥40
6. usa  库存: 58  售价: ¥40
7. usa  库存: 803  售价: ¥40
8. usa

---

# Suite D: 语言与别名
Pass: 8/8

## ✅ D1: London→切换到东京(英→中)
undefined | 924ms

| Step | Intent | Pass | Duration |
|------|--------|------|----------|
| ✅ D1.1 查London IP | query_ip_inventory | PASS | 565ms |
| ✅ D1.2 切换到东京 | query_ip_inventory | PASS | 359ms |

## ✅ D2: 英文全链路 NY→best→purchase
undefined | 14622ms

| Step | Intent | Pass | Duration |
|------|--------|------|----------|
| ✅ D2.1 Query NY IPs | query_ip_inventory | PASS | 671ms |
| ✅ D2.2 find the best one | find_best_ip | PASS | 13372ms |
| ✅ D2.3 purchase it | follow_up_action | PASS | 579ms |

## ✅ D3: 中英混合查询
undefined | 716ms

| Step | Intent | Pass | Duration |
|------|--------|------|----------|
| ✅ D3.1 查London的IP | query_ip_inventory | PASS | 373ms |
| ✅ D3.2 show最便宜的 | follow_up_refine | PASS | 343ms |

## ✅ D4: 首尔/Seoul别名解析
undefined | 337ms

| Step | Intent | Pass | Duration |
|------|--------|------|----------|
| ✅ D4.1 查Seoul IP | query_ip_inventory | PASS | 337ms |

## ✅ D5: 洛杉矶/LA/Los Angeles别名
undefined | 476ms

| Step | Intent | Pass | Duration |
|------|--------|------|----------|
| ✅ D5.1 查LA IP | query_ip_inventory | PASS | 476ms |

## ✅ D6: 地区显示格式(非英文代码)
undefined | 407ms

| Step | Intent | Pass | Duration |
|------|--------|------|----------|
| ✅ D6.1 查伦敦IP | query_ip_inventory | PASS | 407ms |

## ✅ D7: 英文follow-up上下文保持
undefined | 11474ms

| Step | Intent | Pass | Duration |
|------|--------|------|----------|
| ✅ D7.1 Query Tokyo IPs | query_ip_inventory | PASS | 348ms |
| ✅ D7.2 which has most stock | query_static_products | PASS | 11126ms |

## ✅ D8: 查Australia/澳大利亚互通
undefined | 1246ms

| Step | Intent | Pass | Duration |
|------|--------|------|----------|
| ✅ D8.1 Australia IP | query_ip_inventory | PASS | 1246ms |

---

# Suite ISO: 会话隔离
Pass: 1/2 (1 failed)

## ✅ ISO1: 新会话不继承旧上下文
undefined | 27678ms

| Step | Intent | Pass | Duration |
|------|--------|------|----------|
| ✅ ISO1.1 旧会话查纽约 | query_ip_inventory | PASS | 417ms |
| ✅ ISO1.2 新会话-帮我开通 | unknown | PASS | 27261ms |

## ❌ ISO2: 切换主题后旧上下文不干扰
undefined | 2687ms

| Step | Intent | Pass | Duration |
|------|--------|------|----------|
| ✅ ISO2.1 查纽约IP | query_ip_inventory | PASS | 1490ms |
| ✅ ISO2.2 查伦敦IP(换主题) | query_ip_inventory | PASS | 853ms |
| ❌ ISO2.3 开通第一个(应指向伦敦) | follow_up_select | FAIL | 344ms |

### Failures

**ISO2.3 开通第一个(应指向伦敦):**
- message should match ANY of [英国, 伦敦, London, UK, 位置, Location] (preview: 📋 您选中的 1 个产品：

1. gbr  库存: 0  售价: ¥42

输入 "帮我开通" 可直接购买。)
- Preview: 📋 您选中的 1 个产品：

1. gbr  库存: 0  售价: ¥42

输入 "帮我开通" 可直接购买。

---

# Suite DIS: 指代消歧
Pass: 3/3

## ✅ DIS1: 顺序词—质量第二好的
undefined | 1566ms

| Step | Intent | Pass | Duration |
|------|--------|------|----------|
| ✅ DIS1.1 查纽约IP | query_ip_inventory | PASS | 541ms |
| ✅ DIS1.2 找质量最好的 | find_best_ip | PASS | 690ms |
| ✅ DIS1.3 第二个 | follow_up_select | PASS | 335ms |

## ✅ DIS2: "这个""那个"指代
undefined | 944ms

| Step | Intent | Pass | Duration |
|------|--------|------|----------|
| ✅ DIS2.1 查日本IP | query_ip_inventory | PASS | 608ms |
| ✅ DIS2.2 帮我开通这个 | follow_up_action | PASS | 336ms |

## ✅ DIS3: "查最近开通的IP"识别为查询非购买
undefined | 3683ms

| Step | Intent | Pass | Duration |
|------|--------|------|----------|
| ✅ DIS3.1 查最近开通的IP | query_static_orders | PASS | 3683ms |

