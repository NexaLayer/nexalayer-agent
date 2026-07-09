# Conversation Flow Test Report

**Time:** 2026-03-16T14:58:09.126Z
**Total Scenarios:** 6
**Passed:** 4
**Failed:** 2
**Pass Rate:** 66.7%

## ❌ 场景1: 查IP→找最好→开通→取消 (完整链路)
Total: 31788ms

| Step | Intent | Pass | Duration |
|------|--------|------|----------|
| ✅ 1.1 查询纽约IP | query_ip_inventory | PASS | 5477ms |
| ✅ 1.2 follow-up: 找质量最好的 | find_best_ip | PASS | 4320ms |
| ❌ 1.3 follow-up: 帮我开通 | follow_up_action | FAIL | 4451ms |
| ✅ 1.4 取消操作 | unknown | PASS | 17540ms |

### Failures

**1.3 follow-up: 帮我开通:**
- message should contain "开通" but not found (preview: 确认执行此操作？)
- Preview: 确认执行此操作？

## ✅ 场景2: 查伦敦IP→下一页(分页保持)
Total: 19360ms

| Step | Intent | Pass | Duration |
|------|--------|------|----------|
| ✅ 2.1 查询伦敦IP | query_ip_inventory | PASS | 8164ms |
| ✅ 2.2 follow-up: 换一个 | query_ip_inventory | PASS | 11196ms |

## ✅ 场景3: 查日本IP→开通第一个→确认
Total: 15869ms

| Step | Intent | Pass | Duration |
|------|--------|------|----------|
| ✅ 3.1 查询日本IP | query_ip_inventory | PASS | 9755ms |
| ✅ 3.2 follow-up: 开通第一个 | follow_up_select | PASS | 6114ms |

## ✅ 场景4: 购买确认消息格式检查
Total: 16498ms

| Step | Intent | Pass | Duration |
|------|--------|------|----------|
| ✅ 4.1 查询美国IP | query_ip_inventory | PASS | 5260ms |
| ✅ 4.2 开通第一个 | follow_up_select | PASS | 11238ms |

## ✅ 场景5: 英文对话上下文
Total: 26506ms

| Step | Intent | Pass | Duration |
|------|--------|------|----------|
| ✅ 5.1 Query New York IPs | query_ip_inventory | PASS | 11186ms |
| ✅ 5.2 Follow-up: find best | find_best_ip | PASS | 15320ms |

## ❌ 场景6: 上下文超时后独立执行
Total: 6315ms

| Step | Intent | Pass | Duration |
|------|--------|------|----------|
| ❌ 6.1 无上下文的模糊命令 | find_best_ip | FAIL | 6315ms |

### Failures

**6.1 无上下文的模糊命令:**
- intent should contain "follow_up" but got "find_best_ip"
- intent should contain "query" but got "find_best_ip"
- intent should contain "unknown" but got "find_best_ip"
- Preview: 请指定要查找的地区。
例如：开通一个美国质量最好的IP

