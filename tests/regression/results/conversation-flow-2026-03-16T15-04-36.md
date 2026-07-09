# Conversation Flow Test Report

**Time:** 2026-03-16T15:04:36.729Z
**Total Scenarios:** 6
**Passed:** 6
**Failed:** 0
**Pass Rate:** 100.0%

## ✅ 场景1: 查IP→找最好→开通→取消 (完整链路)
Total: 24265ms

| Step | Intent | Pass | Duration |
|------|--------|------|----------|
| ✅ 1.1 查询纽约IP | query_ip_inventory | PASS | 9292ms |
| ✅ 1.2 follow-up: 找质量最好的 | find_best_ip | PASS | 8757ms |
| ✅ 1.3 follow-up: 帮我开通 | follow_up_action | PASS | 6216ms |

## ✅ 场景2: 查伦敦IP→下一页(分页保持)
Total: 21438ms

| Step | Intent | Pass | Duration |
|------|--------|------|----------|
| ✅ 2.1 查询伦敦IP | query_ip_inventory | PASS | 8209ms |
| ✅ 2.2 follow-up: 换一个 | query_ip_inventory | PASS | 13229ms |

## ✅ 场景3: 查日本IP→开通第一个→确认
Total: 10160ms

| Step | Intent | Pass | Duration |
|------|--------|------|----------|
| ✅ 3.1 查询日本IP | query_ip_inventory | PASS | 6543ms |
| ✅ 3.2 follow-up: 开通第一个 | follow_up_select | PASS | 3617ms |

## ✅ 场景4: 购买确认消息格式检查
Total: 3962ms

| Step | Intent | Pass | Duration |
|------|--------|------|----------|
| ✅ 4.1 查询美国IP | query_ip_inventory | PASS | 1917ms |
| ✅ 4.2 开通第一个 | follow_up_select | PASS | 2045ms |

## ✅ 场景5: 英文对话上下文
Total: 12372ms

| Step | Intent | Pass | Duration |
|------|--------|------|----------|
| ✅ 5.1 Query New York IPs | query_ip_inventory | PASS | 2336ms |
| ✅ 5.2 Follow-up: find best | find_best_ip | PASS | 10036ms |

## ✅ 场景6: 无上下文时独立执行
Total: 5890ms

| Step | Intent | Pass | Duration |
|------|--------|------|----------|
| ✅ 6.1 无上下文的模糊命令 | find_best_ip | PASS | 5890ms |

