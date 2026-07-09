import { env } from '../../config/env';

export interface LLMParsedIntent {
  intent: string;
  slots: Record<string, unknown>;
  confidence: number;
}

const SYSTEM_PROMPT = `You are a precise intent parser for a proxy network management system called NexaLayer.

Given a user command (Chinese or English), extract a structured intent and its slots.

## Available Intents

### Account Management
1. **create_user** — Create one user account
   Slots: username (string, optional), role ("user"|"agent"|"admin", default "user"), password (string, optional)
   - "代理商"/"代理" = role "agent", "管理员" = "admin"
   - Username must be alphanumeric only, separated from role words
   - "随机" means leave empty for auto-generation

2. **batch_create_users** — Create multiple users at once
   Slots: quantity (number, required), initial_balance (number, optional, in CNY), prefix (string, optional, default "agent")
   - e.g. "批量创建5个用户，初始额度100元" → quantity=5, initial_balance=100

3. **assign_balance** — Add balance/credit to a user
   Slots: target_user (string), amount (number in CNY)

4. **reset_password** — Reset a user's password
   Slots: target_user (string, optional — empty means self), new_password (string, optional)

5. **get_referral_code** — Get agent's referral/invitation code
   Slots: none

### Statistics & Dashboard
6. **query_stats** — Query statistics (recharge/consumption/orders/profit/overview)
   Slots:
   - type ("recharge"|"consumption"|"cost"|"orders"|"profit"|"overview", required)
   - period ("today"|"month"|"last_month"|"all", default "month") — only for display hint
   - target_user (string, optional — agent queries specific sub-user)
   Use "recharge" for 充值; "consumption"/"cost" for 消费/花费/spending; "orders" for 订单; "profit" for 利润/收入; "overview" for 概览/仪表盘

7. **query_dashboard** — Dashboard overview (alias for query_stats type=overview)
   Slots: target_user (string, optional)

8. **query_balance** — Check balance (own or specific user)
   Slots: target_user (string, optional — email or username; empty = self)
   e.g. "查询minfazhai@icloud.com的余额" → target_user="minfazhai@icloud.com"

9. **query_dynamic_resource** — Dynamic proxy resource stats (flow/traffic)
   Slots: none
   Triggers: 动态资源/动态流量/动态消耗/dynamic resource/dynamic flow

10. **query_static_resource** — Static proxy resource stats (IP counts)
    Slots: none
    Triggers: 静态资源/静态数量/static resource/static IP count

11. **query_user_detail** — Agent queries a specific sub-user's stats
    Slots: target_user (string, required)
    Use when agent explicitly asks about a specific user's data

### Products
12. **query_static_products** — Query static proxy products (IP, stock, price)
    Slots: country (string, optional), city (string, optional), ip_segment (string like "1.2.3.4", optional)
    IMPORTANT: All product queries are for STATIC products. Dynamic products have no queryable inventory.

13. **query_ip_inventory** — Alias for query_static_products
    Slots: same as query_static_products

### Orders
14. **query_dynamic_orders** — List dynamic proxy orders
    Slots: target_user (string, optional), count (number, optional, max 100), search (string, optional — IP/keyword)

15. **query_static_orders** — List static proxy orders
    Slots: target_user (string, optional), count (number, optional, max 100), search (string, optional — IP address or order number)
    e.g. "查询140.99.35.213的订单" → search="140.99.35.213"
    e.g. "查询ye0001的订单" → target_user="ye0001"

16. **query_transactions** — Transaction/payment history
    Slots: target_user (string, optional), count (number, optional, max 100), search (string, optional), date_range (object {start_date, end_date} YYYY-MM-DD, optional)
    e.g. "查询ye0001最近100条交易记录" → target_user="ye0001", count=100

17. **query_users** — List users (admin: all users, agent: own users, user: denied)
    Slots: search (string, optional — username/agent/remark keyword), count (number, optional, max 100)
    e.g. "查看用户列表" → no slots
    e.g. "搜索用户test01" → search="test01"

### Purchase
17. **purchase_dynamic** — Purchase/activate dynamic proxy
    Slots: traffic_gb (number), country (string, optional), target_user (string, optional)
    Confirmation required.

18. **purchase_static** — Purchase/activate static proxy
    Slots: quantity (number), country (string), city (string, optional), product_no (string, optional), duration (number in days, default 30), target_user (string, optional)
    Confirmation required.

19. **purchase_ip** — Buy specific IP segment (alias for purchase_static)
    Slots: ip_segment (string), quantity (number)

20. **create_session** — Alias for purchase_dynamic
    Slots: same as purchase_dynamic

### Pricing
21. **set_product_price** — Agent sets product price
    Slots: product_type ("static"|"dynamic"), price (number in CNY), product_id (string, optional)
    Confirmation required.

### Renewal
22. **renew_static** — Renew/extend a static proxy order
    Slots: ip_segment (string, optional — the IP to renew), order_no (string, optional — order number), duration (number in days, default 30), target_user (string, optional)
    Triggers: 续费/续期/renew/extend
    e.g. "续费 149.119.141.100，3个月" → ip_segment="149.119.141.100", duration=90
    Confirmation required.

### Today's Orders
23. **query_today_orders** — List today's purchases/spending (static + dynamic orders opened today)
    Slots: target_user (string, optional)
    Triggers: 今天消费了什么/今天都买了什么/today's purchases

### IP Quality
24. **check_ip_quality** — Check IP quality via IPQualityScore
    Slots: ip_segment (string, required — the IP to check)
    Triggers: 查询IP质量/检测IP质量/check IP quality
    e.g. "查询 2.3.4.5 的质量" → ip_segment="2.3.4.5"

25. **find_best_ip** — Find the best quality IP in a region
    Slots: country (string), city (string, optional), max_check (number, default 5)
    Triggers: 开通质量最好的IP/找最优质IP/best quality IP
    e.g. "开通一个美国质量最好的IP" → country="USA"

### Dynamic Proxy Extraction
26. **extract_dynamic** — Extract dynamic proxy links
    Slots: country (string, optional), city (string, optional), quantity (number, default 1), valid_time (number in minutes, default 5), method ("password"|"api", default "password"), time_mode ("specified"|"change_request", default "specified"), target_user (string, optional)
    Triggers: 提取动态/提取代理/提取链接/extract proxy
    e.g. "帮我提取一个动态链接" → quantity=1
    e.g. "提取5个美国动态代理" → quantity=5, country="US"
    IMPORTANT: For extract_dynamic, use ISO2 country code
    (US/GB/JP), not ISO3 (USA/GBR/JPN).

### Expiring IP Query
27. **query_expiring_ips** — Query IPs that are about to expire
    Slots: target_user (string, optional)
    Triggers: 哪些IP快到期/到期IP/即将过期/expiring IPs
    e.g. "我的哪些IP快到期了" → (no extra slots needed)
    e.g. "哪些IP要过期了" → (no extra slots needed)

### Help
28. **show_help** — User asks for help or command list
    Slots: topic (string, optional — help topic like "查询"/"开通"/"质量")
    Triggers: 帮助/help/怎么用/支持什么命令/可以做什么
    e.g. "帮助" → (no slots)
    e.g. "帮助 查询" → topic="查询"

### Other
29. **unknown** — Cannot determine intent

## Geo Mapping (MUST use these exact database codes)
- City codes: 华盛顿=USA0DC, 洛杉矶=USA0CALAX, 纽约=USA0NY, 芝加哥=USA0ILCHI, 旧金山=USA0CASFO
- 达拉斯=USA0TXDAL, 迈阿密=USA0FLMIA, 西雅图=USA0WASEA, 休斯顿=USA0TXHOU
- 伦敦=GBR000LON, 东京=JPN000TYO, 大阪=JPN000OSA, 首尔=KOR000SEL, 新加坡=SGP000SIN
- 香港=HKG000HKG, 法兰克福=DEU000FFO, 巴黎=FRA000PAR, 悉尼=AUS000SYD
- Country codes (for most intents): 美国=USA, 英国=GBR, 日本=JPN, 韩国=KOR, 德国=DEU, 法国=FRA, 澳大利亚=AUS, 新加坡=SGP, 加拿大=CAN, 中国=CHN, 香港=HKG, 巴西=BRA
- EXCEPTION — extract_dynamic uses ISO2: 美国=US, 英国=GB, 日本=JP, 韩国=KR, 德国=DE, 法国=FR, 澳大利亚=AU, 新加坡=SG, 加拿大=CA, 中国=CN, 香港=HK, 巴西=BR

## CRITICAL: Intent Disambiguation Rules
When the input contains BOTH action words (开通/购买/买) AND retrospective/query signals, ALWAYS prefer the QUERY intent:
- "把我昨天开通的IP发给我" → query_static_orders (NOT purchase_static). The word "开通" here is past tense ("开通的"), user wants to VIEW their existing IPs.
- "我最近开通了哪些IP" → query_static_orders. "哪些" = which ones = query.
- "查一下我最近开通的IP" → query_static_orders. "查" = check/query.
- "我的IP列表" → query_static_orders. User wants to list their own IPs.
- "list my proxies" → query_static_orders.

Signals that indicate QUERY (not purchase):
- Past tense markers: 了, 过, 的 after action verbs
- Question words: 哪些, 什么, 多少, which, how many
- Retrospective time words: 最近, 昨天, 上周, 近期, recently
- Transfer verbs: 发给我, 给我, 列出, 列表, show me, list
- Query verbs: 查, 查询, 查看, 查一下, 看看, check, show

Signals that indicate PURCHASE (not query):
- Imperative with quantity: 开通一个, 买一个, 开5个
- Direct request: 帮我开, 帮忙开, 我要开通
- No past tense markers or question words

## Phase 2 Intents: Fingerprint Profile Management
- **create_profile** — Create browser profile. Slots: name, os (windows/macos/linux), browser (chrome/firefox/edge)
- **list_profiles** — List profiles
- **update_profile** — Update profile. Slots: profile_id
- **delete_profile** — Delete profile. Slots: profile_id
- **duplicate_profile** — Clone profile. Slots: profile_id
- **batch_create_profiles** — Batch create. Slots: count
- **generate_fingerprint** — Generate fingerprint. Slots: os, browser, country
- **bind_proxy** — Bind proxy to profile. Slots: profile_id, session_id
- **import_profile** — Import profiles
- **export_profile** — Export profiles. Slots: profile_id, group
- **group_profile** — Manage groups. Slots: profile_id, group_name
- **tag_profile** — Manage tags. Slots: profile_id, tags
- **set_user_agent/set_timezone/set_language/set_canvas/set_webgl/set_audio/set_webrtc/set_fonts/set_plugins/set_client_hints** — Set fingerprint param. Slots: profile_id, mode/value
- **add_proxy** — Add external proxy. Slots: proxy_url, country
- **import_proxy** — Batch import proxies
- **verify_proxy** — Test proxy. Slots: proxy_id
- **rotate_proxy** — Rotate proxy. Slots: profile_id
- **list_proxy** — List proxies
- **validate_fingerprint** — Check fingerprint consistency. Slots: profile_id
- **auto_match_proxy** — Auto-match best proxy. Slots: profile_id

## Phase 3 Intents: Browser Operations
- **launch_browser** — Launch browser. Slots: profile_id, headless
- **close_browser** — Close browser. Slots: instance_id
- **restart_browser** — Restart browser. Slots: instance_id
- **batch_launch_browser** — Batch launch
- **batch_close_browser** — Batch close
- **list_browsers** — List running browsers
- **navigate_to** — Navigate. Slots: instance_id, url
- **take_screenshot** — Screenshot. Slots: instance_id
- **submit_task** — Submit task. Slots: profile_id, target_url, task_type
- **run_script** — Run script in browser. Slots: instance_id, script
- **schedule_task** — Schedule task. Slots: profile_id, target_url, delay
- **batch_task** — Batch tasks. Slots: target_urls
- **query_task** — Query task status. Slots: task_id
- **run_detection_test** — Anti-detect test. Slots: profile_id

## General Rules
- Username extraction: alphanumeric only, stop at Chinese particles (的/了/是/为)
- "代理商" in user creation context = role:agent, NOT part of username
- "查询产品" or "查产品" = query_static_products (never dynamic)
- "上月" = last_month; "本月" = month; "今日"/"今天" = today; "累计"/"总" = all
- When user asks about "充值", type = "recharge"
- When user asks about "消费"/"花费", type = "consumption"
- When user asks about "利润"/"收入", type = "profit"
- When user asks about "订单", type = "orders"
- Profile IDs look like: prof_xxxx, Instance IDs: inst_xxxx, Task IDs: task_xxxx
- Detect input language: Chinese chars present → lang="zh", otherwise lang="en"`;

const PARSE_FUNCTION = {
  type: 'function' as const,
  function: {
    name: 'parse_intent',
    description:
      'Parse user natural language into structured intent',
    parameters: {
      type: 'object',
      properties: {
        intent: {
          type: 'string',
          enum: [
            'create_user',
            'batch_create_users',
            'assign_balance',
            'reset_password',
            'get_referral_code',
            'query_stats',
            'query_dashboard',
            'query_balance',
            'query_dynamic_resource',
            'query_static_resource',
            'query_user_detail',
            'query_static_products',
            'query_ip_inventory',
            'query_dynamic_orders',
            'query_static_orders',
            'query_transactions',
            'query_users',
            'purchase_dynamic',
            'purchase_static',
            'purchase_ip',
            'create_session',
            'set_product_price',
            'renew_static',
            'query_today_orders',
            'check_ip_quality',
            'find_best_ip',
            'extract_dynamic',
            'query_expiring_ips',
            'create_profile',
            'list_profiles',
            'update_profile',
            'delete_profile',
            'duplicate_profile',
            'batch_create_profiles',
            'generate_fingerprint',
            'bind_proxy',
            'import_profile',
            'export_profile',
            'group_profile',
            'tag_profile',
            'set_user_agent',
            'set_timezone',
            'set_language',
            'set_canvas',
            'set_webgl',
            'set_audio',
            'set_webrtc',
            'set_fonts',
            'set_plugins',
            'set_client_hints',
            'add_proxy',
            'import_proxy',
            'verify_proxy',
            'rotate_proxy',
            'list_proxy',
            'validate_fingerprint',
            'auto_match_proxy',
            'launch_browser',
            'close_browser',
            'restart_browser',
            'batch_launch_browser',
            'batch_close_browser',
            'list_browsers',
            'navigate_to',
            'take_screenshot',
            'submit_task',
            'run_script',
            'schedule_task',
            'batch_task',
            'query_task',
            'run_detection_test',
            'show_help',
            'unknown',
          ],
        },
        slots: {
          type: 'object',
          description:
            'Only include slots explicitly mentioned.',
          additionalProperties: true,
        },
        confidence: {
          type: 'number',
          minimum: 0,
          maximum: 1,
        },
        lang: {
          type: 'string',
          enum: ['zh', 'en'],
        },
      },
      required: [
        'intent',
        'slots',
        'confidence',
        'lang',
      ],
    },
  },
};

interface LLMProvider {
  name: string;
  apiKey: string;
  baseUrl: string;
  model: string;
}

function getProviders(): LLMProvider[] {
  const providers: LLMProvider[] = [];

  const dsKey = env.DEEPSEEK_API_KEY
    ?.trim()
    .replace(/^=+/, '')
    .trim();
  if (dsKey) {
    providers.push({
      name: 'DeepSeek',
      apiKey: dsKey,
      baseUrl: env.DEEPSEEK_BASE_URL,
      model: env.DEEPSEEK_MODEL,
    });
  }

  const openaiKey = env.OPENAI_API_KEY
    ?.trim()
    .replace(/^=+/, '')
    .trim();
  if (openaiKey && openaiKey.startsWith('sk-')) {
    providers.push({
      name: 'OpenAI',
      apiKey: openaiKey,
      baseUrl: env.OPENAI_BASE_URL,
      model: env.OPENAI_MODEL,
    });
  }

  return providers;
}

type ParseResult =
  LLMParsedIntent & { lang: 'zh' | 'en' };

async function callProvider(
  provider: LLMProvider,
  messages: Array<{
    role: 'system' | 'user';
    content: string;
  }>
): Promise<ParseResult | null> {
  const res = await fetch(
    `${provider.baseUrl}/chat/completions`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${provider.apiKey}`,
      },
      body: JSON.stringify({
        model: provider.model,
        messages,
        tools: [PARSE_FUNCTION],
        tool_choice: {
          type: 'function',
          function: { name: 'parse_intent' },
        },
        temperature: 0,
        max_tokens: 400,
      }),
    }
  );

  if (!res.ok) {
    const errBody = await res.text().catch(() => '');
    console.error(
      `[${provider.name}] HTTP ${res.status}`,
      `URL: ${provider.baseUrl}`,
      `Model: ${provider.model}`,
      `Body: ${errBody.slice(0, 200)}`
    );
    return null;
  }

  const data = (await res.json()) as {
    choices?: Array<{
      message?: {
        tool_calls?: Array<{
          function?: { arguments?: string };
        }>;
      };
    }>;
  };

  const args =
    data.choices?.[0]?.message?.tool_calls?.[0]
      ?.function?.arguments;
  if (!args) return null;

  const parsed = JSON.parse(args) as {
    intent: string;
    slots: Record<string, unknown>;
    confidence: number;
    lang: 'zh' | 'en';
  };

  return {
    intent: parsed.intent,
    slots: parsed.slots || {},
    confidence: parsed.confidence ?? 0.85,
    lang: parsed.lang ?? 'en',
  };
}

export async function llmParse(
  message: string,
  conversationContext?: string
): Promise<ParseResult | null> {
  const providers = getProviders();
  if (providers.length === 0) return null;

  const messages: Array<{
    role: 'system' | 'user';
    content: string;
  }> = [{ role: 'system', content: SYSTEM_PROMPT }];

  if (conversationContext) {
    messages.push({
      role: 'system',
      content: `Recent conversation:\n${conversationContext}`,
    });
  }

  messages.push({ role: 'user', content: message });

  for (const provider of providers) {
    try {
      const result = await callProvider(
        provider,
        messages
      );
      if (result) {
        console.log(
          `[LLM] ${provider.name} succeeded`
        );
        return result;
      }
    } catch (err) {
      console.error(
        `[${provider.name}] parse error:`,
        err
      );
    }
  }

  return null;
}

const CHAT_SYSTEM_PROMPT = `You are NexaLayer AI assistant, a helpful assistant for the NexaLayer proxy network management platform (ZTProxy / 纵横代理).

You can answer general questions about:
- IP proxies (residential, datacenter, ISP, static, dynamic)
- Proxy usage scenarios (web scraping, SEO, ad verification, etc.)
- Proxy protocols (HTTP, HTTPS, SOCKS5)
- IP quality, anonymity levels
- Our platform features and pricing model

Rules:
- NEVER recommend competitor products or services
- NEVER mention other proxy providers by name
- If the user asks about competitors, redirect to NexaLayer's features
- Keep answers concise (under 200 words)
- Respond in the same language as the user's input
- For questions about specific NexaLayer operations, suggest using the command system

At the end of your response, suggest 2-3 relevant NexaLayer commands the user could try.`;

/* ─── Multi-intent plan parsing ─── */

export interface PlanStep {
  step: number;
  intent: string;
  slots: Record<string, unknown>;
  condition: 'always' | 'on_success' | 'on_condition';
  condition_desc?: string;
}

export interface ExecutionPlan {
  plan: PlanStep[];
  lang: 'zh' | 'en';
  confidence: number;
}

const PLAN_SYSTEM_PROMPT = `You are a plan decomposition parser for a proxy network management system (NexaLayer).

Given a COMPOUND user command containing MULTIPLE intents, decompose it into an ordered execution plan.

## Available Intents
- query_balance — Check balance
- query_ip_inventory — Query IP inventory/regions
- find_best_ip — Recommend best quality IP
- check_ip_quality — Check IP quality (needs ip_segment)
- purchase_static — Buy static proxy (needs country)
- purchase_dynamic — Buy dynamic proxy (needs traffic_gb)
- purchase_ip — Buy specific IP (needs ip_segment)
- renew_static — Renew static proxy (needs ip_segment or order_no, duration)
- extract_dynamic — Extract dynamic proxy links
- query_static_orders — List owned static IPs/orders
- query_dynamic_orders — List dynamic orders
- query_transactions — Transaction history
- query_users — List users (admin/agent only)
- query_stats — Statistics (type: recharge|consumption|profit)
- query_today_orders — Today's purchases
- query_expiring_ips — Expiring IPs
- query_dynamic_resource — Dynamic traffic remaining
- query_static_resource — Static resource stats
- assign_balance — Top up balance (needs target_user, amount)
- create_session — Create proxy session
- show_help — Help

## Geo Codes
Country (for most intents): 美国=USA, 英国=GBR, 日本=JPN, 韩国=KOR, 德国=DEU, 法国=FRA, 新加坡=SGP, 香港=HKG, 加拿大=CAN, 台湾=TWN
EXCEPTION — extract_dynamic uses ISO2: 美国=US, 英国=GB, 日本=JP, 韩国=KR, 德国=DE, 法国=FR, 新加坡=SG, 香港=HK, 加拿大=CA, 台湾=TW
City: 洛杉矶=USA0CALAX, 纽约=USA0NY, 芝加哥=USA0ILCHI, 东京=JPN000TYO, 伦敦=GBR000LON

## Step Conditions
- "always": execute unconditionally (first step must be this)
- "on_success": execute only if previous step succeeded
- "on_condition": execute if a condition on previous result is met (describe in condition_desc)

## Rules
- "先A，再B" → step1(A, always), step2(B, on_success)
- "A，并B" / "A，同时B" → step1(A, always), step2(B, always)
- "如果A...就B" → step1(A, always), step2(B, on_condition)
- "A，不够就B" → step1(A, always), step2(B, on_condition, "insufficient/not enough")
- Extract slots from each clause independently
- Duration in months: 3个月=3, 半年=6, 一年=12`;

const PLAN_INTENT_ENUM = [
  'query_balance', 'query_ip_inventory',
  'find_best_ip', 'check_ip_quality',
  'purchase_static', 'purchase_dynamic',
  'purchase_ip', 'renew_static',
  'extract_dynamic', 'query_static_orders',
  'query_dynamic_orders', 'query_transactions',
  'query_users', 'query_stats', 'query_today_orders',
  'query_expiring_ips', 'query_dynamic_resource',
  'query_static_resource', 'assign_balance',
  'create_session', 'show_help', 'unknown',
];

const PLAN_FUNCTION = {
  type: 'function' as const,
  function: {
    name: 'parse_plan',
    description:
      'Decompose a compound sentence into an execution plan',
    parameters: {
      type: 'object',
      properties: {
        plan: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              step: { type: 'integer' },
              intent: {
                type: 'string',
                enum: PLAN_INTENT_ENUM,
              },
              slots: {
                type: 'object',
                additionalProperties: true,
              },
              condition: {
                type: 'string',
                enum: [
                  'always',
                  'on_success',
                  'on_condition',
                ],
              },
              condition_desc: { type: 'string' },
            },
            required: [
              'step', 'intent', 'slots', 'condition',
            ],
          },
        },
        lang: {
          type: 'string',
          enum: ['zh', 'en'],
        },
        confidence: {
          type: 'number',
          minimum: 0,
          maximum: 1,
        },
      },
      required: ['plan', 'lang', 'confidence'],
    },
  },
};

export async function llmParsePlan(
  message: string,
  conversationContext?: string
): Promise<ExecutionPlan | null> {
  const providers = getProviders();
  if (providers.length === 0) return null;

  const messages: Array<{
    role: 'system' | 'user';
    content: string;
  }> = [
    { role: 'system', content: PLAN_SYSTEM_PROMPT },
  ];

  if (conversationContext) {
    messages.push({
      role: 'system',
      content:
        `Recent conversation:\n${conversationContext}`,
    });
  }

  messages.push({ role: 'user', content: message });

  for (const provider of providers) {
    try {
      const res = await fetch(
        `${provider.baseUrl}/chat/completions`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization:
              `Bearer ${provider.apiKey}`,
          },
          body: JSON.stringify({
            model: provider.model,
            messages,
            tools: [PLAN_FUNCTION],
            tool_choice: {
              type: 'function',
              function: { name: 'parse_plan' },
            },
            temperature: 0,
            max_tokens: 800,
          }),
        }
      );

      if (!res.ok) {
        console.error(
          `[${provider.name}] plan HTTP ${res.status}`
        );
        continue;
      }

      const data = (await res.json()) as {
        choices?: Array<{
          message?: {
            tool_calls?: Array<{
              function?: { arguments?: string };
            }>;
          };
        }>;
      };

      const args =
        data.choices?.[0]?.message?.tool_calls?.[0]
          ?.function?.arguments;
      if (!args) continue;

      const parsed = JSON.parse(args) as {
        plan: PlanStep[];
        lang: 'zh' | 'en';
        confidence: number;
      };

      if (
        !parsed.plan ||
        parsed.plan.length === 0
      ) {
        continue;
      }

      console.log(
        `[LLM Plan] ${provider.name} → ` +
        `${parsed.plan.length} steps`
      );

      return {
        plan: parsed.plan,
        lang: parsed.lang ?? 'zh',
        confidence: parsed.confidence ?? 0.8,
      };
    } catch (err) {
      console.error(
        `[${provider.name}] plan error:`, err
      );
    }
  }

  return null;
}

export async function llmChat(
  message: string,
  conversationContext?: string
): Promise<string | null> {
  const providers = getProviders();
  if (providers.length === 0) return null;

  const messages: Array<{
    role: 'system' | 'user';
    content: string;
  }> = [{ role: 'system', content: CHAT_SYSTEM_PROMPT }];

  if (conversationContext) {
    messages.push({
      role: 'system',
      content: `Recent conversation:\n${conversationContext}`,
    });
  }
  messages.push({ role: 'user', content: message });

  for (const provider of providers) {
    try {
      const res = await fetch(
        `${provider.baseUrl}/chat/completions`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${provider.apiKey}`,
          },
          body: JSON.stringify({
            model: provider.model,
            messages,
            temperature: 0.7,
            max_tokens: 500,
          }),
        }
      );
      if (!res.ok) continue;
      const data = (await res.json()) as {
        choices?: Array<{
          message?: { content?: string };
        }>;
      };
      const content =
        data.choices?.[0]?.message?.content;
      if (content) {
        console.log(
          `[LLM Chat] ${provider.name} succeeded`
        );
        return content;
      }
    } catch (err) {
      console.error(
        `[${provider.name}] chat error:`,
        err
      );
    }
  }
  return null;
}
