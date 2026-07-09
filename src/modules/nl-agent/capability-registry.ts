/**
 * Capability Registry
 *
 * Single source of truth: Intent → Capability → API
 *
 * Flow:
 *   User Input → Intent → Capability → Executor(API) → Formatter
 *
 * Every intent MUST have a registered capability entry.
 * Startup validation ensures no intent is left unmapped.
 */

import { createModuleLogger } from '../../utils/logger';

const log = createModuleLogger('capability-registry');

export interface CapabilityDef {
  intent: string;
  capability: string;
  description: { zh: string; en: string };
  api: string;
  dataFields: string[];
  phase: number;
}

const CAPABILITIES: CapabilityDef[] = [
  /* ── Phase 1: Proxy Business ── */
  {
    intent: 'query_balance',
    capability: 'USER_BALANCE_QUERY',
    description: {
      zh: '查询账户余额',
      en: 'Query account balance',
    },
    api: '/api/open/app/user/balance/current',
    dataFields: ['balance'],
    phase: 1,
  },
  {
    intent: 'query_stats',
    capability: 'DASHBOARD_STATISTICS',
    description: {
      zh: '查询消费/充值/利润统计',
      en: 'Query financial statistics',
    },
    api: '/api/open/app/dashboard/info/v2',
    dataFields: [
      'statistics.balance',
      'statistics.total_recharge',
      'statistics.total_consumption',
      'statistics.monthly_orders',
    ],
    phase: 1,
  },
  {
    intent: 'query_dashboard',
    capability: 'DASHBOARD_OVERVIEW',
    description: {
      zh: '仪表盘概览',
      en: 'Dashboard overview',
    },
    api: '/api/open/app/dashboard/info/v2',
    dataFields: [
      'statistics.*',
    ],
    phase: 1,
  },
  {
    intent: 'query_static_resource',
    capability: 'STATIC_RESOURCE_QUERY',
    description: {
      zh: '查询系统静态代理库存（按国家汇总可用IP数）',
      en: 'Query static proxy inventory by country',
    },
    api: '/api/settings/prices',
    dataFields: [
      'country', 'stock', 'products',
      'totalStock', 'totalProducts',
    ],
    phase: 1,
  },
  {
    intent: 'query_dynamic_resource',
    capability: 'DYNAMIC_RESOURCE_QUERY',
    description: {
      zh: '查询动态代理资源（流量/子账号）',
      en: 'Query dynamic proxy resources',
    },
    api: '/api/open/app/dashboard/info/v2',
    dataFields: [
      'dynamicResources[].total',
      'dynamicResources[].used',
      'dynamicResources[].remaining',
    ],
    phase: 1,
  },
  {
    intent: 'query_static_orders',
    capability: 'STATIC_ORDER_LIST',
    description: {
      zh: '查询静态代理订单列表',
      en: 'Query static proxy orders',
    },
    api: '/api/open/app/static/order/list/v2',
    dataFields: [
      'order_no', 'region', 'duration',
      'expire_time', 'instances',
    ],
    phase: 1,
  },
  {
    intent: 'query_dynamic_orders',
    capability: 'DYNAMIC_ORDER_LIST',
    description: {
      zh: '查询动态代理订单列表',
      en: 'Query dynamic proxy orders',
    },
    api: '/api/dynamic',
    dataFields: [
      'order_no', 'status', 'traffic',
      'username', 'created_at',
    ],
    phase: 1,
  },
  {
    intent: 'query_transactions',
    capability: 'TRANSACTION_LIST',
    description: {
      zh: '查询交易/消费记录',
      en: 'Query transactions',
    },
    api: '/api/open/app/user/transactions',
    dataFields: [
      'order_no', 'username', 'type',
      'amount', 'balance', 'remark',
      'created_at',
    ],
    phase: 1,
  },
  {
    intent: 'query_static_products',
    capability: 'STATIC_PRODUCT_LIST',
    description: {
      zh: '查询静态产品列表',
      en: 'Query static products',
    },
    api: '/api/open/app/static/product/list',
    dataFields: [
      'name', 'price', 'duration', 'region',
    ],
    phase: 1,
  },
  {
    intent: 'query_products',
    capability: 'PRODUCT_LIST',
    description: {
      zh: '查询产品列表（通用）',
      en: 'Query products (generic)',
    },
    api: '/api/open/app/static/product/list',
    dataFields: ['name', 'price'],
    phase: 1,
  },
  {
    intent: 'query_ip_inventory',
    capability: 'IP_INVENTORY_QUERY',
    description: {
      zh: '查询IP库存',
      en: 'Query IP inventory',
    },
    api: '/api/open/app/static/product/list',
    dataFields: ['region', 'stock'],
    phase: 1,
  },
  {
    intent: 'generate_proxy_qr',
    capability: 'PROXY_QR_GENERATE',
    description: {
      zh: '生成代理二维码/链接（Shadowrocket 等）',
      en: 'Generate proxy QR code/link',
    },
    api: '/api/open/app/static/order/list/v2',
    dataFields: [
      'ip', 'port', 'username', 'password',
      'urls.socks5', 'urls.http', 'urls.https',
    ],
    phase: 1,
  },
  {
    intent: 'query_ip_info',
    capability: 'IP_INFO_QUERY',
    description: {
      zh: '查询单个IP详细信息（到期时间、订单等）',
      en: 'Query single IP details (expiry, order)',
    },
    api: '/api/open/app/static/order/list/v2',
    dataFields: [
      'ip', 'port', 'expire_time',
      'order_no', 'country', 'city',
    ],
    phase: 1,
  },
  {
    intent: 'query_expiring_ips',
    capability: 'EXPIRING_IP_LIST',
    description: {
      zh: '查询即将到期IP',
      en: 'Query expiring IPs',
    },
    api: '/api/open/app/static/order/list/v2',
    dataFields: [
      'order_no', 'expire_time', 'proxy_ip',
    ],
    phase: 1,
  },
  {
    intent: 'query_today_orders',
    capability: 'TODAY_ORDER_QUERY',
    description: {
      zh: '查询今日订单',
      en: 'Query today orders',
    },
    api: '/api/open/app/dashboard/info/v2',
    dataFields: ['statistics.today_orders'],
    phase: 1,
  },
  {
    intent: 'query_users',
    capability: 'USER_LIST',
    description: {
      zh: '查询用户列表',
      en: 'Query user list',
    },
    api: '/api/open/app/user/list',
    dataFields: [
      'username', 'status', 'balance',
      'agent', 'created_at',
    ],
    phase: 1,
  },
  {
    intent: 'query_user_detail',
    capability: 'USER_DETAIL_QUERY',
    description: {
      zh: '查询用户详情',
      en: 'Query user detail',
    },
    api: '/api/open/app/user/detail',
    dataFields: [
      'username', 'balance', 'status',
      'role', 'created_at',
    ],
    phase: 1,
  },
  {
    intent: 'create_user',
    capability: 'USER_CREATE',
    description: {
      zh: '创建用户',
      en: 'Create user',
    },
    api: '/api/open/app/user/create',
    dataFields: ['username'],
    phase: 1,
  },
  {
    intent: 'batch_create_users',
    capability: 'USER_BATCH_CREATE',
    description: {
      zh: '批量创建用户',
      en: 'Batch create users',
    },
    api: '/api/open/app/user/create',
    dataFields: ['username'],
    phase: 1,
  },
  {
    intent: 'assign_balance',
    capability: 'BALANCE_ASSIGN',
    description: {
      zh: '分配余额',
      en: 'Assign balance',
    },
    api: '/api/open/app/user/assign-balance',
    dataFields: ['balance'],
    phase: 1,
  },
  {
    intent: 'reset_password',
    capability: 'PASSWORD_RESET',
    description: {
      zh: '重置密码',
      en: 'Reset password',
    },
    api: '/api/open/app/user/reset-password',
    dataFields: [],
    phase: 1,
  },
  {
    intent: 'get_referral_code',
    capability: 'REFERRAL_CODE_QUERY',
    description: {
      zh: '获取推荐码',
      en: 'Get referral code',
    },
    api: '/api/open/app/user/referral-code',
    dataFields: ['referral_code'],
    phase: 1,
  },
  {
    intent: 'purchase_dynamic',
    capability: 'DYNAMIC_PURCHASE',
    description: {
      zh: '购买动态代理',
      en: 'Purchase dynamic proxy',
    },
    api: '/api/open/app/dynamic/purchase',
    dataFields: ['order_no'],
    phase: 1,
  },
  {
    intent: 'purchase_static',
    capability: 'STATIC_PURCHASE',
    description: {
      zh: '购买静态代理',
      en: 'Purchase static proxy',
    },
    api: '/api/open/app/static/purchase',
    dataFields: ['order_no'],
    phase: 1,
  },
  {
    intent: 'purchase_ip',
    capability: 'IP_PURCHASE',
    description: {
      zh: '购买IP',
      en: 'Purchase IP',
    },
    api: '/api/open/app/static/purchase',
    dataFields: ['order_no'],
    phase: 1,
  },
  {
    intent: 'create_session',
    capability: 'SESSION_CREATE',
    description: {
      zh: '创建代理会话',
      en: 'Create proxy session',
    },
    api: '/api/open/app/session/create',
    dataFields: ['session_id'],
    phase: 1,
  },
  {
    intent: 'extract_dynamic',
    capability: 'DYNAMIC_EXTRACT',
    description: {
      zh: '提取动态代理',
      en: 'Extract dynamic proxy',
    },
    api: '/api/open/app/dynamic/extract',
    dataFields: ['proxy_host', 'proxy_port'],
    phase: 1,
  },
  {
    intent: 'renew_static',
    capability: 'STATIC_RENEW',
    description: {
      zh: '续费静态代理',
      en: 'Renew static proxy',
    },
    api: '/api/open/app/static/renew',
    dataFields: ['order_no'],
    phase: 1,
  },
  {
    intent: 'set_product_price',
    capability: 'PRODUCT_PRICE_SET',
    description: {
      zh: '设置产品价格',
      en: 'Set product price',
    },
    api: '/api/open/app/product/set-price',
    dataFields: [],
    phase: 1,
  },
  {
    intent: 'check_ip_quality',
    capability: 'IP_QUALITY_CHECK',
    description: {
      zh: 'IP质量检测',
      en: 'Check IP quality',
    },
    api: 'external:ip-quality-apis',
    dataFields: ['score', 'risk', 'geo'],
    phase: 1,
  },
  {
    intent: 'find_best_ip',
    capability: 'IP_BEST_FINDER',
    description: {
      zh: '查找最优IP',
      en: 'Find best IP',
    },
    api: 'external:ip-quality-apis',
    dataFields: ['ip', 'score'],
    phase: 1,
  },
  {
    intent: 'find_and_evaluate_ips',
    capability: 'IP_EVALUATE',
    description: {
      zh: '查找并评估IP',
      en: 'Find and evaluate IPs',
    },
    api: 'external:ip-quality-apis',
    dataFields: ['ip', 'score', 'details'],
    phase: 1,
  },
  {
    intent: 'refine_search_results',
    capability: 'IP_REFINE_SEARCH',
    description: {
      zh: '精细化搜索结果',
      en: 'Refine search results',
    },
    api: 'context:previous_results',
    dataFields: ['filtered_list'],
    phase: 1,
  },
  {
    intent: 'recommend_best_match',
    capability: 'IP_RECOMMEND',
    description: {
      zh: '推荐最佳匹配',
      en: 'Recommend best match',
    },
    api: 'context:previous_results',
    dataFields: ['recommendation'],
    phase: 1,
  },

  /* ── Phase 2: Profile Management ── */
  ...[
    'create_profile', 'list_profiles',
    'update_profile', 'delete_profile',
    'duplicate_profile', 'batch_create_profiles',
    'generate_fingerprint', 'bind_proxy',
    'import_profile', 'export_profile',
    'group_profile', 'tag_profile',
  ].map((intent) => ({
    intent,
    capability: 'PROFILE_MANAGEMENT',
    description: {
      zh: '环境配置管理',
      en: 'Profile management',
    },
    api: 'phase2:profile-api',
    dataFields: ['profile'],
    phase: 2,
  })),

  /* ── Phase 2: Fingerprint Control ── */
  ...[
    'set_user_agent', 'set_timezone',
    'set_language', 'set_canvas',
    'set_webgl', 'set_audio',
    'set_webrtc', 'set_fonts',
    'set_plugins', 'set_client_hints',
  ].map((intent) => ({
    intent,
    capability: 'FINGERPRINT_CONTROL',
    description: {
      zh: '指纹控制',
      en: 'Fingerprint control',
    },
    api: 'phase2:fingerprint-api',
    dataFields: ['fingerprint'],
    phase: 2,
  })),

  /* ── Phase 2: Proxy Management ── */
  ...[
    'add_proxy', 'import_proxy',
    'verify_proxy', 'rotate_proxy',
    'list_proxy',
  ].map((intent) => ({
    intent,
    capability: 'PROXY_MANAGEMENT',
    description: {
      zh: '代理管理',
      en: 'Proxy management',
    },
    api: 'phase2:proxy-api',
    dataFields: ['proxy'],
    phase: 2,
  })),

  /* ── Phase 2: Validation ── */
  {
    intent: 'validate_fingerprint',
    capability: 'FINGERPRINT_VALIDATE',
    description: {
      zh: '验证指纹配置',
      en: 'Validate fingerprint config',
    },
    api: 'phase2:validation-api',
    dataFields: ['valid', 'issues'],
    phase: 2,
  },
  {
    intent: 'auto_match_proxy',
    capability: 'PROXY_AUTO_MATCH',
    description: {
      zh: '自动匹配代理',
      en: 'Auto match proxy',
    },
    api: 'phase2:proxy-api',
    dataFields: ['matched_proxy'],
    phase: 2,
  },

  /* ── Phase 3: Browser Management ── */
  ...[
    'launch_browser', 'close_browser',
    'restart_browser', 'batch_launch_browser',
    'batch_close_browser', 'list_browsers',
    'navigate_to', 'take_screenshot',
  ].map((intent) => ({
    intent,
    capability: 'BROWSER_MANAGEMENT',
    description: {
      zh: '浏览器管理',
      en: 'Browser management',
    },
    api: 'phase3:browser-api',
    dataFields: ['browser_id'],
    phase: 3,
  })),

  /* ── Phase 3: Task Management ── */
  ...[
    'submit_task', 'run_script',
    'schedule_task', 'batch_task',
    'query_task', 'run_detection_test',
  ].map((intent) => ({
    intent,
    capability: 'TASK_MANAGEMENT',
    description: {
      zh: '任务管理',
      en: 'Task management',
    },
    api: 'phase3:task-api',
    dataFields: ['task_id'],
    phase: 3,
  })),

  /* ── Phase 4: Profile Lifecycle ── */
  ...[
    'pause_profile', 'resume_profile',
    'archive_profile',
  ].map((intent) => ({
    intent,
    capability: 'PROFILE_LIFECYCLE',
    description: {
      zh: '环境生命周期管理',
      en: 'Profile lifecycle',
    },
    api: 'phase4:profile-api',
    dataFields: ['profile'],
    phase: 4,
  })),

  /* ── Phase 4: Extended Fingerprints ── */
  ...[
    'set_os', 'set_cpu', 'set_memory',
    'set_gpu', 'set_screen',
    'set_media_devices', 'set_battery',
    'set_webgpu', 'set_navigator',
    'set_device_memory', 'set_gamepad',
  ].map((intent) => ({
    intent,
    capability: 'EXTENDED_FINGERPRINT',
    description: {
      zh: '扩展指纹配置',
      en: 'Extended fingerprint',
    },
    api: 'phase4:fingerprint-api',
    dataFields: ['fingerprint'],
    phase: 4,
  })),

  /* ── Phase 4: Proxy Expansion ── */
  ...[
    'delete_proxy', 'proxy_speed_test',
    'proxy_quality_check', 'create_proxy_pool',
    'list_proxy_pools', 'delete_proxy_pool',
    'auto_select_proxy',
  ].map((intent) => ({
    intent,
    capability: 'PROXY_EXPANSION',
    description: {
      zh: '代理扩展操作',
      en: 'Proxy expansion',
    },
    api: 'phase4:proxy-api',
    dataFields: ['proxy'],
    phase: 4,
  })),

  /* ── Phase 4: Browser Page Actions ── */
  ...[
    'click_element', 'input_text',
    'scroll_page', 'wait_for_element',
    'hover_element', 'select_option',
    'extract_text', 'extract_html',
    'extract_links', 'extract_table',
    'export_cookies', 'import_cookies',
    'clear_cookies', 'upload_file',
    'download_file',
  ].map((intent) => ({
    intent,
    capability: 'BROWSER_PAGE_ACTION',
    description: {
      zh: '浏览器页面操作',
      en: 'Browser page action',
    },
    api: 'phase4:browser-action-api',
    dataFields: ['result'],
    phase: 4,
  })),

  /* ── Phase 4: Workspace ── */
  ...[
    'create_workspace', 'list_workspaces',
    'delete_workspace', 'move_to_workspace',
  ].map((intent) => ({
    intent,
    capability: 'WORKSPACE_MANAGEMENT',
    description: {
      zh: '工作区管理',
      en: 'Workspace management',
    },
    api: 'phase4:workspace-api',
    dataFields: ['workspace'],
    phase: 4,
  })),

  /* ── Phase 4: Workflow ── */
  ...[
    'create_workflow', 'list_workflows',
    'run_workflow', 'delete_workflow',
    'schedule_workflow',
  ].map((intent) => ({
    intent,
    capability: 'WORKFLOW_MANAGEMENT',
    description: {
      zh: '工作流管理',
      en: 'Workflow management',
    },
    api: 'phase4:workflow-api',
    dataFields: ['workflow'],
    phase: 4,
  })),

  /* ── Phase 4: Data Management ── */
  ...[
    'export_browser_data', 'import_browser_data',
    'clear_cache', 'clear_storage',
  ].map((intent) => ({
    intent,
    capability: 'DATA_MANAGEMENT',
    description: {
      zh: '数据管理',
      en: 'Data management',
    },
    api: 'phase4:data-api',
    dataFields: ['result'],
    phase: 4,
  })),

  /* ── Phase 4: System ── */
  ...[
    'system_status', 'resource_usage',
    'view_logs',
  ].map((intent) => ({
    intent,
    capability: 'SYSTEM_MONITOR',
    description: {
      zh: '系统监控',
      en: 'System monitoring',
    },
    api: 'phase4:system-api',
    dataFields: ['status'],
    phase: 4,
  })),

  /* ── Utility / Meta ── */
  {
    intent: 'show_help',
    capability: 'HELP_DISPLAY',
    description: {
      zh: '显示帮助信息',
      en: 'Show help',
    },
    api: 'local:help-resolver',
    dataFields: [],
    phase: 1,
  },
  {
    intent: 'query_nl_history',
    capability: 'NL_HISTORY_QUERY',
    description: {
      zh: '查询NL对话历史',
      en: 'Query NL chat history',
    },
    api: 'local:nl_chat_logs',
    dataFields: [
      'userMessage', 'assistantMessage',
      'intent', 'createdAt',
    ],
    phase: 1,
  },
  /* ── Follow-up / Multi-turn ── */
  {
    intent: 'follow_up_select',
    capability: 'FOLLOW_UP_SELECT',
    description: {
      zh: '从上次查询结果中选择',
      en: 'Select from previous query results',
    },
    api: 'context:last_result',
    dataFields: ['products'],
    phase: 1,
  },
  {
    intent: 'follow_up_recommend',
    capability: 'FOLLOW_UP_RECOMMEND',
    description: {
      zh: '基于上次结果推荐/排序',
      en: 'Recommend from previous results',
    },
    api: 'context:last_result',
    dataFields: ['products'],
    phase: 1,
  },
  {
    intent: 'follow_up_action',
    capability: 'FOLLOW_UP_ACTION',
    description: {
      zh: '对上次结果执行操作（购买等）',
      en: 'Act on previous results (purchase etc)',
    },
    api: 'context:last_result',
    dataFields: ['selectedProduct'],
    phase: 1,
  },
  {
    intent: 'follow_up_refine',
    capability: 'FOLLOW_UP_REFINE',
    description: {
      zh: '对上次结果进一步筛选',
      en: 'Refine previous results',
    },
    api: 'context:last_result',
    dataFields: ['products'],
    phase: 1,
  },

  {
    intent: 'unknown',
    capability: 'UNKNOWN_FALLBACK',
    description: {
      zh: '未识别意图兜底',
      en: 'Unknown intent fallback',
    },
    api: 'none',
    dataFields: [],
    phase: 1,
  },
  {
    intent: 'greeting',
    capability: 'GREETING',
    description: {
      zh: '问候',
      en: 'Greeting',
    },
    api: 'none',
    dataFields: [],
    phase: 1,
  },
];

const intentMap = new Map<string, CapabilityDef>();
for (const cap of CAPABILITIES) {
  intentMap.set(cap.intent, cap);
}

export function getCapability(
  intent: string
): CapabilityDef | undefined {
  return intentMap.get(intent);
}

export function getAllCapabilities(): CapabilityDef[] {
  return [...CAPABILITIES];
}

export function getRegisteredIntents(): Set<string> {
  return new Set(intentMap.keys());
}

/**
 * Validate that every intent in the handler map
 * has a corresponding capability entry.
 * Call at startup to catch mapping errors early.
 */
export function validateIntentCoverage(
  handlerIntents: string[]
): { valid: boolean; missing: string[] } {
  const missing = handlerIntents.filter(
    (i) => !intentMap.has(i)
  );
  if (missing.length > 0) {
    log.warn({
      event: 'capability_coverage_gap',
      missing,
      message:
        'Intents without capability mapping found',
    });
  }
  return {
    valid: missing.length === 0,
    missing,
  };
}
