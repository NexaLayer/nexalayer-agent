# IP Inventory Pagination Regression Report

**Date**: 2026-03-17T14-05-06-070Z
**Scenarios**: 37 (37 passed, 0 failed)
**Steps**: 75
**Total time**: 127.5s
**Perf warnings**: 1
**Pass rate**: 100.0%

## A. Basic pagination

### ✅ A1: Query all IPs returns paginated page 1
Query all IPs returns paginated page 1 | 4683ms

- ✅ **A1.1 都有哪些IP** [query_ip_inventory] 4683ms

### ✅ A2: Next page works
Next page works | 3920ms

- ✅ **A2.1 查所有IP** [query_ip_inventory] 2861ms
- ✅ **A2.2 下一页** [paginate_next] 1059ms

### ✅ A3: Prev page works
Prev page works | 7640ms

- ✅ **A3.1 查所有IP** [query_ip_inventory] 5249ms
- ✅ **A3.2 下一页** [paginate_next] 1588ms
- ✅ **A3.3 上一页** [paginate_prev] 803ms

### ✅ A4: Jump to page 3
Jump to page 3 | 1741ms

- ✅ **A4.1 查所有IP** [query_ip_inventory] 896ms
- ✅ **A4.2 第3页** [paginate_to_page] 845ms

### ✅ A5: Change page size
Change page size | 1692ms

- ✅ **A5.1 查所有IP** [query_ip_inventory] 867ms
- ✅ **A5.2 每页20条** [paginate_change_page_size] 825ms

### ✅ A6: View detail item 5
View detail item 5 | 1238ms

- ✅ **A6.1 查所有IP** [query_ip_inventory] 812ms
- ✅ **A6.2 看第5个** [paginate_view_detail] 426ms

## B. Multi-turn continuation

### ✅ B1: Query NYC -> next page -> purchase 3rd
Query NYC -> next page -> purchase 3rd | 2288ms

- ✅ **B1.1 查纽约IP** [query_ip_inventory] 1036ms
- ✅ **B1.2 下一页** [paginate_next] 842ms
- ✅ **B1.3 开通第三个** [follow_up_action] 410ms

### ✅ B2: Query US -> cheapest -> next -> buy 2nd
Query US -> cheapest -> next -> buy 2nd | 3333ms

- ✅ **B2.1 查美国IP** [query_ip_inventory] 985ms
- ✅ **B2.2 最便宜的** [follow_up_refine] 779ms
- ✅ **B2.3 下一页** [paginate_next] 1151ms
- ✅ **B2.4 开通第二个** [follow_up_action] 418ms

### ✅ B3: Query London -> page 2 -> view 1 -> switch to 3rd
Query London -> page 2 -> view 1 -> switch to 3rd | 2115ms

- ✅ **B3.1 查伦敦IP** [query_ip_inventory] 846ms
- ✅ **B3.2 第2页** [paginate_to_page] 834ms
- ✅ **B3.3 看第1个** [paginate_view_detail] 435ms

### ✅ B4: Query all -> 20 per page -> next -> buy 10th
Query all -> 20 per page -> next -> buy 10th | 13340ms

- ✅ **B4.1 查所有IP** [query_static_orders] 5429ms
- ✅ **B4.2 每页20条** [paginate_change_page_size] 3696ms
- ✅ **B4.3 下一页** [paginate_next] 4215ms

## C. Fuzzy expression

### ✅ C1: "继续" as next page
"继续" as next page | 2866ms

- ✅ **C1.1 查美国IP** [query_ip_inventory] 1731ms
- ✅ **C1.2 继续** [paginate_next] 1135ms

### ✅ C2: "往后翻" as next page
"往后翻" as next page | 1980ms

- ✅ **C2.1 查美国IP** [query_ip_inventory] 1017ms
- ✅ **C2.2 往后翻** [paginate_next] 963ms

### ✅ C3: "后面还有吗" as next page
"后面还有吗" as next page | 2142ms

- ✅ **C3.1 查美国IP** [query_ip_inventory] 993ms
- ✅ **C3.2 后面还有吗** [paginate_next] 1149ms

### ✅ C4: "跳到第2页" jump
"跳到第2页" jump | 2501ms

- ✅ **C4.1 查美国IP** [query_ip_inventory] 1293ms
- ✅ **C4.2 跳到第2页** [paginate_to_page] 1208ms

### ✅ C5: "多显示一点" doubles page size
"多显示一点" doubles page size | 2034ms

- ✅ **C5.1 查美国IP** [query_ip_inventory] 1048ms
- ✅ **C5.2 多显示一点** [paginate_change_page_size] 986ms

### ✅ C6: "看第3个" view detail
"看第3个" view detail | 1391ms

- ✅ **C6.1 查美国IP** [query_ip_inventory] 997ms
- ✅ **C6.2 看第3个** [paginate_view_detail] 394ms

### ✅ C7: "往前翻" as prev page
"往前翻" as prev page | 2425ms

- ✅ **C7.1 查所有IP** [query_ip_inventory] 825ms
- ✅ **C7.2 下一页** [paginate_next] 790ms
- ✅ **C7.3 往前翻** [paginate_prev] 810ms

## D. Context reset

### ✅ D1: NYC -> next -> check balance -> next should warn
NYC -> next -> check balance -> next should warn | 2628ms

- ✅ **D1.1 查纽约IP** [query_ip_inventory] 828ms
- ✅ **D1.2 下一页** [paginate_next] 766ms
- ✅ **D1.3 查余额** [query_balance] 525ms
- ✅ **D1.4 再下一页** [paginate_next] 509ms

### ✅ D2: NYC IP -> "英国的呢" new query resets
NYC IP -> "英国的呢" new query resets | 1590ms

- ✅ **D2.1 查纽约IP** [query_ip_inventory] 781ms
- ✅ **D2.2 英国的呢** [query_ip_inventory] 809ms

### ✅ D3: NYC -> next -> monthly cost -> buy 3rd should not work
NYC -> next -> monthly cost -> buy 3rd should not work | 6803ms

- ✅ **D3.1 查纽约IP** [query_ip_inventory] 768ms
- ✅ **D3.2 下一页** [paginate_next] 872ms
- ✅ **D3.3 查本月消费** [query_stats] 5163ms

### ✅ D4: NYC -> next -> help -> next should still work
NYC -> next -> help -> next should still work | 3261ms

- ✅ **D4.1 查纽约IP** [query_ip_inventory] 1367ms
- ✅ **D4.2 下一页** [paginate_next] 1026ms
- ✅ **D4.3 帮助** [show_help] 418ms
- ✅ **D4.4 下一页** [paginate_next] 450ms

## E. Boundary

### ✅ E1: First page -> prev -> should warn
First page -> prev -> should warn | 1249ms

- ✅ **E1.1 查所有IP** [query_ip_inventory] 842ms
- ✅ **E1.2 上一页** [paginate_prev] 407ms

### ✅ E2: Page 999 out of range
Page 999 out of range | 1157ms

- ✅ **E2.1 查所有IP** [query_ip_inventory] 767ms
- ✅ **E2.2 第999页** [paginate_to_page] 390ms

### ✅ E3: View item 25 when page has 20
View item 25 when page has 20 | 1198ms

- ✅ **E3.1 查所有IP** [query_ip_inventory] 781ms
- ✅ **E3.2 看第25个** [paginate_view_detail] 417ms

### ✅ E4: Page size 1000 (capped)
Page size 1000 (capped) | 2116ms

- ✅ **E4.1 查所有IP** [query_ip_inventory] 937ms
- ✅ **E4.2 每页1000条** [paginate_change_page_size] 1179ms

## F. Frontend consistency

### ✅ F1: All IPs: has total > 0, has products
All IPs: has total > 0, has products | 814ms

- ✅ **F1.1 都有哪些IP** [query_ip_inventory] 814ms

### ✅ F2: NYC IPs return data
NYC IPs return data | 749ms

- ✅ **F2.1 纽约有哪些IP** [query_ip_inventory] 749ms

### ✅ F3: US IPs return data
US IPs return data | 941ms

- ✅ **F3.1 美国有哪些IP** [query_ip_inventory] 941ms

### ✅ F4: London IPs return data
London IPs return data | 951ms

- ✅ **F4.1 伦敦有哪些IP** [query_ip_inventory] 951ms

### ✅ F5: Jakarta IPs
Jakarta IPs | 634ms

- ✅ **F5.1 雅加达有哪些IP** [query_ip_inventory] 634ms

### ✅ F6: Taipei IPs
Taipei IPs | 615ms

- ✅ **F6.1 台北有哪些IP** [query_ip_inventory] 615ms

## G. Regression

### ✅ G1: Static order pagination still works
Static order pagination still works | 6759ms

- ✅ **G1.1 查静态订单** [query_static_orders] 3519ms
- ✅ **G1.2 下一页** [paginate_next] 3240ms

### ✅ G2: Dynamic order pagination still works
Dynamic order pagination still works | 1087ms

- ✅ **G2.1 查动态订单** [query_dynamic_orders] 1087ms

### ✅ G3: Transaction pagination still works
Transaction pagination still works | 780ms

- ✅ **G3.1 查交易记录** [query_nl_history] 780ms

### ✅ G4: Dynamic extract flow not broken
Dynamic extract flow not broken | 5357ms

- ✅ **G4.1 提取动态代理** [extract_dynamic] 5357ms

### ✅ G5: IP query with geo filter still works
IP query with geo filter still works | 13032ms

- ✅ **G5.1 查东京IP** [query_ip_inventory] 13032ms

### ✅ G6: Existing follow-up select works
Existing follow-up select works | 18427ms

- ✅ **G6.1 查美国IP** [query_ip_inventory] 17171ms
  - ⚠️ [PERF] 17171ms > 15000ms
- ✅ **G6.2 找最便宜的** [follow_up_refine] 1256ms

