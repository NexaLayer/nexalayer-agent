import { NLUserContext } from './nl-auth.middleware';
import { Lang, t } from './executor-utils';

type Role = 'admin' | 'agent' | 'user';

function getRole(user: NLUserContext): Role {
  if (user.isAdmin) return 'admin';
  if (user.isAgent) return 'agent';
  return 'user';
}

/* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
   命令定义（按功能分类）
   ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */

interface CmdDef {
  id: string;
  zh: string;
  en: string;
  example_zh: string;
  example_en: string;
  roles: Role[];
  category: string;
}

const COMMANDS: CmdDef[] = [
  // ── 查询类 ──
  {
    id: 'query_balance',
    zh: '查询余额',
    en: 'Check balance',
    example_zh: '查询余额',
    example_en: 'Check my balance',
    roles: ['admin', 'agent', 'user'],
    category: 'query',
  },
  {
    id: 'query_stats',
    zh: '查询统计 (充值/消费/利润)',
    en: 'Query stats (recharge/spend/profit)',
    example_zh: '查询本月消费',
    example_en: 'Show monthly spending',
    roles: ['admin', 'agent', 'user'],
    category: 'query',
  },
  {
    id: 'query_static_orders',
    zh: '查询静态代理订单',
    en: 'Query static proxy orders',
    example_zh: '我有哪些静态订单',
    example_en: 'Show my static orders',
    roles: ['admin', 'agent', 'user'],
    category: 'query',
  },
  {
    id: 'query_dynamic_orders',
    zh: '查询动态代理订单',
    en: 'Query dynamic proxy orders',
    example_zh: '查询动态代理订单',
    example_en: 'Show dynamic orders',
    roles: ['admin', 'agent', 'user'],
    category: 'query',
  },
  {
    id: 'query_transactions',
    zh: '查询交易记录',
    en: 'Query transactions',
    example_zh: '查询最近100条交易记录',
    example_en: 'Show last 100 transactions',
    roles: ['admin', 'agent', 'user'],
    category: 'query',
  },
  {
    id: 'query_ip_inventory',
    zh: '查询IP库存/产品',
    en: 'Query IP inventory/products',
    example_zh: '查询纽约的IP',
    example_en: 'Show New York IPs',
    roles: ['admin', 'agent', 'user'],
    category: 'query',
  },
  {
    id: 'query_dynamic_resource',
    zh: '查询动态代理资源',
    en: 'Query dynamic resources',
    example_zh: '查询动态代理资源',
    example_en: 'Show dynamic resources',
    roles: ['admin', 'agent', 'user'],
    category: 'query',
  },
  {
    id: 'query_expiring_ips',
    zh: '查询即将到期的IP',
    en: 'Query expiring IPs',
    example_zh: '我的哪些IP快到期了',
    example_en: 'Which IPs are expiring?',
    roles: ['admin', 'agent', 'user'],
    category: 'query',
  },
  {
    id: 'query_ip_info',
    zh: '查询单个IP信息',
    en: 'Query single IP info',
    example_zh: '160.250.198.41什么时候到期',
    example_en: 'When does 160.250.198.41 expire?',
    roles: ['admin', 'agent', 'user'],
    category: 'query',
  },
  {
    id: 'generate_proxy_qr',
    zh: '生成代理二维码/链接',
    en: 'Generate proxy QR code/link',
    example_zh: '163.61.209.63 二维码',
    example_en: 'QR code for 163.61.209.63',
    roles: ['admin', 'user'],
    category: 'query',
  },
  {
    id: 'query_users',
    zh: '查看用户列表',
    en: 'List users',
    example_zh: '查看用户列表',
    example_en: 'List users',
    roles: ['admin', 'agent'],
    category: 'query',
  },
  {
    id: 'query_today_orders',
    zh: '查询今日消费',
    en: 'Today\'s spending',
    example_zh: '今天都消费了什么',
    example_en: 'What did I buy today?',
    roles: ['admin', 'agent', 'user'],
    category: 'query',
  },
  // ── 翻页控制 ──
  {
    id: 'paginate_next',
    zh: '下一页',
    en: 'Next page',
    example_zh: '下一页',
    example_en: 'next page',
    roles: ['admin', 'agent', 'user'],
    category: 'pagination',
  },
  {
    id: 'paginate_prev',
    zh: '上一页',
    en: 'Previous page',
    example_zh: '上一页',
    example_en: 'previous page',
    roles: ['admin', 'agent', 'user'],
    category: 'pagination',
  },
  {
    id: 'paginate_to_page',
    zh: '跳转到指定页',
    en: 'Go to page',
    example_zh: '第3页',
    example_en: 'page 3',
    roles: ['admin', 'agent', 'user'],
    category: 'pagination',
  },
  {
    id: 'paginate_change_page_size',
    zh: '修改每页条数',
    en: 'Change page size',
    example_zh: '每页20条',
    example_en: '20 per page',
    roles: ['admin', 'agent', 'user'],
    category: 'pagination',
  },
  // ── 历史记录 ──
  {
    id: 'query_nl_history',
    zh: '查看对话历史',
    en: 'View chat history',
    example_zh: '查看我的历史记录',
    example_en: 'Show my chat history',
    roles: ['admin', 'agent', 'user'],
    category: 'history',
  },
  // ── 业务开通 ──
  {
    id: 'purchase_static',
    zh: '开通静态代理',
    en: 'Open static proxy',
    example_zh: '帮我开一个华盛顿的IP',
    example_en: 'Open a Washington IP',
    roles: ['agent', 'user'],
    category: 'business',
  },
  {
    id: 'purchase_dynamic',
    zh: '开通动态代理',
    en: 'Open dynamic proxy',
    example_zh: '开通2G动态代理',
    example_en: 'Buy 2GB dynamic proxy',
    roles: ['agent', 'user'],
    category: 'business',
  },
  {
    id: 'extract_dynamic',
    zh: '提取动态代理链接',
    en: 'Extract dynamic proxy',
    example_zh: '帮我提取一个动态链接',
    example_en: 'Extract a dynamic link',
    roles: ['agent', 'user'],
    category: 'business',
  },
  {
    id: 'renew_static',
    zh: '续费静态代理',
    en: 'Renew static proxy',
    example_zh: '续费 149.119.141.100，3个月',
    example_en: 'Renew 149.119.141.100, 3 months',
    roles: ['agent', 'user'],
    category: 'business',
  },
  // ── IP 质量 ──
  {
    id: 'check_ip_quality',
    zh: '检测IP质量',
    en: 'Check IP quality',
    example_zh: '查询 2.3.4.5 的质量',
    example_en: 'Check quality of 2.3.4.5',
    roles: ['admin', 'agent', 'user'],
    category: 'quality',
  },
  {
    id: 'find_best_ip',
    zh: '查找最优质IP',
    en: 'Find best quality IP',
    example_zh: '开通一个美国质量最好的IP',
    example_en: 'Open the best quality US IP',
    roles: ['admin', 'agent', 'user'],
    category: 'quality',
  },
  // ── 账号管理 ──
  {
    id: 'assign_balance',
    zh: '分配额度',
    en: 'Assign balance',
    example_zh: '给用户 user01 分配 100 元',
    example_en: 'Assign 100 CNY to user01',
    roles: ['admin', 'agent'],
    category: 'account',
  },
  {
    id: 'reset_password',
    zh: '重置密码',
    en: 'Reset password',
    example_zh: '重置用户 user01 的密码',
    example_en: 'Reset password for user01',
    roles: ['admin', 'agent', 'user'],
    category: 'account',
  },
  {
    id: 'get_referral_code',
    zh: '推荐返佣说明',
    en: 'Referral commission guide',
    example_zh:
      '推荐给其他用户对方每次充值你将获得15％的佣金，请发送邮件至support@nexalayer.net。',
    example_en:
      'Refer users and earn 15% commission on each recharge. Contact support@nexalayer.net.',
    roles: ['agent'],
    category: 'account',
  },
  {
    id: 'set_product_price',
    zh: '设置产品价格',
    en: 'Set product price',
    example_zh: '设置产品 PRD001 价格为 50 元',
    example_en: 'Set PRD001 to 50 CNY',
    roles: ['admin', 'agent'],
    category: 'account',
  },
  // ── 指纹 Profile 管理 ──
  {
    id: 'create_profile',
    zh: '创建浏览器配置',
    en: 'Create browser profile',
    example_zh: '创建一个美国 Chrome 浏览器配置',
    example_en: 'Create a US Chrome profile',
    roles: ['admin', 'agent', 'user'],
    category: 'profile',
  },
  {
    id: 'list_profiles',
    zh: '查看浏览器配置列表',
    en: 'List browser profiles',
    example_zh: '查看我的浏览器配置',
    example_en: 'Show my profiles',
    roles: ['admin', 'agent', 'user'],
    category: 'profile',
  },
  {
    id: 'duplicate_profile',
    zh: '复制浏览器配置',
    en: 'Duplicate profile',
    example_zh: '复制配置 PRF-xxx',
    example_en: 'Duplicate profile PRF-xxx',
    roles: ['admin', 'agent', 'user'],
    category: 'profile',
  },
  {
    id: 'batch_create_profiles',
    zh: '批量创建配置',
    en: 'Batch create profiles',
    example_zh: '批量创建 10 个 Chrome 配置',
    example_en: 'Batch create 10 Chrome profiles',
    roles: ['admin', 'agent', 'user'],
    category: 'profile',
  },
  {
    id: 'generate_fingerprint',
    zh: '生成浏览器指纹',
    en: 'Generate fingerprint',
    example_zh: '生成一个 Windows Chrome 指纹',
    example_en: 'Generate a Windows Chrome fingerprint',
    roles: ['admin', 'agent', 'user'],
    category: 'profile',
  },
  {
    id: 'validate_fingerprint',
    zh: '校验指纹一致性',
    en: 'Validate fingerprint consistency',
    example_zh: '检查配置 PRF-xxx 的指纹一致性',
    example_en: 'Validate fingerprint of PRF-xxx',
    roles: ['admin', 'agent', 'user'],
    category: 'profile',
  },
  // ── 指纹参数控制 ──
  {
    id: 'set_timezone',
    zh: '设置时区',
    en: 'Set timezone',
    example_zh: '把配置 PRF-xxx 时区改成美东时间',
    example_en: 'Set PRF-xxx timezone to US Eastern',
    roles: ['admin', 'agent', 'user'],
    category: 'fingerprint',
  },
  {
    id: 'set_user_agent',
    zh: '设置 User-Agent',
    en: 'Set User-Agent',
    example_zh: '设置配置 PRF-xxx 的 UA 为 Chrome 120',
    example_en: 'Set PRF-xxx UA to Chrome 120',
    roles: ['admin', 'agent', 'user'],
    category: 'fingerprint',
  },
  {
    id: 'set_language',
    zh: '设置语言',
    en: 'Set language',
    example_zh: '设置配置的语言为 en-US',
    example_en: 'Set profile language to en-US',
    roles: ['admin', 'agent', 'user'],
    category: 'fingerprint',
  },
  {
    id: 'set_canvas',
    zh: '设置 Canvas 指纹',
    en: 'Set Canvas fingerprint',
    example_zh: '设置 Canvas 为 noise 模式',
    example_en: 'Set Canvas to noise mode',
    roles: ['admin', 'agent', 'user'],
    category: 'fingerprint',
  },
  {
    id: 'set_webgl',
    zh: '设置 WebGL 指纹',
    en: 'Set WebGL fingerprint',
    example_zh: '设置 WebGL 为 noise 模式',
    example_en: 'Set WebGL to noise mode',
    roles: ['admin', 'agent', 'user'],
    category: 'fingerprint',
  },
  {
    id: 'set_webrtc',
    zh: '设置 WebRTC 模式',
    en: 'Set WebRTC mode',
    example_zh: '禁用配置 PRF-xxx 的 WebRTC',
    example_en: 'Disable WebRTC for PRF-xxx',
    roles: ['admin', 'agent', 'user'],
    category: 'fingerprint',
  },
  {
    id: 'set_audio',
    zh: '设置 Audio 指纹',
    en: 'Set Audio fingerprint',
    example_zh: '设置 Audio 为 noise 模式',
    example_en: 'Set Audio to noise mode',
    roles: ['admin', 'agent', 'user'],
    category: 'fingerprint',
  },
  {
    id: 'set_os',
    zh: '设置操作系统',
    en: 'Set OS',
    example_zh: '设置操作系统为 Windows',
    example_en: 'Set OS to Windows',
    roles: ['admin', 'agent', 'user'],
    category: 'fingerprint',
  },
  {
    id: 'set_cpu',
    zh: '设置 CPU 核心数',
    en: 'Set CPU cores',
    example_zh: '设置 CPU 为 8 核',
    example_en: 'Set CPU to 8 cores',
    roles: ['admin', 'agent', 'user'],
    category: 'fingerprint',
  },
  {
    id: 'set_memory',
    zh: '设置内存大小',
    en: 'Set memory',
    example_zh: '设置内存为 16GB',
    example_en: 'Set memory to 16GB',
    roles: ['admin', 'agent', 'user'],
    category: 'fingerprint',
  },
  {
    id: 'set_gpu',
    zh: '设置 GPU 型号',
    en: 'Set GPU model',
    example_zh: '设置 GPU 为 RTX 3060',
    example_en: 'Set GPU to RTX 3060',
    roles: ['admin', 'agent', 'user'],
    category: 'fingerprint',
  },
  {
    id: 'set_screen',
    zh: '设置屏幕分辨率',
    en: 'Set screen resolution',
    example_zh: '设置分辨率为 1920x1080',
    example_en: 'Set resolution to 1920x1080',
    roles: ['admin', 'agent', 'user'],
    category: 'fingerprint',
  },
  {
    id: 'set_battery',
    zh: '设置 Battery API',
    en: 'Set Battery API',
    example_zh: '关闭 Battery API',
    example_en: 'Disable Battery API',
    roles: ['admin', 'agent', 'user'],
    category: 'fingerprint',
  },
  {
    id: 'set_webgpu',
    zh: '设置 WebGPU',
    en: 'Set WebGPU',
    example_zh: '设置 WebGPU 指纹',
    example_en: 'Set WebGPU fingerprint',
    roles: ['admin', 'agent', 'user'],
    category: 'fingerprint',
  },
  // ── Profile 生命周期 ──
  {
    id: 'pause_profile',
    zh: '暂停配置',
    en: 'Pause profile',
    example_zh: '暂停配置 PRF-xxx',
    example_en: 'Pause profile PRF-xxx',
    roles: ['admin', 'agent', 'user'],
    category: 'profile',
  },
  {
    id: 'resume_profile',
    zh: '恢复配置',
    en: 'Resume profile',
    example_zh: '恢复配置 PRF-xxx',
    example_en: 'Resume profile PRF-xxx',
    roles: ['admin', 'agent', 'user'],
    category: 'profile',
  },
  // ── 代理管理 ──
  {
    id: 'add_proxy',
    zh: '添加外部代理',
    en: 'Add external proxy',
    example_zh: '添加代理 socks5://1.2.3.4:1080',
    example_en: 'Add proxy socks5://1.2.3.4:1080',
    roles: ['admin', 'agent', 'user'],
    category: 'proxy_mgmt',
  },
  {
    id: 'list_proxy',
    zh: '查看代理列表',
    en: 'List proxies',
    example_zh: '查看可用的代理',
    example_en: 'Show available proxies',
    roles: ['admin', 'agent', 'user'],
    category: 'proxy_mgmt',
  },
  {
    id: 'verify_proxy',
    zh: '验证代理连通性',
    en: 'Verify proxy connectivity',
    example_zh: '测试代理 PRX-xxx 的连通性',
    example_en: 'Test proxy PRX-xxx connectivity',
    roles: ['admin', 'agent', 'user'],
    category: 'proxy_mgmt',
  },
  {
    id: 'bind_proxy',
    zh: '绑定代理到配置',
    en: 'Bind proxy to profile',
    example_zh: '给配置 PRF-xxx 绑定代理',
    example_en: 'Bind proxy to PRF-xxx',
    roles: ['admin', 'agent', 'user'],
    category: 'proxy_mgmt',
  },
  {
    id: 'delete_proxy',
    zh: '删除代理',
    en: 'Delete proxy',
    example_zh: '删除代理 PRX-xxx',
    example_en: 'Delete proxy PRX-xxx',
    roles: ['admin', 'agent', 'user'],
    category: 'proxy_mgmt',
  },
  {
    id: 'proxy_speed_test',
    zh: '代理测速',
    en: 'Proxy speed test',
    example_zh: '测试代理 PRX-xxx 速度',
    example_en: 'Speed test proxy PRX-xxx',
    roles: ['admin', 'agent', 'user'],
    category: 'proxy_mgmt',
  },
  {
    id: 'create_proxy_pool',
    zh: '创建代理池',
    en: 'Create proxy pool',
    example_zh: '创建代理池 美国住宅',
    example_en: 'Create proxy pool US residential',
    roles: ['admin', 'agent', 'user'],
    category: 'proxy_mgmt',
  },
  // ── 浏览器实例管理 ──
  {
    id: 'launch_browser',
    zh: '启动浏览器',
    en: 'Launch browser',
    example_zh: '启动配置 PRF-xxx 的浏览器',
    example_en: 'Launch browser for PRF-xxx',
    roles: ['admin', 'agent', 'user'],
    category: 'browser',
  },
  {
    id: 'close_browser',
    zh: '关闭浏览器',
    en: 'Close browser',
    example_zh: '关闭浏览器 INS-xxx',
    example_en: 'Close browser INS-xxx',
    roles: ['admin', 'agent', 'user'],
    category: 'browser',
  },
  {
    id: 'list_browsers',
    zh: '查看运行中的浏览器',
    en: 'List running browsers',
    example_zh: '查看运行中的浏览器',
    example_en: 'Show running browsers',
    roles: ['admin', 'agent', 'user'],
    category: 'browser',
  },
  {
    id: 'restart_browser',
    zh: '重启浏览器',
    en: 'Restart browser',
    example_zh: '重启浏览器 INS-xxx',
    example_en: 'Restart browser INS-xxx',
    roles: ['admin', 'agent', 'user'],
    category: 'browser',
  },
  {
    id: 'navigate_to',
    zh: '浏览器导航',
    en: 'Navigate to URL',
    example_zh: '用浏览器 INS-xxx 访问 google.com',
    example_en: 'Navigate INS-xxx to google.com',
    roles: ['admin', 'agent', 'user'],
    category: 'browser',
  },
  {
    id: 'take_screenshot',
    zh: '浏览器截图',
    en: 'Take screenshot',
    example_zh: '截图浏览器 INS-xxx',
    example_en: 'Screenshot INS-xxx',
    roles: ['admin', 'agent', 'user'],
    category: 'browser',
  },
  // ── 浏览器页面操作 ──
  {
    id: 'click_element',
    zh: '点击元素',
    en: 'Click element',
    example_zh: '在浏览器 INS-xxx 点击 #login',
    example_en: 'Click #login in INS-xxx',
    roles: ['admin', 'agent', 'user'],
    category: 'browser_action',
  },
  {
    id: 'input_text',
    zh: '输入文本',
    en: 'Input text',
    example_zh: '在输入框 #search 输入 "iphone"',
    example_en: 'Type "iphone" in #search',
    roles: ['admin', 'agent', 'user'],
    category: 'browser_action',
  },
  {
    id: 'scroll_page',
    zh: '滚动页面',
    en: 'Scroll page',
    example_zh: '向下滚动页面',
    example_en: 'Scroll down the page',
    roles: ['admin', 'agent', 'user'],
    category: 'browser_action',
  },
  {
    id: 'extract_text',
    zh: '提取文本',
    en: 'Extract text',
    example_zh: '提取页面文本内容',
    example_en: 'Extract page text',
    roles: ['admin', 'agent', 'user'],
    category: 'browser_action',
  },
  {
    id: 'extract_links',
    zh: '提取链接',
    en: 'Extract links',
    example_zh: '提取页面所有链接',
    example_en: 'Extract all page links',
    roles: ['admin', 'agent', 'user'],
    category: 'browser_action',
  },
  {
    id: 'extract_table',
    zh: '提取表格',
    en: 'Extract table',
    example_zh: '提取页面表格数据',
    example_en: 'Extract table data',
    roles: ['admin', 'agent', 'user'],
    category: 'browser_action',
  },
  {
    id: 'export_cookies',
    zh: '导出 Cookie',
    en: 'Export cookies',
    example_zh: '导出浏览器 INS-xxx 的 Cookie',
    example_en: 'Export cookies from INS-xxx',
    roles: ['admin', 'agent', 'user'],
    category: 'browser_action',
  },
  {
    id: 'clear_cookies',
    zh: '清除 Cookie',
    en: 'Clear cookies',
    example_zh: '清除浏览器 INS-xxx 的 Cookie',
    example_en: 'Clear cookies in INS-xxx',
    roles: ['admin', 'agent', 'user'],
    category: 'browser_action',
  },
  // ── 任务管理 ──
  {
    id: 'submit_task',
    zh: '提交自动化任务',
    en: 'Submit automation task',
    example_zh: '用配置 PRF-xxx 抓取 example.com',
    example_en: 'Scrape example.com with PRF-xxx',
    roles: ['admin', 'agent', 'user'],
    category: 'task',
  },
  {
    id: 'query_task',
    zh: '查看任务状态',
    en: 'Query task status',
    example_zh: '查看任务 TSK-xxx 的状态',
    example_en: 'Check task TSK-xxx status',
    roles: ['admin', 'agent', 'user'],
    category: 'task',
  },
  {
    id: 'run_script',
    zh: '运行浏览器脚本',
    en: 'Run browser script',
    example_zh: '在浏览器 INS-xxx 中获取页面标题',
    example_en: 'Get page title in INS-xxx',
    roles: ['admin', 'agent', 'user'],
    category: 'task',
  },
  {
    id: 'create_workflow',
    zh: '创建自动化流程',
    en: 'Create workflow',
    example_zh: '创建流程：抓取 Amazon 商品',
    example_en: 'Create workflow: scrape Amazon',
    roles: ['admin', 'agent', 'user'],
    category: 'task',
  },
  {
    id: 'list_workflows',
    zh: '查看自动化流程',
    en: 'List workflows',
    example_zh: '查看自动化流程',
    example_en: 'Show workflows',
    roles: ['admin', 'agent', 'user'],
    category: 'task',
  },
  {
    id: 'run_workflow',
    zh: '运行流程',
    en: 'Run workflow',
    example_zh: '运行流程 WF-xxx',
    example_en: 'Run workflow WF-xxx',
    roles: ['admin', 'agent', 'user'],
    category: 'task',
  },
  // ── 工作区 ──
  {
    id: 'create_workspace',
    zh: '创建工作区',
    en: 'Create workspace',
    example_zh: '创建工作区 Amazon',
    example_en: 'Create workspace Amazon',
    roles: ['admin', 'agent', 'user'],
    category: 'workspace',
  },
  {
    id: 'list_workspaces',
    zh: '查看工作区',
    en: 'List workspaces',
    example_zh: '查看工作区',
    example_en: 'Show workspaces',
    roles: ['admin', 'agent', 'user'],
    category: 'workspace',
  },
  {
    id: 'move_to_workspace',
    zh: '移动配置到工作区',
    en: 'Move to workspace',
    example_zh: '把配置 PRF-xxx 移到 Amazon',
    example_en: 'Move PRF-xxx to Amazon',
    roles: ['admin', 'agent', 'user'],
    category: 'workspace',
  },
  {
    id: 'delete_workspace',
    zh: '删除工作区',
    en: 'Delete workspace',
    example_zh: '删除工作区 Amazon',
    example_en: 'Delete workspace Amazon',
    roles: ['admin', 'agent', 'user'],
    category: 'workspace',
  },
  // ── 数据管理 ──
  {
    id: 'export_browser_data',
    zh: '导出浏览器数据',
    en: 'Export browser data',
    example_zh: '导出配置 PRF-xxx 的数据',
    example_en: 'Export data of PRF-xxx',
    roles: ['admin', 'agent', 'user'],
    category: 'data',
  },
  {
    id: 'clear_cache',
    zh: '清理缓存',
    en: 'Clear cache',
    example_zh: '清理配置 PRF-xxx 的缓存',
    example_en: 'Clear cache of PRF-xxx',
    roles: ['admin', 'agent', 'user'],
    category: 'data',
  },
  {
    id: 'clear_storage',
    zh: '清理存储',
    en: 'Clear storage',
    example_zh: '清理配置 PRF-xxx 的存储',
    example_en: 'Clear storage of PRF-xxx',
    roles: ['admin', 'agent', 'user'],
    category: 'data',
  },
  // ── 系统 ──
  {
    id: 'system_status',
    zh: '查看系统状态',
    en: 'System status',
    example_zh: '查看系统状态',
    example_en: 'Show system status',
    roles: ['admin', 'agent'],
    category: 'system',
  },
  {
    id: 'resource_usage',
    zh: '查看资源使用',
    en: 'Resource usage',
    example_zh: '查看资源使用',
    example_en: 'Show resource usage',
    roles: ['admin', 'agent'],
    category: 'system',
  },
  {
    id: 'view_logs',
    zh: '查看操作日志',
    en: 'View logs',
    example_zh: '查看最近日志',
    example_en: 'View recent logs',
    roles: ['admin', 'agent'],
    category: 'system',
  },

  // ─── 补全缺失意图 ───

  {
    id: 'query_dashboard',
    zh: '查看仪表盘',
    en: 'View dashboard',
    example_zh: '查看仪表盘',
    example_en: 'Show dashboard',
    roles: ['admin', 'agent'],
    category: 'query',
  },
  {
    id: 'query_products',
    zh: '查看产品列表',
    en: 'List products',
    example_zh: '有哪些产品',
    example_en: 'Show products',
    roles: ['admin', 'agent', 'user'],
    category: 'query',
  },
  {
    id: 'query_static_resource',
    zh: '显示独享静态代理(isp)资源',
    en: 'Show dedicated static proxy (ISP) resources',
    example_zh: '显示独享静态代理(isp)资源',
    example_en:
      'Show dedicated static proxy (ISP) resources',
    roles: ['admin', 'agent', 'user'],
    category: 'query',
  },
  {
    id: 'query_static_products',
    zh: '显示业务共享静态代理(isp)资源',
    en: 'Show business shared static proxy (ISP) resources',
    example_zh: '显示业务共享静态代理(isp)资源',
    example_en:
      'Show business shared static proxy (ISP) resources',
    roles: ['admin', 'agent'],
    category: 'query',
  },
  {
    id: 'purchase_ip',
    zh: '购买指定IP',
    en: 'Purchase specific IP',
    example_zh: '购买 1.2.3.4',
    example_en: 'Purchase IP 1.2.3.4',
    roles: ['admin', 'agent'],
    category: 'business',
  },
  {
    id: 'create_session',
    zh: '创建代理会话',
    en: 'Create proxy session',
    example_zh: '创建一个美国会话',
    example_en: 'Create a US session',
    roles: ['admin', 'agent'],
    category: 'business',
  },
  {
    id: 'update_profile',
    zh: '更新配置',
    en: 'Update profile',
    example_zh: '更新配置 prof_xxx',
    example_en: 'Update profile prof_xxx',
    roles: ['admin', 'agent'],
    category: 'profile',
  },
  {
    id: 'delete_profile',
    zh: '删除配置',
    en: 'Delete profile',
    example_zh: '删除配置 prof_xxx',
    example_en: 'Delete profile prof_xxx',
    roles: ['admin', 'agent'],
    category: 'profile',
  },
  {
    id: 'import_profile',
    zh: '导入配置',
    en: 'Import profile',
    example_zh: '导入配置',
    example_en: 'Import profile',
    roles: ['admin', 'agent'],
    category: 'profile',
  },
  {
    id: 'export_profile',
    zh: '导出配置',
    en: 'Export profile',
    example_zh: '导出配置 prof_xxx',
    example_en: 'Export profile prof_xxx',
    roles: ['admin', 'agent'],
    category: 'profile',
  },
  {
    id: 'group_profile',
    zh: '配置分组',
    en: 'Group profile',
    example_zh: '把配置 prof_xxx 加入分组',
    example_en: 'Group profile prof_xxx',
    roles: ['admin', 'agent'],
    category: 'profile',
  },
  {
    id: 'tag_profile',
    zh: '配置标签',
    en: 'Tag profile',
    example_zh: '给配置 prof_xxx 打标签 amazon',
    example_en: 'Tag profile prof_xxx as amazon',
    roles: ['admin', 'agent'],
    category: 'profile',
  },
  {
    id: 'archive_profile',
    zh: '归档配置',
    en: 'Archive profile',
    example_zh: '归档配置 prof_xxx',
    example_en: 'Archive profile prof_xxx',
    roles: ['admin', 'agent'],
    category: 'profile',
  },
  {
    id: 'set_fonts',
    zh: '设置字体列表',
    en: 'Set fonts',
    example_zh: '设置配置 prof_xxx 字体为 Windows 默认',
    example_en: 'Set prof_xxx fonts to Windows default',
    roles: ['admin', 'agent'],
    category: 'fingerprint',
  },
  {
    id: 'set_plugins',
    zh: '设置插件列表',
    en: 'Set plugins',
    example_zh: '设置配置 prof_xxx 的插件',
    example_en: 'Set plugins for prof_xxx',
    roles: ['admin', 'agent'],
    category: 'fingerprint',
  },
  {
    id: 'set_client_hints',
    zh: '设置 Client Hints',
    en: 'Set Client Hints',
    example_zh: '设置配置 prof_xxx 的 Client Hints',
    example_en: 'Set Client Hints for prof_xxx',
    roles: ['admin', 'agent'],
    category: 'fingerprint',
  },
  {
    id: 'set_media_devices',
    zh: '设置媒体设备',
    en: 'Set media devices',
    example_zh: '设置配置 prof_xxx 的摄像头和麦克风',
    example_en: 'Set cameras/mics for prof_xxx',
    roles: ['admin', 'agent'],
    category: 'fingerprint',
  },
  {
    id: 'set_navigator',
    zh: '设置 Navigator 属性',
    en: 'Set navigator props',
    example_zh: '设置配置 prof_xxx 的 navigator',
    example_en: 'Set navigator for prof_xxx',
    roles: ['admin', 'agent'],
    category: 'fingerprint',
  },
  {
    id: 'set_device_memory',
    zh: '设置 Device Memory',
    en: 'Set device memory',
    example_zh: '设置配置 prof_xxx 的设备内存为 8GB',
    example_en: 'Set prof_xxx device memory to 8GB',
    roles: ['admin', 'agent'],
    category: 'fingerprint',
  },
  {
    id: 'set_gamepad',
    zh: '设置 Gamepad',
    en: 'Set gamepad',
    example_zh: '启用配置 prof_xxx 的 Gamepad',
    example_en: 'Enable gamepad for prof_xxx',
    roles: ['admin', 'agent'],
    category: 'fingerprint',
  },
  {
    id: 'import_proxy',
    zh: '批量导入代理',
    en: 'Import proxies',
    example_zh: '导入代理列表',
    example_en: 'Import proxy list',
    roles: ['admin', 'agent'],
    category: 'proxy_mgmt',
  },
  {
    id: 'rotate_proxy',
    zh: '轮换代理',
    en: 'Rotate proxy',
    example_zh: '轮换配置 prof_xxx 的代理',
    example_en: 'Rotate proxy for prof_xxx',
    roles: ['admin', 'agent'],
    category: 'proxy_mgmt',
  },
  {
    id: 'proxy_quality_check',
    zh: '代理质量检测',
    en: 'Proxy quality check',
    example_zh: '检测代理 prx_xxx 质量',
    example_en: 'Check quality of prx_xxx',
    roles: ['admin', 'agent'],
    category: 'proxy_mgmt',
  },
  {
    id: 'auto_match_proxy',
    zh: '自动匹配代理',
    en: 'Auto match proxy',
    example_zh: '自动匹配配置 prof_xxx 的代理',
    example_en: 'Auto match proxy for prof_xxx',
    roles: ['admin', 'agent'],
    category: 'proxy_mgmt',
  },
  {
    id: 'auto_select_proxy',
    zh: '自动选择最佳代理',
    en: 'Auto select best proxy',
    example_zh: '为配置 prof_xxx 自动选择最佳代理',
    example_en: 'Auto select best proxy for prof_xxx',
    roles: ['admin', 'agent'],
    category: 'proxy_mgmt',
  },
  {
    id: 'list_proxy_pools',
    zh: '查看代理池',
    en: 'List proxy pools',
    example_zh: '查看代理池',
    example_en: 'Show proxy pools',
    roles: ['admin', 'agent'],
    category: 'proxy_mgmt',
  },
  {
    id: 'delete_proxy_pool',
    zh: '删除代理池',
    en: 'Delete proxy pool',
    example_zh: '删除代理池 pool_xxx',
    example_en: 'Delete proxy pool pool_xxx',
    roles: ['admin', 'agent'],
    category: 'proxy_mgmt',
  },
  {
    id: 'batch_launch_browser',
    zh: '批量启动浏览器',
    en: 'Batch launch browsers',
    example_zh: '批量启动所有配置的浏览器',
    example_en: 'Batch launch all browsers',
    roles: ['admin', 'agent'],
    category: 'browser',
  },
  {
    id: 'batch_close_browser',
    zh: '批量关闭浏览器',
    en: 'Batch close browsers',
    example_zh: '关闭所有浏览器',
    example_en: 'Close all browsers',
    roles: ['admin', 'agent'],
    category: 'browser',
  },
  {
    id: 'wait_for_element',
    zh: '等待元素出现',
    en: 'Wait for element',
    example_zh: '等待浏览器 inst_xxx 出现 #result',
    example_en: 'Wait for #result in inst_xxx',
    roles: ['admin', 'agent'],
    category: 'browser_action',
  },
  {
    id: 'hover_element',
    zh: '悬停元素',
    en: 'Hover element',
    example_zh: '悬停浏览器 inst_xxx 的 .menu',
    example_en: 'Hover .menu in inst_xxx',
    roles: ['admin', 'agent'],
    category: 'browser_action',
  },
  {
    id: 'select_option',
    zh: '选择下拉选项',
    en: 'Select option',
    example_zh: '在浏览器 inst_xxx 选择 #country 的选项',
    example_en: 'Select option in #country in inst_xxx',
    roles: ['admin', 'agent'],
    category: 'browser_action',
  },
  {
    id: 'extract_html',
    zh: '提取页面HTML',
    en: 'Extract HTML',
    example_zh: '提取浏览器 inst_xxx 的 HTML',
    example_en: 'Extract HTML from inst_xxx',
    roles: ['admin', 'agent'],
    category: 'browser_action',
  },
  {
    id: 'import_cookies',
    zh: '导入 Cookie',
    en: 'Import cookies',
    example_zh: '导入 Cookie 到浏览器 inst_xxx',
    example_en: 'Import cookies to inst_xxx',
    roles: ['admin', 'agent'],
    category: 'browser_action',
  },
  {
    id: 'upload_file',
    zh: '上传文件',
    en: 'Upload file',
    example_zh: '在浏览器 inst_xxx 上传文件',
    example_en: 'Upload file in inst_xxx',
    roles: ['admin', 'agent'],
    category: 'browser_action',
  },
  {
    id: 'download_file',
    zh: '下载文件',
    en: 'Download file',
    example_zh: '在浏览器 inst_xxx 下载文件',
    example_en: 'Download file in inst_xxx',
    roles: ['admin', 'agent'],
    category: 'browser_action',
  },
  {
    id: 'schedule_task',
    zh: '定时任务',
    en: 'Schedule task',
    example_zh: '每天运行任务 TSK-xxx',
    example_en: 'Run task TSK-xxx daily',
    roles: ['admin', 'agent'],
    category: 'task',
  },
  {
    id: 'batch_task',
    zh: '批量任务',
    en: 'Batch task',
    example_zh: '批量提交抓取任务',
    example_en: 'Submit batch scraping tasks',
    roles: ['admin', 'agent'],
    category: 'task',
  },
  {
    id: 'run_detection_test',
    zh: '运行指纹检测',
    en: 'Run detection test',
    example_zh: '检测配置 prof_xxx 的指纹泄露',
    example_en: 'Test fingerprint leaks for prof_xxx',
    roles: ['admin', 'agent'],
    category: 'task',
  },
  {
    id: 'delete_workflow',
    zh: '删除自动化流程',
    en: 'Delete workflow',
    example_zh: '删除流程 wf_xxx',
    example_en: 'Delete workflow wf_xxx',
    roles: ['admin', 'agent'],
    category: 'task',
  },
  {
    id: 'schedule_workflow',
    zh: '定时调度流程',
    en: 'Schedule workflow',
    example_zh: '每天运行流程 wf_xxx',
    example_en: 'Schedule wf_xxx daily',
    roles: ['admin', 'agent'],
    category: 'task',
  },
  {
    id: 'import_browser_data',
    zh: '导入浏览器数据',
    en: 'Import browser data',
    example_zh: '导入配置 prof_xxx 的浏览器数据',
    example_en: 'Import browser data for prof_xxx',
    roles: ['admin', 'agent'],
    category: 'data',
  },
];

const CATEGORIES: {
  key: string;
  zh: string;
  en: string;
}[] = [
  {
    key: 'pagination',
    zh: '📄 翻页控制',
    en: '📄 Pagination',
  },
  { key: 'query', zh: '📋 查询', en: '📋 Query' },
  {
    key: 'history',
    zh: '📜 历史记录',
    en: '📜 History',
  },
  {
    key: 'business',
    zh: '🚀 业务开通',
    en: '🚀 Business',
  },
  {
    key: 'quality',
    zh: '🔍 IP质量',
    en: '🔍 IP Quality',
  },
  {
    key: 'account',
    zh: '👤 账号管理',
    en: '👤 Account',
  },
  {
    key: 'profile',
    zh: '🖥️ 指纹配置',
    en: '🖥️ Profiles',
  },
  {
    key: 'fingerprint',
    zh: '🔧 指纹参数',
    en: '🔧 Fingerprint',
  },
  {
    key: 'proxy_mgmt',
    zh: '🌐 代理管理',
    en: '🌐 Proxy Mgmt',
  },
  {
    key: 'browser',
    zh: '🌍 浏览器',
    en: '🌍 Browser',
  },
  {
    key: 'browser_action',
    zh: '🎯 页面操作',
    en: '🎯 Page Actions',
  },
  {
    key: 'task',
    zh: '⚡ 自动化任务',
    en: '⚡ Tasks',
  },
  {
    key: 'workspace',
    zh: '📁 工作区',
    en: '📁 Workspace',
  },
  {
    key: 'data',
    zh: '💾 数据管理',
    en: '💾 Data',
  },
  {
    key: 'system',
    zh: '🔧 系统',
    en: '🔧 System',
  },
];

/* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
   1. 显式帮助
   ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */

export function showHelp(
  user: NLUserContext,
  lang: Lang,
  topic?: string
): {
  message: string;
  suggestions: string[];
} {
  const role = getRole(user);

  if (topic) {
    return showTopicHelp(role, lang, topic);
  }

  const roleLabel = t(
    lang,
    { admin: '管理员', agent: '代理商', user: '用户' }[
      role
    ],
    { admin: 'Admin', agent: 'Agent', user: 'User' }[
      role
    ]
  );

  let msg = t(
    lang,
    `📖 帮助中心 (${roleLabel})\n` +
      `━━━━━━━━━━━━━━━━━━━━━━━━\n\n`,
    `📖 Help Center (${roleLabel})\n` +
      `━━━━━━━━━━━━━━━━━━━━━━━━\n\n`
  );

  const suggestions: string[] = [];

  for (const cat of CATEGORIES) {
    const cmds = COMMANDS.filter(
      (c) =>
        c.category === cat.key &&
        c.roles.includes(role)
    );
    if (!cmds.length) continue;

    msg += `${lang === 'zh' ? cat.zh : cat.en}\n`;
    for (const cmd of cmds) {
      const name = lang === 'zh' ? cmd.zh : cmd.en;
      const ex =
        lang === 'zh'
          ? cmd.example_zh
          : cmd.example_en;
      msg += `  • ${name}\n    ${t(lang, '例', 'e.g.')}: "${ex}"\n`;
    }
    msg += '\n';

    if (suggestions.length < 4) {
      const pick = cmds[0];
      suggestions.push(
        lang === 'zh'
          ? pick.example_zh
          : pick.example_en
      );
    }
  }

  msg += t(
    lang,
    '💡 输入 "帮助 <分类>" 查看详细帮助\n' +
      '   可选分类：查询、开通、质量、账号、' +
      '配置、指纹、代理、浏览器、任务',
    '💡 Type "help <category>" for details\n' +
      '   Categories: query, business, quality, ' +
      'account, profile, fingerprint, proxy, ' +
      'browser, task'
  );

  return { message: msg, suggestions };
}

function showTopicHelp(
  role: Role,
  lang: Lang,
  topic: string
): {
  message: string;
  suggestions: string[];
} {
  const kw = topic.toLowerCase();

  const catMap: Record<string, string> = {
    翻页: 'pagination',
    分页: 'pagination',
    下一页: 'pagination',
    上一页: 'pagination',
    pagination: 'pagination',
    page: 'pagination',
    历史: 'history',
    历史记录: 'history',
    对话记录: 'history',
    聊天记录: 'history',
    对话历史: 'history',
    history: 'history',
    chat_history: 'history',
    查询: 'query',
    query: 'query',
    仪表盘: 'query',
    dashboard: 'query',
    产品: 'query',
    products: 'query',
    开通: 'business',
    购买: 'business',
    business: 'business',
    会话: 'business',
    session: 'business',
    质量: 'quality',
    quality: 'quality',
    账号: 'account',
    account: 'account',
    配置: 'profile',
    profile: 'profile',
    profiles: 'profile',
    导入配置: 'profile',
    导出配置: 'profile',
    删除配置: 'profile',
    分组: 'profile',
    标签: 'profile',
    归档: 'profile',
    指纹: 'fingerprint',
    fingerprint: 'fingerprint',
    fp: 'fingerprint',
    ua: 'fingerprint',
    字体: 'fingerprint',
    fonts: 'fingerprint',
    插件: 'fingerprint',
    plugins: 'fingerprint',
    navigator: 'fingerprint',
    gamepad: 'fingerprint',
    webgpu: 'fingerprint',
    battery: 'fingerprint',
    媒体设备: 'fingerprint',
    设备内存: 'fingerprint',
    代理管理: 'proxy_mgmt',
    代理: 'proxy_mgmt',
    proxy: 'proxy_mgmt',
    代理池: 'proxy_mgmt',
    轮换: 'proxy_mgmt',
    测速: 'proxy_mgmt',
    浏览器: 'browser',
    browser: 'browser',
    启动: 'browser',
    截图: 'browser',
    批量启动: 'browser',
    批量关闭: 'browser',
    任务: 'task',
    task: 'task',
    自动化: 'task',
    automation: 'task',
    脚本: 'task',
    script: 'task',
    流程: 'task',
    workflow: 'task',
    定时: 'task',
    schedule: 'task',
    检测: 'task',
    页面操作: 'browser_action',
    点击: 'browser_action',
    输入: 'browser_action',
    滚动: 'browser_action',
    提取: 'browser_action',
    cookie: 'browser_action',
    悬停: 'browser_action',
    hover: 'browser_action',
    等待: 'browser_action',
    wait: 'browser_action',
    选择: 'browser_action',
    select: 'browser_action',
    上传: 'browser_action',
    upload: 'browser_action',
    下载: 'browser_action',
    download: 'browser_action',
    html: 'browser_action',
    工作区: 'workspace',
    workspace: 'workspace',
    数据: 'data',
    data: 'data',
    缓存: 'data',
    cache: 'data',
    存储: 'data',
    storage: 'data',
    导入数据: 'data',
    导出数据: 'data',
    系统: 'system',
    system: 'system',
    日志: 'system',
    logs: 'system',
    资源: 'system',
  };

  const catKey = catMap[kw] || '';
  const cmds = catKey
    ? COMMANDS.filter(
        (c) =>
          c.category === catKey &&
          c.roles.includes(role)
      )
    : COMMANDS.filter(
        (c) =>
          c.roles.includes(role) &&
          (c.zh.includes(topic) ||
            c.en
              .toLowerCase()
              .includes(kw) ||
            c.id.includes(kw))
      );

  if (!cmds.length) {
    return showHelp(
      { isAdmin: role === 'admin', isAgent: role === 'agent' } as NLUserContext,
      lang
    );
  }

  let msg = t(
    lang,
    `📖 「${topic}」相关命令\n` +
      `━━━━━━━━━━━━━━━━━━━━━━━━\n\n`,
    `📖 "${topic}" Commands\n` +
      `━━━━━━━━━━━━━━━━━━━━━━━━\n\n`
  );

  const suggestions: string[] = [];
  for (const cmd of cmds) {
    const name = lang === 'zh' ? cmd.zh : cmd.en;
    const ex =
      lang === 'zh' ? cmd.example_zh : cmd.example_en;
    msg += `• ${name}\n  ${t(lang, '例', 'e.g.')}: "${ex}"\n\n`;
    if (suggestions.length < 5) {
      suggestions.push(ex);
    }
  }

  return { message: msg, suggestions };
}

/* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
   2. 未识别意图帮助
   ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */

const KEYWORD_INTENT_MAP: {
  keywords: RegExp;
  category: string;
  zh: string;
  en: string;
}[] = [
  {
    keywords: /余额|balance|充值|recharge/i,
    category: 'query',
    zh: '查询余额',
    en: 'balance query',
  },
  {
    keywords: /订单|order/i,
    category: 'query',
    zh: '订单查询',
    en: 'order query',
  },
  {
    keywords: /IP|ip/i,
    category: 'business',
    zh: 'IP操作',
    en: 'IP operations',
  },
  {
    keywords: /开通|购买|buy|open|purchase/i,
    category: 'business',
    zh: '业务开通',
    en: 'business',
  },
  {
    keywords: /提取|extract|链接|link/i,
    category: 'business',
    zh: '代理提取',
    en: 'proxy extraction',
  },
  {
    keywords: /质量|quality/i,
    category: 'quality',
    zh: 'IP质量检测',
    en: 'IP quality',
  },
  {
    keywords: /用户|user|账号|account/i,
    category: 'account',
    zh: '账号管理',
    en: 'account management',
  },
  {
    keywords: /价格|price|定价/i,
    category: 'account',
    zh: '价格管理',
    en: 'pricing',
  },
  {
    keywords: /续费|renew|extend/i,
    category: 'business',
    zh: '续费',
    en: 'renewal',
  },
  {
    keywords: /到期|过期|expir/i,
    category: 'query',
    zh: '到期查询',
    en: 'expiry query',
  },
  {
    keywords: /二维码|qr|扫码|shadowrocket|小火箭/i,
    category: 'query',
    zh: '二维码/链接',
    en: 'QR code/link',
  },
  {
    keywords: /配置|profile|浏览器配置/i,
    category: 'profile',
    zh: '指纹配置管理',
    en: 'profile management',
  },
  {
    keywords: /指纹|fingerprint|UA|user.?agent/i,
    category: 'fingerprint',
    zh: '指纹参数设置',
    en: 'fingerprint settings',
  },
  {
    keywords: /canvas|webgl|webrtc|audio/i,
    category: 'fingerprint',
    zh: '指纹参数设置',
    en: 'fingerprint settings',
  },
  {
    keywords: /时区|timezone|语言|language|字体|font/i,
    category: 'fingerprint',
    zh: '指纹参数设置',
    en: 'fingerprint settings',
  },
  {
    keywords: /代理管理|proxy.*manag|外部代理|socks|http代理/i,
    category: 'proxy_mgmt',
    zh: '代理管理',
    en: 'proxy management',
  },
  {
    keywords: /绑定代理|bind.*proxy|代理绑定/i,
    category: 'proxy_mgmt',
    zh: '代理绑定',
    en: 'proxy binding',
  },
  {
    keywords: /验证代理|verify.*proxy|测试代理|proxy.*test/i,
    category: 'proxy_mgmt',
    zh: '代理验证',
    en: 'proxy verification',
  },
  {
    keywords: /启动浏览器|launch|打开浏览器|关闭浏览器|close.*browser/i,
    category: 'browser',
    zh: '浏览器操作',
    en: 'browser operations',
  },
  {
    keywords: /截图|screenshot|导航|navigate|访问/i,
    category: 'browser',
    zh: '浏览器操作',
    en: 'browser operations',
  },
  {
    keywords: /重启浏览器|restart.*browser|批量启动|batch.*launch/i,
    category: 'browser',
    zh: '浏览器操作',
    en: 'browser operations',
  },
  {
    keywords: /任务|task|自动化|automation|抓取|scrape|爬取/i,
    category: 'task',
    zh: '自动化任务',
    en: 'automation tasks',
  },
  {
    keywords: /脚本|script|定时|schedule|批量任务/i,
    category: 'task',
    zh: '自动化任务',
    en: 'automation tasks',
  },
  {
    keywords: /检测|detect|反检测|anti.?detect/i,
    category: 'profile',
    zh: '指纹检测',
    en: 'fingerprint detection',
  },
];

export function helpForUnknown(
  input: string,
  user: NLUserContext,
  lang: Lang
): {
  message: string;
  suggestions: string[];
} {
  const role = getRole(user);

  const matched = KEYWORD_INTENT_MAP.filter((m) =>
    m.keywords.test(input)
  );

  if (matched.length > 0) {
    const cats = [
      ...new Set(matched.map((m) => m.category)),
    ];
    const relatedCmds = COMMANDS.filter(
      (c) =>
        cats.includes(c.category) &&
        c.roles.includes(role)
    );

    if (relatedCmds.length > 0) {
      const topicHint = matched
        .map((m) => (lang === 'zh' ? m.zh : m.en))
        .join('、');
      let msg = t(
        lang,
        `🤔 您似乎想进行「${topicHint}」相关操作，` +
          `以下是可用的命令：\n\n`,
        `🤔 It looks like you want "${topicHint}". ` +
          `Here are available commands:\n\n`
      );

      const suggestions: string[] = [];
      for (const cmd of relatedCmds.slice(0, 6)) {
        const name = lang === 'zh' ? cmd.zh : cmd.en;
        const ex =
          lang === 'zh'
            ? cmd.example_zh
            : cmd.example_en;
        msg += `• ${name}: "${ex}"\n`;
        if (suggestions.length < 5) {
          suggestions.push(ex);
        }
      }

      msg += t(
        lang,
        '\n💡 输入 "帮助" 查看所有可用命令',
        '\n💡 Type "help" for all commands'
      );
      return { message: msg, suggestions };
    }
  }

  const popular = COMMANDS.filter((c) =>
    c.roles.includes(role)
  ).slice(0, 6);

  let msg = t(
    lang,
    '🤔 抱歉，我暂时无法理解这个指令。\n\n' +
      '以下是您可以使用的常用命令：\n\n',
    "🤔 Sorry, I couldn't understand that.\n\n" +
      'Here are some commands you can try:\n\n'
  );

  const suggestions: string[] = [];
  for (const cmd of popular) {
    const ex =
      lang === 'zh' ? cmd.example_zh : cmd.example_en;
    const name = lang === 'zh' ? cmd.zh : cmd.en;
    msg += `• ${name}: "${ex}"\n`;
    if (suggestions.length < 5) {
      suggestions.push(ex);
    }
  }

  msg += t(
    lang,
    '\n💡 输入 "帮助" 查看完整命令列表',
    '\n💡 Type "help" for the full command list'
  );

  return { message: msg, suggestions };
}

/* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
   3. 缺少参数帮助
   ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */

interface ParamHint {
  zh: string;
  en: string;
  examples_zh: string[];
  examples_en: string[];
}

const PARAM_HINTS: Record<string, ParamHint> = {
  create_user: {
    zh: '创建用户需要提供邮箱作为用户名',
    en: 'Create user requires an email as username',
    examples_zh: ['创建用户 test@example.com'],
    examples_en: ['Create user test@example.com'],
  },
  batch_create_users: {
    zh: '批量创建需要指定数量',
    en: 'Batch create requires a quantity',
    examples_zh: [
      '批量创建 5 个用户',
      '批量创建 10 个用户，初始额度 100',
    ],
    examples_en: [
      'Batch create 5 users',
      'Batch create 10 users with 100 balance',
    ],
  },
  reset_password: {
    zh: '重置密码需要指定用户名',
    en: 'Reset password requires a username',
    examples_zh: [
      '重置用户 user01 的密码',
      '重置密码',
    ],
    examples_en: [
      'Reset password for user01',
      'Reset my password',
    ],
  },
  assign_balance: {
    zh: '分配额度需要指定用户名和金额',
    en: 'Assign balance requires username and amount',
    examples_zh: ['给用户 user01 分配 100 元'],
    examples_en: ['Assign 100 CNY to user01'],
  },
  purchase_static: {
    zh: '开通静态代理需要指定IP或地区',
    en: 'Open static proxy requires IP or region',
    examples_zh: [
      '开通一个 167.148.72.0 的 IP，30天',
      '帮我开一个华盛顿的IP',
      '查询纽约的IP',
    ],
    examples_en: [
      'Open 167.148.72.0, 30 days',
      'Open a Washington IP',
      'Show New York IPs',
    ],
  },
  purchase_dynamic: {
    zh: '开通动态代理需要指定流量大小',
    en: 'Open dynamic proxy requires traffic size',
    examples_zh: [
      '开通 2G 动态代理',
      '购买 10GB 动态代理',
    ],
    examples_en: [
      'Buy 2GB dynamic proxy',
      'Open 10GB dynamic proxy',
    ],
  },
  renew_static: {
    zh: '续费需要指定IP地址或订单号',
    en: 'Renewal requires an IP or order number',
    examples_zh: [
      '续费 149.119.141.100，3个月',
      '续费订单 NL1234567890',
    ],
    examples_en: [
      'Renew 149.119.141.100, 3 months',
      'Renew order NL1234567890',
    ],
  },
  check_ip_quality: {
    zh: '检测IP质量需要提供IP地址',
    en: 'IP quality check requires an IP address',
    examples_zh: ['查询 2.3.4.5 的质量'],
    examples_en: ['Check quality of 2.3.4.5'],
  },
  find_best_ip: {
    zh: '查找最优IP需要指定地区',
    en: 'Finding best IP requires a region',
    examples_zh: ['开通一个美国质量最好的IP'],
    examples_en: ['Open the best quality US IP'],
  },
  set_product_price: {
    zh: '设置价格需要指定产品和金额',
    en: 'Set price requires product ID and amount',
    examples_zh: ['设置产品 PRD001 价格为 50 元'],
    examples_en: ['Set PRD001 to 50 CNY'],
  },
  extract_dynamic: {
    zh: '提取动态代理，可指定数量和地区',
    en: 'Extract dynamic proxy, optionally with count and region',
    examples_zh: [
      '帮我提取一个动态链接',
      '提取5个美国动态代理',
    ],
    examples_en: [
      'Extract a dynamic link',
      'Extract 5 US dynamic proxies',
    ],
  },
  create_profile: {
    zh: '创建配置需要指定浏览器类型或地区',
    en: 'Create profile requires browser type or region',
    examples_zh: [
      '创建一个美国 Chrome 浏览器配置',
      '创建 Firefox 配置，名称为 test01',
    ],
    examples_en: [
      'Create a US Chrome profile',
      'Create Firefox profile named test01',
    ],
  },
  batch_create_profiles: {
    zh: '批量创建配置需要指定数量',
    en: 'Batch create requires a quantity',
    examples_zh: [
      '批量创建 10 个 Chrome 配置',
      '创建 5 个日本 Firefox 配置',
    ],
    examples_en: [
      'Batch create 10 Chrome profiles',
      'Create 5 Japan Firefox profiles',
    ],
  },
  duplicate_profile: {
    zh: '复制配置需要提供配置ID',
    en: 'Duplicate requires a profile ID',
    examples_zh: ['复制配置 PRF-xxx'],
    examples_en: ['Duplicate profile PRF-xxx'],
  },
  generate_fingerprint: {
    zh: '生成指纹可以指定操作系统和浏览器',
    en: 'Generate fingerprint with OS and browser',
    examples_zh: [
      '生成一个 Windows Chrome 指纹',
      '生成 macOS Safari 指纹',
    ],
    examples_en: [
      'Generate a Windows Chrome fingerprint',
      'Generate macOS Safari fingerprint',
    ],
  },
  set_user_agent: {
    zh: '设置 UA 需要指定配置ID和浏览器版本',
    en: 'Set UA requires profile ID and browser version',
    examples_zh: [
      '设置配置 PRF-xxx 的 UA 为 Chrome 120',
    ],
    examples_en: [
      'Set PRF-xxx UA to Chrome 120',
    ],
  },
  set_timezone: {
    zh: '设置时区需要指定配置ID和目标时区',
    en: 'Set timezone requires profile ID and timezone',
    examples_zh: [
      '把配置 PRF-xxx 的时区改成美东时间',
      '设置时区为 Asia/Tokyo',
    ],
    examples_en: [
      'Set PRF-xxx timezone to US Eastern',
      'Set timezone to Asia/Tokyo',
    ],
  },
  bind_proxy: {
    zh: '绑定代理需要指定配置ID',
    en: 'Bind proxy requires a profile ID',
    examples_zh: [
      '给配置 PRF-xxx 绑定美国代理',
    ],
    examples_en: [
      'Bind US proxy to PRF-xxx',
    ],
  },
  add_proxy: {
    zh: '添加代理需要提供协议和地址',
    en: 'Add proxy requires protocol and address',
    examples_zh: [
      '添加代理 socks5://user:pass@1.2.3.4:1080',
      '添加 HTTP 代理 1.2.3.4:8080',
    ],
    examples_en: [
      'Add proxy socks5://user:pass@1.2.3.4:1080',
      'Add HTTP proxy 1.2.3.4:8080',
    ],
  },
  verify_proxy: {
    zh: '验证代理需要指定代理ID',
    en: 'Verify proxy requires a proxy ID',
    examples_zh: ['测试代理 PRX-xxx 的连通性'],
    examples_en: ['Test proxy PRX-xxx connectivity'],
  },
  launch_browser: {
    zh: '启动浏览器需要指定配置ID',
    en: 'Launch browser requires a profile ID',
    examples_zh: [
      '启动配置 PRF-xxx 的浏览器',
      '用 PRF-xxx 打开浏览器',
    ],
    examples_en: [
      'Launch browser for PRF-xxx',
      'Open browser with PRF-xxx',
    ],
  },
  close_browser: {
    zh: '关闭浏览器需要指定实例ID',
    en: 'Close browser requires an instance ID',
    examples_zh: ['关闭浏览器 INS-xxx'],
    examples_en: ['Close browser INS-xxx'],
  },
  navigate_to: {
    zh: '导航需要指定浏览器实例和目标URL',
    en: 'Navigate requires instance ID and URL',
    examples_zh: [
      '用浏览器 INS-xxx 访问 google.com',
    ],
    examples_en: [
      'Navigate INS-xxx to google.com',
    ],
  },
  take_screenshot: {
    zh: '截图需要指定浏览器实例',
    en: 'Screenshot requires an instance ID',
    examples_zh: ['截图浏览器 INS-xxx'],
    examples_en: ['Screenshot INS-xxx'],
  },
  submit_task: {
    zh: '提交任务需要指定配置和目标',
    en: 'Submit task requires profile and target',
    examples_zh: [
      '用配置 PRF-xxx 抓取 example.com',
    ],
    examples_en: [
      'Scrape example.com with PRF-xxx',
    ],
  },
  query_task: {
    zh: '查看任务需要指定任务ID',
    en: 'Query task requires a task ID',
    examples_zh: ['查看任务 TSK-xxx 的状态'],
    examples_en: ['Check task TSK-xxx status'],
  },
  validate_fingerprint: {
    zh: '指纹校验需要指定配置ID',
    en: 'Validate requires a profile ID',
    examples_zh: [
      '检查配置 PRF-xxx 的指纹一致性',
    ],
    examples_en: [
      'Validate fingerprint of PRF-xxx',
    ],
  },
  run_script: {
    zh: '运行脚本需要指定浏览器实例和脚本内容',
    en: 'Run script requires instance ID and code',
    examples_zh: [
      '在浏览器 INS-xxx 中获取页面标题',
    ],
    examples_en: [
      'Get page title in INS-xxx',
    ],
  },
};

export function helpForMissingParams(
  intent: string,
  lang: Lang
): {
  hint: string;
  suggestions: string[];
} {
  const info = PARAM_HINTS[intent];
  if (!info) {
    return {
      hint: '',
      suggestions: [],
    };
  }

  const desc = lang === 'zh' ? info.zh : info.en;
  const examples =
    lang === 'zh'
      ? info.examples_zh
      : info.examples_en;

  let hint = t(
    lang,
    `💡 ${desc}。\n\n${t(lang, '示例', 'Examples')}：\n`,
    `💡 ${desc}.\n\n${t(lang, '示例', 'Examples')}:\n`
  );
  for (const ex of examples) {
    hint += `  • "${ex}"\n`;
  }
  return { hint, suggestions: examples };
}

/* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
   4. 权限不足帮助
   ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */

export function helpForPermissionDenied(
  intent: string,
  user: NLUserContext,
  lang: Lang
): {
  message: string;
  suggestions: string[];
} {
  const role = getRole(user);
  const cmd = COMMANDS.find((c) => c.id === intent);
  const cmdName = cmd
    ? lang === 'zh'
      ? cmd.zh
      : cmd.en
    : intent;
  const requiredRoles = cmd?.roles || [];
  const roleNames = requiredRoles.map((r) =>
    t(
      lang,
      { admin: '管理员', agent: '代理商', user: '用户' }[
        r
      ],
      r
    )
  );
  const roleStr = roleNames.join(
    t(lang, ' 或 ', ' or ')
  );

  let msg = t(
    lang,
    `🔒 「${cmdName}」需要 ${roleStr} 权限。\n\n` +
      `您当前是 ${t(lang, { admin: '管理员', agent: '代理商', user: '用户' }[role], role)} 角色。\n\n` +
      `以下是您可以执行的操作：\n\n`,
    `🔒 "${cmdName}" requires ${roleStr} role.\n\n` +
      `You are currently logged in as ${role}.\n\n` +
      `Here's what you can do:\n\n`
  );

  const available = COMMANDS.filter((c) =>
    c.roles.includes(role)
  );

  const suggestions: string[] = [];
  const sameCat = available.filter(
    (c) => c.category === cmd?.category
  );
  const show =
    sameCat.length > 0
      ? sameCat.slice(0, 5)
      : available.slice(0, 5);

  for (const c of show) {
    const ex =
      lang === 'zh' ? c.example_zh : c.example_en;
    const name = lang === 'zh' ? c.zh : c.en;
    msg += `• ${name}: "${ex}"\n`;
    suggestions.push(ex);
  }

  msg += t(
    lang,
    '\n💡 输入 "帮助" 查看您可用的所有命令',
    '\n💡 Type "help" for all your available commands'
  );

  return { message: msg, suggestions };
}

/* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
   5. 执行失败后帮助
   ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */

interface RecoveryHint {
  zh: string[];
  en: string[];
}

const FAILURE_RECOVERY: Record<string, RecoveryHint> = {
  purchase_static: {
    zh: [
      '查询该地区可用的IP: "查询华盛顿的IP"',
      '确认IP可用性: 最后一位非0表示指定IP',
      '检查余额是否充足: "查询余额"',
    ],
    en: [
      'Check available IPs: "Show Washington IPs"',
      'Verify IP: last octet non-zero = specific IP',
      'Check balance: "Check my balance"',
    ],
  },
  purchase_dynamic: {
    zh: [
      '确认已开通动态代理账户',
      '检查余额: "查询余额"',
      '检查动态资源: "查询动态代理资源"',
    ],
    en: [
      'Confirm dynamic proxy account is active',
      'Check balance: "Check my balance"',
      'Check resources: "Show dynamic resources"',
    ],
  },
  renew_static: {
    zh: [
      '查看当前订单: "查询静态代理订单"',
      '确认IP地址或订单号正确',
      '检查余额是否充足: "查询余额"',
    ],
    en: [
      'View orders: "Show static orders"',
      'Verify IP or order number',
      'Check balance: "Check my balance"',
    ],
  },
  extract_dynamic: {
    zh: [
      '确认已开通动态代理: "查询动态代理资源"',
      '检查流量是否充足',
      '重试: "提取动态代理"',
    ],
    en: [
      'Confirm proxy active: "Show dynamic resources"',
      'Check traffic balance',
      'Retry: "Extract dynamic proxy"',
    ],
  },
  check_ip_quality: {
    zh: [
      '确认IP格式正确 (如 2.3.4.5)',
      '稍后重试，API可能暂时不可用',
    ],
    en: [
      'Verify IP format (e.g. 2.3.4.5)',
      'Retry later, API may be temporarily down',
    ],
  },
  create_user: {
    zh: [
      '确认邮箱格式正确',
      '检查邮箱是否已被注册',
    ],
    en: [
      'Verify email format',
      'Check if email is already registered',
    ],
  },
  assign_balance: {
    zh: [
      '确认用户名存在: "查询用户 xxx 的信息"',
      '检查自己的余额是否充足',
    ],
    en: [
      'Verify user exists: "Show info for xxx"',
      'Check your own balance',
    ],
  },
  create_profile: {
    zh: [
      '检查配置名称是否重复: "查看我的配置"',
      '指定浏览器和地区: "创建美国 Chrome 配置"',
      '查看已有配置: "查看我的浏览器配置"',
    ],
    en: [
      'Check for duplicates: "Show my profiles"',
      'Specify browser & region: "Create US Chrome profile"',
      'List profiles: "Show my profiles"',
    ],
  },
  batch_create_profiles: {
    zh: [
      '确认数量参数正确',
      '单次批量上限 50 个',
      '查看已有配置: "查看我的浏览器配置"',
    ],
    en: [
      'Verify count parameter',
      'Max 50 per batch',
      'List profiles: "Show my profiles"',
    ],
  },
  launch_browser: {
    zh: [
      '确认配置ID正确: "查看我的浏览器配置"',
      '检查配置是否绑定了代理',
      '查看运行中的浏览器: "查看运行中的浏览器"',
    ],
    en: [
      'Verify profile ID: "Show my profiles"',
      'Check proxy binding',
      'List running: "Show running browsers"',
    ],
  },
  close_browser: {
    zh: [
      '确认实例ID正确: "查看运行中的浏览器"',
      '浏览器可能已关闭',
    ],
    en: [
      'Verify instance ID: "Show running browsers"',
      'Browser may already be closed',
    ],
  },
  navigate_to: {
    zh: [
      '确认浏览器实例正在运行: "查看运行中的浏览器"',
      '检查URL格式是否正确',
      '尝试添加协议头: "访问 https://example.com"',
    ],
    en: [
      'Verify instance is running: "Show running browsers"',
      'Check URL format',
      'Add protocol: "Navigate to https://example.com"',
    ],
  },
  submit_task: {
    zh: [
      '确认配置ID正确: "查看我的浏览器配置"',
      '检查任务参数',
      '查看任务状态: "查看任务 TSK-xxx 的状态"',
    ],
    en: [
      'Verify profile ID: "Show my profiles"',
      'Check task parameters',
      'Check status: "Check task TSK-xxx status"',
    ],
  },
  add_proxy: {
    zh: [
      '确认代理格式: socks5://user:pass@host:port',
      '检查代理是否可用: "测试代理连通性"',
      '查看已有代理: "查看代理列表"',
    ],
    en: [
      'Verify format: socks5://user:pass@host:port',
      'Test connectivity: "Test proxy connectivity"',
      'List proxies: "Show proxies"',
    ],
  },
  bind_proxy: {
    zh: [
      '确认配置ID正确: "查看我的浏览器配置"',
      '确认有可用代理: "查看代理列表"',
    ],
    en: [
      'Verify profile ID: "Show my profiles"',
      'Check available proxies: "Show proxies"',
    ],
  },
  validate_fingerprint: {
    zh: [
      '确认配置ID正确: "查看我的浏览器配置"',
      '生成指纹后再校验: "生成指纹"',
    ],
    en: [
      'Verify profile ID: "Show my profiles"',
      'Generate first: "Generate fingerprint"',
    ],
  },
};

export function helpForFailure(
  intent: string,
  errorMsg: string,
  lang: Lang
): {
  recoveryHint: string;
  suggestions: string[];
} {
  const recovery = FAILURE_RECOVERY[intent];
  if (!recovery) {
    return {
      recoveryHint: t(
        lang,
        '\n💡 可以输入 "帮助" 获取可用命令列表',
        '\n💡 Type "help" for available commands'
      ),
      suggestions: [
        t(lang, '帮助', 'help'),
      ],
    };
  }

  const hints =
    lang === 'zh' ? recovery.zh : recovery.en;

  let recoveryHint = t(
    lang,
    '\n\n💡 可以尝试：\n',
    '\n\n💡 Try:\n'
  );
  const suggestions: string[] = [];
  for (const h of hints) {
    recoveryHint += `  • ${h}\n`;
    const match = h.match(/"([^"]+)"/);
    if (match && suggestions.length < 3) {
      suggestions.push(match[1]);
    }
  }

  return { recoveryHint, suggestions };
}
