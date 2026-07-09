# Dynamic Proxy Conversation Flow Test Report

**Time:** 2026-03-17T13:04:15.365Z
**Scenarios:** 49
**Steps:** 96
**Passed:** 49
**Failed:** 0
**Perf Warnings:** 0
**Pass Rate:** 100.0%

---

# Suite A: 结果集延续
Pass: 5/5

## ✅ A1: 查询动态资源→提取一个
查询资源后follow-up提取 | 8256ms

| Step | Intent | Pass | ms | Perf |
|------|--------|------|----|------|
| ✅ A1.1 查询动态资源 | query_dynamic_resource | PASS | 6607 | ✓ |
| ✅ A1.2 提取一个 | extract_dynamic | PASS | 1648 | ✓ |

## ✅ A2: 查动态资源→提取5个美国的
查询后指定国家和数量提取 | 7275ms

| Step | Intent | Pass | ms | Perf |
|------|--------|------|----|------|
| ✅ A2.1 查动态资源 | query_dynamic_resource | PASS | 5671 | ✓ |
| ✅ A2.2 提取5个美国的 | extract_dynamic | PASS | 1603 | ✓ |

## ✅ A3: 提取美国动态→再来3个
提取后继续追加提取 | 1606ms

| Step | Intent | Pass | ms | Perf |
|------|--------|------|----|------|
| ✅ A3.1 提取一个美国动态 | extract_dynamic | PASS | 1215 | ✓ |
| ✅ A3.2 再来3个 | refine_search_results | PASS | 391 | ✓ |

## ✅ A4: 查动态订单→再提取同类型
查订单后继续提取 | 1887ms

| Step | Intent | Pass | ms | Perf |
|------|--------|------|----|------|
| ✅ A4.1 查动态订单 | query_dynamic_orders | PASS | 660 | ✓ |
| ✅ A4.2 提取一个动态代理 | extract_dynamic | PASS | 1226 | ✓ |

## ✅ A5: 提取一个→换成日本
提取后更换国家(应命中动态refine) | 1968ms

| Step | Intent | Pass | ms | Perf |
|------|--------|------|----|------|
| ✅ A5.1 提取一个动态代理 | extract_dynamic | PASS | 921 | ✓ |
| ✅ A5.2 换成日本 | extract_dynamic | PASS | 1047 | ✓ |

---

# Suite B: 确认状态机
Pass: 7/7

## ✅ B1: 购买动态→管理员受限
管理员不能直接开通动态代理 | 924ms

| Step | Intent | Pass | ms | Perf |
|------|--------|------|----|------|
| ✅ B1.1 购买10GB动态代理 | purchase_dynamic | PASS | 425 | ✓ |
| ✅ B1.2 确认 | purchase_dynamic | PASS | 499 | ✓ |

## ✅ B2: 购买动态→取消
购买确认后取消 | 809ms

| Step | Intent | Pass | ms | Perf |
|------|--------|------|----|------|
| ✅ B2.1 购买5GB动态代理 | purchase_dynamic | PASS | 397 | ✓ |
| ✅ B2.2 取消 | cancel_confirmed | PASS | 412 | ✓ |

## ✅ B3: 购买动态→取消→改成5GB
取消后改参数重新购买 | 1243ms

| Step | Intent | Pass | ms | Perf |
|------|--------|------|----|------|
| ✅ B3.1 购买10GB动态代理 | purchase_dynamic | PASS | 419 | ✓ |
| ✅ B3.2 取消 | cancel_confirmed | PASS | 411 | ✓ |
| ✅ B3.3 改成5GB | purchase_dynamic | PASS | 413 | ✓ |

## ✅ B4: 购买动态→插话查余额→取消
确认态中插话查余额 | 1313ms

| Step | Intent | Pass | ms | Perf |
|------|--------|------|----|------|
| ✅ B4.1 购买10GB动态代理 | purchase_dynamic | PASS | 430 | ✓ |
| ✅ B4.2 查余额 | query_balance | PASS | 473 | ✓ |
| ✅ B4.3 取消 | cancel_confirmed | PASS | 410 | ✓ |

## ✅ B5: 提取不需确认(直接执行)
extract_dynamic不走确认流程 | 940ms

| Step | Intent | Pass | ms | Perf |
|------|--------|------|----|------|
| ✅ B5.1 提取一个动态代理 | extract_dynamic | PASS | 940 | ✓ |

## ✅ B6: 购买与提取意图不混淆
"购买"→purchase, "提取"→extract | 1839ms

| Step | Intent | Pass | ms | Perf |
|------|--------|------|----|------|
| ✅ B6.1 购买动态代理 | purchase_dynamic | PASS | 407 | ✓ |
| ✅ B6.2 取消购买 | cancel_confirmed | PASS | 482 | ✓ |
| ✅ B6.3 提取动态代理 | extract_dynamic | PASS | 949 | ✓ |

## ✅ B7: 确认态取消命中状态机
"取消"走状态机,不走fallback | 911ms

| Step | Intent | Pass | ms | Perf |
|------|--------|------|----|------|
| ✅ B7.1 购买3GB动态代理 | purchase_dynamic | PASS | 511 | ✓ |
| ✅ B7.2 取消(状态机) | cancel_confirmed | PASS | 400 | ✓ |

---

# Suite C: 参数改写
Pass: 9/9

## ✅ C1: 提取1个→改成5个
数量改写 | 1827ms

| Step | Intent | Pass | ms | Perf |
|------|--------|------|----|------|
| ✅ C1.1 提取一个动态代理 | extract_dynamic | PASS | 900 | ✓ |
| ✅ C1.2 改成5个 | extract_dynamic | PASS | 927 | ✓ |

## ✅ C2: 提取5个美国→改成英国
国家改写(不能落到inventory) | 1918ms

| Step | Intent | Pass | ms | Perf |
|------|--------|------|----|------|
| ✅ C2.1 提取5个美国动态代理 | extract_dynamic | PASS | 998 | ✓ |
| ✅ C2.2 改成英国 | extract_dynamic | PASS | 920 | ✓ |

## ✅ C3: 提取socks5→改成http
协议改写 | 1580ms

| Step | Intent | Pass | ms | Perf |
|------|--------|------|----|------|
| ✅ C3.1 提取socks5动态代理 | extract_dynamic | PASS | 972 | ✓ |
| ✅ C3.2 改成http | extract_dynamic | PASS | 608 | ✓ |

## ✅ C4: 提取→改成10分钟有效
有效期改写 | 1938ms

| Step | Intent | Pass | ms | Perf |
|------|--------|------|----|------|
| ✅ C4.1 提取一个动态代理 | extract_dynamic | PASS | 995 | ✓ |
| ✅ C4.2 改成10分钟有效 | extract_dynamic | PASS | 943 | ✓ |

## ✅ C5: 提取美国→指定洛杉矶
国家→城市细化 | 2027ms

| Step | Intent | Pass | ms | Perf |
|------|--------|------|----|------|
| ✅ C5.1 提取美国动态代理 | extract_dynamic | PASS | 948 | ✓ |
| ✅ C5.2 指定洛杉矶 | extract_dynamic | PASS | 1079 | ✓ |

## ✅ C6: 提取日本→改成全球随机
取消国家指定 | 2051ms

| Step | Intent | Pass | ms | Perf |
|------|--------|------|----|------|
| ✅ C6.1 提取日本动态代理 | extract_dynamic | PASS | 930 | ✓ |
| ✅ C6.2 不指定国家 | extract_dynamic | PASS | 1121 | ✓ |

## ✅ C7: 提取→改成API提取
提取方式改写 | 2027ms

| Step | Intent | Pass | ms | Perf |
|------|--------|------|----|------|
| ✅ C7.1 提取一个动态代理 | extract_dynamic | PASS | 952 | ✓ |
| ✅ C7.2 用API提取 | extract_dynamic | PASS | 1075 | ✓ |

## ✅ C8: 提取http→改回socks5
协议回退 | 1271ms

| Step | Intent | Pass | ms | Perf |
|------|--------|------|----|------|
| ✅ C8.1 提取http动态代理 | extract_dynamic | PASS | 591 | ✓ |
| ✅ C8.2 改回socks5 | extract_dynamic | PASS | 680 | ✓ |

## ✅ C9: 改http只改协议不改国家数量
参数隔离: 改一个参数不污染其他 | 1345ms

| Step | Intent | Pass | ms | Perf |
|------|--------|------|----|------|
| ✅ C9.1 提取5个美国socks5 | extract_dynamic | PASS | 717 | ✓ |
| ✅ C9.2 改成http | extract_dynamic | PASS | 628 | ✓ |

---

# Suite D: 错误恢复
Pass: 7/7

## ✅ D1: 提取0个→改成1个
数量非法后恢复 | 1892ms

| Step | Intent | Pass | ms | Perf |
|------|--------|------|----|------|
| ✅ D1.1 提取0个动态代理 | extract_dynamic | PASS | 909 | ✓ |
| ✅ D1.2 改成1个 | extract_dynamic | PASS | 983 | ✓ |

## ✅ D2: 无上下文"换成日本"
无上下文参数改写不报错 | 756ms

| Step | Intent | Pass | ms | Perf |
|------|--------|------|----|------|
| ✅ D2.1 无上下文换日本 | query_ip_inventory | PASS | 756 | ✓ |

## ✅ D3: 查询无资源→友好提示
无动态资源时友好提示 | 6533ms

| Step | Intent | Pass | ms | Perf |
|------|--------|------|----|------|
| ✅ D3.1 查动态资源 | query_dynamic_resource | PASS | 6533 | ✓ |

## ✅ D4: 提取→失败→换参数重试
提取失败后修改参数继续 | 2509ms

| Step | Intent | Pass | ms | Perf |
|------|--------|------|----|------|
| ✅ D4.1 提取一个动态代理 | extract_dynamic | PASS | 1554 | ✓ |
| ✅ D4.2 换成美国 | extract_dynamic | PASS | 954 | ✓ |

## ✅ D5: 静态后提取动态不误继承
静态查询后直接提取不串上下文 | 1819ms

| Step | Intent | Pass | ms | Perf |
|------|--------|------|----|------|
| ✅ D5.1 查纽约静态IP | query_ip_inventory | PASS | 765 | ✓ |
| ✅ D5.2 提取动态代理 | extract_dynamic | PASS | 1054 | ✓ |

## ✅ D6: 协议非法输入
输入错误协议名不崩溃 | 646ms

| Step | Intent | Pass | ms | Perf |
|------|--------|------|----|------|
| ✅ D6.1 提取https5代理 | extract_dynamic | PASS | 646 | ✓ |

## ✅ D7: 国家城市冲突
日本+洛杉矶冲突不崩溃 | 958ms

| Step | Intent | Pass | ms | Perf |
|------|--------|------|----|------|
| ✅ D7.1 冲突参数提取 | extract_dynamic | PASS | 958 | ✓ |

---

# Suite E: 语言与国家码
Pass: 7/7

## ✅ E1: 提取美国→意图含US
中文"美国"→ISO2 US | 1051ms

| Step | Intent | Pass | ms | Perf |
|------|--------|------|----|------|
| ✅ E1.1 提取美国动态代理 | extract_dynamic | PASS | 1051 | ✓ |

## ✅ E2: 提取英国→GB
中文"英国"→ISO2 GB | 996ms

| Step | Intent | Pass | ms | Perf |
|------|--------|------|----|------|
| ✅ E2.1 提取英国动态代理 | extract_dynamic | PASS | 996 | ✓ |

## ✅ E3: 提取日本→JP
中文"日本"→ISO2 JP | 929ms

| Step | Intent | Pass | ms | Perf |
|------|--------|------|----|------|
| ✅ E3.1 提取日本动态代理 | extract_dynamic | PASS | 929 | ✓ |

## ✅ E4: extract US dynamic proxies
英文提取 | 937ms

| Step | Intent | Pass | ms | Perf |
|------|--------|------|----|------|
| ✅ E4.1 英文提取 | extract_dynamic | PASS | 937 | ✓ |

## ✅ E5: 英文→改socks5→中英混合
英文提取后中文改参数 | 1874ms

| Step | Intent | Pass | ms | Perf |
|------|--------|------|----|------|
| ✅ E5.1 英文提取日本 | extract_dynamic | PASS | 947 | ✓ |
| ✅ E5.2 改成socks5 | extract_dynamic | PASS | 927 | ✓ |

## ✅ E6: 提取UK→改成Japan
英文国家缩写切换 | 1447ms

| Step | Intent | Pass | ms | Perf |
|------|--------|------|----|------|
| ✅ E6.1 提取UK动态代理 | extract_dynamic | PASS | 717 | ✓ |
| ✅ E6.2 改成Japan | extract_dynamic | PASS | 730 | ✓ |

## ✅ E7: 中英混合复合参数
中英混合输入 | 1285ms

| Step | Intent | Pass | ms | Perf |
|------|--------|------|----|------|
| ✅ E7.1 混合提取 | extract_dynamic | PASS | 1285 | ✓ |

---

# Suite F: 跨模块链路
Pass: 5/5

## ✅ F1: 查资源→提取→查订单
资源→提取→订单完整链路 | 7689ms

| Step | Intent | Pass | ms | Perf |
|------|--------|------|----|------|
| ✅ F1.1 查动态资源 | query_dynamic_resource | PASS | 5367 | ✓ |
| ✅ F1.2 提取一个 | extract_dynamic | PASS | 1676 | ✓ |
| ✅ F1.3 查动态订单 | query_dynamic_orders | PASS | 646 | ✓ |

## ✅ F2: 查余额→购买→取消
余额→购买(确认态)→取消 | 1227ms

| Step | Intent | Pass | ms | Perf |
|------|--------|------|----|------|
| ✅ F2.1 查余额 | query_balance | PASS | 434 | ✓ |
| ✅ F2.2 购买动态代理 | purchase_dynamic | PASS | 407 | ✓ |
| ✅ F2.3 取消 | cancel_confirmed | PASS | 386 | ✓ |

## ✅ F3: 提取美国→查消费
提取后查消费统计 | 4512ms

| Step | Intent | Pass | ms | Perf |
|------|--------|------|----|------|
| ✅ F3.1 提取美国动态代理 | extract_dynamic | PASS | 957 | ✓ |
| ✅ F3.2 查今天消费 | query_today_orders | PASS | 3555 | ✓ |

## ✅ F4: 帮助→资源→提取
帮助→资源查询→提取链路 | 7318ms

| Step | Intent | Pass | ms | Perf |
|------|--------|------|----|------|
| ✅ F4.1 帮助 | show_help | PASS | 438 | ✓ |
| ✅ F4.2 查动态资源 | query_dynamic_resource | PASS | 5296 | ✓ |
| ✅ F4.3 提取一个 | extract_dynamic | PASS | 1584 | ✓ |

## ✅ F5: 动态→静态不污染
动态上下文不污染静态查询 | 2132ms

| Step | Intent | Pass | ms | Perf |
|------|--------|------|----|------|
| ✅ F5.1 提取美国动态代理 | extract_dynamic | PASS | 959 | ✓ |
| ✅ F5.2 查纽约静态IP | query_ip_inventory | PASS | 752 | ✓ |
| ✅ F5.3 开通第一个(指向静态) | follow_up_action | PASS | 421 | ✓ |

---

# Suite G: 跨域隔离
Pass: 3/3

## ✅ G1: 静态→动态→换日本应改动态
查静态后提取动态→"换成日本"改的是动态不是跳回静态 | 2596ms

| Step | Intent | Pass | ms | Perf |
|------|--------|------|----|------|
| ✅ G1.1 查纽约静态IP | query_ip_inventory | PASS | 730 | ✓ |
| ✅ G1.2 提取美国动态代理 | extract_dynamic | PASS | 926 | ✓ |
| ✅ G1.3 换成日本(应继续动态) | extract_dynamic | PASS | 940 | ✓ |

## ✅ G2: 动态→静态→再来一个不继承动态
提取动态后查静态→"再来一个"不再继承动态提取 | 6901ms

| Step | Intent | Pass | ms | Perf |
|------|--------|------|----|------|
| ✅ G2.1 提取美国动态代理 | extract_dynamic | PASS | 919 | ✓ |
| ✅ G2.2 查静态IP | query_ip_inventory | PASS | 814 | ✓ |
| ✅ G2.3 再来一个(理想不继承动态) | query_ip_inventory | PASS | 5168 | ✓ |

## ✅ G3: 购买动态→查静态→取消
购买确认态→插话查静态→取消应取消购买确认 | 2276ms

| Step | Intent | Pass | ms | Perf |
|------|--------|------|----|------|
| ✅ G3.1 购买5GB动态代理 | purchase_dynamic | PASS | 1018 | ✓ |
| ✅ G3.2 查静态IP | query_ip_inventory | PASS | 837 | ✓ |
| ✅ G3.3 取消(购买确认) | cancel_confirmed | PASS | 421 | ✓ |

---

# Suite H: 英文口语
Pass: 6/6

## ✅ H1: give me 5 US proxies
口语 give me → extract_dynamic | 1014ms

| Step | Intent | Pass | ms | Perf |
|------|--------|------|----|------|
| ✅ H1.1 give me | extract_dynamic | PASS | 1014 | ✓ |

## ✅ H2: get me 3 japan proxies
口语 get me | 1022ms

| Step | Intent | Pass | ms | Perf |
|------|--------|------|----|------|
| ✅ H2.1 get me | extract_dynamic | PASS | 1022 | ✓ |

## ✅ H3: make it http
口语 make it → 参数改写 | 1950ms

| Step | Intent | Pass | ms | Perf |
|------|--------|------|----|------|
| ✅ H3.1 提取一个美国动态代理 | extract_dynamic | PASS | 1024 | ✓ |
| ✅ H3.2 make it http | extract_dynamic | PASS | 926 | ✓ |

## ✅ H4: change it to socks5
口语 change it to | 1429ms

| Step | Intent | Pass | ms | Perf |
|------|--------|------|----|------|
| ✅ H4.1 提取http动态代理 | extract_dynamic | PASS | 715 | ✓ |
| ✅ H4.2 change to socks5 | extract_dynamic | PASS | 714 | ✓ |

## ✅ H5: switch to germany
口语 switch to country | 2047ms

| Step | Intent | Pass | ms | Perf |
|------|--------|------|----|------|
| ✅ H5.1 提取美国动态代理 | extract_dynamic | PASS | 970 | ✓ |
| ✅ H5.2 switch to germany | extract_dynamic | PASS | 1077 | ✓ |

## ✅ H6: use api mode
口语 use api | 2026ms

| Step | Intent | Pass | ms | Perf |
|------|--------|------|----|------|
| ✅ H6.1 提取动态代理 | extract_dynamic | PASS | 944 | ✓ |
| ✅ H6.2 use api mode | extract_dynamic | PASS | 1081 | ✓ |

---

# Performance SLA (4-tier)

| Tier | Metric | SLA |
|------|--------|-----|
| T1 | Cancel/Confirm | < 500ms |
| T2 | Semantic follow-up | < 1500ms |
| T3 | Param rewrite | < 3000ms |
| T4 | Query / Extract | < 15000ms |
