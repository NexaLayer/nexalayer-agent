import { GEO_MAPPING, resolveGeo } from './geo-mapping';
import { createModuleLogger } from '../../utils/logger';

const log = createModuleLogger('intent-parser');

export interface ParsedIntent {
  intent: string;
  slots: Record<string, unknown>;
  confidence: number;
  lang: 'zh' | 'en';
  confirmationRequired: boolean;
}

export function detectLang(text: string): 'zh' | 'en' {
  const zhRe = /[\u4e00-\u9fff]/;
  return zhRe.test(text) ? 'zh' : 'en';
}

interface PatternDef {
  intent: string;
  patterns: RegExp[];
  slotExtractors: SlotExtractor[];
  confirmationRequired: boolean;
}

interface SlotExtractor {
  slot: string;
  extract(text: string, lang: 'zh' | 'en'): unknown;
}

function extractCity(
  _text: string,
  _lang: 'zh' | 'en'
): string | null {
  return null;
}

function extractCountry(
  _text: string,
  _lang: 'zh' | 'en'
): string | null {
  return null;
}

function extractAmount(
  text: string,
  _lang: 'zh' | 'en'
): number | null {
  const m = text.match(
    /(\d+(?:\.\d+)?)\s*(?:元|CNY|cny|yuan|¥)/i
  );
  if (m) return parseFloat(m[1]);
  const m2 = text.match(
    /(?:分配|assign|充值|加|recharge)\s*(\d+(?:\.\d+)?)/i
  );
  if (m2) return parseFloat(m2[1]);
  return null;
}

function extractUsername(
  text: string,
  _lang: 'zh' | 'en'
): string | null {
  const ROLE_WORDS =
    /代理商|代理|管理员|普通用户|agent|admin|user/gi;

  const zhAlphaPatterns: RegExp[] = [
    /(?:用户名|账号|帐号)[为是:：]\s*([a-zA-Z0-9_.\-]+)/i,
    /(?:用户名|账号|帐号)[为是:：]\s*(\S+?)(?:的|，|,|\s|$)/i,
    /(?:叫|名叫|叫做|名为)\s*([a-zA-Z0-9_.\-]+)/i,
  ];

  const enPatterns: RegExp[] = [
    /(?:username|named?|called)\s*(?:is|:)?\s*([a-zA-Z0-9_.\-]+)/i,
    /(?:user|account)\s+([a-zA-Z0-9_.\-]+)/i,
  ];

  const targetPatterns: RegExp[] = [
    /(?:给|为|to|for)\s+(?:用户|user)?\s*([a-zA-Z0-9_.\-]+)/i,
  ];

  const allPatterns = [
    ...zhAlphaPatterns,
    ...enPatterns,
    ...targetPatterns,
  ];

  for (const p of allPatterns) {
    const m = text.match(p);
    if (m && m[1]) {
      let val = m[1]
        .replace(ROLE_WORDS, '')
        .replace(/[,，。.的了是为]/g, '')
        .trim();
      if (val.length >= 1 && val.length <= 50) {
        return val;
      }
    }
  }

  return null;
}

function extractRole(
  text: string,
  _lang: 'zh' | 'en'
): string | null {
  const t = text.toLowerCase();
  if (
    t.includes('代理商') ||
    t.includes('代理') ||
    /\bagent\b/i.test(text)
  ) {
    return 'agent';
  }
  if (
    t.includes('管理员') ||
    /\badmin\b/i.test(text)
  ) {
    return 'admin';
  }
  return null;
}

function extractQuantity(
  text: string,
  _lang: 'zh' | 'en'
): number | null {
  const m = text.match(
    /(\d+)\s*(?:条|个(?!月)|台|IPs?)/i
  );
  if (m) return parseInt(m[1], 10);
  const mEn = text.match(
    /(\d+)\s*(?:proxies|proxy)/i
  );
  if (mEn) return parseInt(mEn[1], 10);
  const mVerb = text.match(
    /(?:extract|提取|获取)\s+(\d+)/i
  );
  if (mVerb) return parseInt(mVerb[1], 10);
  return null;
}

function extractIpAddress(
  text: string,
  _lang: 'zh' | 'en'
): string | null {
  const m = text.match(
    /(\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3})/
  );
  return m ? m[1] : null;
}

function extractProxyProtocol(
  text: string,
  _lang: 'zh' | 'en'
): string | null {
  const t = text.toLowerCase();
  if (/socks5|socks/.test(t)) return 'socks5';
  if (/https/.test(t)) return 'https';
  if (/http/.test(t)) return 'http';
  return null;
}

function extractIpSegment(
  text: string,
  _lang: 'zh' | 'en'
): string | null {
  const m4 = text.match(
    /(\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3})/
  );
  if (m4) return m4[1];
  const m3 = text.match(
    /(\d{1,3}\.\d{1,3}\.\d{1,3})(?:\s|$|的)/
  );
  if (m3) return m3[1];
  return null;
}

function extractDuration(
  text: string,
  _lang: 'zh' | 'en'
): number | null {
  if (/半年/.test(text)) return 6;
  if (/一年|1年/.test(text)) return 12;
  if (/一个月/.test(text)) return 1;
  const mMonth = text.match(
    /(\d+)\s*(?:个月|月|months?)/i
  );
  if (mMonth) return parseInt(mMonth[1], 10);
  const mDay = text.match(
    /(\d+)\s*(?:天|日|days?)/i
  );
  if (mDay) {
    return Math.max(
      1, Math.round(parseInt(mDay[1], 10) / 30)
    );
  }
  return null;
}

function extractRemark(
  text: string,
  _lang: 'zh' | 'en'
): string | null {
  const m = text.match(
    /(?:备注|remark|note)[：:\s]*(.+?)$/i
  );
  return m ? m[1].trim() : null;
}

function extractOrderNo(
  text: string,
  _lang: 'zh' | 'en'
): string | null {
  const m = text.match(
    /(?:订单|order)[号No.:：\s]*([A-Za-z0-9_-]+)/i
  );
  return m ? m[1] : null;
}

function extractPeriod(
  text: string,
  _lang: 'zh' | 'en'
): string {
  const t = text.toLowerCase();
  if (
    t.includes('today') ||
    t.includes('今日') ||
    t.includes('今天')
  )
    return 'day';
  if (t.includes('week') || t.includes('本周'))
    return 'week';
  if (
    t.includes('month') ||
    t.includes('本月') ||
    t.includes('这个月')
  )
    return 'month';
  return 'month';
}

function extractStatsType(
  text: string,
  _lang: 'zh' | 'en'
): string {
  const t = text.toLowerCase();
  if (
    t.includes('profit') ||
    t.includes('利润') ||
    t.includes('收入')
  )
    return 'profit';
  if (
    t.includes('充值') ||
    t.includes('recharge')
  )
    return 'recharge';
  if (
    t.includes('cost') ||
    t.includes('消费') ||
    t.includes('花费') ||
    t.includes('spending')
  )
    return 'consumption';
  if (
    t.includes('订单') ||
    t.includes('order')
  )
    return 'orders';
  if (t.includes('traffic') || t.includes('流量'))
    return 'traffic';
  return 'overview';
}

const STATS_RESERVED =
  /^(统计|概览|利润|消费|花费|收入|充值|订单|数据|本月|上月|今日|今天|累计|仪表盘|动态|静态|流量|IP|资源|交易|记录|最近|代理|的)$/i;

const IP_PATTERN =
  /^\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}$/;

const ORDER_ID_PREFIXES = /^(?:STA|DYN|NL|ORD)/i;
const TIMESTAMP_IN_ID = /\d{8,14}/;

export function isLikelyOrderId(token: string): boolean {
  if (!token || token.length < 6) return false;
  if (ORDER_ID_PREFIXES.test(token)) return true;
  if (
    token.length >= 16 &&
    TIMESTAMP_IN_ID.test(token) &&
    /[a-zA-Z]/.test(token) &&
    /\d/.test(token)
  ) {
    return true;
  }
  return false;
}

export type EntityType =
  | 'order_id'
  | 'ip_address'
  | 'username'
  | 'unknown';

export function classifyEntity(
  token: string
): EntityType {
  if (!token) return 'unknown';
  if (IP_PATTERN.test(token)) return 'ip_address';
  if (isLikelyOrderId(token)) return 'order_id';
  if (
    /^[a-zA-Z0-9_.\-@]+$/.test(token) &&
    token.length <= 50 &&
    !STATS_RESERVED.test(token)
  ) {
    return 'username';
  }
  return 'unknown';
}

function extractStatsTargetUser(
  text: string,
  _lang: 'zh' | 'en'
): string | null {
  const patterns: RegExp[] = [
    /(?:查询|查看|查|帮我查)\s*(?:用户)?\s*([a-zA-Z0-9_.\-@]+)\s*(?:的?\s*)?(?:统计|概览|数据|利润|消费|充值|订单|动态|静态|流量|IP|资源|交易|记录|最近|代理|本月|上月|今日|今天)/i,
    /([a-zA-Z0-9_.\-@]+)\s*(?:的?\s*)(?:统计|概览|数据|利润|消费|充值|订单|动态|静态|流量|交易|记录|今天|今日|本月|上月)/i,
    /(?:用户|user)\s+([a-zA-Z0-9_.\-@]+)\s*(?:的)?/i,
    /(?:for|of)\s+(?:user\s+)?([a-zA-Z0-9_.\-@]+)\s*$/i,
    /(?:transactions?|orders?)\s+(?:for|of)\s+([a-zA-Z0-9_.\-@]+)/i,
    /(?:what\s+did|show)\s+([a-zA-Z0-9_.\-@]+)\s+(?:buy|spend|purchase|order)/i,
    /([a-zA-Z0-9_.\-@]+)'s?\s+(?:static\s+)?(?:orders?|transactions?)/i,
    /(?:查看|查询|查|帮我查)\s+([a-zA-Z0-9_.\-@]{2,})\s+的/i,
    /(?:today'?s?\s+orders?\s+for)\s+([a-zA-Z0-9_.\-@]+)/i,
  ];
  for (const p of patterns) {
    const m = text.match(p);
    if (
      m?.[1] &&
      m[1].length <= 50 &&
      !STATS_RESERVED.test(m[1]) &&
      !IP_PATTERN.test(m[1]) &&
      !isLikelyOrderId(m[1])
    ) {
      return m[1];
    }
  }
  return null;
}

function extractRecordCount(
  text: string,
  _lang: 'zh' | 'en'
): number | null {
  const patterns = [
    /(?:最近|最新|前|last|recent)\s*(\d+)\s*(?:条|个|笔|项|records?|entries|transactions?|orders?|users?)/i,
    /(\d+)\s*(?:条|个|笔|项)\s*(?:记录|交易|订单|流水)/i,
    /(?:top|limit)\s*(\d+)/i,
    /(?:last|recent)\s+(\d+)\s+\w+\s+(?:records?|entries|transactions?|orders?)/i,
  ];
  for (const p of patterns) {
    const m = text.match(p);
    if (m) {
      const n = parseInt(m[1], 10);
      if (n > 0 && n <= 100) return n;
    }
  }
  return null;
}

function extractDateRange(
  text: string,
  _lang: 'zh' | 'en'
): {
  start_date?: string;
  end_date?: string;
} | null {
  const rangeM = text.match(
    /(\d{4}[-/]\d{1,2}[-/]\d{1,2})\s*(?:到|至|-|~)\s*(\d{4}[-/]\d{1,2}[-/]\d{1,2})/
  );
  if (rangeM) {
    return {
      start_date: rangeM[1].replace(/\//g, '-'),
      end_date: rangeM[2].replace(/\//g, '-'),
    };
  }
  const singleM = text.match(
    /(\d{4}[-/]\d{1,2}[-/]\d{1,2})/
  );
  if (singleM) {
    const d = singleM[1].replace(/\//g, '-');
    return { start_date: d, end_date: d };
  }
  const relM = text.match(
    /(\d{1,2})月(\d{1,2})日?\s*(?:到|至|-|~)\s*(\d{1,2})月(\d{1,2})日?/
  );
  if (relM) {
    const y = new Date().getFullYear();
    return {
      start_date: `${y}-${relM[1].padStart(2, '0')}-${relM[2].padStart(2, '0')}`,
      end_date: `${y}-${relM[3].padStart(2, '0')}-${relM[4].padStart(2, '0')}`,
    };
  }
  return null;
}

function extractSearchKeyword(
  text: string,
  _lang: 'zh' | 'en'
): string | null {
  const ipM = text.match(
    /(\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3})/
  );
  if (ipM) return ipM[1];

  const orderPrefixM = text.match(
    /(?:订单号?|order\s*(?:no|number|id|#)?)\s*[:：]?\s*([A-Za-z0-9_-]{3,})/i
  );
  if (orderPrefixM) return orderPrefixM[1];

  const allTokens = text.match(
    /[A-Za-z0-9_-]{6,}/g
  );
  if (allTokens) {
    for (const tok of allTokens) {
      if (isLikelyOrderId(tok)) return tok;
    }
  }

  const supplierM = text.match(
    /(?:供应商|供应|supplier)\s*(?:是|为|:：)?\s*([a-zA-Z0-9\u4e00-\u9fff]+)/i
  );
  if (supplierM) return supplierM[1];
  const searchUserM = text.match(
    /(?:搜索|查找|search)\s*(?:用户|账号|客户|user)\s+([^\s,，]+)/i
  );
  if (searchUserM) return searchUserM[1];
  const agentSearchM = text.match(
    /(?:代理商|agent)\s+([^\s,，的]+)/i
  );
  if (agentSearchM) return agentSearchM[1];
  const remarkSearchM = text.match(
    /(?:备注|remark)\s*(?:是|为|含有|包含|:：)?\s*([^\s,，的]+)/i
  );
  if (remarkSearchM) return remarkSearchM[1];
  const searchM = text.match(
    /(?:搜索|查找|search|keyword)\s+([^\s,，]+)/i
  );
  if (searchM) return searchM[1];
  return null;
}

function extractSortOrder(
  text: string,
  _lang: 'zh' | 'en'
): string | null {
  if (/最?便宜|最低价|cheapest|lowest/i.test(text))
    return 'price_asc';
  if (/最贵|最高价|most expensive|highest/i.test(text))
    return 'price_desc';
  return null;
}

function extractExcludePrefix(
  text: string,
  _lang: 'zh' | 'en'
): string[] | null {
  const results: string[] = [];
  const re =
    /(?:不要|排除|去掉|不含|不包括|exclude|without|no)\s*(\d{1,3})\s*(?:开头|段|prefix|网段)/gi;
  let m;
  while ((m = re.exec(text)) !== null) {
    results.push(m[1]);
  }
  const re2 =
    /(?:不要|排除|去掉|不含|不包括|exclude|without|no)\s*(\d{1,3}(?:\s*[,，、]\s*\d{1,3})*)\s*(?:的|开头|段|prefix)/gi;
  while ((m = re2.exec(text)) !== null) {
    const segs = m[1].split(/[,，、\s]+/);
    for (const s of segs) {
      const trimmed = s.trim();
      if (/^\d{1,3}$/.test(trimmed) &&
        !results.includes(trimmed)
      ) {
        results.push(trimmed);
      }
    }
  }
  return results.length > 0 ? results : null;
}

function extractQualityFilter(
  text: string,
  _lang: 'zh' | 'en'
): string | null {
  if (/质量高|高质量|best quality|premium/i.test(text))
    return 'high';
  if (/住宅|residential/i.test(text))
    return 'residential';
  if (/机房|datacenter|data center|idc/i.test(text))
    return 'datacenter';
  return null;
}

function extractQualityThreshold(
  text: string,
  _lang: 'zh' | 'en'
): number | null {
  const m = text.match(
    /(?:质量|评分|分数|score|quality)\s*(?:高于|大于|超过|above|over|>|>=)\s*(\d{1,3})/i
  );
  if (m) return parseInt(m[1], 10);
  const m2 = text.match(
    /(\d{1,3})\s*(?:分以上|分及以上|以上)/
  );
  if (m2) return parseInt(m2[1], 10);
  return null;
}

function extractPurpose(
  text: string,
  _lang: 'zh' | 'en'
): string | null {
  const map: [RegExp, string][] = [
    [/tiktok/i, 'tiktok'],
    [/amazon|亚马逊/i, 'amazon'],
    [/爬虫|scraping|scrape|crawl/i, 'scraping'],
    [/广告|ads|advert/i, 'ads'],
    [/注册|signup|register/i, 'registration'],
    [/google/i, 'google'],
    [/facebook|fb/i, 'facebook'],
    [/instagram|ig/i, 'instagram'],
    [/twitter|x\.com/i, 'twitter'],
    [/youtube/i, 'youtube'],
    [/电商|shopify|ebay|ecommerce/i, 'ecommerce'],
  ];
  for (const [re, tag] of map) {
    if (re.test(text)) return tag;
  }
  return null;
}

/* ── Reference Resolution (指代解析) ── */

export type ReferenceType =
  | 'previous_results'
  | 'next_batch'
  | 'same_region'
  | 'same_type'
  | 'specific_items'
  | null;

export interface ResolvedReference {
  type: ReferenceType;
  modifier?: string;
}

const REF_PATTERNS: [RegExp, ReferenceType][] = [
  [/这批|这一批|这几个|这些|上一批|前面的/, 'previous_results'],
  [/下一批|下一组|再来|还有(?:吗|别的|其他|没)|换一[批组]/, 'next_batch'],
  [/同地区|同一?个?地区|同国家|同城市/, 'same_region'],
  [/同类型|同一?类|类似的|一样的/, 'same_type'],
];

export function resolveReference(
  text: string
): ResolvedReference {
  const t = text.toLowerCase();
  for (const [re, type] of REF_PATTERNS) {
    if (re.test(t)) return { type };
  }
  if (/不行|不好|差|不要|换|不满意/.test(t))
    return { type: 'next_batch', modifier: 'reject' };
  if (/再来\s*(\d+)\s*个/.test(t))
    return { type: 'next_batch' };
  return { type: null };
}

const BALANCE_RESERVED =
  /^(余额|balance|我的|查询|查看|查|的)$/i;

function extractBalanceTarget(
  text: string,
  _lang: 'zh' | 'en'
): string | null {
  const emailMatch = text.match(
    /([a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,})/
  );
  if (emailMatch) return emailMatch[1];

  const userPatterns: RegExp[] = [
    /(?:查询|查看|查)\s*(?:用户)?\s*([a-zA-Z0-9_.\-@]+)\s*(?:的\s*)?(?:余额|balance)/i,
    /(?:用户|user)\s+([a-zA-Z0-9_.\-@]+)\s*(?:的)?.*(?:余额|balance)/i,
    /(?:check|query|get|show)\s+([a-zA-Z0-9_.\-@]+)(?:'s)?\s*balance/i,
    /(?:帮我|帮忙)?(?:看下?|查下?|查看)\s+([a-zA-Z0-9_.\-@]+)\s*(?:的\s*)?(?:余额|balance)/i,
  ];
  for (const p of userPatterns) {
    const m = text.match(p);
    if (
      m?.[1] &&
      m[1].length <= 50 &&
      !BALANCE_RESERVED.test(m[1])
    ) {
      return m[1];
    }
  }
  return null;
}

function extractBatchQuantity(
  text: string,
  _lang: 'zh' | 'en'
): number | null {
  const m = text.match(
    /(?:批量|batch).*?(\d+)\s*(?:个|位|名|users?)/i
  );
  if (m) return parseInt(m[1], 10);
  const m2 = text.match(
    /(\d+)\s*(?:个|位|名).*(?:用户|账号)/i
  );
  if (m2) return parseInt(m2[1], 10);
  return null;
}

function extractInitialBalance(
  text: string,
  _lang: 'zh' | 'en'
): number | null {
  const m = text.match(
    /(?:初始|initial).*?(\d+(?:\.\d+)?)\s*(?:元|CNY|¥)/i
  );
  if (m) return parseFloat(m[1]);
  const m2 = text.match(
    /(?:额度|balance).*?(\d+(?:\.\d+)?)/i
  );
  if (m2) return parseFloat(m2[1]);
  return null;
}

function extractTrafficGb(
  text: string,
  _lang: 'zh' | 'en'
): number | null {
  const m = text.match(
    /(\d+(?:\.\d+)?)\s*G(?:B)?(?![a-zA-Z])/i
  );
  return m ? parseFloat(m[1]) : null;
}

function extractHelpTopic(
  text: string
): string | null {
  const m = text.match(
    /(?:帮助|help|怎么用|怎么)\s*(.+)/i
  );
  if (m) {
    const topic = m[1].trim();
    if (
      topic &&
      topic.length > 1 &&
      !/^(我|系统|功能|命令|操作|吗|呢|啊|呀|\?)$/i.test(topic)
    ) {
      return topic;
    }
  }
  return null;
}

function extractPageNumber(
  text: string,
  _lang: 'zh' | 'en'
): number | null {
  const m = text.match(
    /(?:第|page)\s*(\d+)\s*(?:页|$)/i
  );
  return m ? parseInt(m[1], 10) : null;
}

function extractPageSize(
  text: string,
  _lang: 'zh' | 'en'
): number | null {
  const m = text.match(
    /(?:每页|per\s*page|show)\s*(\d+)\s*(?:条|个|items?|rows?)?/i
  );
  return m ? parseInt(m[1], 10) : null;
}

function extractPageSizeFuzzy(
  text: string,
  lang: 'zh' | 'en'
): number | null {
  const explicit = extractPageSize(text, lang);
  if (explicit) return explicit;
  const numM = text.match(/(\d+)\s*(?:条|个|项)/);
  if (numM) return parseInt(numM[1], 10);
  if (/多显示|展示多|多看|more\s*per|more\s*items/i.test(text)) {
    return 20;
  }
  return null;
}

function extractDetailIndex(
  text: string,
  _lang: 'zh' | 'en'
): number | null {
  const m = text.match(
    /(?:查看|看|show|view)\s*第?\s*(\d+)\s*(?:条|个|项)?\s*(?:详情|detail)?/i
  );
  if (m) return parseInt(m[1], 10);
  const m2 = text.match(
    /第?\s*(\d+)\s*(?:条|个)\s*(?:详情|detail)/i
  );
  if (m2) return parseInt(m2[1], 10);
  const m3 = text.match(
    /(?:item|entry)\s*(\d+)/i
  );
  return m3 ? parseInt(m3[1], 10) : null;
}

const INTENT_PATTERNS: PatternDef[] = [
  /* ── Pagination controls (must match early) ── */
  {
    intent: 'paginate_next',
    patterns: [
      /^(?:下一页|next\s*page?|继续|more)$/i,
      /^(?:下一?页|继续看|接着看|往下看)$/i,
      /^(?:next|下页|翻页)$/i,
      /^(?:往后翻|看后面的?|后面还有吗?)$/i,
      /^(?:看下一?页|还有吗|show\s*more)$/i,
    ],
    slotExtractors: [],
    confirmationRequired: false,
  },
  {
    intent: 'paginate_prev',
    patterns: [
      /^(?:上一页|prev(?:ious)?\s*page?|前一页)$/i,
      /^(?:上一?页|回上页|上页|往回看)$/i,
      /^(?:prev|previous|back)$/i,
      /^(?:往前翻|返回上一?页|前面的?)$/i,
      /^(?:show\s*prev|go\s*back)$/i,
    ],
    slotExtractors: [],
    confirmationRequired: false,
  },
  {
    intent: 'paginate_to_page',
    patterns: [
      /^(?:第\s*\d+\s*页|page\s*\d+)$/i,
      /^(?:跳到?|go\s*to)\s*(?:第\s*)?\d+\s*(?:页|page)?$/i,
      /^(?:goto|go)\s+\d+$/i,
      /^(?:去|到)第?\s*\d+\s*页$/i,
    ],
    slotExtractors: [
      { slot: 'page', extract: extractPageNumber },
    ],
    confirmationRequired: false,
  },
  {
    intent: 'paginate_change_page_size',
    patterns: [
      /^每页\s*\d+\s*(?:条|个|项)?$/i,
      /^(?:per\s*page|show|display)\s*\d+\s*(?:items?|rows?|per)?$/i,
      /^\d+\s*(?:条|个)\s*(?:每页|一页)$/i,
      /^一页\s*(?:显示|展示)?\s*\d+\s*(?:条|个|项)?$/i,
      /^(?:多显示一点|展示多一点|多看一些)$/i,
      /^(?:show\s*more\s*items|more\s*per\s*page)$/i,
    ],
    slotExtractors: [
      {
        slot: 'page_size',
        extract: extractPageSizeFuzzy,
      },
    ],
    confirmationRequired: false,
  },
  {
    intent: 'paginate_view_detail',
    patterns: [
      /^(?:查看|看|show|view)\s*第?\s*\d+\s*(?:条|个|项)?\s*(?:详情|detail)?$/i,
      /^第?\s*\d+\s*(?:条|个)\s*(?:详情|detail)$/i,
      /^(?:show|view)\s*(?:item|entry)\s*\d+$/i,
    ],
    slotExtractors: [
      {
        slot: 'detail_index',
        extract: extractDetailIndex,
      },
    ],
    confirmationRequired: false,
  },
  /* ── NL History ── */
  {
    intent: 'query_nl_history',
    patterns: [
      /(?:查看|查询|显示|我的).*(?:对话历史|聊天记录|NL历史|命令历史|会话历史)/i,
      /(?:对话历史|聊天记录|NL历史|命令历史|会话历史)/i,
      /(?:history|chat\s*history|conversation\s*history|command\s*history)/i,
      /(?:what|show)\s*(?:my)\s*(?:chat|conversation|command)\s*history/i,
      /(?:所有|全部).*(?:用户|账号).*(?:对话历史|聊天记录|命令历史|会话历史)/i,
      /(?:查看|查询)\s*(?:用户)\s*\S+\s*(?:的?\s*)?(?:对话历史|聊天记录|命令历史|会话历史)/i,
    ],
    slotExtractors: [
      {
        slot: 'search',
        extract: extractSearchKeyword,
      },
      {
        slot: 'count',
        extract: extractRecordCount,
      },
      {
        slot: 'target_user',
        extract: extractStatsTargetUser,
      },
    ],
    confirmationRequired: false,
  },
  {
    intent: 'greeting',
    patterns: [
      /^(?:你好|hi|hello|hey|嗨|哈喽|哈啰)\s*$/i,
    ],
    slotExtractors: [],
    confirmationRequired: false,
  },
  {
    intent: 'show_help',
    patterns: [
      /^(?:帮助|help|怎么用)(?:\s|$)/i,
      /^(?:帮助|help)$/i,
      /(?:支持|有)(?:什么|哪些)(?:命令|功能|操作)/i,
      /(?:怎么用|怎么使用|如何使用|how to use)/i,
      /(?:命令|功能|操作)(?:列表|清单|一览|大全)/i,
      /(?:可以|能)(?:做什么|干什么|干啥|做啥)/i,
      /what can (?:you|i) do/i,
      /^帮忙\s*$/i,
      /^(?:有什么功能|有啥功能)\s*$/i,
    ],
    slotExtractors: [
      { slot: 'topic', extract: extractHelpTopic },
    ],
    confirmationRequired: false,
  },
  {
    intent: 'create_user',
    patterns: [
      /(?:开通|创建|新建|注册).*(?:用户|帐户|账户|账号|代理商)(?!.*代理)/i,
      /(?:开通|创建|新建|注册).*(?:代理商)/i,
      /(?:开通|创建|新建|注册)(?!.*(?:动态|静态|IP|ip|代理)).*(?:代理)/i,
      /create.*(user|account|agent)/i,
      /new.*(user|account|agent)/i,
    ],
    slotExtractors: [
      { slot: 'username', extract: extractUsername },
      { slot: 'role', extract: extractRole },
    ],
    confirmationRequired: true,
  },
  {
    intent: 'assign_balance',
    patterns: [
      /(?:给|为).*(用户|账号).*(分配|充值|加).*(额度|余额|钱|元)/i,
      /(?:分配|充值).*(额度|余额)/i,
      /assign.*balance/i,
      /add.*(?:balance|credit)/i,
      /^(?:充|充值)\s*(?:余额|额度|balance)\s*$/i,
    ],
    slotExtractors: [
      {
        slot: 'target_user',
        extract: extractUsername,
      },
      { slot: 'amount', extract: extractAmount },
    ],
    confirmationRequired: true,
  },
  {
    intent: 'query_today_orders',
    patterns: [
      /(?:今天|今日|today).*(?:买了?|开通了?|购买了?).*(?:什么|哪些|啥|多少)?(?!.*(?:记录|明细|流水|账单))/i,
      /(?:今天|今日|today).*都.*(?:买|开通|购买)(?!.*(?:记录|明细|流水|账单))/i,
      /(?:今天|today).*(?:buy|purchase|open)(?!.*(?:record|transaction|billing))/i,
      /(?:今日|今天).*(?:开通|购买|开的|买的)(?!.*(?:记录|明细|流水|账单|消费))/i,
      /(?:今日|今天).*(?:订单|order)/i,
      /(?:today).*(?:order)/i,
      /what.*(?:buy|purchase|order).*today/i,
      /today'?s?\s*orders?/i,
      /(?:今天的).*(?:订单|购买).*(?:记录)?/i,
    ],
    slotExtractors: [
      {
        slot: 'target_user',
        extract: extractStatsTargetUser,
      },
    ],
    confirmationRequired: false,
  },
  {
    intent: 'query_stats',
    patterns: [
      /(?:查询|查看|帮我查).*(利润|消费(?!.*(?:记录|明细|流水|账单))|花费|收入|充值|统计|概览|spending|profit|cost|recharge|stats|overview)/i,
      /(?:show|get|query).*(profit|spending|cost|stats|recharge|overview)/i,
      /(?:查询|查看|查)\s*\S+\s*(?:的\s*)?(?:统计|概览|数据)/i,
      /(?:消费统计|消费报告|消费概览|消费报表)/i,
      /(?:收支|开支|支出).*(?:情况|统计|明细|概况|报告)?/i,
      /(?:本月|上月|这月|这个月|上个月).*(?:花了|消费了|用了|花掉).*(?:多少)/i,
      /(?:花了|消费了|用了).*(?:多少钱)/i,
      /(?:一共|总共|合计).*(?:花了|消费|花费|支出)/i,
      /(?:monthly|usage).*(?:report|summary|stats)/i,
      /(?:本月|上月|今日|今天|本周|累计|这月|这个月|上个月).*(利润|消费|花费|充值|订单|统计|开支|支出|收支|stats|spending|profit|recharge)/i,
      /(?:我的|my)\s*(?:充值).*(?:记录|历史|明细)/i,
    ],
    slotExtractors: [
      { slot: 'type', extract: extractStatsType },
      { slot: 'period', extract: extractPeriod },
      {
        slot: 'target_user',
        extract: extractStatsTargetUser,
      },
    ],
    confirmationRequired: false,
  },
  {
    intent: 'query_dashboard',
    patterns: [
      /(?:查询|查看|帮我查).*仪表盘/i,
      /仪表盘.*数据/i,
      /(?:show|get|view).*dashboard/i,
      /dashboard.*(?:data|overview|info)/i,
    ],
    slotExtractors: [
      {
        slot: 'target_user',
        extract: extractStatsTargetUser,
      },
    ],
    confirmationRequired: false,
  },
  {
    intent: 'query_balance',
    patterns: [
      /(?:我的|查询|查看).*(?:余额|balance)/i,
      /(?:check|show|get|what is).*balance/i,
      /余额.*(?:多少|是)/i,
      /查询?\s*\S+@\S+.*(?:的|的余额|余额)/i,
      /查询?\s*(?:用户)\s*\S+.*余额/i,
      /^(?:查?余额|余额查询|余额)$/i,
      /(?:帮我|帮忙)?(?:查|看|查看|查下|查查|看看).*余额/i,
      /^(?!.*(?:动态|流量|静态|IP|ip|代理)).*(?:还有|还剩|剩余).*(?:多少|多少钱|钱)/i,
      /(?:账户?|账上|资金).*(?:还有|剩|余额|多少)/i,
      /(?:钱|余额).*(?:够|还有|剩)/i,
      /(?:how much).*(?:balance|money|have)/i,
      /(?:帮我|帮忙).*(?:看|查).*(?:余额|钱|多少)/i,
      /(?:我有多少).*(?:余额|钱)/i,
      /(?:我的|my)\s*(?:账户?\s*)?余额/i,
      /余额.*(?:查|看|查看)/i,
    ],
    slotExtractors: [
      {
        slot: 'target_user',
        extract: extractBalanceTarget,
      },
    ],
    confirmationRequired: false,
  },
  {
    intent: 'query_transactions',
    patterns: [
      /(?:查询|查看|查)(?!.*(?:动态|静态)(?:.*(?:订单|order))).*(?:交易|transaction)/i,
      /(?:show|list|get).*transaction/i,
      /(?:最近|recent).*(?:交易|transaction|record)/i,
      /(?:流水|交易记录|消费记录|收支记录|账单|消费明细|消费流水|交易流水)/i,
      /(?:查|看|帮我查).*(?:流水|账单|消费明细|收支)/i,
      /(?:transaction|billing).*(?:history|record|log)/i,
      /transactions?\s+(?:for|of)\s+/i,
      /(?:search|find)\s+transactions?\b/i,
      /(?:last|recent)\s+\d+\s+transactions?/i,
      /(?:今天|今日|today).*(?:消费记录|交易记录|消费流水|交易流水|消费明细)/i,
      /(?:今天的|今日的?).*(?:消费|交易).*(?:记录|明细|流水)/i,
      /(?:查询|查看|查).*(?:消费记录|交易记录|消费流水|交易流水)/i,
      /(?:今天|今日).*(?:静态|动态).*消费/i,
    ],
    slotExtractors: [
      {
        slot: 'target_user',
        extract: extractStatsTargetUser,
      },
      {
        slot: 'count',
        extract: extractRecordCount,
      },
      {
        slot: 'date_range',
        extract: extractDateRange,
      },
      {
        slot: 'search',
        extract: extractSearchKeyword,
      },
      {
        slot: 'period',
        extract: extractPeriod,
      },
    ],
    confirmationRequired: false,
  },
  {
    intent: 'query_static_products',
    patterns: [
      /(?:显示|查询|查看|列出).*(?:业务共享).*(?:静态).*(?:代理|资源|isp)/i,
      /(?:business\s+shared).*(?:static).*(?:proxy|resource|isp)/i,
    ],
    slotExtractors: [],
    confirmationRequired: false,
  },
  {
    intent: 'query_products',
    patterns: [
      /^(?!.*(?:西海岸|东海岸|北美|欧洲|东南亚|东亚|中东|IP|ip)).*(?:有|查看|列出).*(?:哪些|什么).*(?:产品|代理|product)/i,
      /(?:show|list|available).*product/i,
    ],
    slotExtractors: [],
    confirmationRequired: false,
  },
  /* ── Query: resources & orders (before purchases) ── */
  {
    intent: 'query_dynamic_resource',
    patterns: [
      /(?:查询|查看|查).*(?:动态).*(?:资源|流量|消耗)/i,
      /(?:dynamic).*(?:resource|flow|traffic|remaining)/i,
      /(?:动态).*(?:剩余|消耗|还剩|还有)/i,
      /(?:动态流量).*(?:还剩|还有|剩余|剩多少)/i,
      /^(?!.*(?:买|购买|充值|需要|想要|我要|帮我)).*(?:动态代理).*(?:资源|流量|使用)/i,
      /(?:还有|还剩).*(?:多少|几).*(?:动态|流量)/i,
      /流量.*(?:还有|有不|有没有|有没)/i,
      /(?:有多少|有几).*G.*(?:动态|没用完)/i,
      /(?:动态的?).*(?:还剩|没用完|剩多少)/i,
    ],
    slotExtractors: [
      {
        slot: 'target_user',
        extract: extractStatsTargetUser,
      },
    ],
    confirmationRequired: false,
  },
  {
    intent: 'query_static_resource',
    patterns: [
      /(?:查询|查看|查)(?!.*(?:哪些|什么|有多少|我有)).*(?:静态).*(?:资源|数量|IP)/i,
      /(?:static).*(?:resource|count)/i,
      /(?:静态).*(?:开通|可用|过期|资源|库存)/i,
      /(?:静态IP).*(?:有多少|有几|资源|总数|数量)/i,
      /(?:有多少|有几).*(?:静态IP|静态代理)/i,
      /(?:静态代理).*(?:资源|使用|概况)/i,
    ],
    slotExtractors: [
      {
        slot: 'target_user',
        extract: extractStatsTargetUser,
      },
    ],
    confirmationRequired: false,
  },
  {
    intent: 'query_dynamic_orders',
    patterns: [
      /(?:查询|查看|查).*(?:动态).*(?:订单|order|代理)/i,
      /(?:dynamic).*(?:order)/i,
      /(?:动态).*(?:订单|记录|列表)/i,
      /(?:我的|my)\s*(?:动态).*(?:订单|记录|代理)?/i,
      /(?:我|我的?).*(?:买过|购买过|开通过|充值过).*(?:哪些|什么|多少)?.*(?:动态)/i,
      /(?:动态订单|动态购买记录)/i,
      /(?:list|show).*(?:dynamic).*(?:order|proxy)/i,
      /(?:last|recent)\s+\d+\s+dynamic\s+orders?/i,
    ],
    slotExtractors: [
      {
        slot: 'target_user',
        extract: extractStatsTargetUser,
      },
      {
        slot: 'count',
        extract: extractRecordCount,
      },
      {
        slot: 'search',
        extract: extractSearchKeyword,
      },
    ],
    confirmationRequired: false,
  },
  /* ── generate_proxy_qr ── */
  {
    intent: 'generate_proxy_qr',
    patterns: [
      /(?:二维码|qr|QR)\s*.*\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}/i,
      /\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}\s*.*(?:二维码|qr|QR)/i,
      /(?:生成|给我|显示|提供|出示|show|generate|create)\s*.*(?:二维码|qr|QR)/i,
      /(?:二维码|qr|QR)\s*(?:生成|给我|显示|提供|出示)?/i,
      /(?:扫码|扫描|shadowrocket|小火箭|clash|v2ray)/i,
      /(?:生成|给我|显示|提供).*(?:socks5?|http|https)\s*(?:链接|link|url|地址)/i,
      /(?:socks5?|http|https)\s*(?:链接|link|url|地址).*(?:生成|给我|显示|提供)/i,
      /(?:代理|proxy)\s*(?:链接|link|url|地址|连接)\s*.*\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}/i,
      /\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}\s*.*(?:代理|proxy)\s*(?:链接|link|url|地址|连接)/i,
    ],
    slotExtractors: [
      { slot: 'ip', extract: extractIpAddress },
      {
        slot: 'protocol',
        extract: extractProxyProtocol,
      },
      {
        slot: 'order_no',
        extract: extractOrderNo,
      },
    ],
    confirmationRequired: false,
  },
  /* ── query_ip_info: MUST be BEFORE query_expiring_ips ── */
  {
    intent: 'query_ip_info',
    patterns: [
      /\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}\s*(?:什么时候|几号|几时|啥时候)?.*(?:到期|过期|expire)/i,
      /\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}\s*(?:的?\s*)?(?:信息|详情|状态|info|status|detail)/i,
      /(?:查询|查看|查一下|查|看看|帮我查)\s*(?:IP|ip)?\s*\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}/i,
      /\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}\s*(?:是(?:什么|哪个|谁的)|属于)/i,
      /(?:这个|那个|这条|那条)\s*(?:IP|ip)\s*(?:到期|过期|信息|详情|啥时候)/i,
      /(?:IP|ip)\s*\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}\s*$/i,
      /^\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}\s*$/i,
      /(?:when|what|check|query|lookup).*\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}/i,
      /\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}.*(?:when|expire|info|status|detail)/i,
    ],
    slotExtractors: [
      { slot: 'ip', extract: extractIpAddress },
    ],
    confirmationRequired: false,
  },
  {
    intent: 'query_expiring_ips',
    patterns: [
      /(?:哪些|哪个|什么).*(?:IP|ip|代理|proxy).*(?:快到期|即将到期|要到期|快过期|要过期|即将过期|expir)/i,
      /(?:IP|ip|代理|proxy).*(?:快到期|即将到期|要到期|快过期|要过期|即将过期|expir)/i,
      /^(?!.*\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3})(?!.*(?:续费|续期|renew|extend)).*(?:到期|过期|expir).*(?:IP|ip|代理|proxy)/i,
      /^(?!.*\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3})(?!.*(?:续费|续期|renew|extend)).*(?:快到期|即将到期|要过期|expiring|about to expire)/i,
      /(?:IP|ip).*(?:到期|过期).*(?:提醒|通知|预警)/i,
      /(?:我的|my).*(?:IP|ip).*(?:什么时候|哪天|几号|几时).*(?:到期|过期)/i,
      /^(?!.*\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}).*(?:什么时候|几号|几时).*(?:到期|过期)/i,
      /^(?!.*\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}).*(?:到期|过期).*(?:时间|日期|提醒|通知)/i,
      /^(?!.*\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}).*(?:IP|ip).*(?:到期了|到期没|到期吗|过期了|过期没|过期吗)/i,
      /(?:帮我|帮忙)?.*(?:看|查).*(?:ip|IP).*(?:到期|过期)/i,
    ],
    slotExtractors: [
      {
        slot: 'target_user',
        extract: extractStatsTargetUser,
      },
    ],
    confirmationRequired: false,
  },
  {
    intent: 'query_static_orders',
    patterns: [
      /(?:查询|查看|查).*(?:静态).*(?:订单|order)/i,
      /(?:static).*(?:order)/i,
      /(?:查询|查看|查)\s*\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}\s*(?:的?\s*)?(?:订单|order)/i,
      /(?:查询|查看|查)\s*[a-zA-Z0-9_.@-]+\s*(?:的?\s*)?订单/i,
      /(?:我|我的|my)\s*(?:最近|近期|recently)?\s*(?:开通|购买|买|开)(?:了|过|的)+\s*(?:哪些|什么|多少)?\s*(?:IP|ip|代理|proxy)/i,
      /(?:最近|近期|昨天|上周|本周|今天).*(?:开通|购买|买)(?:了|过|的)+\s*(?:IP|ip|代理|proxy)/i,
      /(?:今天|今日|最近|近期).*(?:开通|开的|购买).*(?:静态|代理|IP|ip).*(?:订单)?/i,
      /(?:把|将|给我|发给我|列出|列表|show|list).*(?:开通|购买|买)(?:了|过|的)+\s*(?:IP|ip|代理|proxy)/i,
      /(?:查一下|查看|查询|帮我查|看看).*(?:最近|我的?)\s*(?:开通|购买).*(?:IP|ip|代理)/i,
      /(?:我的|my)\s*(?:IP|ip|代理|proxy)\s*(?:列表|list|有哪些)/i,
      /(?:list|show)\s+my\s+(?:ip|proxy|proxies)/i,
      /(?:我|我的).*(?:有哪些|有什么|有多少).*(?:静态|订单|order)/i,
      /(?:我|我的).*(?:买过|购买过|买了|开通过|开过).*(?:哪些|什么|多少).*(?:静态|订单|order|IP|ip)/i,
      /(?:列出|列表|看看|展示|显示).*(?:所有|全部|我的?).*(?:IP|ip)/i,
      /(?:最近|近期).*(?:开通|买|购买).*(?:IP|ip)/i,
      /^(?!.*(?:renew|续费|续期|extend)).*(?:all|my)\s+(?:ip|proxy|proxies)\s*$/i,
      /^(?!.*(?:续费|续期|renew|extend)).*(?:所有|全部).*(?:IP|ip)\s*$/i,
      /(?:查看|查询|帮我查|帮我查看|看看).*(?:最近|近期).*(?:的?\s*)?(?:订单|order)/i,
      /(?:帮我|我的).*(?:查看|查).*(?:订单|order)/i,
      /(?:我的|my)\s*(?:代理|proxy)\s*(?:列表|list)/i,
      /(?:查看|查|帮我查).*(?:我的?\s*)?(?:订单|order)/i,
      /(?:我).*(?:有多少个?).*(?:IP|ip)/i,
      /我.*(?:买的|买过的|购买的|开过的|开通的).*(?:那些|那个|这些|哪些)?.*(?:ip|IP)/i,
      /(?:最近|last|recent)\s*\d+\s*(?:条|个|笔)?\s*(?:静态)?\s*(?:订单|order)/i,
      /(?:最近|last|recent)\s*\d+\s*(?:条|个|笔)?\s*\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}.*(?:订单|order)/i,
      /(?:show|list|get)\s+\S+'s?\s*(?:static\s+)?orders?/i,
      /(?:last|recent)\s+\d+\s+orders?\s+(?:for|of)\b/i,
      /\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}.*(?:的?\s*)?(?:订单|order)/i,
    ],
    slotExtractors: [
      {
        slot: 'target_user',
        extract: extractStatsTargetUser,
      },
      {
        slot: 'count',
        extract: extractRecordCount,
      },
      {
        slot: 'search',
        extract: extractSearchKeyword,
      },
      {
        slot: 'period',
        extract: extractPeriod,
      },
      {
        slot: 'date_range',
        extract: extractDateRange,
      },
    ],
    confirmationRequired: false,
  },
  /* ── User list query ── */
  {
    intent: 'query_users',
    patterns: [
      /(?:查看|查询|显示|列出|展示).*(?:用户|账号|客户).*(?:列表|清单|名单)?/i,
      /(?:用户|账号|客户)\s*(?:列表|清单|名单|管理)/i,
      /(?:有哪些|有多少|多少个?).*(?:用户|账号|客户)/i,
      /(?:所有|全部|全部的?).*(?:用户|账号|客户)/i,
      /(?:list|show|get|display)\s+(?:all\s+)?users?/i,
      /(?:user|account)\s+list/i,
      /(?:我的|my)\s*(?:用户|下属|客户|账号).*(?:列表|清单)?/i,
      /(?:下属|名下|旗下).*(?:用户|账号|客户)/i,
      /(?:帮我|帮忙)?.*(?:看看|查查|查下).*(?:用户|账号)/i,
      /(?:搜索|查找|search|find)\s*(?:用户|账号|客户|user)/i,
      /(?:last|recent)\s+\d+\s+users?/i,
      /(?:最近|最新)\s*\d+\s*(?:个|位|名)?\s*(?:用户|账号|客户)/i,
      /(?:代理商|agent)\s*\S+\s*(?:的?\s*)?(?:用户|下属|客户)/i,
      /(?:备注|remark)\s*(?:是|为|含有|包含)?\s*\S+\s*(?:的?\s*)?(?:用户|账号)/i,
      /(?:按|根据).*(?:代理商|备注|用户名).*(?:搜索|查找|筛选).*(?:用户|账号)/i,
      /(?:用户|账号|客户).*(?:搜索|查找|筛选)/i,
    ],
    slotExtractors: [
      {
        slot: 'search',
        extract: extractSearchKeyword,
      },
      {
        slot: 'count',
        extract: extractRecordCount,
      },
    ],
    confirmationRequired: false,
  },
  /* ── Account management ── */
  {
    intent: 'batch_create_users',
    patterns: [
      /(?:批量|batch).*(?:创建|开通|create).*(?:用户|账号|user)/i,
      /(?:创建|开通).*(\d+)\s*(?:个|位|名).*(?:用户|账号)/i,
    ],
    slotExtractors: [
      {
        slot: 'quantity',
        extract: extractBatchQuantity,
      },
      {
        slot: 'initial_balance',
        extract: extractInitialBalance,
      },
    ],
    confirmationRequired: true,
  },
  {
    intent: 'reset_password',
    patterns: [
      /(?:重置|修改|更改|设置).*(?:密码|password)/i,
      /(?:reset|change).*password/i,
    ],
    slotExtractors: [
      {
        slot: 'target_user',
        extract: extractUsername,
      },
    ],
    confirmationRequired: true,
  },
  {
    intent: 'get_referral_code',
    patterns: [
      /(?:获取|查看|查|我的).*(?:推荐码|邀请码|referral)/i,
      /(?:referral|invitation).*code/i,
      /推荐码/i,
    ],
    slotExtractors: [],
    confirmationRequired: false,
  },
  {
    intent: 'set_product_price',
    patterns: [
      /(?:设置|修改|设定).*(?:价格|price)/i,
      /(?:set|change).*price/i,
    ],
    slotExtractors: [
      { slot: 'price', extract: extractAmount },
    ],
    confirmationRequired: true,
  },
  /* ── IP Quality (before purchases — "质量最好的IP" trumps "开通IP") ── */
  /* ── Composite: recommend best match (BEFORE quality/find) ── */
  {
    intent: 'recommend_best_match',
    patterns: [
      /(?:帮我|帮忙)?(?:推荐|选|挑|找).*(?:最?适合|best for|suitable).*(?:tiktok|amazon|亚马逊|爬虫|广告|google|facebook|instagram|注册)/i,
      /(?:帮我|帮忙)?(?:找|推荐).*(?:又.*又|性价比|便宜.*(?:干净|纯净|质量)|(?:干净|纯净|质量).*便宜)/i,
      /(?:帮我|帮忙)?(?:选|挑).*(?:最合适|best match|最佳).*(?:ip|IP|代理)/i,
      /(?:给我|帮我).*(?:推荐|选).*(?:一个|个).*(?:最(?:合适|佳)).*(?:ip|IP|代理)?/i,
      /(?:干净|纯净).*(?:又|并且?|而且).*(?:便宜|cheap)/i,
      /(?:便宜|cheap).*(?:又|并且?|而且).*(?:干净|纯净|质量)/i,
      /(?:找|帮我找|推荐).*(?:适合|用于|for)\s+\S+\s*(?:的?\s*(?:ip|IP|代理))/i,
    ],
    slotExtractors: [
      { slot: 'country', extract: extractCountry },
      { slot: 'city', extract: extractCity },
      {
        slot: 'quality',
        extract: extractQualityFilter,
      },
      { slot: 'purpose', extract: extractPurpose },
      { slot: 'sort', extract: extractSortOrder },
      { slot: 'quantity', extract: extractQuantity },
    ],
    confirmationRequired: false,
  },
  /* ── Composite: find + evaluate (BEFORE quality/find) ── */
  {
    intent: 'find_and_evaluate_ips',
    patterns: [
      /(?:帮我|帮忙)?(?:找|查|搜).*(?:ip|IP|代理).*(?:评估|测[一下]*|检[测查]|看看).*(?:质量|怎么样)/i,
      /(?:帮我|帮忙)?(?:找|查|搜).*(?:ip|IP|代理).*(?:顺便|同时|并).*(?:测|评估|检测|质量)/i,
      /(?:帮我|帮忙)?(?:推荐|找).*(?:一批|几个|一些).*(?:ip|IP|代理).*(?:按|排序).*(?:质量)/i,
      /(?:找|给我|帮我找).*(?:一批|几个|一些)?.*(?:ip|IP).*(?:质量差|不行|不好).*(?:不要|过滤|排除|去掉)/i,
      /(?:按|根据).*(?:质量|quality).*(?:排序|排列|rank|sort).*(?:ip|IP)/i,
      /(?:evaluate|check)\s+quality\s+(?:of\s+)?.*(?:ip|IP)/i,
      /(?:find|search).*(?:ip|IP).*(?:rank|sort|evaluate).*(?:quality)/i,
      /(?:找|查|搜|帮我).*(?:ip|IP).*质量.*(?:排|选|筛)/i,
      /(?:找|帮我找|查).*(?:ip|IP).*(?:质量)(?:怎么样|好不好|咋样)/i,
      /(?:帮我|帮忙)?(?:挑|选|找).*(?:ip|IP).*(?:评估|测|检测).*(?:再|后|之后).*(?:买|开|购)/i,
      /(?:便宜|最便宜|cheapest).*(?:ip|IP).*(?:但|不过).*(?:质量)/i,
      /(?:帮我|帮忙)?(?:找|查|搜).*(?:ip|IP).*(?:质量好).*(?:直接|就).*(?:开|买|购)/i,
      /(?:ip|IP).*(?:质量)(?:怎么样|好不好|咋样|如何)(?!.*\d{1,3}\.\d{1,3})/i,
      /(?:找|查|搜|帮我).*(?:ip|IP).*(?:质量)(?:高于|大于|超过|>=?)?\s*\d+/i,
    ],
    slotExtractors: [
      { slot: 'country', extract: extractCountry },
      { slot: 'city', extract: extractCity },
      {
        slot: 'quality',
        extract: extractQualityFilter,
      },
      {
        slot: 'qualityMin',
        extract: extractQualityThreshold,
      },
      { slot: 'sort', extract: extractSortOrder },
      { slot: 'quantity', extract: extractQuantity },
      { slot: 'purpose', extract: extractPurpose },
      {
        slot: 'excludePrefix',
        extract: extractExcludePrefix,
      },
    ],
    confirmationRequired: false,
  },
  /* ── Composite: refine previous results ── */
  {
    intent: 'refine_search_results',
    patterns: [
      /^(?:这批|这一批|这些|上一批|前面的?)(?:不行|不好|不满意|不太?行|差|质量差)/,
      /^(?:下一批|下一组|再来一?[批组]|换一?[批组])$/,
      /^(?:再来|还要|还需要)\s*\d+\s*(?:个|条)/,
      /^换(?:个?|一些?)(?:便宜|贵|好|差)(?:一?点|些?)(?:的)?$/,
      /^只要(?:住宅|机房|静态|动态|datacenter|residential)/i,
      /^(?:评分|质量|分数)\s*(?:高于|大于|超过|>=?)?\s*\d+\s*(?:以上|分以上)?/,
      /^不要(?:机房|datacenter|住宅|residential)/i,
      /^(?:还有(?:吗|别的|其他)|有没有别的)$/,
      /^(?:要|只要|我要)(?:同地区|同类型|类似|一样)的?$/,
      /^(?:前面的?|这几个|那几个)(?:里|中)?(?:选|挑|找)(?:最好|最便宜|质量最高)/,
      /^(?:first|next|another)\s*(?:batch|group|set)/i,
      /^(?:switch|change)\s+to\s+(?:cheaper|better|residential)/i,
    ],
    slotExtractors: [
      {
        slot: 'quality',
        extract: extractQualityFilter,
      },
      {
        slot: 'qualityMin',
        extract: extractQualityThreshold,
      },
      { slot: 'sort', extract: extractSortOrder },
      { slot: 'quantity', extract: extractQuantity },
      {
        slot: 'excludePrefix',
        extract: extractExcludePrefix,
      },
    ],
    confirmationRequired: false,
  },
  {
    intent: 'check_ip_quality',
    patterns: [
      /(?:查询|检测|检查|查看|check).*\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}.*(?:质量|quality)/i,
      /(?:查询|检测|检查|查看|check).*\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}/i,
      /(?:查询|检测|检查|查看|check)\s*(?:ip|IP)\s*(?:质量|quality)$/i,
      /(?:通过|用|使用)\s*(?:ping0|ipqualityscore)/i,
      /(?:检测|check).*(?:号段).*(?:质量|数据)/i,
      /\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}.*(?:的?\s*)?(?:质量|quality|怎么样|好不好|干净|安全|被封|被标记|风险|污染|住宅|分数|报告)/i,
      /(?:这个|这).*(?:ip|IP).*(?:干净|怎么样|质量|安全)/i,
      /(?:质量检测|质量查询)\s*\d{1,3}\.\d{1,3}/i,
      /(?:测一下|查一下|查下|看下|看看).*\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}.*(?:质量|怎么样|干净|风险|污染|被封)/i,
      /(?:检查|查看|查)\s*\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}\s*(?:是不是|有没有|是否)/i,
      /(?:check|is)\s+\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}.*(?:quality|clean|safe|good)/i,
      /(?:帮我|帮忙)?(?:测|检测|查).*\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}/i,
      /(?:check|query)\s+(?:quality|ip\s*quality)\s+(?:of\s+)?\d{1,3}\.\d{1,3}/i,
      /(?:看看|查看|查).*\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}.*(?:的?\s*)?(?:IP)?.*(?:质量|怎么样)/i,
      /(?:检查).*(?:号段|这个号段)\s*\d{1,3}\.\d{1,3}/i,
      /(?:测一下|测测|测下|测)(?!.*(?:美国|英国|日本|德国|韩国|纽约|洛杉矶|华盛顿|东京)).*(?:IP|ip)/i,
      /(?:ip|IP)\s*(?:质量|咋样).*\d{1,3}\.\d{1,3}/i,
    ],
    slotExtractors: [
      {
        slot: 'ip_segment',
        extract: extractIpSegment,
      },
    ],
    confirmationRequired: false,
  },
  {
    intent: 'find_best_ip',
    patterns: [
      /(?:开通|找|查找|推荐).*(?:质量最好|最优质|best quality|最干净|最安全).*(?:ip|IP)/i,
      /(?:质量最好|最优质|best quality|最干净|最安全).*(?:ip|IP)/i,
      /(?:推荐|suggest|recommend)(?!.*(?:最便宜|最低价|cheapest|最贵|最高价|价格)).*(?:ip|IP|代理)/i,
      /(?:帮我|帮忙|给我)?(?:推荐|选|找).*(?:好用?|好的?|靠谱|稳定|纯净|干净|不.*封).*(?:ip|IP|代理)/i,
      /(?:帮我|帮忙|给我)?(?:推荐|选|找)(?!.*(?:最便宜|最低价|cheapest|最贵|最高价|便宜|排除|不要|exclude|住宅|机房|datacenter|residential|适合|又.*又)).*(?:一个|个).*(?:ip|IP|代理)/i,
      /(?:有没有|有什么|有啥|有).*(?:好(?:用|的)?|质量好).*(?:ip|IP|代理).*(?:推荐|吗)?/i,
      /(?:哪个|哪些?).*(?:ip|IP).*(?:质量最?好|最优)/i,
      /(?:质量最?高|质量最?好).*(?:ip|IP|代理)/i,
      /(?:我要|我想要|我需要).*(?:质量最?好|最干净|不.*封|纯净)/i,
      /(?:find|best|cleanest|good).*(?:ip|IP|proxy)/i,
      /(?:ip|IP|proxy).*(?:推荐|suggest|recommend)/i,
      /(?:没被?污染|不被封|不容易.*封).*(?:ip|IP)/i,
      /(?:给我|帮我|帮忙).*(?:一个|个).*(?:纯净|干净|安全|好用|好的?|靠谱|稳定|不.*封).*(?:ip|IP|代理)?/i,
      /best\s+(?:quality\s+)?(?:ip|IP|proxy)\s+(?:in\s+)?\S+/i,
      /(?:帮我|帮忙)?(?:选|找|挑).*(?:一个|个).*(?:好|好的?).*(?:ip|IP)/i,
      /最好的.*(?:IP|ip|代理)/i,
      /(?:帮我|帮忙)(?:选|挑).*(?:IP|ip|代理)/i,
      /^推荐.*(?:不|先不|但不|但是不).*(?:买|开|购)/i,
      /推荐.*(?:好的?|好用|质量好).*(?:帮我|直接)?/i,
      /(?:有什么|有啥).*(?:又.*又|性价比)/i,
      /先看看.*(?:好的|什么).*(?:IP|ip)?.*再/i,
    ],
    slotExtractors: [
      { slot: 'country', extract: extractCountry },
      { slot: 'city', extract: extractCity },
    ],
    confirmationRequired: false,
  },
  /* ── Purchase / Provision (after all queries) ── */
  {
    intent: 'purchase_ip',
    patterns: [
      /(?:开通|开|买|购买|帮忙开|帮我开|我要|我需要).*(\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3})/i,
      /(?:need|want|buy|open|provision|purchase|get).*(\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3})/i,
      /purchase\s+(\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3})/i,
    ],
    slotExtractors: [
      {
        slot: 'ip_segment',
        extract: extractIpSegment,
      },
      { slot: 'quantity', extract: extractQuantity },
      { slot: 'duration', extract: extractDuration },
      { slot: 'remark', extract: extractRemark },
      {
        slot: 'target_user',
        extract: extractStatsTargetUser,
      },
    ],
    confirmationRequired: true,
  },
  {
    intent: 'purchase_dynamic',
    patterns: [
      /(?:购买|开通|买).*(?:动态).*(?:代理|proxy|流量)?/i,
      /(?:buy|purchase|open).*dynamic/i,
      /(?:开通|购买|买)\s*\d+(?:\.\d+)?\s*G(?:B)?/i,
      /(?:充值|充|加)\s*\d+(?:\.\d+)?\s*G(?:B)?\s*(?:流量)?/i,
      /(?:买|购买|帮我买|帮忙买).*(?:动态|流量)/i,
      /(?:需要|想要|我要|我想).*(?:动态).*(?:代理|流量)?/i,
      /(?:动态).*(?:代理)?.*(?:充值|购买|买)/i,
      /\d+(?:\.\d+)?\s*G(?:B)?\s*(?:动态|流量)/i,
      /(?:买|开通|购买).*(?:动态)(?:的)?$/i,
      /(?:充值|充|加).*(?:动态)/i,
    ],
    slotExtractors: [
      { slot: 'country', extract: extractCountry },
      {
        slot: 'traffic_gb',
        extract: extractTrafficGb,
      },
      {
        slot: 'target_user',
        extract: extractStatsTargetUser,
      },
      { slot: 'remark', extract: extractRemark },
    ],
    confirmationRequired: true,
  },
  {
    intent: 'create_session',
    patterns: [
      /(?:创建|新建|建立|建).*(?:会话|session)/i,
      /(?:buy|purchase|create).*(dynamic|static).*(?:session)/i,
      /create.*session/i,
      /new.*session/i,
      /(?:帮我|帮忙)?(?:开|建|创建).*(?:一个|个)?\s*(?:会话|session)/i,
    ],
    slotExtractors: [
      { slot: 'country', extract: extractCountry },
      { slot: 'city', extract: extractCity },
      {
        slot: 'traffic_gb',
        extract: extractTrafficGb,
      },
      { slot: 'quantity', extract: extractQuantity },
      {
        slot: 'target_user',
        extract: extractStatsTargetUser,
      },
      { slot: 'remark', extract: extractRemark },
    ],
    confirmationRequired: true,
  },
  {
    intent: 'purchase_static',
    patterns: [
      /(?:购买|开通|买).*(?:静态).*(?:代理|proxy|IP)?/i,
      /(?:buy|purchase|open).*static/i,
      /(?:帮我开|帮忙开|开通|开|买).*(?:一个|一台|几个|\d+个)?.*(?:的\s*)?(?:IP|ip)/i,
      /(?:我想要|我需要|我要|我想买).*(?:一个|几个|\d+个)?.*(?:的\s*)?(?:IP|ip)/i,
      /(?:买|购买|帮我买).*(?:代理|proxy)/i,
      /(?:need|want|buy|get)\s+(?:a\s+)?(?:\S+\s+)?(?:ip|IP|proxy)/i,
      /(?:开通|买|购买).*\S+.*(?:代理|ip|IP)$/i,
      /(?:给我|来).*(?:一个|几个|\d+个).*(?:的?\s*)?(?:IP|ip)/i,
      /来个.*(?:ip|IP)/i,
      /开个.*(?:IP|ip)/i,
      /开个.*的.*(?:吧|呗|啊)?\s*$/i,
      /^开通\s*$/i,
    ],
    slotExtractors: [
      { slot: 'ip_segment', extract: extractIpSegment },
      { slot: 'country', extract: extractCountry },
      { slot: 'city', extract: extractCity },
      { slot: 'quantity', extract: extractQuantity },
      { slot: 'duration', extract: extractDuration },
      { slot: 'remark', extract: extractRemark },
      {
        slot: 'target_user',
        extract: extractStatsTargetUser,
      },
    ],
    confirmationRequired: true,
  },
  {
    intent: 'extract_dynamic',
    patterns: [
      /(?:提取|获取|导出).*(?:动态|dynamic).*(?:代理|proxy|链接|link)/i,
      /(?:提取|获取|导出).*(?:代理|proxy|链接|link)/i,
      /(?:extract|get|give\s+me).*(?:dynamic|proxy)/i,
      /(?:帮我|帮忙).*(?:提取|获取).*(?:动态|代理|链接|link)/i,
      /(?:生成|给我).*(?:动态|代理).*(?:链接|link|地址|url)/i,
      /(?:拿|取|给我).*(?:一个|几个|\d+个)?.*(?:动态代理|代理)/i,
      /(?:动态代理|动态IP).*(?:链接|地址|url|link)/i,
      /(?:动态).*(?:提取链接|代理链接)/i,
    ],
    slotExtractors: [
      { slot: 'country', extract: extractCountry },
      { slot: 'city', extract: extractCity },
      { slot: 'quantity', extract: extractQuantity },
      {
        slot: 'target_user',
        extract: extractStatsTargetUser,
      },
    ],
    confirmationRequired: false,
  },
  {
    intent: 'renew_static',
    patterns: [
      /(?:续费|续期|renew|extend).*(?:静态|代理|proxy|IP|订单|order)/i,
      /(?:帮我|帮忙)?续费/i,
      /(?:renew|extend).*(?:subscription|order|ip|proxy|\d{1,3}\.\d{1,3})/i,
      /^续期/i,
      /(?:续|续期|续费).*(\d+)\s*(?:天|个月|月|年|week|month)/i,
      /(?:给|帮|把).*(?:IP|ip|\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}).*(?:续|延期|延长)/i,
      /(?:再续|继续用|延长使用)/i,
      /renew.*\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}/i,
      /(?:renew|extend)\s+(?:my\s+)?(?:ip|proxy)/i,
      /^续个费\s*$/i,
    ],
    slotExtractors: [
      {
        slot: 'ip_segment',
        extract: extractIpSegment,
      },
      {
        slot: 'order_no',
        extract: extractOrderNo,
      },
      { slot: 'duration', extract: extractDuration },
      {
        slot: 'target_user',
        extract: extractStatsTargetUser,
      },
    ],
    confirmationRequired: true,
  },
  /* query_ip_inventory placed after all specific IP intents to avoid swallowing */
  {
    intent: 'query_ip_inventory',
    patterns: [
      /(?:查询|查看|搜索|查).*(ip|IP|代理).*(库存|价格)/i,
      /(\S+).*有.*(?:哪些|什么|多少).*(ip|IP)/i,
      /(?:available|show|list|check).*(?:ip|proxy|inventor)/i,
      /(\S+).*(ip|IP).*(stock|price|inventory)/i,
      /(?:找|帮忙找|帮我找|推荐).*(?:最便宜|最低价|cheapest|最贵|最高价).*(?:ip|IP|代理)/i,
      /(?:最便宜|最低价|cheapest|最贵|最高价).*(?:ip|IP|代理)/i,
      /(?:看看|查查|查看).*(?:的\s*)?(?:IP|ip).*(?:库存|资源)/i,
      /(?:有没有|有无)(?!.*(?:好用|好的|质量|干净|纯净|安全|靠谱|稳定|被|风险|标记|污染|到期|过期|快到)).*(?:的\s*)?(?:IP|ip)/i,
      /(IP|ip)\s*(?:库存|价格|列表|资源)$/i,
      /(?:都有|有)(?!.*(?:到期|过期|快到|快过|要到|要过)).*(?:哪些|什么|啥).*(?:地区|城市)?.*(?:的?\s*)?(?:IP|ip)/i,
      /(?:哪个|哪些?).*(?:IP|ip).*(?:最便宜|便宜|最低)/i,
      /\S+\s*(?:IP|ip)\s*(?:有多少|价格|有吗)/i,
      /(?:what|which).*(?:ip|proxy|proxies).*(?:available|have)/i,
      /(?:ip|proxy|proxies).*(?:in|for)\s+\S+/i,
      /\S+\s*有\s*(?:IP|ip)\s*(?:吗|么|嘛|没)?\s*$/i,
      /\S+.*(?:哪些|什么|哪个).*(?:城市|地区|区域).*(?:有|的).*(?:IP|ip)/i,
      /(?:什么|啥).*(?:IP|ip).*(?:最便宜|便宜)/i,
      /(?:IP|ip).*最便宜/i,
      /\S+\s*(?:IP|ip)\s*怎么样\s*$/i,
      /\S+\s*(?:IP|ip)\s*还有多少/i,
      /\S+\s*(?:IP|ip)?\s*有不有/i,
      /(?:还有|有没有).*(?:便宜的?).*(?:ip|IP)/i,
      /^(?!.*(?:推荐|质量|好用|好的|靠谱|干净|纯净|稳定|安全|买|购|开通|续|到期|过期|快|我的|列出|所有|提取|给我|来|测|充|选))[\u4e00-\u9fff]{2,8}(?:的?\s*)?(?:IP|ip)\s*$/i,
      /[\u4e00-\u9fff]{2,8}\s*(?:机房|服务器|代理)\s*$/i,
      /[\u4e00-\u9fff]+\s*(?:ip|IP)\s*(?:有哪些|有什么|有多少)/i,
      /(?:西海岸|东海岸|北美|欧洲|东南亚|东亚|中东).*(?:IP|ip|代理|proxy|有)/i,
      /^\w[\w\s]*\s+(?:ip|proxy|proxies)\s*$/i,
      /^(?:ip|proxy|proxies)\s+(?:in|for)\s+\w+/i,
      /(?:住宅|residential|机房|datacenter|idc|data center).*(?:ip|IP|代理|proxy)/i,
      /(?:ip|IP|代理|proxy).*(?:住宅|residential|机房|datacenter|idc)/i,
      /(?:不要|排除|去掉|exclude|without|no)\s*\d{1,3}\s*(?:开头|段|prefix).*(?:ip|IP|代理)?/i,
    ],
    slotExtractors: [
      { slot: 'city', extract: extractCity },
      { slot: 'country', extract: extractCountry },
      { slot: 'sort', extract: extractSortOrder },
      {
        slot: 'excludePrefix',
        extract: extractExcludePrefix,
      },
      {
        slot: 'quality',
        extract: extractQualityFilter,
      },
    ],
    confirmationRequired: false,
  },

  // ========== Phase 2: Profile Management ==========
  {
    intent: 'create_profile',
    patterns: [
      /(?:创建|新建|添加).*(?:配置|profile|浏览器)/i,
      /create\s+(?:a\s+)?(?:browser\s+)?profile/i,
    ],
    slotExtractors: [
      { slot: 'name', extract: extractProfileName },
      { slot: 'os', extract: extractOs },
      { slot: 'browser', extract: extractBrowser },
    ],
    confirmationRequired: true,
  },
  {
    intent: 'list_profiles',
    patterns: [
      /(?:查看|列出|查询|显示).*(?:配置|profile|浏览器)/i,
      /(?:配置|profile)\s*(?:列表|list)/i,
      /list\s+profiles?/i,
    ],
    slotExtractors: [],
    confirmationRequired: false,
  },
  {
    intent: 'update_profile',
    patterns: [
      /(?:修改|更新|编辑).*(?:配置|profile)/i,
      /update\s+profile/i,
    ],
    slotExtractors: [
      { slot: 'profile_id', extract: extractProfileId },
    ],
    confirmationRequired: true,
  },
  {
    intent: 'delete_profile',
    patterns: [
      /(?:删除|移除).*(?:配置|profile)/i,
      /delete\s+profile/i,
    ],
    slotExtractors: [
      { slot: 'profile_id', extract: extractProfileId },
    ],
    confirmationRequired: true,
  },
  {
    intent: 'duplicate_profile',
    patterns: [
      /(?:复制|克隆|拷贝).*(?:配置|profile)/i,
      /(?:clone|copy|duplicate)\s+profile/i,
    ],
    slotExtractors: [
      { slot: 'profile_id', extract: extractProfileId },
    ],
    confirmationRequired: false,
  },
  {
    intent: 'batch_create_profiles',
    patterns: [
      /批量(?:创建|生成).*(?:配置|profile)/i,
      /batch\s+create\s+profiles?/i,
    ],
    slotExtractors: [
      { slot: 'count', extract: extractCount },
    ],
    confirmationRequired: true,
  },
  {
    intent: 'generate_fingerprint',
    patterns: [
      /(?:生成|创建).*(?:指纹|fingerprint)/i,
      /generate\s+fingerprint/i,
    ],
    slotExtractors: [
      { slot: 'os', extract: extractOs },
      { slot: 'browser', extract: extractBrowser },
    ],
    confirmationRequired: false,
  },
  {
    intent: 'bind_proxy',
    patterns: [
      /(?:绑定|关联).*(?:代理|proxy).*(?:配置|profile)/i,
      /(?:给|为).*(?:配置|profile).*(?:绑定|关联).*(?:代理|proxy)/i,
      /bind\s+proxy/i,
    ],
    slotExtractors: [
      { slot: 'profile_id', extract: extractProfileId },
    ],
    confirmationRequired: true,
  },
  {
    intent: 'import_profile',
    patterns: [
      /(?:导入).*(?:配置|profile)/i,
      /import\s+profiles?/i,
    ],
    slotExtractors: [],
    confirmationRequired: true,
  },
  {
    intent: 'export_profile',
    patterns: [
      /(?:导出|备份).*(?:配置|profile)/i,
      /export\s+profiles?/i,
    ],
    slotExtractors: [
      { slot: 'profile_id', extract: extractProfileId },
    ],
    confirmationRequired: false,
  },
  {
    intent: 'group_profile',
    patterns: [
      /(?:移到|移入|加入|设置).*(?:分组|group)/i,
      /(?:分组).*(?:配置|profile)/i,
    ],
    slotExtractors: [
      { slot: 'profile_id', extract: extractProfileId },
    ],
    confirmationRequired: true,
  },
  {
    intent: 'tag_profile',
    patterns: [
      /(?:打|添加|设置).*(?:标签|tag)/i,
      /tag\s+profile/i,
    ],
    slotExtractors: [
      { slot: 'profile_id', extract: extractProfileId },
    ],
    confirmationRequired: false,
  },

  // ========== Phase 2: Fingerprint Control ==========
  {
    intent: 'set_user_agent',
    patterns: [
      /(?:设置|修改|更改).*(?:UA|user.?agent)/i,
    ],
    slotExtractors: [
      { slot: 'profile_id', extract: extractProfileId },
      { slot: 'browser', extract: extractBrowser },
    ],
    confirmationRequired: true,
  },
  {
    intent: 'set_timezone',
    patterns: [
      /(?:设置|修改|更改|改成).*(?:时区|timezone)/i,
    ],
    slotExtractors: [
      { slot: 'profile_id', extract: extractProfileId },
      { slot: 'timezone', extract: extractTimezone },
    ],
    confirmationRequired: true,
  },
  {
    intent: 'set_language',
    patterns: [
      /(?:设置|修改|更改).*(?:语言|language|locale)/i,
    ],
    slotExtractors: [
      { slot: 'profile_id', extract: extractProfileId },
    ],
    confirmationRequired: true,
  },
  {
    intent: 'set_canvas',
    patterns: [
      /(?:设置|修改|关闭).*(?:canvas)/i,
    ],
    slotExtractors: [
      { slot: 'profile_id', extract: extractProfileId },
      { slot: 'mode', extract: extractFpMode },
    ],
    confirmationRequired: true,
  },
  {
    intent: 'set_webgl',
    patterns: [
      /(?:设置|修改|关闭).*(?:webgl)/i,
    ],
    slotExtractors: [
      { slot: 'profile_id', extract: extractProfileId },
      { slot: 'mode', extract: extractFpMode },
    ],
    confirmationRequired: true,
  },
  {
    intent: 'set_audio',
    patterns: [
      /(?:设置|修改|关闭).*(?:audio|音频)/i,
    ],
    slotExtractors: [
      { slot: 'profile_id', extract: extractProfileId },
      { slot: 'mode', extract: extractFpMode },
    ],
    confirmationRequired: true,
  },
  {
    intent: 'set_webrtc',
    patterns: [
      /(?:设置|修改|禁用|关闭|启用).*(?:webrtc)/i,
      /(?:webrtc).*(?:设置|修改|禁用|关闭)/i,
    ],
    slotExtractors: [
      { slot: 'profile_id', extract: extractProfileId },
      { slot: 'mode', extract: extractWebrtcMode },
    ],
    confirmationRequired: true,
  },
  {
    intent: 'set_fonts',
    patterns: [
      /(?:设置|修改).*(?:字体|font)/i,
    ],
    slotExtractors: [
      { slot: 'profile_id', extract: extractProfileId },
    ],
    confirmationRequired: true,
  },
  {
    intent: 'set_plugins',
    patterns: [
      /(?:设置|修改).*(?:插件|plugin)/i,
    ],
    slotExtractors: [
      { slot: 'profile_id', extract: extractProfileId },
    ],
    confirmationRequired: true,
  },
  {
    intent: 'set_client_hints',
    patterns: [
      /(?:设置|修改).*(?:client.?hints)/i,
    ],
    slotExtractors: [
      { slot: 'profile_id', extract: extractProfileId },
    ],
    confirmationRequired: true,
  },

  // ========== Phase 2: Proxy Management ==========
  {
    intent: 'add_proxy',
    patterns: [
      /(?:添加|新增).*(?:代理|proxy)/i,
      /add\s+proxy/i,
    ],
    slotExtractors: [
      { slot: 'proxy_url', extract: extractProxyUrl },
    ],
    confirmationRequired: true,
  },
  {
    intent: 'import_proxy',
    patterns: [
      /(?:导入|批量导入).*(?:代理|proxy)/i,
      /import\s+prox/i,
    ],
    slotExtractors: [],
    confirmationRequired: true,
  },
  {
    intent: 'verify_proxy',
    patterns: [
      /(?:测试|验证|检查).*(?:代理|proxy).*(?:连通|连接)/i,
      /(?:测试|验证).*(?:代理|proxy)/i,
      /(?:verify|test)\s+proxy/i,
    ],
    slotExtractors: [],
    confirmationRequired: false,
  },
  {
    intent: 'rotate_proxy',
    patterns: [
      /(?:轮换|更换|切换|换一个).*(?:代理|proxy)/i,
      /rotate\s+proxy/i,
    ],
    slotExtractors: [
      { slot: 'profile_id', extract: extractProfileId },
    ],
    confirmationRequired: true,
  },
  {
    intent: 'list_proxy',
    patterns: [
      /(?:查看|列出|显示).*(?:可用)?(?:代理|proxy).*(?:列表)?/i,
      /(?:代理|proxy)\s*(?:列表|list)/i,
      /list\s+prox/i,
    ],
    slotExtractors: [],
    confirmationRequired: false,
  },

  // ========== Phase 2: Validation ==========
  {
    intent: 'validate_fingerprint',
    patterns: [
      /(?:检查|校验|验证).*(?:指纹|fingerprint).*(?:一致|匹配)/i,
      /(?:指纹|fingerprint).*(?:校验|验证|一致性)/i,
      /validate\s+fingerprint/i,
    ],
    slotExtractors: [
      { slot: 'profile_id', extract: extractProfileId },
    ],
    confirmationRequired: false,
  },
  {
    intent: 'auto_match_proxy',
    patterns: [
      /(?:自动|智能).*(?:匹配|推荐).*(?:代理|proxy)/i,
      /auto.?match\s+proxy/i,
    ],
    slotExtractors: [
      { slot: 'profile_id', extract: extractProfileId },
    ],
    confirmationRequired: true,
  },

  // ========== Phase 3: Browser Management ==========
  {
    intent: 'launch_browser',
    patterns: [
      /(?:启动|打开|开启).*(?:浏览器|browser)/i,
      /launch\s+browser/i,
    ],
    slotExtractors: [
      { slot: 'profile_id', extract: extractProfileId },
    ],
    confirmationRequired: true,
  },
  {
    intent: 'close_browser',
    patterns: [
      /(?:关闭|停止).*(?:浏览器|browser)/i,
      /close\s+browser/i,
    ],
    slotExtractors: [
      { slot: 'instance_id', extract: extractInstanceId },
    ],
    confirmationRequired: true,
  },
  {
    intent: 'restart_browser',
    patterns: [
      /(?:重启|重新启动).*(?:浏览器|browser)/i,
      /restart\s+browser/i,
    ],
    slotExtractors: [
      { slot: 'instance_id', extract: extractInstanceId },
    ],
    confirmationRequired: true,
  },
  {
    intent: 'batch_launch_browser',
    patterns: [
      /批量(?:启动|打开).*(?:浏览器|browser)/i,
      /batch\s+launch/i,
    ],
    slotExtractors: [],
    confirmationRequired: true,
  },
  {
    intent: 'batch_close_browser',
    patterns: [
      /(?:批量)?(?:关闭|停止).*所有.*(?:浏览器|browser)/i,
      /batch\s+close/i,
    ],
    slotExtractors: [],
    confirmationRequired: true,
  },
  {
    intent: 'list_browsers',
    patterns: [
      /(?:查看|列出|显示).*(?:运行|活跃)?.*(?:浏览器|browser)/i,
      /(?:浏览器|browser)\s*(?:列表|list)/i,
      /list\s+browsers?/i,
    ],
    slotExtractors: [],
    confirmationRequired: false,
  },
  {
    intent: 'navigate_to',
    patterns: [
      /(?:用|使用).*(?:浏览器|browser).*(?:访问|打开|导航)/i,
      /navigate\s+to/i,
    ],
    slotExtractors: [
      { slot: 'instance_id', extract: extractInstanceId },
      { slot: 'url', extract: extractUrl },
    ],
    confirmationRequired: false,
  },
  {
    intent: 'take_screenshot',
    patterns: [
      /(?:截图|截屏|screenshot)/i,
    ],
    slotExtractors: [
      { slot: 'instance_id', extract: extractInstanceId },
    ],
    confirmationRequired: false,
  },

  // ========== Phase 3: Task Management ==========
  {
    intent: 'submit_task',
    patterns: [
      /(?:用|使用).*(?:配置|profile).*(?:抓取|爬取|采集)/i,
      /(?:提交|创建).*(?:任务|task)/i,
      /submit\s+task/i,
    ],
    slotExtractors: [
      { slot: 'profile_id', extract: extractProfileId },
      { slot: 'url', extract: extractUrl },
    ],
    confirmationRequired: true,
  },
  {
    intent: 'run_script',
    patterns: [
      /(?:在|用).*(?:浏览器|browser).*(?:执行|运行).*(?:脚本|script)/i,
      /(?:获取|抓取).*(?:页面|page).*(?:标题|title|内容)/i,
      /run\s+script/i,
    ],
    slotExtractors: [
      { slot: 'instance_id', extract: extractInstanceId },
    ],
    confirmationRequired: true,
  },
  {
    intent: 'schedule_task',
    patterns: [
      /(?:\d+\s*(?:小时|分钟|秒)后|定时|延迟).*(?:截图|抓取|任务)/i,
      /schedule\s+task/i,
    ],
    slotExtractors: [
      { slot: 'profile_id', extract: extractProfileId },
      { slot: 'url', extract: extractUrl },
    ],
    confirmationRequired: true,
  },
  {
    intent: 'batch_task',
    patterns: [
      /批量(?:截图|抓取|采集).*(?:网站|站点|url)/i,
      /batch\s+task/i,
    ],
    slotExtractors: [],
    confirmationRequired: true,
  },
  {
    intent: 'query_task',
    patterns: [
      /(?:查看|查询|获取).*(?:任务|task).*(?:状态|结果)/i,
      /(?:任务|task)\s*(?:列表|list|状态)/i,
      /query\s+task/i,
    ],
    slotExtractors: [],
    confirmationRequired: false,
  },
  {
    intent: 'run_detection_test',
    patterns: [
      /(?:检测|测试).*(?:指纹|fingerprint).*(?:质量|检测)/i,
      /(?:反检测|anti.?detect).*(?:测试|test)/i,
      /run\s+detection/i,
    ],
    slotExtractors: [
      { slot: 'profile_id', extract: extractProfileId },
    ],
    confirmationRequired: false,
  },

  // ========== Phase 4: Profile Lifecycle ==========
  {
    intent: 'pause_profile',
    patterns: [
      /暂停.*(?:配置|profile)/i,
      /(?:配置|profile).*暂停/i,
      /pause\s+profile/i,
    ],
    slotExtractors: [
      { slot: 'profile_id', extract: extractProfileId },
    ],
    confirmationRequired: true,
  },
  {
    intent: 'resume_profile',
    patterns: [
      /恢复.*(?:配置|profile)/i,
      /(?:配置|profile).*恢复/i,
      /resume\s+profile/i,
    ],
    slotExtractors: [
      { slot: 'profile_id', extract: extractProfileId },
    ],
    confirmationRequired: true,
  },
  {
    intent: 'archive_profile',
    patterns: [
      /归档.*(?:配置|profile)/i,
      /(?:配置|profile).*归档/i,
      /archive\s+profile/i,
    ],
    slotExtractors: [
      { slot: 'profile_id', extract: extractProfileId },
    ],
    confirmationRequired: true,
  },

  // ========== Phase 4: Extended Fingerprints ==========
  {
    intent: 'set_os',
    patterns: [
      /设置.*(?:操作系统|os)/i,
      /(?:改|换).*(?:操作系统|os)/i,
      /set\s+os/i,
    ],
    slotExtractors: [
      { slot: 'profile_id', extract: extractProfileId },
      { slot: 'os', extract: extractOs },
    ],
    confirmationRequired: false,
  },
  {
    intent: 'set_cpu',
    patterns: [
      /设置.*cpu.*(?:核|core)/i,
      /(?:改|设).*cpu/i,
      /set\s+cpu/i,
    ],
    slotExtractors: [
      { slot: 'profile_id', extract: extractProfileId },
      { slot: 'cpu_cores', extract: extractCpuCores },
    ],
    confirmationRequired: false,
  },
  {
    intent: 'set_memory',
    patterns: [
      /设置.*(?:内存|memory)/i,
      /(?:改|设).*(?:内存|ram)/i,
      /set\s+(?:memory|ram)/i,
    ],
    slotExtractors: [
      { slot: 'profile_id', extract: extractProfileId },
      { slot: 'memory_gb', extract: extractMemoryGb },
    ],
    confirmationRequired: false,
  },
  {
    intent: 'set_gpu',
    patterns: [
      /设置.*(?:gpu|显卡)/i,
      /(?:改|换).*(?:gpu|显卡)/i,
      /set\s+gpu/i,
    ],
    slotExtractors: [
      { slot: 'profile_id', extract: extractProfileId },
      { slot: 'gpu_model', extract: extractGpuModel },
    ],
    confirmationRequired: false,
  },
  {
    intent: 'set_screen',
    patterns: [
      /设置.*(?:分辨率|屏幕|screen|resolution)/i,
      /(?:改|设).*(?:分辨率|dpr|色深)/i,
      /set\s+(?:screen|resolution)/i,
    ],
    slotExtractors: [
      { slot: 'profile_id', extract: extractProfileId },
      { slot: 'resolution', extract: extractResolution },
    ],
    confirmationRequired: false,
  },
  {
    intent: 'set_media_devices',
    patterns: [
      /设置.*(?:媒体设备|media.?device|摄像头|麦克风)/i,
      /set\s+media.?device/i,
    ],
    slotExtractors: [
      { slot: 'profile_id', extract: extractProfileId },
    ],
    confirmationRequired: false,
  },
  {
    intent: 'set_battery',
    patterns: [
      /设置.*(?:电池|battery)/i,
      /(?:开启|关闭|禁用).*(?:电池|battery)/i,
      /set\s+battery/i,
    ],
    slotExtractors: [
      { slot: 'profile_id', extract: extractProfileId },
      { slot: 'mode', extract: extractFpMode },
    ],
    confirmationRequired: false,
  },
  {
    intent: 'set_webgpu',
    patterns: [
      /设置.*webgpu/i,
      /(?:开启|关闭|禁用).*webgpu/i,
      /set\s+webgpu/i,
    ],
    slotExtractors: [
      { slot: 'profile_id', extract: extractProfileId },
      { slot: 'mode', extract: extractFpMode },
    ],
    confirmationRequired: false,
  },
  {
    intent: 'set_navigator',
    patterns: [
      /设置.*navigator/i,
      /set\s+navigator/i,
    ],
    slotExtractors: [
      { slot: 'profile_id', extract: extractProfileId },
    ],
    confirmationRequired: false,
  },
  {
    intent: 'set_device_memory',
    patterns: [
      /设置.*device.?memory/i,
      /set\s+device.?memory/i,
    ],
    slotExtractors: [
      { slot: 'profile_id', extract: extractProfileId },
      { slot: 'memory_gb', extract: extractMemoryGb },
    ],
    confirmationRequired: false,
  },
  {
    intent: 'set_gamepad',
    patterns: [
      /设置.*(?:游戏手柄|gamepad)/i,
      /(?:开启|关闭|禁用).*(?:gamepad|游戏手柄)/i,
      /set\s+gamepad/i,
    ],
    slotExtractors: [
      { slot: 'profile_id', extract: extractProfileId },
      { slot: 'mode', extract: extractFpMode },
    ],
    confirmationRequired: false,
  },

  // ========== Phase 4: Proxy Expansion ==========
  {
    intent: 'delete_proxy',
    patterns: [
      /删除.*(?:代理|proxy)/i,
      /(?:移除|去掉).*(?:代理|proxy)/i,
      /delete\s+proxy/i,
      /remove\s+proxy/i,
    ],
    slotExtractors: [
      { slot: 'proxy_id', extract: extractProxyId },
    ],
    confirmationRequired: true,
  },
  {
    intent: 'proxy_speed_test',
    patterns: [
      /(?:代理|proxy).*(?:测速|speed)/i,
      /(?:测试|test).*(?:代理|proxy).*(?:速度|speed)/i,
      /proxy\s+speed/i,
    ],
    slotExtractors: [
      { slot: 'proxy_id', extract: extractProxyId },
    ],
    confirmationRequired: false,
  },
  {
    intent: 'proxy_quality_check',
    patterns: [
      /(?:检测|检查).*(?:代理|proxy).*(?:质量|quality)/i,
      /(?:代理|proxy).*(?:质量|quality).*(?:检测|检查)/i,
      /proxy\s+quality/i,
    ],
    slotExtractors: [
      { slot: 'proxy_id', extract: extractProxyId },
    ],
    confirmationRequired: false,
  },
  {
    intent: 'create_proxy_pool',
    patterns: [
      /创建.*(?:代理池|proxy.?pool)/i,
      /create\s+proxy\s+pool/i,
    ],
    slotExtractors: [
      { slot: 'name', extract: extractWorkspaceName },
    ],
    confirmationRequired: true,
  },
  {
    intent: 'list_proxy_pools',
    patterns: [
      /(?:查看|列出|显示).*(?:代理池|proxy.?pool)/i,
      /(?:代理池|proxy.?pool).*(?:列表|list)/i,
      /list\s+proxy\s+pool/i,
    ],
    slotExtractors: [],
    confirmationRequired: false,
  },
  {
    intent: 'delete_proxy_pool',
    patterns: [
      /删除.*(?:代理池|proxy.?pool)/i,
      /delete\s+proxy\s+pool/i,
    ],
    slotExtractors: [
      { slot: 'pool_id', extract: extractPoolId },
    ],
    confirmationRequired: true,
  },
  {
    intent: 'auto_select_proxy',
    patterns: [
      /自动.*(?:选择|选|匹配).*(?:最佳|best).*(?:代理|proxy)/i,
      /(?:代理|proxy).*自动.*(?:选择|选)/i,
      /auto.?select.*proxy/i,
    ],
    slotExtractors: [
      { slot: 'profile_id', extract: extractProfileId },
    ],
    confirmationRequired: true,
  },

  // ========== Phase 4: Browser Page Actions ==========
  {
    intent: 'click_element',
    patterns: [
      /(?:点击|click).*(?:元素|element|按钮|button)/i,
      /在.*(?:浏览器|browser).*(?:点击|click)/i,
      /click\s+/i,
    ],
    slotExtractors: [
      { slot: 'instance_id', extract: extractInstanceId },
      { slot: 'selector', extract: extractSelector },
    ],
    confirmationRequired: false,
  },
  {
    intent: 'input_text',
    patterns: [
      /(?:输入|填写|type|fill|input).*(?:文本|text|内容)/i,
      /在.*(?:输入框|input|field).*(?:输入|填)/i,
    ],
    slotExtractors: [
      { slot: 'instance_id', extract: extractInstanceId },
      { slot: 'selector', extract: extractSelector },
      { slot: 'text', extract: extractInputText },
    ],
    confirmationRequired: false,
  },
  {
    intent: 'scroll_page',
    patterns: [
      /(?:滚动|scroll).*(?:页面|page)/i,
      /(?:向下|向上|down|up).*(?:滚动|scroll)/i,
      /scroll\s+/i,
    ],
    slotExtractors: [
      { slot: 'instance_id', extract: extractInstanceId },
      { slot: 'direction', extract: extractScrollDir },
    ],
    confirmationRequired: false,
  },
  {
    intent: 'wait_for_element',
    patterns: [
      /等待.*(?:元素|element)/i,
      /wait.*(?:for|element)/i,
    ],
    slotExtractors: [
      { slot: 'instance_id', extract: extractInstanceId },
      { slot: 'selector', extract: extractSelector },
    ],
    confirmationRequired: false,
  },
  {
    intent: 'hover_element',
    patterns: [
      /(?:悬停|hover).*(?:元素|element)/i,
      /hover\s+/i,
    ],
    slotExtractors: [
      { slot: 'instance_id', extract: extractInstanceId },
      { slot: 'selector', extract: extractSelector },
    ],
    confirmationRequired: false,
  },
  {
    intent: 'select_option',
    patterns: [
      /(?:选择|select).*(?:选项|option|下拉)/i,
      /(?:下拉|dropdown).*(?:选|select)/i,
    ],
    slotExtractors: [
      { slot: 'instance_id', extract: extractInstanceId },
      { slot: 'selector', extract: extractSelector },
    ],
    confirmationRequired: false,
  },
  {
    intent: 'extract_text',
    patterns: [
      /提取.*(?:文本|text|内容)/i,
      /获取.*(?:文本|text|内容)/i,
      /extract\s+text/i,
    ],
    slotExtractors: [
      { slot: 'instance_id', extract: extractInstanceId },
      { slot: 'selector', extract: extractSelector },
    ],
    confirmationRequired: false,
  },
  {
    intent: 'extract_html',
    patterns: [
      /提取.*(?:html|源码|源代码)/i,
      /获取.*(?:html|源码)/i,
      /extract\s+html/i,
    ],
    slotExtractors: [
      { slot: 'instance_id', extract: extractInstanceId },
      { slot: 'selector', extract: extractSelector },
    ],
    confirmationRequired: false,
  },
  {
    intent: 'extract_links',
    patterns: [
      /提取.*(?:链接|link|url)/i,
      /获取.*(?:所有链接|all links)/i,
      /extract\s+links/i,
    ],
    slotExtractors: [
      { slot: 'instance_id', extract: extractInstanceId },
    ],
    confirmationRequired: false,
  },
  {
    intent: 'extract_table',
    patterns: [
      /提取.*(?:表格|table|数据)/i,
      /抓取.*(?:表格|table|数据)/i,
      /extract\s+table/i,
    ],
    slotExtractors: [
      { slot: 'instance_id', extract: extractInstanceId },
      { slot: 'selector', extract: extractSelector },
    ],
    confirmationRequired: false,
  },

  // ========== Phase 4: Cookie Management ==========
  {
    intent: 'export_cookies',
    patterns: [
      /导出.*cookie/i,
      /export\s+cookie/i,
      /(?:获取|提取).*cookie/i,
    ],
    slotExtractors: [
      { slot: 'instance_id', extract: extractInstanceId },
      { slot: 'profile_id', extract: extractProfileId },
    ],
    confirmationRequired: false,
  },
  {
    intent: 'import_cookies',
    patterns: [
      /导入.*cookie/i,
      /import\s+cookie/i,
    ],
    slotExtractors: [
      { slot: 'instance_id', extract: extractInstanceId },
      { slot: 'profile_id', extract: extractProfileId },
    ],
    confirmationRequired: true,
  },
  {
    intent: 'clear_cookies',
    patterns: [
      /(?:清除|清理|删除).*cookie/i,
      /clear\s+cookie/i,
    ],
    slotExtractors: [
      { slot: 'instance_id', extract: extractInstanceId },
      { slot: 'profile_id', extract: extractProfileId },
    ],
    confirmationRequired: true,
  },

  // ========== Phase 4: File Operations ==========
  {
    intent: 'upload_file',
    patterns: [
      /上传.*(?:文件|file)/i,
      /upload\s+file/i,
    ],
    slotExtractors: [
      { slot: 'instance_id', extract: extractInstanceId },
    ],
    confirmationRequired: false,
  },
  {
    intent: 'download_file',
    patterns: [
      /下载.*(?:文件|file)/i,
      /download\s+file/i,
    ],
    slotExtractors: [
      { slot: 'instance_id', extract: extractInstanceId },
      { slot: 'url', extract: extractUrl },
    ],
    confirmationRequired: false,
  },

  // ========== Phase 4: Workspace ==========
  {
    intent: 'create_workspace',
    patterns: [
      /创建.*(?:工作区|workspace)/i,
      /(?:新建|新增).*(?:工作区|workspace)/i,
      /create\s+workspace/i,
    ],
    slotExtractors: [
      { slot: 'name', extract: extractWorkspaceName },
    ],
    confirmationRequired: true,
  },
  {
    intent: 'list_workspaces',
    patterns: [
      /(?:查看|列出|显示).*(?:工作区|workspace)/i,
      /(?:工作区|workspace).*(?:列表|list)/i,
      /list\s+workspace/i,
    ],
    slotExtractors: [],
    confirmationRequired: false,
  },
  {
    intent: 'delete_workspace',
    patterns: [
      /删除.*(?:工作区|workspace)/i,
      /delete\s+workspace/i,
    ],
    slotExtractors: [
      { slot: 'workspace_id', extract: extractWorkspaceId },
      { slot: 'name', extract: extractWorkspaceName },
    ],
    confirmationRequired: true,
  },
  {
    intent: 'move_to_workspace',
    patterns: [
      /(?:移动|移|放).*(?:配置|profile).*(?:到|至).*(?:工作区|workspace)/i,
      /把.*(?:配置|profile).*移.*到/i,
      /move.*(?:profile|配置).*(?:to|workspace)/i,
    ],
    slotExtractors: [
      { slot: 'profile_id', extract: extractProfileId },
      { slot: 'workspace_name', extract: extractWorkspaceName },
    ],
    confirmationRequired: true,
  },

  // ========== Phase 4: Workflow ==========
  {
    intent: 'create_workflow',
    patterns: [
      /创建.*(?:流程|工作流|workflow)/i,
      /(?:新建|新增).*(?:流程|workflow)/i,
      /create\s+workflow/i,
    ],
    slotExtractors: [
      { slot: 'name', extract: extractWorkspaceName },
    ],
    confirmationRequired: true,
  },
  {
    intent: 'list_workflows',
    patterns: [
      /(?:查看|列出|显示).*(?:流程|工作流|workflow)/i,
      /(?:自动化|automation).*(?:列表|list)/i,
      /list\s+workflow/i,
    ],
    slotExtractors: [],
    confirmationRequired: false,
  },
  {
    intent: 'run_workflow',
    patterns: [
      /(?:运行|执行|启动).*(?:流程|工作流|workflow)/i,
      /run\s+workflow/i,
    ],
    slotExtractors: [
      { slot: 'workflow_id', extract: extractWorkflowId },
    ],
    confirmationRequired: true,
  },
  {
    intent: 'delete_workflow',
    patterns: [
      /删除.*(?:流程|工作流|workflow)/i,
      /delete\s+workflow/i,
    ],
    slotExtractors: [
      { slot: 'workflow_id', extract: extractWorkflowId },
    ],
    confirmationRequired: true,
  },
  {
    intent: 'schedule_workflow',
    patterns: [
      /(?:定时|定期|每天|每周|每小时).*(?:运行|执行).*(?:流程|workflow)/i,
      /schedule\s+workflow/i,
    ],
    slotExtractors: [
      { slot: 'workflow_id', extract: extractWorkflowId },
    ],
    confirmationRequired: true,
  },

  // ========== Phase 4: Data Management ==========
  {
    intent: 'export_browser_data',
    patterns: [
      /导出.*(?:浏览器|browser).*(?:数据|data)/i,
      /导出.*(?:配置|profile).*(?:数据|data)/i,
      /export\s+(?:browser\s+)?data/i,
    ],
    slotExtractors: [
      { slot: 'profile_id', extract: extractProfileId },
    ],
    confirmationRequired: false,
  },
  {
    intent: 'import_browser_data',
    patterns: [
      /导入.*(?:浏览器|browser).*(?:数据|data)/i,
      /导入.*(?:数据|data).*(?:到|至)/i,
      /import\s+(?:browser\s+)?data/i,
    ],
    slotExtractors: [
      { slot: 'profile_id', extract: extractProfileId },
    ],
    confirmationRequired: true,
  },
  {
    intent: 'clear_cache',
    patterns: [
      /(?:清理|清除|删除).*(?:缓存|cache)/i,
      /clear\s+cache/i,
    ],
    slotExtractors: [
      { slot: 'profile_id', extract: extractProfileId },
    ],
    confirmationRequired: true,
  },
  {
    intent: 'clear_storage',
    patterns: [
      /(?:清理|清除|删除).*(?:存储|storage|local.?storage)/i,
      /clear\s+(?:storage|local.?storage)/i,
    ],
    slotExtractors: [
      { slot: 'profile_id', extract: extractProfileId },
    ],
    confirmationRequired: true,
  },

  // ========== Phase 4: System ==========
  {
    intent: 'system_status',
    patterns: [
      /(?:查看|显示).*(?:系统|system).*(?:状态|status)/i,
      /系统.*(?:状态|概览)/i,
      /system\s+status/i,
    ],
    slotExtractors: [],
    confirmationRequired: false,
  },
  {
    intent: 'resource_usage',
    patterns: [
      /(?:查看|显示).*(?:资源|resource).*(?:使用|usage)/i,
      /(?:内存|cpu|磁盘).*(?:使用|占用)/i,
      /resource\s+usage/i,
    ],
    slotExtractors: [],
    confirmationRequired: false,
  },
  {
    intent: 'view_logs',
    patterns: [
      /(?:查看|显示).*(?:日志|log)/i,
      /(?:最近|recent).*(?:日志|log)/i,
      /view\s+logs/i,
    ],
    slotExtractors: [],
    confirmationRequired: false,
  },
];

// ========== Slot extractors for new intents ==========

function extractProfileId(
  text: string
): string | null {
  const m = text.match(/prof_[a-z0-9]{12}/i);
  return m ? m[0] : null;
}

function extractInstanceId(
  text: string
): string | null {
  const m = text.match(/inst_[a-z0-9]{12}/i);
  return m ? m[0] : null;
}

function extractProfileName(
  text: string
): string | null {
  const m = text.match(
    /(?:叫|名称|命名|名字)["\s]*([^\s"]+)/
  );
  return m ? m[1] : null;
}

function extractOs(
  text: string
): string | null {
  const osMap: Record<string, string> = {
    windows: 'windows', win: 'windows',
    macos: 'macos', mac: 'macos',
    linux: 'linux',
    android: 'android',
    ios: 'ios', iphone: 'ios',
  };
  const lower = text.toLowerCase();
  for (const [key, val] of Object.entries(osMap)) {
    if (lower.includes(key)) return val;
  }
  return null;
}

function extractBrowser(
  text: string
): string | null {
  const bMap: Record<string, string> = {
    chrome: 'chrome', firefox: 'firefox',
    edge: 'edge', safari: 'safari',
  };
  const lower = text.toLowerCase();
  for (const [key, val] of Object.entries(bMap)) {
    if (lower.includes(key)) return val;
  }
  return null;
}

function extractTimezone(
  text: string
): string | null {
  const tzMap: Record<string, string> = {
    'est': 'America/New_York',
    '美东': 'America/New_York',
    'cst': 'America/Chicago',
    'pst': 'America/Los_Angeles',
    '美西': 'America/Los_Angeles',
    'gmt': 'Europe/London',
    'jst': 'Asia/Tokyo',
    '东京': 'Asia/Tokyo',
    '北京': 'Asia/Shanghai',
    'utc': 'UTC',
  };
  const lower = text.toLowerCase();
  for (const [key, val] of Object.entries(tzMap)) {
    if (lower.includes(key)) return val;
  }
  const m = text.match(
    /(?:America|Europe|Asia|Australia)\/\w+/
  );
  return m ? m[0] : null;
}

function extractFpMode(
  text: string
): string | null {
  if (/noise/i.test(text)) return 'noise';
  if (/block|关闭|禁用/i.test(text)) return 'block';
  if (/real|真实/i.test(text)) return 'real';
  return null;
}

function extractWebrtcMode(
  text: string
): string | null {
  if (/disabled|禁用|关闭/i.test(text)) return 'disabled';
  if (/fake|伪装/i.test(text)) return 'fake';
  if (/real|真实/i.test(text)) return 'real';
  return null;
}

function extractProxyUrl(
  text: string
): string | null {
  const m = text.match(
    /(?:socks5|http|https):\/\/[^\s]+/i
  );
  return m ? m[0] : null;
}

function extractUrl(
  text: string
): string | null {
  const m = text.match(
    /https?:\/\/[^\s]+/i
  );
  return m ? m[0] : null;
}

function extractProxyId(
  text: string
): string | null {
  const m = text.match(/prx_[a-z0-9]{12}/i);
  return m ? m[0] : null;
}

function extractPoolId(
  text: string
): string | null {
  const m = text.match(/pool_[a-z0-9]{12}/i);
  return m ? m[0] : null;
}

function extractWorkspaceId(
  text: string
): string | null {
  const m = text.match(/ws_[a-z0-9]{12}/i);
  return m ? m[0] : null;
}

function extractWorkflowId(
  text: string
): string | null {
  const m = text.match(/wf_[a-z0-9]{12}/i);
  return m ? m[0] : null;
}

function extractWorkspaceName(
  text: string
): string | null {
  const m = text.match(
    /(?:叫|名称|命名|名字|名为)\s*["「]?([^\s"」]+)/
  );
  if (m) return m[1];
  const m2 = text.match(
    /(?:工作区|workspace|流程|workflow|代理池)\s+(\S+)/i
  );
  return m2 ? m2[1] : null;
}

function extractSelector(
  text: string
): string | null {
  const m = text.match(
    /(#[\w-]+|\.[\w-]+|\[[\w-]+=?[^\]]*\])/
  );
  return m ? m[0] : null;
}

function extractInputText(
  text: string
): string | null {
  const m = text.match(
    /(?:输入|填写|type|fill|input)\s*["「]([^"」]+)["」]/i
  );
  if (m) return m[1];
  const m2 = text.match(
    /(?:输入|填写|type|fill)\s+(\S+)/i
  );
  return m2 ? m2[1] : null;
}

function extractScrollDir(
  text: string
): string | null {
  if (/向上|up|顶部|top/i.test(text)) return 'up';
  if (/向下|down|底部|bottom/i.test(text)) return 'down';
  return 'down';
}

function extractCpuCores(
  text: string
): number | null {
  const m = text.match(/(\d+)\s*(?:核|core)/i);
  return m ? parseInt(m[1], 10) : null;
}

function extractMemoryGb(
  text: string
): number | null {
  const m = text.match(
    /(\d+)\s*(?:gb|g|GB)/i
  );
  return m ? parseInt(m[1], 10) : null;
}

function extractGpuModel(
  text: string
): string | null {
  const m = text.match(
    /(?:rtx|gtx|rx|radeon|intel\s+(?:uhd|iris))\s*\d+\s*\w*/i
  );
  return m ? m[0].trim() : null;
}

function extractResolution(
  text: string
): string | null {
  const m = text.match(/(\d{3,4})\s*[xX×]\s*(\d{3,4})/);
  return m ? `${m[1]}x${m[2]}` : null;
}

function extractCount(
  text: string
): number | null {
  const m = text.match(/(\d+)\s*(?:个|份|条)/);
  if (m) return parseInt(m[1], 10);
  const m2 = text.match(/(\d+)/);
  return m2 ? parseInt(m2[1], 10) : null;
}

const QUERY_SIGNALS =
  /发给我|列出|列表|哪些|有哪些|有什么|多少个|最近|昨天|上周|上个月|我的|查一下|查看|查询|给我看|show me|list my|my (ip|proxy|order)/i;

const RETROSPECTIVE =
  /(?:了|过|的)\s*(?:IP|ip|代理|proxy|订单|order)/i;

function isRetrospectiveQuery(text: string): boolean {
  if (!QUERY_SIGNALS.test(text)) return false;
  if (
    /(?:帮我开|帮忙开|请开|开通一个|开通\d|买一个|购买一个)/i
      .test(text)
  ) {
    return false;
  }
  if (RETROSPECTIVE.test(text)) return true;
  if (
    /(?:开通|买|购买)/.test(text) &&
    /(?:发给|哪些|最近|昨天|列出|我的|查)/.test(text)
  ) {
    return true;
  }
  return false;
}

const PURCHASE_INTENTS = new Set([
  'purchase_static',
  'purchase_ip',
  'purchase_dynamic',
  'create_session',
]);

const DISABLED_INTENTS = new Set([
  'create_user',
  'batch_create_users',
]);

const IP_ADDR_RE =
  /\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}/;

function hasConsumptionKeyword(text: string): boolean {
  return /(?:消费(?:记录|明细|流水)?|账单|billing|transactions?|收支记录|充值扣费|流水记录)/i
    .test(text);
}

function hasExplicitNlHistoryKeyword(
  text: string
): boolean {
  return /(?:对话历史|聊天记录|nl历史|命令历史|会话历史|chat\s*history|conversation\s*history|command\s*history)/i
    .test(text);
}

function hasStaticOrderKeyword(text: string): boolean {
  return (
    /(?:静态|代理|IP|ip)/i.test(text) &&
    /(?:订单|开通|购买|开的|买的)/i.test(text)
  );
}

function hasTransactionRecordKeyword(
  text: string
): boolean {
  if (
    /(?:消费记录|交易记录|消费流水|交易流水|消费明细|账单|流水记录|收支记录)/i
      .test(text)
  ) return true;
  if (
    /(?:静态|动态).*消费/i.test(text) &&
    !/(?:统计|概览|报告|总额|合计|总共)/i.test(text)
  ) return true;
  return false;
}

function hasPeriodicAggKeyword(
  text: string
): boolean {
  return /(?:本月|上月|本周|上周|累计|这个月|上个月|this\s*month|last\s*month|weekly|monthly)/i
    .test(text);
}

const IP_SPECIFIC_INTENTS = new Set([
  'query_ip_info',
  'check_ip_quality',
  'find_best_ip',
  'find_and_evaluate_ips',
  'renew_static',
  'generate_proxy_qr',
]);

/**
 * NER pre-check: when input contains a concrete IP
 * address, force `query_ip_info` unless the matched
 * intent already handles specific IPs.
 */
function nerPreCheck(
  text: string,
  lang: 'zh' | 'en'
): ParsedIntent | null {
  const m = text.match(IP_ADDR_RE);
  if (!m) return null;
  const ip = m[0];
  const parts = ip.split('.');
  const valid = parts.every((p) => {
    const n = Number(p);
    return n >= 0 && n <= 255;
  });
  if (!valid) return null;

  return {
    intent: 'query_ip_info',
    slots: { ip },
    confidence: 0.9,
    lang,
    confirmationRequired: false,
  };
}

export function ruleParseIntent(
  text: string
): ParsedIntent {
  const lang = detectLang(text);
  const normalized = text.trim();

  const forcedQuery = isRetrospectiveQuery(normalized);

  for (const def of INTENT_PATTERNS) {
    if (DISABLED_INTENTS.has(def.intent)) {
      continue;
    }

    if (forcedQuery && PURCHASE_INTENTS.has(def.intent)) {
      continue;
    }

    // 规则优先级：billing/transactions/consumption
    // 必须高于 query_nl_history。
    if (
      def.intent === 'query_nl_history' &&
      hasConsumptionKeyword(normalized) &&
      !hasExplicitNlHistoryKeyword(normalized)
    ) {
      continue;
    }

    // 优先级：query_static_orders > query_today_orders
    // 当句子含"静态/代理/IP"+"开通/订单"时，
    // 跳过 query_today_orders 让 query_static_orders 命中
    if (
      def.intent === 'query_today_orders' &&
      hasStaticOrderKeyword(normalized)
    ) {
      continue;
    }

    // 优先级：query_transactions vs query_today_orders
    // 当句子含"消费记录/交易记录/流水/账单"时，
    // 跳过 query_today_orders 让 query_transactions 命中
    if (
      def.intent === 'query_today_orders' &&
      hasTransactionRecordKeyword(normalized)
    ) {
      continue;
    }

    // 优先级：query_transactions > query_stats
    // 当句子含明确交易记录关键词但不含
    // 周期聚合词(本月/上月/本周/累计)时，
    // 跳过 query_stats 让 query_transactions 命中
    if (
      def.intent === 'query_stats' &&
      hasTransactionRecordKeyword(normalized) &&
      !hasPeriodicAggKeyword(normalized)
    ) {
      continue;
    }

    // 优先级：query_static_orders > query_stats
    // 当句子含静态订单关键词时，
    // 跳过 query_stats 让 query_static_orders 命中
    if (
      def.intent === 'query_stats' &&
      hasStaticOrderKeyword(normalized)
    ) {
      continue;
    }

    for (const pattern of def.patterns) {
      if (pattern.test(normalized)) {
        const slots: Record<string, unknown> = {};
        for (const ext of def.slotExtractors) {
          const val = ext.extract(normalized, lang);
          if (val !== null && val !== undefined) {
            slots[ext.slot] = val;
          }
        }

        if (
          IP_ADDR_RE.test(normalized) &&
          !IP_SPECIFIC_INTENTS.has(def.intent)
        ) {
          const ner = nerPreCheck(normalized, lang);
          if (ner) {
            log.info({
              event: 'parser_ner_override',
              original_intent: def.intent,
              final_intent: ner.intent,
              message: normalized.slice(0, 120),
            });
            return ner;
          }
        }

        const geo = resolveGeo(normalized);
        if (
          geo.city && !slots.city && !geo.ambiguous
        )
          slots.city = geo.city;
        if (geo.country && !slots.country)
          slots.country = geo.country;
        if (
          geo.candidates.length > 0 ||
          geo.matchedNames.length > 0 ||
          geo.group
        )
          slots._geo = geo;

        const parsed: ParsedIntent = {
          intent: def.intent,
          slots,
          confidence: 0.7,
          lang,
          confirmationRequired:
            def.confirmationRequired,
        };
        log.info({
          event: 'parser_rule_match',
          intent: parsed.intent,
          confidence: parsed.confidence,
          has_geo: !!slots._geo,
          slot_keys: Object.keys(slots),
          message: normalized.slice(0, 120),
        });
        return parsed;
      }
    }
  }

  const nerFallback = nerPreCheck(normalized, lang);
  if (nerFallback) {
    log.info({
      event: 'parser_ner_fallback',
      intent: nerFallback.intent,
      message: normalized.slice(0, 120),
    });
    return nerFallback;
  }

  const geoFallback = resolveGeo(normalized);
  if (
    geoFallback.city ||
    geoFallback.country ||
    geoFallback.group ||
    geoFallback.candidates.length > 0
  ) {
    const slots: Record<string, unknown> = {};
    if (geoFallback.city && !geoFallback.ambiguous)
      slots.city = geoFallback.city;
    if (geoFallback.country)
      slots.country = geoFallback.country;
    slots._geo = geoFallback;
    const parsed: ParsedIntent = {
      intent: 'query_ip_inventory',
      slots,
      confidence: 0.5,
      lang,
      confirmationRequired: false,
    };
    log.info({
      event: 'parser_geo_fallback',
      intent: parsed.intent,
      city: geoFallback.city,
      country: geoFallback.country,
      candidates: geoFallback.candidates.length,
      message: normalized.slice(0, 120),
    });
    return parsed;
  }

  log.info({
    event: 'parser_unknown',
    message: normalized.slice(0, 120),
  });
  return {
    intent: 'unknown',
    slots: {},
    confidence: 0,
    lang,
    confirmationRequired: false,
  };
}

export { ruleParseIntent as parseIntent };

const COMPOUND_MARKERS: RegExp[] = [
  /(?:并且?|同时|顺便)\s*(?:帮|给|再|把|查|看|开|买|测|续|提|推)/,
  /(?:然后|接着|之后)\s*(?:帮|给|再|就|查|看|开|买|测|续|提|推)/,
  /先.{2,30}[，,]?\s*(?:再|然后|接着)\s*.{2,}/,
  /如果.{2,30}(?:就|那就|的话)\s*.{2,}/,
  /(?:不够|没问题|可以|没有)\s*.{0,10}(?:就|的话)\s*(?:帮|给|充|开|买|续)/,
  /[，,;；]\s*(?:再|还要|还得|也(?:帮|给))\s*.{0,5}(?:帮|查|看|开|买|测|续|提|推)/,
  /\bthen\s+(?:also|help|check|buy|open|renew|extract)\b/i,
  /\bfirst\b.{3,}\bthen\b/i,
  /\bif\b.{3,}\bthen\b/i,
];

export function detectCompound(
  text: string
): boolean {
  return COMPOUND_MARKERS.some((r) => r.test(text));
}

/* ── Follow-up (multi-turn) detection ── */

export type FollowUpType =
  | 'select'
  | 'action'
  | 'refine'
  | 'recommend';

export interface FollowUpInfo {
  type: FollowUpType;
  indices?: number[];
  quantity?: number;
  criteria?: string;
  action?: string;
  raw: string;
}

interface FollowUpRule {
  type: FollowUpType;
  pattern: RegExp;
  extract(m: RegExpMatchArray, t: string): Partial<
    Omit<FollowUpInfo, 'type' | 'raw'>
  >;
}

const zhNum: Record<string, number> = {
  一: 1, 二: 2, 两: 2, 三: 3, 四: 4,
  五: 5, 六: 6, 七: 7, 八: 8, 九: 9, 十: 10,
};

function parseZhNum(s: string): number {
  return zhNum[s] ?? (parseInt(s, 10) || 1);
}

const FOLLOW_UP_RULES: FollowUpRule[] = [
  {
    type: 'action',
    pattern:
      /(?:帮我?|帮忙)?(?:开通|购买|买|下单|开|buy|purchase)\s*(?:这|它|这个|他们|这些|第?\s*[一二两三四五六七八九十\d]+)?/i,
    extract: (m) => {
      const idxM = m[0].match(
        /第?\s*([一二两三四五六七八九十\d]+)/
      );
      return {
        action: 'purchase',
        indices: idxM
          ? [parseZhNum(idxM[1])]
          : undefined,
      };
    },
  },
  {
    type: 'select',
    pattern:
      /(?:选|要|挑|选择|拿|取)(?:第?\s*)?([一二两三四五六七八九十\d]+)\s*(?:个|条)?/,
    extract: (m) => ({
      quantity: parseZhNum(m[1]),
    }),
  },
  {
    type: 'select',
    pattern:
      /第\s*([一二两三四五六七八九十\d]+)\s*(?:个|条)?/,
    extract: (m) => ({
      indices: [parseZhNum(m[1])],
    }),
  },
  {
    type: 'select',
    pattern:
      /(?:帮我|帮忙)?(?:挑|选|推荐)\s*([一二两三四五六七八九十\d]+)\s*(?:个|条)/,
    extract: (m) => ({
      quantity: parseZhNum(m[1]),
    }),
  },
  {
    type: 'recommend',
    pattern:
      /(?:哪个?|那个?)(?:最|比较)?(?:便宜|cheap)/i,
    extract: () => ({ criteria: 'cheapest' }),
  },
  {
    type: 'recommend',
    pattern:
      /(?:哪个?|那个?)(?:最|比较)?(?:好|质量好|稳定|quality)/i,
    extract: () => ({ criteria: 'best_quality' }),
  },
  {
    type: 'recommend',
    pattern:
      /(?:帮我?|帮忙)?(?:挑|选|推荐).*?(?:最?好|质量|稳定|best|quality)/i,
    extract: (m) => {
      const qm = m[0].match(
        /([一二两三四五六七八九十\d]+)\s*(?:个|条)/
      );
      return {
        criteria: 'best_quality',
        quantity: qm ? parseZhNum(qm[1]) : undefined,
      };
    },
  },
  {
    type: 'recommend',
    pattern:
      /(?:帮我?|帮忙)?(?:挑|选|推荐).*?(?:最?便宜|cheapest)/i,
    extract: (m) => {
      const qm = m[0].match(
        /([一二两三四五六七八九十\d]+)\s*(?:个|条)/
      );
      return {
        criteria: 'cheapest',
        quantity: qm ? parseZhNum(qm[1]) : undefined,
      };
    },
  },
  {
    type: 'refine',
    pattern:
      /(?:库存|stock).*?(?:最多|最大|最高|most)/i,
    extract: () => ({ criteria: 'most_stock' }),
  },
  {
    type: 'refine',
    pattern:
      /(?:便宜|cheap|价格低|低价|cost\s*low)/i,
    extract: () => ({ criteria: 'cheapest' }),
  },
];

export function detectFollowUp(
  text: string
): FollowUpInfo | null {
  const t = text.trim();
  for (const rule of FOLLOW_UP_RULES) {
    const m = t.match(rule.pattern);
    if (!m) continue;
    const extracted = rule.extract(m, t);
    return {
      type: rule.type,
      raw: t,
      ...extracted,
    };
  }
  return null;
}
