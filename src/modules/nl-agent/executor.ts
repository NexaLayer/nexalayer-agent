import type { NLUserContext } from './nl-auth.middleware';
import {
  type Lang,
  type ExecResult,
  t,
  fmtNum,
  backendGet,
  backendPost,
  getAdminToken,
  findUserAcrossRoles,
  randomString,
  randomPassword,
  paginationFooter,
  DEFAULT_PAGE_SIZE,
} from './executor-utils';
import {
  codeToName,
  countryCodeToName,
  stateCodeToName,
  productLocationNames,
  type GeoResult,
  type GeoCandidate,
} from './geo-mapping';
import type { SearchContext } from './conversation-context';
import {
  showHelp,
  helpForUnknown,
  helpForMissingParams,
  helpForPermissionDenied,
  helpForFailure,
} from './help-resolver';
import {
  isLikelyOrderId,
  classifyEntity,
} from './intent-parser';
import { createModuleLogger } from '../../utils/logger';

export type IntentHandler = (
  slots: Record<string, unknown>,
  user: NLUserContext,
  lang: Lang
) => Promise<ExecResult>;

const log = createModuleLogger('nl-executor');

/* ─── User List Query ─── */

export async function executeQueryUsers(
  slots: Record<string, unknown>,
  user: NLUserContext,
  lang: Lang
): Promise<ExecResult> {
  if (!user.isAgent && !user.isAdmin) {
    return {
      message: t(
        lang,
        '⚠️ 仅管理员和代理商可以查看用户列表。',
        '⚠️ Only admins and agents can list users.'
      ),
    };
  }

  const search = slots.search as string;
  const page = (slots.page as number) || 1;
  const count = (slots.count as number) || DEFAULT_PAGE_SIZE;
  const pageSize = Math.min(count, 100);

  let url =
    `/api/open/app/users/list` +
    `?page=${page}&pageSize=${pageSize}`;
  if (search) {
    url += `&search=${encodeURIComponent(search)}`;
  }

  const res = (await backendGet(
    url,
    user.backendToken
  )) as {
    code: number;
    data?: {
      list?: Array<{
        username?: string;
        status?: number;
        is_activated?: boolean;
        balance?: number;
        agent_name?: string;
        ipweb_username?: string;
        remark?: string;
        is_agent?: boolean;
        created_at?: string;
      }>;
      total?: number;
    };
  };

  const list = res.data?.list ?? [];
  if (!list.length) {
    const hint = search
      ? t(lang,
          `未找到匹配"${search}"的用户。`,
          `No users matching "${search}".`)
      : t(lang,
          '暂无用户数据。',
          'No users found.');
    return { message: hint };
  }

  const total = res.data?.total ?? list.length;
  let msg = t(
    lang,
    `👥 用户列表（第 ${page} 页）\n\n`,
    `👥 Users (Page ${page})\n\n`
  );

  for (let i = 0; i < list.length; i++) {
    const u = list[i];
    const idx = (page - 1) * pageSize + i + 1;
    const uname = u.username || '—';
    const role = u.is_agent
      ? t(lang, '代理商', 'Agent')
      : t(lang, '用户', 'User');
    const status = u.status === 1 ? '✅' : '⛔';
    const activated = u.is_activated
      ? '' : t(lang, '(未激活)', '(inactive)');
    const bal = u.balance != null
      ? `¥${u.balance}` : '—';
    const agent = u.agent_name
      ? `  ${t(lang, '代理', 'Agent')}: ` +
        `${u.agent_name}` : '';
    const remark = u.remark
      ? `  ${t(lang, '备注', 'Note')}: ` +
        `${u.remark}` : '';
    const date = u.created_at
      ? u.created_at.replace('T', ' ')
        .slice(0, 10) : '';

    msg += `${idx}. ${status} ${uname}` +
      `  | ${role}${activated}` +
      `  | ${t(lang, '余额', 'Bal')}: ${bal}` +
      `${agent}${remark}` +
      `  | ${date}\n`;
  }

  msg += paginationFooter(
    page, pageSize, total, lang
  );

  return {
    message: msg.trim(),
    data: { users: list, total },
  };
}

/* ─── Account ─── */

export async function executeCreateUser(
  _slots: Record<string, unknown>,
  _user: NLUserContext,
  lang: Lang
): Promise<ExecResult> {
  return {
    message: t(
      lang,
      '该功能已停用：不允许通过 NL 指令创建用户账号。',
      'This feature is disabled: creating users via NL is not allowed.'
    ),
  };
}

export async function executeBatchCreateUsers(
  _slots: Record<string, unknown>,
  _user: NLUserContext,
  lang: Lang
): Promise<ExecResult> {
  return {
    message: t(
      lang,
      '该功能已停用：不允许通过 NL 指令批量创建用户。',
      'This feature is disabled: batch user creation via NL is not allowed.'
    ),
  };
}

export async function executeResetPassword(
  slots: Record<string, unknown>,
  user: NLUserContext,
  lang: Lang
): Promise<ExecResult> {
  const targetUser = slots.target_user as string;
  const newPwd =
    (slots.new_password as string) || randomPassword();

  if (!targetUser) {
    return {
      message: t(
        lang,
        '请提供需要重置密码的用户名。\n' +
          '例如：重置用户 user01 的密码',
        'Please provide the username.\n' +
          'Example: reset password for user01'
      ),
    };
  }

  const isResetSelf =
    targetUser.toLowerCase() ===
    user.username.toLowerCase();

  if (
    !user.isAdmin &&
    !user.isAgent &&
    !isResetSelf
  ) {
    return {
      message: t(
        lang,
        '普通用户只能重置自己的密码。',
        'Users can only reset their own password.'
      ),
    };
  }

  const adminToken = await getAdminToken();
  const found = await findUserAcrossRoles(
    targetUser,
    adminToken
  );
  if (!found) {
    return {
      message: t(
        lang,
        `未找到用户 ${targetUser}`,
        `User ${targetUser} not found`
      ),
    };
  }

  if (
    user.isAgent &&
    !user.isAdmin &&
    !isResetSelf
  ) {
    const isSubUser =
      found.agent_id === user.userId;
    if (!isSubUser) {
      return {
        message: t(
          lang,
          `用户 ${targetUser} 不在您名下，` +
            '无权重置其密码。',
          `User ${targetUser} is not under ` +
            'your account.'
        ),
      };
    }
  }

  const uid = found.id;
  const res = (await backendPost(
    `/api/open/app/user/${uid}/change-password`,
    { new_password: newPwd },
    adminToken
  )) as { code: number; msg?: string };
  if (res.code !== 0) {
    return {
      message: t(
        lang,
        `重置失败: ${res.msg || '未知错误'}`,
        `Failed: ${res.msg || 'Unknown error'}`
      ),
    };
  }
  return {
    message: t(
      lang,
      `✅ 用户 ${targetUser} 密码已重置为: ` +
        `${newPwd}`,
      `✅ Password for ${targetUser} reset ` +
        `to: ${newPwd}`
    ),
    data: {
      target_user: targetUser,
      new_password: newPwd,
    },
  };
}

export async function executeGetReferralCode(
  _slots: Record<string, unknown>,
  _user: NLUserContext,
  lang: Lang
): Promise<ExecResult> {
  return {
    message: t(
      lang,
      '推荐给其他用户对方每次充值你将获得15％的佣金！\n请发送邮件至support@ztproxy.net。',
      'Refer users and earn 15% commission for each recharge.\nPlease email support@ztproxy.net.'
    ),
  };
}

/* ─── Balance ─── */

export async function executeAssignBalance(
  slots: Record<string, unknown>,
  _user: NLUserContext,
  lang: Lang
): Promise<ExecResult> {
  if (!_user.isAdmin && !_user.isAgent) {
    return {
      message: t(
        lang,
        '只有管理员和代理商可以分配额度。',
        'Only admins and agents can assign balance.'
      ),
    };
  }

  const targetUser = slots.target_user as string;
  const amount = slots.amount as number;
  if (!targetUser || !amount) {
    return {
      message: t(
        lang,
        '请提供目标用户名和金额。例如：给用户 user01 分配 100 元',
        'Please provide username and amount. Example: Assign 100 CNY to user01'
      ),
    };
  }
  const adminToken = await getAdminToken();
  const res = (await backendPost(
    '/api/open/app/user/adjust-balance',
    { username: targetUser, amount },
    adminToken
  )) as { code: number; msg?: string };
  if (res.code !== 0) {
    return {
      message: t(
        lang,
        `分配失败: ${res.msg || '未知错误'}`,
        `Failed: ${res.msg || 'Unknown error'}`
      ),
    };
  }
  return {
    message: t(
      lang,
      `✅ 已给用户 ${targetUser} 分配 ${amount} 元额度。`,
      `✅ Assigned ¥${amount} to user ${targetUser}.`
    ),
    data: { target_user: targetUser, amount },
  };
}

export async function executeQueryBalance(
  slots: Record<string, unknown>,
  user: NLUserContext,
  lang: Lang
): Promise<ExecResult> {
  const targetUser = slots.target_user as string;

  if (targetUser && (user.isAgent || user.isAdmin)) {
    const token = user.isAdmin
      ? user.backendToken
      : await getAdminToken();

    const found = await findUserAcrossRoles(
      targetUser,
      token
    );
    if (!found) {
      return {
        message: t(
          lang,
          `未找到用户 ${targetUser}`,
          `User ${targetUser} not found`
        ),
      };
    }

    const balRes = (await backendGet(
      `/api/open/app/user/${found.id}/balance`,
      token
    )) as {
      code: number;
      data?: { balance?: number };
    };
    const bal = balRes.data?.balance ?? 0;
    const roleLabel = found.is_agent
      ? t(lang, '(代理商)', '(Agent)')
      : found.is_admin
        ? t(lang, '(管理员)', '(Admin)')
        : '';

    return {
      message: t(
        lang,
        `💰 用户 ${found.username} ${roleLabel} 的余额: ¥${fmtNum(bal)}`,
        `💰 Balance of ${found.username} ${roleLabel}: ¥${fmtNum(bal)}`
      ),
      data: {
        username: found.username,
        balance: bal,
      },
    };
  }

  const res = (await backendGet(
    '/api/open/app/user/balance/current',
    user.backendToken
  )) as {
    code: number;
    data?: { balance?: number };
  };
  const bal = res.data?.balance ?? 0;
  return {
    message: t(
      lang,
      `💰 当前余额: ¥${fmtNum(bal)}`,
      `💰 Current Balance: ¥${fmtNum(bal)}`
    ),
    data: { balance: bal },
  };
}

/* ─── Stats / Dashboard ─── */

interface DashStats {
  balance?: number;
  total_recharge?: number;
  month_recharge?: number;
  last_month_recharge?: number;
  today_recharge?: number;
  total_consumption?: number;
  month_consumption?: number;
  last_month_consumption?: number;
  today_consumption?: number;
  total_orders?: number;
  monthly_orders?: number;
  last_month_orders?: number;
  today_orders?: number;
  total_profit?: number;
  monthly_profit?: number;
  last_month_profit?: number;
  today_profit?: number;
}

interface DashboardResource {
  title?: string;
  total?: number;
  used?: number;
  remaining?: number;
  pool_type?: string;
}

interface FullDashData {
  statistics?: DashStats;
  dynamicResources?: DashboardResource[];
  staticResources?: Array<Record<string, unknown>>;
}

async function fetchDashboardFull(
  token: string,
  targetUserId?: number
): Promise<FullDashData> {
  let path = '/api/open/app/dashboard/info/v2';
  if (targetUserId) {
    path += `?target_user_id=${targetUserId}`;
  }
  const res = (await backendGet(path, token)) as {
    code: number;
    data?: FullDashData;
  };
  return res.data ?? {};
}

async function fetchDashboard(
  token: string,
  targetUserId?: number
): Promise<DashStats> {
  const data = await fetchDashboardFull(
    token,
    targetUserId
  );
  return data.statistics ?? {};
}

export async function executeQueryStats(
  slots: Record<string, unknown>,
  user: NLUserContext,
  lang: Lang
): Promise<ExecResult> {
  const statsType =
    (slots.type as string) || 'overview';
  const targetUser = slots.target_user as string;
  let targetUserId: number | undefined;

  if (targetUser && (user.isAgent || user.isAdmin)) {
    const token = user.isAdmin
      ? user.backendToken
      : await getAdminToken();
    const found = await findUserAcrossRoles(
      targetUser,
      token
    );
    if (!found) {
      return {
        message: t(
          lang,
          `未找到用户 ${targetUser}`,
          `User ${targetUser} not found`
        ),
      };
    }
    targetUserId = found.id;
  }

  const s = await fetchDashboard(
    user.backendToken,
    targetUserId
  );
  const who = targetUser
    ? t(lang, `用户 ${targetUser} `, `User ${targetUser} `)
    : '';

  if (statsType === 'recharge') {
    return {
      message: t(
        lang,
        `💰 ${who}充值统计：\n\n• 累计充值: ¥${fmtNum(s.total_recharge)}\n• 本月充值: ¥${fmtNum(s.month_recharge)}\n• 上月充值: ¥${fmtNum(s.last_month_recharge)}\n• 今日充值: ¥${fmtNum(s.today_recharge)}`,
        `💰 ${who}Recharge Stats:\n\n• Total: ¥${fmtNum(s.total_recharge)}\n• This Month: ¥${fmtNum(s.month_recharge)}\n• Last Month: ¥${fmtNum(s.last_month_recharge)}\n• Today: ¥${fmtNum(s.today_recharge)}`
      ),
      data: { statistics: s },
    };
  }

  if (
    statsType === 'consumption' ||
    statsType === 'cost'
  ) {
    return {
      message: t(
        lang,
        `💸 ${who}消费统计：\n\n• 累计消费: ¥${fmtNum(s.total_consumption)}\n• 本月消费: ¥${fmtNum(s.month_consumption)}\n• 上月消费: ¥${fmtNum(s.last_month_consumption)}\n• 今日消费: ¥${fmtNum(s.today_consumption)}`,
        `💸 ${who}Spending Stats:\n\n• Total: ¥${fmtNum(s.total_consumption)}\n• This Month: ¥${fmtNum(s.month_consumption)}\n• Last Month: ¥${fmtNum(s.last_month_consumption)}\n• Today: ¥${fmtNum(s.today_consumption)}`
      ),
      data: { statistics: s },
    };
  }

  if (statsType === 'orders') {
    return {
      message: t(
        lang,
        `📋 ${who}订单统计：\n\n• 总订单: ${fmtNum(s.total_orders)}\n• 本月订单: ${fmtNum(s.monthly_orders)}\n• 上月订单: ${fmtNum(s.last_month_orders)}\n• 今日订单: ${fmtNum(s.today_orders)}`,
        `📋 ${who}Order Stats:\n\n• Total: ${fmtNum(s.total_orders)}\n• This Month: ${fmtNum(s.monthly_orders)}\n• Last Month: ${fmtNum(s.last_month_orders)}\n• Today: ${fmtNum(s.today_orders)}`
      ),
      data: { statistics: s },
    };
  }

  if (statsType === 'profit') {
    return {
      message: t(
        lang,
        `📊 ${who}利润统计：\n\n• 总利润: ¥${fmtNum(s.total_profit)}\n• 本月利润: ¥${fmtNum(s.monthly_profit)}\n• 上月利润: ¥${fmtNum(s.last_month_profit)}\n• 今日利润: ¥${fmtNum(s.today_profit)}`,
        `📊 ${who}Profit Stats:\n\n• Total: ¥${fmtNum(s.total_profit)}\n• This Month: ¥${fmtNum(s.monthly_profit)}\n• Last Month: ¥${fmtNum(s.last_month_profit)}\n• Today: ¥${fmtNum(s.today_profit)}`
      ),
      data: { statistics: s },
    };
  }

  return {
    message: t(
      lang,
      `📊 ${who}统计概览：\n\n• 余额: ¥${fmtNum(s.balance)}\n• 累计充值: ¥${fmtNum(s.total_recharge)}\n• 本月充值: ¥${fmtNum(s.month_recharge)}\n• 累计消费: ¥${fmtNum(s.total_consumption)}\n• 本月消费: ¥${fmtNum(s.month_consumption)}\n• 总订单: ${fmtNum(s.total_orders)}\n• 本月订单: ${fmtNum(s.monthly_orders)}\n• 本月利润: ¥${fmtNum(s.monthly_profit)}`,
      `📊 ${who}Overview:\n\n• Balance: ¥${fmtNum(s.balance)}\n• Total Recharge: ¥${fmtNum(s.total_recharge)}\n• Monthly Recharge: ¥${fmtNum(s.month_recharge)}\n• Total Spend: ¥${fmtNum(s.total_consumption)}\n• Monthly Spend: ¥${fmtNum(s.month_consumption)}\n• Total Orders: ${fmtNum(s.total_orders)}\n• Monthly Orders: ${fmtNum(s.monthly_orders)}\n• Monthly Profit: ¥${fmtNum(s.monthly_profit)}`
    ),
    data: { statistics: s },
  };
}

export async function executeQueryDashboard(
  slots: Record<string, unknown>,
  user: NLUserContext,
  lang: Lang
): Promise<ExecResult> {
  return executeQueryStats(
    { ...slots, type: 'overview' },
    user,
    lang
  );
}

export async function executeQueryDynamicResource(
  slots: Record<string, unknown>,
  user: NLUserContext,
  lang: Lang
): Promise<ExecResult> {
  const targetUser = slots.target_user as string;
  if (targetUser && (user.isAgent || user.isAdmin)) {
    const token = user.isAdmin
      ? user.backendToken
      : await getAdminToken();
    const found = await findUserAcrossRoles(
      targetUser,
      token
    );
    if (!found) {
      return {
        message: t(
          lang,
          `未找到用户 ${targetUser}`,
          `User ${targetUser} not found`
        ),
      };
    }
    const dash = await fetchDashboardFull(
      user.backendToken,
      found.id
    );
    const resources =
      dash.dynamicResources ?? [];
    const who = `用户 ${targetUser} `;
    if (resources.length === 0) {
      return {
        message: t(
          lang,
          `⚡ ${who}暂无动态代理资源`,
          `⚡ ${who}has no dynamic resources`
        ),
      };
    }
    let msg = t(
      lang,
      `⚡ ${who}动态代理资源：\n`,
      `⚡ ${who}Dynamic Resources:\n`
    );
    for (const r of resources) {
      const name = r.title || r.pool_type || '—';
      msg +=
        `\n• ${name}` +
        `  |  ${t(lang, '总量', 'Total')}: ` +
        `${fmtNum(r.total)} GB` +
        `  |  ${t(lang, '已用', 'Used')}: ` +
        `${fmtNum(r.used)} GB` +
        `  |  ${t(lang, '剩余', 'Left')}: ` +
        `${fmtNum(r.remaining)} GB`;
    }
    return {
      message: msg,
      data: { resources },
    };
  }
  const dash = await fetchDashboardFull(
    user.backendToken
  );
  const resources = dash.dynamicResources ?? [];
  if (resources.length === 0) {
    return {
      message: t(
        lang,
        '⚡ 暂无动态代理资源',
        '⚡ No dynamic resources'
      ),
    };
  }
  let msg = t(
    lang,
    '⚡ 动态代理资源：\n',
    '⚡ Dynamic Proxy Resources:\n'
  );
  for (const r of resources) {
    const name = r.title || r.pool_type || '—';
    msg +=
      `\n• ${name}` +
      `  |  ${t(lang, '总量', 'Total')}: ` +
      `${fmtNum(r.total)} GB` +
      `  |  ${t(lang, '已用', 'Used')}: ` +
      `${fmtNum(r.used)} GB` +
      `  |  ${t(lang, '剩余', 'Left')}: ` +
      `${fmtNum(r.remaining)} GB`;
  }

  const childRes = (await backendGet(
    '/api/open/app/dashboard/child-accounts',
    user.backendToken
  )) as {
    code: number;
    data?: Array<{
      id?: number;
      username?: string;
      account_type?: string;
      limit_flow_mb?: number;
      download_flow_mb?: number;
      upload_flow_mb?: number;
      status?: number;
      status_text?: string;
    }>;
  };
  const children = childRes.data ?? [];
  if (children.length > 0) {
    const page = (slots.page as number) || 1;
    const count = (slots.count as number) || DEFAULT_PAGE_SIZE;
    const pgSize = Math.min(count, 50);
    const cStart = (page - 1) * pgSize;
    const cSlice = children.slice(
      cStart, cStart + pgSize
    );
    const cTotal = children.length;

    msg += t(
      lang,
      `\n\n📊 动态消耗详情（第 ${page} 页）\n`,
      `\n\n📊 Consumption Detail (Pg ${page})\n`
    );
    for (let i = 0; i < cSlice.length; i++) {
      const c = cSlice[i];
      const idx = cStart + i + 1;
      const uname = c.username || '—';
      const aType = c.account_type || '—';
      const cId = c.id ?? '—';
      const totalMb = c.limit_flow_mb ?? 0;
      const dlMb = c.download_flow_mb ?? 0;
      const ulMb = c.upload_flow_mb ?? 0;
      const remainMb = totalMb - dlMb - ulMb;
      const totalGb = fmtNum(totalMb / 1024);
      const remainGb = fmtNum(remainMb / 1024);
      const dlGb = fmtNum(dlMb / 1024);
      const ulGb = fmtNum(ulMb / 1024);
      const st = c.status_text || (
        c.status === 1
          ? t(lang, '正常', 'Active')
          : t(lang, '停用', 'Disabled')
      );
      msg += `${idx}. ${uname}  | ${aType}` +
        `  | ID:${cId}` +
        `  | ${t(lang, '总', 'Tot')}:${totalGb}GB` +
        `  | ${t(lang, '剩', 'Left')}:` +
        `${remainGb}GB` +
        `  | ${t(lang, '下载', 'DL')}:${dlGb}GB` +
        `  | ${t(lang, '上传', 'UL')}:${ulGb}GB` +
        `  | ${st}\n`;
    }

    msg += paginationFooter(
      page, pgSize, cTotal, lang
    );
  }

  return {
    message: msg,
    data: {
      resources,
      children,
      total: children.length,
    },
  };
}

interface CountryStock {
  name: string;
  code: string;
  stock: number;
  products: number;
}

function aggregateByCountry(
  items: PriceItem[]
): CountryStock[] {
  const map = new Map<
    string,
    { name: string; stock: number; products: number }
  >();
  for (const p of items) {
    const code = p.country || 'UNKNOWN';
    const entry = map.get(code) ?? {
      name: countryCodeToName(code),
      stock: 0,
      products: 0,
    };
    entry.stock += p.stock ?? 0;
    entry.products += 1;
    map.set(code, entry);
  }
  return [...map.entries()]
    .map(([code, v]) => ({
      code,
      name: v.name,
      stock: v.stock,
      products: v.products,
    }))
    .sort((a, b) => b.stock - a.stock);
}

export async function executeQueryStaticResource(
  slots: Record<string, unknown>,
  user: NLUserContext,
  lang: Lang
): Promise<ExecResult> {
  const url =
    '/api/settings/prices?is_global=true' +
    '&proxy_types=101&proxy_types=102' +
    '&proxy_types=103';
  const res = (await backendGet(
    url, user.backendToken
  )) as { code: number; data?: PriceItem[] };

  if (res.code !== 0 || !res.data?.length) {
    return {
      message: t(
        lang,
        '🔒 暂无可用的静态代理资源。',
        '🔒 No static proxy resources available.'
      ),
    };
  }

  const enabled = res.data.filter(
    (p) => p.active !== 0 && p.enable !== 0
  );
  const inStock = enabled.filter(
    (p) => (p.stock ?? 0) > 0
  );
  const countries = aggregateByCountry(inStock);
  const totalStock = countries.reduce(
    (s, c) => s + c.stock, 0
  );
  const totalProducts = inStock.length;

  const lines: string[] = [];
  lines.push(t(lang,
    `🌐 独享静态代理(isp)资源总览\n` +
    `共 ${countries.length} 个国家/地区，` +
    `${fmtNum(totalProducts)} 个产品，` +
    `${fmtNum(totalStock)} 条可用IP\n`,
    `🌐 Dedicated Static Proxy (ISP) Resources\n` +
    `${countries.length} countries, ` +
    `${fmtNum(totalProducts)} products, ` +
    `${fmtNum(totalStock)} IPs available\n`
  ));

  const show = countries.slice(0, 15);
  for (let i = 0; i < show.length; i++) {
    const c = show[i];
    lines.push(
      `${i + 1}. ${c.name}` +
      `  ${fmtNum(c.stock)} ` +
      t(lang, '条', ' IPs') +
      `  (${c.products} ` +
      t(lang, '个产品', ' products') +
      ')'
    );
  }

  if (countries.length > 15) {
    lines.push(t(lang,
      `\n... 还有 ${countries.length - 15} 个国家`,
      `\n... ${countries.length - 15} more`
    ));
  }

  lines.push('');
  lines.push(t(lang,
    '您可以继续输入：\n' +
    '• "查看美国的静态代理" — 查看指定国家详情\n' +
    '• "显示业务共享静态代理(isp)资源" — 查看共享资源\n' +
    '• "查看动态资源" — 查看动态代理资源\n' +
    '• "查看我的订单" — 查看已购订单',
    'You can type:\n' +
    '• "Show US static proxies"\n' +
    '• "Show business shared static proxy (ISP) resources"\n' +
    '• "Show dynamic resources"\n' +
    '• "Show my orders"'
  ));

  return {
    message: lines.join('\n'),
    suggestions: lang === 'zh'
      ? [
          '查看美国的静态代理',
          '显示业务共享静态代理(isp)资源',
          '查看动态资源',
          '查看我的静态订单',
        ]
      : [
          'Show US static proxies',
          'Show business shared static proxy (ISP) resources',
          'Show dynamic resources',
          'Show my static orders',
        ],
    data: {
      countries,
      totalStock,
      totalProducts,
    },
  };
}

export async function executeQueryUserDetail(
  slots: Record<string, unknown>,
  user: NLUserContext,
  lang: Lang
): Promise<ExecResult> {
  const targetUser = slots.target_user as string;
  if (!targetUser) {
    return {
      message: t(
        lang,
        '请提供要查询的用户名。例如：查询用户 user01 的信息',
        'Please provide a username. Example: show info for user01'
      ),
    };
  }
  return executeQueryStats(
    { ...slots, type: 'overview', target_user: targetUser },
    user,
    lang
  );
}

/* ─── Products ─── */

interface IpRangePrice {
  ipRange?: string;
  price?: number;
  costPrice?: number;
  globalPrice?: number;
}

interface CidrEntry {
  cidr: string;
  count: number;
  enable?: string;
}

interface PriceItem {
  type?: string;
  product_no?: string;
  proxyType?: number;
  area?: string;
  country?: string;
  city?: string;
  state?: string;
  price?: number;
  costPrice?: number;
  globalPrice?: number;
  stock?: number;
  supplierCode?: string;
  status?: number;
  active?: number;
  enable?: number;
  ipRange?: string;
  ipRangePrices?: IpRangePrice[];
  cidrInfo?: CidrEntry[];
}

interface CidrRow {
  ip: string;
  stock: number;
  costPrice: number;
  sellPrice: number;
  globalPrice: number;
  loc: string;
  productType: string;
  active: number;
  enable: number;
  productNo: string;
}

function expandCidrRows(
  p: PriceItem,
  lang: Lang
): CidrRow[] {
  const loc = fmtLocation(p);
  const pNo = p.product_no ?? '';
  const pType = resolveProductType(
    p.product_no, p.supplierCode, lang
  );
  const cidrs = p.cidrInfo ?? [];
  const rangePrices = p.ipRangePrices ?? [];
  const priceMap = new Map(
    rangePrices.map((r) => [r.ipRange, r])
  );
  const base = {
    loc,
    productType: pType,
    active: p.active ?? 0,
    enable: p.enable ?? 0,
    productNo: pNo,
  };

  if (cidrs.length === 0 && rangePrices.length === 0) {
    return [{
      ...base,
      ip: '',
      stock: p.stock ?? 0,
      costPrice: p.costPrice ?? 0,
      sellPrice: p.price ?? 0,
      globalPrice: p.globalPrice ?? 0,
    }];
  }

  if (cidrs.length > 0) {
    return cidrs.map((c) => {
      const rp = priceMap.get(c.cidr);
      return {
        ...base,
        ip: c.cidr.replace(/\/\d+$/, ''),
        stock: c.count,
        costPrice: rp?.costPrice ?? p.costPrice ?? 0,
        sellPrice: rp?.price ?? p.price ?? 0,
        globalPrice: rp?.globalPrice ?? p.globalPrice ?? 0,
      };
    });
  }

  return rangePrices.map((r) => ({
    ...base,
    ip: (r.ipRange ?? '').replace(/\/\d+$/, ''),
    stock: p.stock ?? 0,
    costPrice: r.costPrice ?? p.costPrice ?? 0,
    sellPrice: r.price ?? p.price ?? 0,
    globalPrice: r.globalPrice ?? p.globalPrice ?? 0,
  }));
}

function fmtRowPrice(
  row: CidrRow,
  user: NLUserContext,
  lang: Lang,
  targetUsername?: string
): string {
  if (user.isAdmin) {
    return t(
      lang,
      `成本：¥${row.costPrice}；` +
        `全局售价：¥${row.globalPrice || row.sellPrice}`,
      `Cost: ¥${row.costPrice}; ` +
        `Global: ¥${row.globalPrice || row.sellPrice}`
    );
  }
  if (user.isAgent) {
    if (targetUsername) {
      return t(
        lang,
        `用户 ${targetUsername} 价格：` +
          `¥${row.sellPrice}`,
        `User ${targetUsername} Price: ` +
          `¥${row.sellPrice}`
      );
    }
    // 与前端 StaticBusiness 对齐：代理商未指定用户时，
    // 成本口径与售价口径都展示代理商价格。
    return t(
      lang,
      `代理商价：¥${row.sellPrice}；` +
        `成本：¥${row.sellPrice}`,
      `Agent Price: ¥${row.sellPrice}; ` +
        `Cost: ¥${row.sellPrice}`
    );
  }
  return t(
    lang,
    `我的价格：¥${row.sellPrice}`,
    `My Price: ¥${row.sellPrice}`
  );
}

function extractStatePrefix(code: string): string {
  const upper = code.toUpperCase();
  const m = upper.match(/^([A-Z]{3}\d[A-Z]{2})/);
  return m ? m[1] : upper;
}

/* ── Layer 4: 候选集联合产品匹配 ── */

function matchProductCandidate(
  p: PriceItem,
  c: GeoCandidate
): boolean {
  const pCity = (p.city || '').toUpperCase();
  const pArea = (p.area || '').toUpperCase();
  const pState = (p.state || '').toUpperCase();
  const pCountry =
    (p.country || '').toUpperCase();

  const locationCodes = [pCity, pArea, pState];

  if (c.cityCode) {
    const code = c.cityCode.toUpperCase();
    for (const loc of locationCodes) {
      if (!loc) continue;
      if (loc === code) return true;
      if (loc.startsWith(code)) return true;
    }
  }
  if (c.stateCode) {
    const code = c.stateCode.toUpperCase();
    for (const loc of locationCodes) {
      if (!loc) continue;
      if (loc === code) return true;
      if (loc.startsWith(code)) return true;
    }
  }
  if (c.level === 'country' && !c.stateCode) {
    if (pCountry === c.countryCode.toUpperCase())
      return true;
  }

  const pNames = productLocationNames(
    p.country, p.state, p.city
  );
  if (p.area) {
    pNames.push(p.area.toLowerCase());
    const areaZh =
      codeToName(p.area.toUpperCase());
    if (areaZh !== p.area) {
      pNames.push(areaZh.toLowerCase());
    }
  }
  const aliases = [
    c.label.toLowerCase(),
    c.labelEn.toLowerCase(),
  ];
  for (const a of aliases) {
    for (const pn of pNames) {
      if (pn === a) return true;
    }
  }
  return false;
}

function matchGeoFilter(
  p: PriceItem,
  geo: GeoResult
): boolean {
  if (geo.group) {
    return matchGeoGroup(p, geo.group);
  }
  if (geo.candidates.length > 0) {
    return geo.candidates.some(
      (c) => matchProductCandidate(p, c)
    );
  }
  if (geo.country) {
    const c = (p.country || '').toUpperCase();
    return c === geo.country.toUpperCase();
  }
  return false;
}

function findMatchingCandidate(
  p: PriceItem,
  candidates: GeoCandidate[]
): GeoCandidate | null {
  for (const c of candidates) {
    if (matchProductCandidate(p, c)) return c;
  }
  return null;
}

interface CandidateGroup {
  candidate: GeoCandidate;
  products: PriceItem[];
}

function groupByCandidate(
  products: PriceItem[],
  candidates: GeoCandidate[]
): CandidateGroup[] {
  const groups: CandidateGroup[] = candidates.map(
    (c) => ({ candidate: c, products: [] })
  );
  for (const p of products) {
    const c = findMatchingCandidate(p, candidates);
    if (c) {
      const g = groups.find(
        (g) => g.candidate === c
      );
      if (g) g.products.push(p);
    }
  }
  return groups.filter((g) => g.products.length > 0);
}

function matchGeoGroup(
  p: PriceItem,
  group: { states: string[]; countries?: string[] }
): boolean {
  const pState = (p.state || '').toUpperCase();
  const pCity = (p.city || '').toUpperCase();
  const pCountry = (p.country || '').toUpperCase();
  for (const st of group.states) {
    const upper = st.toUpperCase();
    if (pState.startsWith(upper)) return true;
    if (pCity.startsWith(upper)) return true;
  }
  if (
    group.states.length === 0 &&
    group.countries &&
    group.countries.length > 0
  ) {
    for (const c of group.countries) {
      if (pCountry === c.toUpperCase()) return true;
    }
  }
  return false;
}

/* ── Query Builder ── */

interface ProductQuery {
  geo: GeoResult | null;
  excludePrefix: string[];
  sort: string | null;
  quality: string | null;
}

function buildProductQuery(
  slots: Record<string, unknown>
): ProductQuery {
  const geo = (slots._geo as GeoResult) || null;
  const sort = (slots.sort as string) || null;
  const excludePrefix =
    (slots.excludePrefix as string[]) || [];
  const quality =
    (slots.quality as string) || null;
  return { geo, excludePrefix, sort, quality };
}

function deduplicateProducts(
  items: PriceItem[]
): PriceItem[] {
  const seen = new Set<string>();
  const out: PriceItem[] = [];
  for (const p of items) {
    const key =
      p.product_no ||
      `${p.ipRange || ''}|${p.country || ''}` +
      `|${p.price ?? 0}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(p);
  }
  return out;
}

function applyProductQuery(
  products: PriceItem[],
  q: ProductQuery
): PriceItem[] {
  let result = products;
  if (q.geo) {
    result = result.filter((p) =>
      matchGeoFilter(p, q.geo!)
    );
    result = deduplicateProducts(result);
  }
  if (q.excludePrefix.length > 0) {
    result = result.filter((p) => {
      const ip = p.ipRange || '';
      return !q.excludePrefix.some(
        (prefix) => ip.startsWith(prefix + '.')
      );
    });
  }
  if (q.quality === 'residential') {
    result = result.filter(
      (p) => (p.proxyType ?? 0) === 101
    );
  } else if (q.quality === 'datacenter') {
    result = result.filter(
      (p) => (p.proxyType ?? 0) === 103
    );
  }
  if (q.sort === 'price_asc') {
    result.sort(
      (a, b) => (a.price ?? 0) - (b.price ?? 0)
    );
  } else if (q.sort === 'price_desc') {
    result.sort(
      (a, b) => (b.price ?? 0) - (a.price ?? 0)
    );
  }
  return result;
}

function fmtLocation(p: PriceItem): string {
  const cn = p.country
    ? countryCodeToName(p.country)
    : '';
  const st = p.state
    ? stateCodeToName(p.state)
    : '';
  const ct = p.city ? codeToName(p.city) : '';
  const parts: string[] = [];
  if (cn) parts.push(cn);
  if (st && st !== cn && st !== ct) parts.push(st);
  if (ct && ct !== cn) parts.push(ct);
  return parts.join('-') || '—';
}

function fmtPrice(
  p: PriceItem,
  user: NLUserContext,
  lang: Lang,
  targetUsername?: string
): string {
  if (user.isAdmin) {
    const cost =
      p.costPrice != null
        ? `¥${p.costPrice}`
        : '—';
    const gp =
      p.globalPrice ?? p.price;
    const sell = gp != null ? `¥${gp}` : '—';
    return (
      `${t(lang, '成本', 'Cost')}: ${cost}  |  ` +
      `${t(lang, '全局售价', 'Global')}: ${sell}`
    );
  }
  if (user.isAgent) {
    if (targetUsername) {
      const up =
        p.price != null ? `¥${p.price}` : '—';
      return (
        `${t(lang, '用户 ', 'User ')}` +
        `${targetUsername} ` +
        `${t(lang, '价格', 'Price')}: ${up}`
      );
    }
    const agentP =
      p.price != null ? `¥${p.price}` : '—';
    return (
      `${t(lang, '代理商价', 'Agent')}: ${agentP}` +
      `  |  ${t(lang, '成本', 'Cost')}: ${agentP}`
    );
  }
  return p.price != null
    ? `${t(lang, '我的价格', 'Price')}: ¥${p.price}`
    : '—';
}

const SUPPLIER_TYPE_ZH: Record<string, string> = {
  mb: '纯净静态1',
  ipideash: '纯净静态2',
  ipv: '纯净静态3',
  LM: '纯净静态4',
};
const SUPPLIER_TYPE_EN: Record<string, string> = {
  mb: 'Pure Static 1',
  ipideash: 'Pure Static 2',
  ipv: 'Pure Static 3',
  LM: 'Pure Static 4',
};

function resolveProductType(
  productNo: string | undefined,
  staticType: string | undefined,
  lang: Lang
): string {
  const map =
    lang === 'zh' ? SUPPLIER_TYPE_ZH : SUPPLIER_TYPE_EN;
  if (staticType && map[staticType]) return map[staticType];
  if (!productNo) return '—';
  const pn = productNo.toLowerCase();
  if (
    pn.startsWith('lm_') ||
    pn.includes('lm') ||
    pn.includes('lumi')
  ) {
    return map.LM;
  }
  if (pn.startsWith('mb_')) return map.mb;
  if (pn.startsWith('ipidea')) return map.ipideash;
  if (pn.startsWith('ipv')) return map.ipv;
  return '—';
}

interface OrderItem {
  amount?: number;
  user_price?: number;
  agent_price?: number;
  username?: string;
  agent_username?: string;
}

function fmtOrderPrice(
  o: OrderItem,
  user: NLUserContext,
  lang: Lang
): string {
  const parts: string[] = [];
  if (user.isAdmin) {
    parts.push(
      `${t(lang, '用户价', 'UserP')}: ¥${o.user_price ?? 0}`
    );
    parts.push(
      `${t(lang, '代理价', 'AgentP')}: ¥${o.agent_price ?? 0}`
    );
    parts.push(
      `${t(lang, '成本', 'Cost')}: ¥${o.amount ?? 0}`
    );
    if (o.username) parts.push(
      `${t(lang, '用户', 'User')}: ${o.username}`
    );
    if (o.agent_username) parts.push(
      `${t(lang, '代理', 'Agent')}: ${o.agent_username}`
    );
  } else if (user.isAgent) {
    parts.push(
      `${t(lang, '用户价', 'UserP')}: ¥${o.user_price ?? 0}`
    );
    parts.push(
      `${t(lang, '代理价', 'AgentP')}: ¥${o.agent_price ?? 0}`
    );
    if (o.username) parts.push(
      `${t(lang, '用户', 'User')}: ${o.username}`
    );
  } else {
    parts.push(
      `${t(lang, '价格', 'Price')}: ¥${o.user_price ?? 0}`
    );
  }
  return `  ${parts.join('  |  ')}\n`;
}

export async function executeQueryStaticProducts(
  slots: Record<string, unknown>,
  user: NLUserContext,
  lang: Lang
): Promise<ExecResult> {
  const traceId =
    (slots._trace_id as string) ||
    `nl_exec_${Date.now().toString(36)}`;
  const query = buildProductQuery(slots);
  const country =
    slots.country as string | undefined;
  const city = slots.city as string | undefined;
  const rawTarget =
    slots.target_user as string | undefined;

  let targetUsername: string | undefined;
  let targetUserId: number | undefined;

  if (rawTarget && user.isAgent) {
    const adminTk = await getAdminToken();
    const found = await findUserAcrossRoles(
      rawTarget, adminTk
    );
    if (!found) {
      return {
        message: t(
          lang,
          `未找到用户 ${rawTarget}，请检查用户名。`,
          `User ${rawTarget} not found.`
        ),
      };
    }
    if (
      found.agent_id !== user.userId &&
      !user.isAdmin
    ) {
      return {
        message: t(
          lang,
          `用户 ${rawTarget} 不属于您的名下，` +
            `无法查询。`,
          `User ${rawTarget} is not under ` +
            `your account.`
        ),
      };
    }
    targetUsername = found.username;
    targetUserId = found.id;
  }

  log.info({
    event: 'static_products_query_start',
    trace_id: traceId,
    intent: (slots._intent as string) || 'unknown',
    city,
    country,
    has_geo: !!query.geo,
    sort: query.sort,
    quality: query.quality,
    exclude_prefix: query.excludePrefix,
    target_user: targetUsername ?? null,
  });

  if (!query.geo && (city || country)) {
    const fbNames: string[] = [];
    if (city) {
      const n = codeToName(city);
      if (n !== city) fbNames.push(n);
    }
    if (country) {
      const n = countryCodeToName(country);
      if (n !== country) fbNames.push(n);
    }
    query.geo = {
      raw: city || country || '',
      ambiguous: false,
      candidates: [],
      city: city || null,
      country: country || null,
      matchedNames: fbNames,
      group: null,
    };
  }

  let url: string;
  if (user.isAdmin) {
    url =
      '/api/settings/prices?is_global=true' +
      '&proxy_types=101&proxy_types=102' +
      '&proxy_types=103';
  } else {
    url =
      '/api/settings/prices?is_global=false' +
      '&proxy_types=101&proxy_types=102' +
      '&proxy_types=103';
    if (user.isAgent && targetUserId) {
      url +=
        `&agent_id=${user.userId}` +
        `&user_id=${targetUserId}`;
    }
  }

  const res = (await backendGet(
    url,
    user.backendToken
  )) as {
    code: number;
    data?: PriceItem[];
  };

  log.info({
    event: 'static_products_backend_loaded',
    trace_id: traceId,
    response_code: res.code,
    raw_count: res.data?.length || 0,
  });

  if (res.code !== 0 || !res.data?.length) {
    const loc =
      query.geo?.matchedNames?.[0] || '全部';
    return {
      message: t(
        lang,
        `未找到 ${loc} 的静态代理产品。`,
        `No static products found for ${loc}.`
      ),
    };
  }

  const allEnabled = res.data.filter(
    (p) => p.active !== 0 && p.enable !== 0
  );
  const scopeProducts = user.isAdmin
    ? res.data
    : allEnabled;
  log.info({
    event: 'static_products_scope_selected',
    trace_id: traceId,
    is_admin: !!user.isAdmin,
    raw_total: res.data.length,
    enabled_total: allEnabled.length,
    scoped_total: scopeProducts.length,
  });
  log.info({
    event: 'static_products_enabled_count',
    trace_id: traceId,
    enabled_count: scopeProducts.length,
    in_stock_count: scopeProducts.filter(
      (p) => (p.stock ?? 0) > 0
    ).length,
  });

  const geo = query.geo;
  const isAmbiguous =
    geo?.ambiguous && geo.candidates.length > 1;

  if (isAmbiguous && geo) {
    log.info({
      event: 'static_products_geo_ambiguous',
      trace_id: traceId,
      geo_raw: geo.raw,
      candidate_count: geo.candidates.length,
    });
    return formatAmbiguousQuery(
      scopeProducts, geo, query, user, lang,
      targetUsername
    );
  }

  const page = (slots.page as number) || 1;
  const pageSize =
    (slots.count as number) || DEFAULT_PAGE_SIZE;
  return formatNormalQuery(
    scopeProducts, query, user, lang,
    page, pageSize, traceId, targetUsername
  );
}

function formatAmbiguousQuery(
  allEnabled: PriceItem[],
  geo: GeoResult,
  query: ProductQuery,
  user: NLUserContext,
  lang: Lang,
  targetUsername?: string
): ExecResult {
  const inStock = allEnabled.filter(
    (p) => (p.stock ?? 0) > 0
  );
  const pool = inStock.length > 0
    ? inStock : allEnabled;
  const usingAll = inStock.length === 0;

  const groups = groupByCandidate(
    pool, geo.candidates
  );

  if (groups.length === 0) {
    const labels = geo.candidates
      .map((c) => c.label).join('、');
    return {
      message: t(
        lang,
        `"${geo.raw}" 可能指以下地区，但均未找到可用产品：\n` +
          labels,
        `"${geo.raw}" may refer to: ${labels}, ` +
          `but no products found for any.`
      ),
    };
  }

  const filteredGroups = groups.map((g) => ({
    candidate: g.candidate,
    products: applyNonGeoFilters(g.products, query),
  })).filter((g) => g.products.length > 0);

  if (filteredGroups.length === 0) {
    const labels = geo.candidates
      .map((c) => c.label).join('、');
    return {
      message: t(
        lang,
        `"${geo.raw}" 相关地区均无匹配产品。` +
          `\n尝试的地区：${labels}`,
        `No products matched for "${geo.raw}".` +
          ` Tried: ${labels}`
      ),
    };
  }

  const stockNote = usingAll
    ? t(
        lang,
        '⚠️ 有库存的已售罄，以下为全部产品\n\n',
        '⚠️ In-stock sold out, showing all\n\n'
      ) : '';

  let msg = t(
    lang,
    `📦 "${geo.raw}" 相关地区可用 IP：\n\n`,
    `📦 IPs related to "${geo.raw}":\n\n`
  ) + stockNote;

  for (let i = 0; i < filteredGroups.length; i++) {
    const g = filteredGroups[i];
    const c = g.candidate;
    const total = g.products.length;
    const inS = g.products.filter(
      (p) => (p.stock ?? 0) > 0
    ).length;

    msg += `${i + 1}. ${c.label}（${c.labelEn}）`;
    msg += ` — ${total} 个产品`;
    if (inS > 0) msg += `，${inS} 个有库存`;
    msg += '\n';

    const show = g.products.slice(0, 5);
    for (const p of show) {
      const loc = fmtLocation(p);
      const stock = p.stock ?? 0;
      const price = fmtPrice(
        p, user, lang, targetUsername
      );
      msg +=
        `   ${loc}  ` +
        `${t(lang, '库存', 'Stock')}: ${stock}  ` +
        `${price}\n`;
    }
    if (total > 5) {
      msg += t(
        lang,
        `   ... 还有 ${total - 5} 个\n`,
        `   ... ${total - 5} more\n`
      );
    }
    msg += '\n';
  }

  msg += t(
    lang,
    '💡 你也可以直接说：\n',
    '💡 You can also say:\n'
  );
  for (const g of filteredGroups) {
    msg += `- ${g.candidate.label}IP\n`;
  }

  return {
    message: msg.trim(),
    data: {
      ambiguous: true,
      groups: filteredGroups.map((g) => ({
        label: g.candidate.label,
        labelEn: g.candidate.labelEn,
        count: g.products.length,
      })),
    },
  };
}

function applyNonGeoFilters(
  products: PriceItem[],
  q: ProductQuery
): PriceItem[] {
  let result = products;
  if (q.excludePrefix.length > 0) {
    result = result.filter((p) => {
      const ip = p.ipRange || '';
      return !q.excludePrefix.some(
        (pre) => ip.startsWith(pre + '.')
      );
    });
  }
  if (q.quality === 'residential') {
    result = result.filter(
      (p) => (p.proxyType ?? 0) === 101
    );
  } else if (q.quality === 'datacenter') {
    result = result.filter(
      (p) => (p.proxyType ?? 0) === 103
    );
  }
  if (q.sort === 'price_asc') {
    result.sort(
      (a, b) => (a.price ?? 0) - (b.price ?? 0)
    );
  } else if (q.sort === 'price_desc') {
    result.sort(
      (a, b) => (b.price ?? 0) - (a.price ?? 0)
    );
  }
  return result;
}

function formatNormalQuery(
  allProducts: PriceItem[],
  query: ProductQuery,
  user: NLUserContext,
  lang: Lang,
  page: number,
  pageSize: number,
  traceId?: string,
  targetUsername?: string
): ExecResult {
  const initialCount = allProducts.length;
  const isAdmin = !!user.isAdmin;
  let products = isAdmin
    ? applyProductQuery(allProducts, query)
    : applyProductQuery(
        allProducts.filter(
          (p) => (p.stock ?? 0) > 0
        ),
        query
      );

  let showingOutOfStock = false;
  const hasFilter = !isAdmin && !!(
    query.geo ||
    query.excludePrefix.length > 0 ||
    query.quality
  );
  if (!products.length && hasFilter) {
    products = applyProductQuery(
      allProducts, query
    );
    showingOutOfStock = products.length > 0;
  }

  log.info({
    event: 'static_products_filter_done',
    trace_id: traceId || 'n/a',
    enabled_total: initialCount,
    filtered_total: products.length,
    is_admin: isAdmin,
    has_filter: hasFilter,
    showing_out_of_stock: showingOutOfStock,
    geo_matched:
      query.geo?.matchedNames?.slice(0, 3) || [],
  });

  if (query.geo) {
    const geoCandidates =
      query.geo.candidates.map((c) => ({
        cityCode: c.cityCode || '',
        stateCode: c.stateCode || '',
        countryCode: c.countryCode || '',
      }));
    const cityDist = products.reduce(
      (acc, p) => {
        const key = p.city || 'EMPTY';
        acc[key] = (acc[key] || 0) + 1;
        return acc;
      },
      {} as Record<string, number>
    );
    const stateDist = products.reduce(
      (acc, p) => {
        const key = p.state || 'EMPTY';
        acc[key] = (acc[key] || 0) + 1;
        return acc;
      },
      {} as Record<string, number>
    );
    log.info({
      event: 'static_products_filter_geo_detail',
      trace_id: traceId || 'n/a',
      candidates: geoCandidates,
      city_distribution: cityDist,
      state_distribution: stateDist,
    });
  }

  if (!products.length) {
    const loc =
      query.geo?.matchedNames?.[0] || '';
    let hint = '';
    if (query.excludePrefix.length > 0) {
      hint = t(
        lang,
        `（已排除 ${query.excludePrefix.join('、')} 开头）`,
        ` (excluded prefix ` +
          `${query.excludePrefix.join(', ')})`
      );
    }
    return {
      message: t(
        lang,
        `未找到 ${loc || '该地区'} 的${
          isAdmin ? '' : '可用'
        }静态代理产品${hint}。`,
        `No static products for ` +
          `${loc || 'that region'}${hint}.`
      ),
    };
  }

  const locLabel = query.geo?.group?.label
    || query.geo?.matchedNames?.[0] || '';
  const qualityHint = query.quality
    ? ` [${query.quality}]` : '';
  const excludeHint =
    query.excludePrefix.length > 0
      ? t(
          lang,
          `（排除 ${query.excludePrefix.join('、')} 开头）`,
          ` (excl. prefix ` +
            `${query.excludePrefix.join(',')})`
        ) : '';
  const stockHint = showingOutOfStock
    ? t(
        lang,
        '⚠️ 有库存的已售罄，以下为全部产品：\n',
        '⚠️ In-stock sold out, showing all:\n'
      ) : '';

  const allRows: CidrRow[] = [];
  for (const p of products) {
    allRows.push(...expandCidrRows(p, lang));
  }

  const totalRows = allRows.length;
  const safePage = Math.max(1, page);
  const safeSize = Math.min(
    Math.max(1, pageSize), 100
  );
  const startIdx = (safePage - 1) * safeSize;
  const showRows = allRows.slice(
    startIdx, startIdx + safeSize
  );

  const sortLabel = query.sort
    ? (query.sort === 'price_asc'
        ? t(lang, '最便宜', 'Cheapest')
        : t(lang, '最贵', 'Most expensive'))
    : '';

  const titleLoc = locLabel
    ? ` (${locLabel})` : '';
  const pageLabel = t(
    lang,
    `第 ${safePage} 页`,
    `Page ${safePage}`
  );
  const title = sortLabel
    ? t(
        lang,
        `📦 ${sortLabel}的静态代理` +
          `${titleLoc}${qualityHint}` +
          `${excludeHint}` +
          ` — 共 ${totalRows} 个IP段` +
          `（${pageLabel}）：\n${stockHint}\n`,
        `📦 ${sortLabel} static proxies` +
          `${titleLoc}${qualityHint}` +
          `${excludeHint}` +
          ` — ${totalRows} IP ranges` +
          ` (${pageLabel}):\n${stockHint}\n`
      )
    : t(
        lang,
        `📦 ${locLabel || '全部'}静态代理产品` +
          `${qualityHint}${excludeHint}` +
          ` (${totalRows} 个IP段，` +
          `${pageLabel})：\n${stockHint}\n`,
        `📦 Static products` +
          `${locLabel ? ` in ${locLabel}` : ''}` +
          `${qualityHint}${excludeHint}` +
          ` (${totalRows} IP ranges, ` +
          `${pageLabel}):\n${stockHint}\n`
      );

  let msg = title;
  let prevKey = '';
  for (let i = 0; i < showRows.length; i++) {
    const row = showRows[i];
    const displayIdx = startIdx + i + 1;
    const key = `${row.productNo}`;
    if (key !== prevKey) {
      if (prevKey) msg += '\n';
      const header =
        `${row.loc} [${row.productType}]`;
      const status = row.active === 0
        ? ' ⚠️停用' : '';
      msg += `${header}${status}\n`;
      prevKey = key;
    }
    const priceStr = fmtRowPrice(
      row, user, lang, targetUsername
    );
    if (row.ip) {
      msg += `${displayIdx}. ${row.ip} ` +
        `${t(lang, '库存', 'Stock')}：` +
        `${row.stock}；${priceStr}\n`;
    } else {
      msg += `${displayIdx}. ` +
        `${t(lang, '库存', 'Stock')}：` +
        `${row.stock}；${priceStr}\n`;
    }
  }

  msg += paginationFooter(
    safePage, safeSize, totalRows, lang
  );

  const geoDebug = query.geo
    ? {
        input: query.geo.raw,
        cityCandidates: query.geo.candidates
          .map((c) => c.cityCode)
          .filter(Boolean),
        matchedNames: query.geo.matchedNames,
        matchedCount: products.length,
      }
    : undefined;

  log.info({
    event: 'static_products_rendered',
    trace_id: traceId || 'n/a',
    product_count: products.length,
    cidr_row_count: totalRows,
    page: safePage,
    page_size: safeSize,
    shown: showRows.length,
  });

  return {
    message: msg.trim(),
    data: {
      products: products.slice(0, 20),
      total: totalRows,
      page: safePage,
      pageSize: safeSize,
      currentPageItems: showRows,
      cidrRowCount: totalRows,
      geoDebug,
    },
  };
}

export async function executeQueryProducts(
  slots: Record<string, unknown>,
  user: NLUserContext,
  lang: Lang
): Promise<ExecResult> {
  return executeQueryStaticProducts(
    slots, user, lang
  );
}

export async function executeQueryIpInventory(
  slots: Record<string, unknown>,
  user: NLUserContext,
  lang: Lang
): Promise<ExecResult> {
  return executeQueryStaticProducts(
    slots, user, lang
  );
}

/* ─── Orders ─── */

async function resolveTargetUserOrAgent(
  targetUser: string,
  user: NLUserContext
): Promise<{
  userId?: number;
  agentId?: number;
  who: string;
  error?: string;
} | null> {
  if (
    !targetUser ||
    !(user.isAgent || user.isAdmin)
  ) {
    return null;
  }
  const token = user.isAdmin
    ? user.backendToken
    : await getAdminToken();
  const found = await findUserAcrossRoles(
    targetUser,
    token
  );
  if (!found) return { error: targetUser, who: '' };
  if (found.is_agent) {
    return {
      agentId: found.id,
      who: `${targetUser}(代理商) `,
    };
  }
  return { userId: found.id, who: `${targetUser} ` };
}

export async function executeQueryDynamicOrders(
  slots: Record<string, unknown>,
  user: NLUserContext,
  lang: Lang
): Promise<ExecResult> {
  const page = (slots.page as number) || 1;
  let targetUser = slots.target_user as string;
  const count = (slots.count as number) || DEFAULT_PAGE_SIZE;
  let search = slots.search as string;
  const pageSize = Math.min(count, 100);

  const resolved = await resolveTargetUserOrAgent(
    targetUser,
    user
  );
  if (resolved?.error) {
    const failedToken = resolved.error;
    if (isLikelyOrderId(failedToken)) {
      search = search || failedToken;
      targetUser = '';
    } else {
      return {
        message: t(
          lang,
          `未找到用户 ${failedToken}`,
          `User ${failedToken} not found`
        ),
      };
    }
  }
  const who = resolved?.error ? '' : (resolved?.who ?? '');

  let url =
    `/api/dynamic?page=${page}` +
    `&page_size=${pageSize}`;
  if (!resolved?.error && resolved?.agentId)
    url += `&agent_id=${resolved.agentId}`;
  else if (!resolved?.error && resolved?.userId)
    url += `&user_id=${resolved.userId}`;

  const res = (await backendGet(
    url,
    user.backendToken
  )) as {
    code: number;
    data?: {
      list?: Array<{
        order_no?: string;
        status?: string;
        traffic?: number;
        pool_type?: string;
        created_at?: string;
        username?: string;
      }>;
      total?: number;
    };
  };

  if (!res.data?.list?.length) {
    return {
      message: t(
        lang,
        `${who}暂无动态代理订单。`,
        `${who}No dynamic proxy orders found.`
      ),
    };
  }

  let list = res.data.list;
  if (search) {
    list = list.filter(
      (o) =>
        o.order_no?.includes(search) ||
        o.pool_type?.includes(search)
    );
    if (!list.length) {
      return {
        message: t(
          lang,
          `${who}未找到包含 ${search} 的动态订单。`,
          `${who}No dynamic orders matching ${search}.`
        ),
      };
    }
  }

  const total = res.data.total ?? list.length;
  let msg = t(
    lang,
    `📋 ${who}动态代理订单（第 ${page} 页）\n\n`,
    `📋 ${who}Dynamic Orders (Page ${page})\n\n`
  );
  for (let i = 0; i < list.length; i++) {
    const o = list[i];
    const idx = (page - 1) * pageSize + i + 1;
    const no = o.order_no || '—';
    const st = o.status || '—';
    const uname = o.username || '';
    const flow = o.traffic
      ? `${o.traffic}GB`
      : '—';
    const date = o.created_at
      ? o.created_at.replace('T', ' ')
        .slice(0, 16) : '';
    msg += `${idx}. ${no}  |  ${st}` +
      `  |  ${flow}`;
    if (uname) msg += `  |  ${uname}`;
    if (date) msg += `  |  ${date}`;
    msg += '\n';
  }

  msg += paginationFooter(
    page, pageSize, total, lang
  );

  return {
    message: msg.trim(),
    data: { orders: list, total },
  };
}

interface StaticOrderItem {
  order_no?: string;
  status?: string;
  effective_status?: string;
  country_code?: string;
  city_code?: string;
  state?: string;
  product_no?: string;
  proxy_type?: number;
  static_type?: string;
  amount?: number;
  user_price?: number;
  agent_price?: number;
  created_at?: string;
  updated_at?: string;
  username?: string;
  agent_username?: string;
  duration?: number;
  unit?: string;
  ip_count?: number;
  remark?: string | Record<string, string>;
  agent_remark?: string | Record<string, string>;
  instances?: Array<{
    proxy_ip?: string;
    proxy_port?: number;
    username?: string;
    password?: string;
    expire_time?: string;
    user_expired?: string;
    created_at?: string;
    updated_at?: string;
    status?: number;
    remark?: string;
    agent_remark?: string;
  }>;
}

function fmtDt(raw?: string): string {
  if (!raw) return '';
  return raw.replace('T', ' ').slice(0, 19);
}

function fmtRemarkField(
  r: string | Record<string, string> | undefined
): string {
  if (!r) return '';
  if (typeof r === 'string') return r;
  const vals = Object.values(r).filter(Boolean);
  return vals.length ? vals[0] : '';
}

function fmtStatus(
  s?: string, lang?: Lang
): string {
  const map: Record<string, string> = {
    success: lang === 'zh' ? '运行中' : 'Running',
    active: lang === 'zh' ? '运行中' : 'Running',
    pending: lang === 'zh' ? '待处理' : 'Pending',
    expired: lang === 'zh' ? '已过期' : 'Expired',
    stopped: lang === 'zh' ? '已停止' : 'Stopped',
    cancelled: lang === 'zh' ? '已取消' : 'Cancelled',
    failed: lang === 'zh' ? '失败' : 'Failed',
    refunded: lang === 'zh' ? '已退款' : 'Refunded',
    cooling_period:
      lang === 'zh' ? '冷却期' : 'Cooling',
    unknown: lang === 'zh' ? '未知' : 'Unknown',
    processing:
      lang === 'zh' ? '处理中' : 'Processing',
  };
  return map[s || ''] || s || '—';
}

function fmtStaticType(
  o: StaticOrderItem, lang: Lang
): string {
  const st = o.static_type || o.product_no || '';
  return resolveProductType(
    o.product_no, st, lang
  );
}

interface FlatInstance {
  order: StaticOrderItem;
  inst: NonNullable<
    StaticOrderItem['instances']
  >[number];
}

function flattenOrderInstances(
  orders: StaticOrderItem[]
): FlatInstance[] {
  const rows: FlatInstance[] = [];
  for (const o of orders) {
    if (o.instances?.length) {
      for (const inst of o.instances) {
        rows.push({ order: o, inst });
      }
    } else {
      rows.push({
        order: o,
        inst: {} as FlatInstance['inst'],
      });
    }
  }
  return rows;
}

function formatInstanceBlock(
  fi: FlatInstance,
  idx: number,
  user: NLUserContext,
  lang: Lang
): string {
  const o = fi.order;
  const inst = fi.inst;
  const no = o.order_no || '—';
  const cn = o.country_code
    ? countryCodeToName(o.country_code) : '';
  const ct = o.city_code
    ? codeToName(o.city_code) : '';
  const region = ct && cn && ct !== cn
    ? `${cn}-${ct}` : ct || cn || '—';
  const status = fmtStatus(
    o.effective_status || o.status, lang
  );
  const prodType = fmtStaticType(o, lang);

  let proxy = '—';
  if (inst.proxy_ip) {
    if (user.isAgent) {
      proxy = inst.proxy_ip;
    } else {
      const port = inst.proxy_port ?? '—';
      const u = inst.username || '—';
      const p = inst.password || '—';
      proxy =
        `${inst.proxy_ip}:${port}:${u}:${p}`;
    }
  }

  let b = `${idx}. `;
  b += t(lang,
    `订单号：${no}\n`,
    `Order: ${no}\n`);
  b += t(lang,
    `实例：${proxy}\n`,
    `Instance: ${proxy}\n`);
  b += `${region}  ${prodType}  ${status}\n`;

  if (user.isAdmin) {
    const uName = o.username || '—';
    const aName = o.agent_username || '—';
    b += t(lang,
      `用户：${uName} 代理商：${aName}\n`,
      `User: ${uName} Agent: ${aName}\n`);
    const up = o.user_price != null
      ? `¥${o.user_price.toFixed(2)}` : '—';
    const ap = o.agent_price != null
      ? `¥${o.agent_price.toFixed(2)}` : '—';
    const cost = o.amount != null && o.ip_count
      ? `¥${(o.amount / o.ip_count).toFixed(2)}`
      : '—';
    b += t(lang,
      `用户价格：${up}；` +
        `代理商价格：${ap}；成本：${cost}\n`,
      `User price: ${up}; ` +
        `Agent price: ${ap}; Cost: ${cost}\n`);
  } else if (user.isAgent) {
    const uName = o.username || '—';
    b += t(lang,
      `用户：${uName}\n`,
      `User: ${uName}\n`);
    const up = o.user_price != null
      ? `¥${o.user_price.toFixed(2)}` : '—';
    const ap = o.agent_price != null
      ? `¥${o.agent_price.toFixed(2)}` : '—';
    b += t(lang,
      `用户价格：${up}；代理商价格：${ap}\n`,
      `User price: ${up}; Agent price: ${ap}\n`);
  } else {
    const up = o.user_price != null
      ? `¥${o.user_price.toFixed(2)}` : '—';
    b += t(lang,
      `用户价格：${up}\n`,
      `Price: ${up}\n`);
  }

  const expTime = inst.expire_time
    || inst.user_expired || '';
  if (expTime) {
    b += t(lang,
      `到期: ${fmtDt(expTime)}\n`,
      `Exp: ${fmtDt(expTime)}\n`);
  }
  b += t(lang,
    `创建: ${fmtDt(o.created_at)}\n`,
    `Created: ${fmtDt(o.created_at)}\n`);
  b += t(lang,
    `更新: ${fmtDt(o.updated_at)}\n`,
    `Updated: ${fmtDt(o.updated_at)}\n`);

  if (user.isAdmin) {
    const ur = fmtRemarkField(o.remark);
    const ar = fmtRemarkField(o.agent_remark);
    if (ur) b += t(lang,
      `用户备注: ${ur}\n`,
      `User note: ${ur}\n`);
    if (ar) b += t(lang,
      `代理备注: ${ar}\n`,
      `Agent note: ${ar}\n`);
  } else if (user.isAgent) {
    const ar = fmtRemarkField(o.agent_remark);
    if (ar) b += t(lang,
      `备注: ${ar}\n`, `Note: ${ar}\n`);
  } else {
    const ur = fmtRemarkField(o.remark);
    if (ur) b += t(lang,
      `备注: ${ur}\n`, `Note: ${ur}\n`);
  }

  return b;
}

export async function executeQueryStaticOrders(
  slots: Record<string, unknown>,
  user: NLUserContext,
  lang: Lang
): Promise<ExecResult> {
  const page = (slots.page as number) || 1;
  let targetUser = slots.target_user as string;
  const count =
    (slots.count as number) || DEFAULT_PAGE_SIZE;
  let search = slots.search as string;
  const pageSize = Math.min(count, 100);
  const period = slots.period as string | undefined;
  const dateRange = slots.date_range as {
    start_date?: string;
    end_date?: string;
  } | undefined;

  const resolved = await resolveTargetUserOrAgent(
    targetUser, user
  );
  if (resolved?.error) {
    const failedToken = resolved.error;
    if (isLikelyOrderId(failedToken)) {
      search = search || failedToken;
      targetUser = '';
    } else {
      return {
        message: t(lang,
          `未找到用户 ${failedToken}`,
          `User ${failedToken} not found`),
      };
    }
  }
  const who = resolved?.error
    ? '' : (resolved?.who ?? '');

  const fetchSize = Math.min(pageSize * 2, 200);
  let url =
    `/api/open/app/static/order/list/v2` +
    `?page=${page}&pageSize=${fetchSize}` +
    `&skip_statistics=true`;
  if (!resolved?.error && resolved?.agentId)
    url += `&agent_id=${resolved.agentId}`;
  else if (!resolved?.error && resolved?.userId)
    url += `&user_id=${resolved.userId}`;
  if (search) {
    url +=
      `&search=${encodeURIComponent(search)}` +
      `&is_search=true`;
  }
  if (dateRange?.start_date) {
    url += `&start_date=${dateRange.start_date}`;
    url += `&end_date=${dateRange.end_date || dateRange.start_date}`;
  } else if (period === 'day') {
    const today = new Date()
      .toISOString().slice(0, 10);
    url += `&start_date=${today}&end_date=${today}`;
  }

  const res = (await backendGet(
    url, user.backendToken
  )) as {
    code: number;
    data?: {
      list?: StaticOrderItem[];
      total?: number;
    };
  };

  if (!res.data?.list?.length) {
    const extra = search ? ` (${search})` : '';
    return {
      message: t(lang,
        `${who}暂无静态代理订单${extra}。`,
        `${who}No static proxy orders${extra}.`),
    };
  }

  const allRows = flattenOrderInstances(
    res.data.list
  );
  const showRows = allRows.slice(0, pageSize);
  const orderTotal = res.data.total ?? 0;
  const instanceTotal =
    allRows.length >= fetchSize
      ? orderTotal * 2
      : allRows.length +
        Math.max(0, orderTotal -
          res.data.list.length) * 2;

  let msg = t(lang,
    `📦 ${who}静态代理订单` +
      `（第 ${page} 页）\n\n`,
    `📦 ${who}Static Orders` +
      ` (Page ${page})\n\n`);

  for (let i = 0; i < showRows.length; i++) {
    const idx = (page - 1) * pageSize + i + 1;
    msg += formatInstanceBlock(
      showRows[i], idx, user, lang
    );
    msg += '\n';
  }

  msg += paginationFooter(
    page, pageSize,
    Math.max(instanceTotal, showRows.length),
    lang
  );

  return {
    message: msg.trim(),
    data: {
      orders: res.data.list,
      total: orderTotal,
      instanceCount: allRows.length,
    },
  };
}

/* ─── Purchase ─── */

interface DynProduct {
  id: number;
  type: string;
  proxyType: number;
  price: number;
  name?: string;
  globalPrice?: number;
}

export async function executePurchaseDynamic(
  slots: Record<string, unknown>,
  user: NLUserContext,
  lang: Lang
): Promise<ExecResult> {
  if (user.isAdmin) {
    return {
      message: t(
        lang,
        '管理员不能直接开通动态代理，请以用户身份操作。',
        'Admins cannot provision dynamic proxies directly.'
      ),
    };
  }
  if (user.isAgent) {
    const tgtUser = slots.target_user as string;
    if (!tgtUser) {
      return {
        message: t(
          lang,
          '代理商开通动态代理需要指定名下用户。\n' +
            '例如：帮用户 xxx 开通 2G',
          'Agents must specify a sub-user.\n' +
            'Example: open 2GB for user xxx'
        ),
      };
    }
  }

  const trafficGb =
    (slots.traffic_gb as number) || 1;
  const remark = (slots.remark as string) || '';
  const targetUserName =
    (slots.target_user as string) || '';

  const adminToken = await getAdminToken();
  let targetUserId = user.userId;
  let targetUsername =
    targetUserName || user.username;

  if (targetUserName) {
    const found = await findUserAcrossRoles(
      targetUserName,
      adminToken
    );
    if (!found) {
      return {
        message: t(
          lang,
          `未找到用户 ${targetUserName}`,
          `User ${targetUserName} not found`
        ),
      };
    }
    targetUserId = found.id;
    targetUsername = found.username ?? targetUserName;
  }

  const prodRes = (await backendGet(
    '/api/business/dynamic-proxy/products',
    user.backendToken
  )) as { code: number; data?: DynProduct[] };

  let product: DynProduct | undefined;
  if (prodRes.code === 0 && prodRes.data?.length) {
    product =
      prodRes.data.find(
        (p) => p.type === 'dynamic_ipweb'
      ) || prodRes.data[0];
  }

  if (!product) {
    return {
      message: t(
        lang,
        '未找到可用的动态代理产品。',
        'No dynamic proxy product available.'
      ),
    };
  }

  let unitPrice = product.price || 0;

  const priceQs = targetUserName
    ? `?is_global=false&user_id=${targetUserId}`
    : '?is_global=false';
  const priceRes = (await backendGet(
    `/api/dynamic-prices/prices${priceQs}`,
    user.backendToken
  )) as {
    code: number;
    data?: Array<{
      id: number;
      price: number;
      tierPrices?: Array<{
        min_traffic: number;
        max_traffic: number;
        price: number;
      }>;
    }>;
  };

  if (
    priceRes.code === 0 &&
    priceRes.data?.length
  ) {
    const pp = priceRes.data.find(
      (p) => p.id === product.id
    );
    if (pp) {
      if (pp.tierPrices?.length) {
        const minF =
          pp.tierPrices[0].min_traffic || 3;
        const bf = Math.max(trafficGb, minF);
        const tier = pp.tierPrices.find(
          (t) =>
            bf >= t.min_traffic &&
            bf <= t.max_traffic
        );
        unitPrice =
          tier?.price ??
          pp.tierPrices[pp.tierPrices.length - 1]
            .price;
      } else if (pp.price > 0) {
        unitPrice = pp.price;
      }
    }
  }

  const totalAmount = Number(
    (unitPrice * trafficGb).toFixed(2)
  );

  const body = {
    productNo: product.type,
    proxyType: product.proxyType || 104,
    flow: trafficGb,
    maxFlowLimit: trafficGb,
    username: targetUsername,
    userId: targetUserId,
    unitPrice,
    totalAmount,
    remark,
  };

  const res = (await backendPost(
    '/api/business/dynamic-proxy/open',
    body,
    user.backendToken
  )) as {
    code: number;
    data?: {
      orderNo?: string;
      balance?: number;
      proxy?: {
        url?: string;
        list?: string[];
      };
    };
    msg?: string;
  };

  if (res.code !== 0) {
    const errStr = res.msg || '未知错误';
    const rec = helpForFailure(
      'purchase_dynamic', errStr, lang
    );
    return {
      message: t(
        lang,
        `开通失败: ${errStr}`,
        `Failed: ${errStr}`
      ) + rec.recoveryHint,
      suggestions: rec.suggestions,
    };
  }

  let proxyLine = '';
  if (res.data?.proxy?.url) {
    proxyLine = `\n• 代理地址: ${res.data.proxy.url}`;
  } else if (res.data?.proxy?.list?.length) {
    proxyLine =
      `\n• 代理地址: ${res.data.proxy.list[0]}`;
  }

  return {
    message: t(
      lang,
      `✅ 动态代理开通成功！\n\n` +
        `• 流量: ${trafficGb} GB\n` +
        `• 产品: ${product.type}\n` +
        `• 用户: ${targetUsername}` +
        proxyLine +
        (remark ? `\n• 备注: ${remark}` : '') +
        `\n\n如需提取代理，请输入"提取动态代理"`,
      `✅ Dynamic proxy activated!\n\n` +
        `• Traffic: ${trafficGb} GB\n` +
        `• Product: ${product.type}\n` +
        `• User: ${targetUsername}` +
        proxyLine +
        (remark ? `\n• Remark: ${remark}` : '') +
        `\n\nTo extract proxy, type "extract proxy"`
    ),
    data: res.data as Record<string, unknown>,
  };
}

export async function executePurchaseStatic(
  slots: Record<string, unknown>,
  user: NLUserContext,
  lang: Lang
): Promise<ExecResult> {
  if (user.isAdmin) {
    return {
      message: t(
        lang,
        '管理员不能直接开通 IP，请以用户身份操作。',
        'Admins cannot provision IPs directly.'
      ),
    };
  }

  const tgtUserSlot =
    slots.target_user as string | undefined;

  if (user.isAgent && !tgtUserSlot) {
    return {
      message: t(
        lang,
        '代理商开通 IP 需要指定名下用户。\n' +
          '例如：帮用户 xxx 开通 ' +
          '167.148.72.0，30天',
        'Agents must specify a sub-user.\n' +
          'Example: open 167.148.72.0 for ' +
          'user xxx, 30 days'
      ),
    };
  }

  const targetUser = tgtUserSlot || user.username;
  const adminToken = await getAdminToken();
  const targetRes = await findUserAcrossRoles(
    targetUser, adminToken
  );
  if (!targetRes) {
    return {
      message: t(
        lang,
        `未找到用户 ${targetUser}，请检查用户名。`,
        `User ${targetUser} not found.`
      ),
    };
  }

  if (
    user.isAgent &&
    targetRes.agent_id !== user.userId
  ) {
    return {
      message: t(
        lang,
        `用户 ${targetUser} 不属于您的名下，` +
          `无法开通。`,
        `User ${targetUser} is not under ` +
          `your account.`
      ),
    };
  }

  const userId = targetRes.id;

  const ip = slots.ip_segment as string | undefined;
  const qty = (slots.quantity as number) || 1;
  const remark = (slots.remark as string) || '';
  const durationDays =
    (slots.duration as number) || 30;
  const cycleTimes = Math.max(
    1,
    Math.round(durationDays / 30)
  );

  let productNo =
    slots.product_no as string | undefined;
  let country = (slots.country as string) || '';
  let city = (slots.city as string) || '';
  let unitPrice = 0;
  let ipRange = '';

  let priceUrl: string;
  if (user.isAdmin) {
    priceUrl =
      '/api/settings/prices?is_global=true' +
      '&proxy_types=101&proxy_types=102' +
      '&proxy_types=103';
  } else {
    priceUrl =
      '/api/settings/prices?is_global=false' +
      '&proxy_types=101&proxy_types=102' +
      '&proxy_types=103';
    if (user.isAgent) {
      priceUrl +=
        `&agent_id=${user.userId}` +
        `&user_id=${userId}`;
    }
  }

  if (ip) {
    const prefix = ip.replace(/\.\d+$/, '.0/24');
    const pricesRes = (await backendGet(
      priceUrl, user.backendToken
    )) as { code: number; data?: PriceItem[] };

    if (pricesRes.code === 0 && pricesRes.data) {
      for (const p of pricesRes.data) {
        if (!p.ipRangePrices?.length) continue;
        for (const rp of p.ipRangePrices) {
          if (
            rp.ipRange &&
            (rp.ipRange.includes(ip) ||
              rp.ipRange === prefix)
          ) {
            productNo = productNo || p.type || '';
            country = country || p.country || '';
            city = city || p.city || '';
            unitPrice = rp.price ?? p.price ?? 0;
            ipRange = rp.ipRange;
            break;
          }
        }
        if (productNo) break;
      }
    }

    if (!productNo) {
      return {
        message: t(
          lang,
          `未找到包含 IP ${ip} 的产品，` +
            `请检查 IP 地址。`,
          `No product found for IP ${ip}.`
        ),
      };
    }
  }

  const geo =
    slots._geo as GeoResult | undefined;
  if (
    !productNo && geo?.ambiguous &&
    geo.candidates.length > 1
  ) {
    let msg = t(
      lang,
      `"${geo.raw}" 可能指以下地区，请选择：\n\n`,
      `"${geo.raw}" may refer to:\n\n`
    );
    const sugg: string[] = [];
    for (
      let i = 0; i < geo.candidates.length; i++
    ) {
      const c = geo.candidates[i];
      msg +=
        `${i + 1}. ${c.label}（${c.labelEn}）\n`;
      sugg.push(
        t(
          lang,
          `开${c.label}IP`,
          `Open ${c.labelEn} IP`
        )
      );
    }
    msg += t(
      lang,
      '\n回复数字或直接说：\n' +
        sugg.map((s) => `- ${s}`).join('\n'),
      '\nReply a number or say:\n' +
        sugg.map((s) => `- ${s}`).join('\n')
    );
    return {
      message: msg.trim(),
      suggestions: sugg,
    };
  }

  if (!productNo) {
    if (country || city || geo) {
      const result =
        await executeQueryStaticProducts(
          geo ? { ...slots } : { country, city },
          user, lang
        );
      const hint = t(
        lang,
        '\n\n请选择一个 IP 段后输入开通命令，' +
          '例如：\n开通一个 167.148.72.0 的 IP，' +
          '30天',
        '\n\nPlease pick an IP range and use:\n' +
          'open 167.148.72.0, 30 days'
      );
      return {
        message: result.message + hint,
        data: result.data,
        suggestions: result.data?.products
          ? (result.data.products as PriceItem[])
              .slice(0, 3)
              .map((p) => {
                const r =
                  p.ipRangePrices?.[0]?.ipRange ||
                  p.ipRange || '';
                const base =
                  r.split('/')[0] || '';
                return t(
                  lang,
                  `开通一个 ${base} 的 IP，` +
                    `${durationDays}天`,
                  `Open ${base}, ` +
                    `${durationDays} days`
                );
              })
              .filter((s) => s.includes('.'))
          : undefined,
      };
    }
    return {
      message: t(
        lang,
        '请指定要开通的 IP 地址或地区。\n' +
          '例如：\n• 开通一个 167.148.72.0 的 ' +
          'IP，30天\n• 帮我开一个华盛顿的 IP',
        'Please specify an IP or region.\n' +
          'Examples:\n• open 167.148.72.0, ' +
          '30 days\n• open a Washington IP'
      ),
    };
  }

  const totalAmount = unitPrice * qty * cycleTimes;
  const orderNo = `NL${Date.now()}${Math.floor(
    Math.random() * 1000
  )}`;

  const isSpecifiedIp =
    !!ip && !ip.endsWith('.0');

  const body: Record<string, unknown> = {
    orderType: 'static_proxy',
    poolId: productNo,
    unitPrice,
    totalAmount,
    userId,
    target_username: targetUser,
    ipCount: qty,
    duration: 30,
    unit: 1,
    cycleTimes,
    regionCode: '',
    countryCode: country,
    cityCode: city,
    staticType: productNo,
    remark: remark ||
      `NL Agent: ${user.username} → ${targetUser}`,
    app_order_no: orderNo,
  };
  if (ipRange) {
    body.ipRange = ipRange;
    body.cidrBlocks = [
      { cidr: ipRange, count: qty },
    ];
  }
  if (isSpecifiedIp) {
    body.assignedIp = ip;
  }

  const res = (await backendPost(
    '/api/open/app/static/order/create/v2',
    body,
    user.backendToken
  )) as {
    code: number;
    data?: unknown;
    msg?: string;
  };

  if (res.code !== 0) {
    const errStr = res.msg || '未知错误';
    const rec = helpForFailure(
      'purchase_static', errStr, lang
    );
    return {
      message: t(
        lang,
        `开通失败: ${errStr}`,
        `Failed: ${errStr}`
      ) + rec.recoveryHint,
      suggestions: rec.suggestions,
    };
  }

  const durLabel = `${cycleTimes * 30}`;
  const now = new Date();
  const expire = new Date(now);
  expire.setDate(expire.getDate() + cycleTimes * 30);
  const fmtDate = (d: Date) => {
    const y = d.getFullYear();
    const mo = d.getMonth() + 1;
    const day = d.getDate();
    const h = String(d.getHours()).padStart(2, '0');
    const mi = String(d.getMinutes()).padStart(2, '0');
    return `${y}年${mo}月${day}日 ${h}:${mi}`;
  };
  const fmtDateEn = (d: Date) =>
    d.toISOString().replace('T', ' ').slice(0, 16);

  const ipLine = isSpecifiedIp
    ? `• 指定IP: ${ip}`
    : `• IP段: ${ipRange || ip || '—'} (随机分配)`;
  const ipLineEn = isSpecifiedIp
    ? `• Assigned IP: ${ip}`
    : `• IP Range: ${ipRange || ip || '—'} (random)`;

  let proxyCredentials = '';
  let proxyCredentialsEn = '';
  const resData = res.data as Record<string, unknown>;
  const appOrderNo = resData?.appOrderNo as string || '';

  if (appOrderNo) {
    try {
      await new Promise((r) => setTimeout(r, 2000));
      const detailRes = (await backendGet(
        `/api/open/app/static/order/list/v2` +
          `?page=1&pageSize=1` +
          `&search=${encodeURIComponent(appOrderNo)}` +
          `&is_search=true&skip_statistics=true`,
        user.backendToken
      )) as {
        code: number;
        data?: {
          list?: Array<{
            instances?: Array<{
              proxy_ip?: string;
              proxy_port?: number;
              username?: string;
              password?: string;
              expire_time?: string;
            }>;
          }>;
        };
      };
      const inst =
        detailRes.data?.list?.[0]?.instances?.[0];
      if (inst?.proxy_ip) {
        const port = inst.proxy_port || 6013;
        const u = inst.username || '—';
        const p = inst.password || '—';
        const exp = inst.expire_time || fmtDate(expire);
        proxyCredentials =
          `\n• 代理信息: ${inst.proxy_ip}:${port}:${u}:${p}` +
          `\n• 开通时间: ${fmtDate(now)}` +
          `\n• 到期时间: ${exp}`;
        proxyCredentialsEn =
          `\n• Proxy: ${inst.proxy_ip}:${port}:${u}:${p}` +
          `\n• Created: ${fmtDateEn(now)}` +
          `\n• Expires: ${exp}`;
      }
    } catch {
      /* order detail query failed, show basic info */
    }
  }

  if (!proxyCredentials) {
    proxyCredentials =
      `\n• 开通时间: ${fmtDate(now)}` +
      `\n• 到期时间: ${fmtDate(expire)}`;
    proxyCredentialsEn =
      `\n• Created: ${fmtDateEn(now)}` +
      `\n• Expires: ${fmtDateEn(expire)}`;
  }

  return {
    message: t(
      lang,
      `✅ 静态代理开通成功！\n\n${ipLine}\n• 数量: ${qty}\n• 时长: ${durLabel} 天\n• 用户: ${targetUser}` +
        proxyCredentials +
        (remark ? `\n• 备注: ${remark}` : ''),
      `✅ Static proxy activated!\n\n${ipLineEn}\n• Qty: ${qty}\n• Duration: ${durLabel} days\n• User: ${targetUser}` +
        proxyCredentialsEn +
        (remark ? `\n• Remark: ${remark}` : '')
    ),
    data: resData,
  };
}

export async function executeRenewStatic(
  slots: Record<string, unknown>,
  user: NLUserContext,
  lang: Lang
): Promise<ExecResult> {
  const ip = slots.ip_segment as string | undefined;
  const orderNo = slots.order_no as string | undefined;
  const durationMonths = slots.duration
    ? Math.max(1, Math.round(
        (slots.duration as number) / 30
      ))
    : 1;

  if (![1, 3, 6, 12].includes(durationMonths)) {
    return {
      message: t(
        lang,
        '续费月数只能选择 1、3、6、12 个月。',
        'Renewal duration must be 1, 3, 6, or 12 months.'
      ),
    };
  }

  if (!ip && !orderNo) {
    return {
      message: t(
        lang,
        '请指定要续费的 IP 或订单号。\n' +
          '例如：\n• 续费 149.119.141.100，3个月\n' +
          '• 续费订单 NL1234567890',
        'Please specify the IP or order number to renew.\n' +
          'e.g.: renew 149.119.141.100, 3 months'
      ),
    };
  }

  const search = ip || orderNo || '';
  const listRes = (await backendGet(
    `/api/open/app/static/order/list/v2` +
      `?page=1&pageSize=5` +
      `&search=${encodeURIComponent(search)}` +
      `&is_search=true&skip_statistics=true`,
    user.backendToken
  )) as {
    code: number;
    data?: {
      list?: Array<{
        order_no?: string;
        app_order_no?: string;
        status?: string;
        instances?: Array<{
          instance_no?: string;
          proxy_ip?: string;
          expire_time?: string;
          status?: number;
        }>;
      }>;
    };
  };

  const orders = listRes.data?.list?.filter(
    (o) => o.status === 'success' || o.status === 'active'
  );
  if (!orders?.length) {
    return {
      message: t(
        lang,
        `未找到可续费的订单 (${search})。`,
        `No renewable order found for ${search}.`
      ),
    };
  }

  const order = orders[0];
  const instance = order.instances?.find(
    (i) =>
      (i.status === 1 || i.status === 2) &&
      (!ip || i.proxy_ip === ip)
  ) || order.instances?.[0];

  if (!instance?.instance_no) {
    return {
      message: t(
        lang,
        `订单 ${order.order_no} 没有可续费的实例。`,
        `Order ${order.order_no} has no renewable instances.`
      ),
    };
  }

  const renewOrderId =
    order.app_order_no || order.order_no || '';
  const body = {
    order_id: renewOrderId,
    instances: [
      {
        instanceNo: instance.instance_no,
        duration: durationMonths,
      },
    ],
  };

  const res = (await backendPost(
    '/api/open/app/static/order/renew',
    body,
    user.backendToken
  )) as {
    code: number;
    msg?: string;
    data?: {
      orderNo?: string;
      appOrderNo?: string;
      amount?: number;
    };
  };

  if (res.code !== 0) {
    const errStr = res.msg || '未知错误';
    const rec = helpForFailure(
      'renew_static', errStr, lang
    );
    return {
      message: t(
        lang,
        `续费失败: ${errStr}`,
        `Renewal failed: ${errStr}`
      ) + rec.recoveryHint,
      suggestions: rec.suggestions,
    };
  }

  const ipLabel = instance.proxy_ip || search;
  return {
    message: t(
      lang,
      `✅ 续费成功！\n\n` +
        `• IP: ${ipLabel}\n` +
        `• 续费时长: ${durationMonths} 个月\n` +
        `• 订单号: ${renewOrderId}\n` +
        (res.data?.amount != null
          ? `• 费用: ¥${res.data.amount}`
          : ''),
      `✅ Renewal successful!\n\n` +
        `• IP: ${ipLabel}\n` +
        `• Duration: ${durationMonths} month(s)\n` +
        `• Order: ${renewOrderId}\n` +
        (res.data?.amount != null
          ? `• Cost: ¥${res.data.amount}`
          : '')
    ),
    data: res.data as Record<string, unknown>,
  };
}

export async function executeSetProductPrice(
  slots: Record<string, unknown>,
  user: NLUserContext,
  lang: Lang
): Promise<ExecResult> {
  if (!user.isAdmin && !user.isAgent) {
    return {
      message: t(
        lang,
        '只有管理员和代理商可以设置价格。\n' +
          '管理员可设置全局价格和代理商价格，' +
          '代理商可设置用户价格。',
        'Only admins and agents can set prices.'
      ),
    };
  }

  const productType =
    (slots.product_type as string) || 'static';
  const price = slots.price as number;
  const productId = slots.product_id as string;

  if (!price) {
    return {
      message: t(
        lang,
        '请提供产品ID和价格。\n' +
          '例如：设置产品 PRD001 价格为 50 元',
        'Please provide product ID and price.\n' +
          'Example: set PRD001 to 50 CNY'
      ),
    };
  }

  const adminToken = await getAdminToken();
  const body: Record<string, unknown> = {
    product_id: productId,
    price,
  };

  if (user.isAdmin) {
    const tgtAgent = slots.target_user as string;
    if (tgtAgent) {
      const found = await findUserAcrossRoles(
        tgtAgent,
        adminToken
      );
      if (found) body.agent_id = found.id;
    }
  } else if (user.isAgent) {
    body.agent_id = user.userId;
  }

  const res = (await backendPost(
    '/api/settings/price',
    body,
    adminToken
  )) as { code: number; msg?: string };

  if (res.code !== 0) {
    return {
      message: t(
        lang,
        `设置失败: ${res.msg || '未知错误'}`,
        `Failed: ${res.msg || 'Unknown error'}`
      ),
    };
  }

  return {
    message: t(
      lang,
      `✅ 价格设置成功！${productType} 产品 ` +
        `${productId || ''} 价格: ¥${price}`,
      `✅ Price set! ${productType} product ` +
        `${productId || ''}: ¥${price}`
    ),
    data: {
      product_id: productId,
      price,
      product_type: productType,
    },
  };
}

/* ─── Transactions ─── */

export async function executeQueryTransactions(
  slots: Record<string, unknown>,
  user: NLUserContext,
  lang: Lang
): Promise<ExecResult> {
  let targetUser = slots.target_user as string;
  const page = (slots.page as number) || 1;
  const count = (slots.count as number) || DEFAULT_PAGE_SIZE;
  let search = slots.search as string;
  const dateRange = slots.date_range as {
    start_date?: string;
    end_date?: string;
  } | null;
  const period = slots.period as string | undefined;
  const pageSize = Math.min(count, 100);

  let effStartDate = dateRange?.start_date;
  let effEndDate = dateRange?.end_date;
  if (!effStartDate && period === 'day') {
    const today = new Date()
      .toISOString().slice(0, 10);
    effStartDate = today;
    effEndDate = today;
  }

  const resolved = await resolveTargetUserOrAgent(
    targetUser,
    user
  );
  if (resolved?.error) {
    const failedToken = resolved.error;
    if (isLikelyOrderId(failedToken)) {
      search = search || failedToken;
      targetUser = '';
    } else {
      return {
        message: t(
          lang,
          `未找到用户 ${failedToken}`,
          `User ${failedToken} not found`
        ),
      };
    }
  }
  const who = resolved?.error ? '' : (resolved?.who ?? '');

  let url =
    '/api/open/app/user/transactions' +
    `?page=${page}&page_size=${pageSize}`;
  if (!resolved?.error && resolved?.agentId)
    url += `&agent_id=${resolved.agentId}`;
  else if (!resolved?.error && resolved?.userId)
    url += `&target_user_id=${resolved.userId}`;
  if (search)
    url += `&keyword=${encodeURIComponent(search)}`;
  if (effStartDate)
    url += `&start_date=${effStartDate}`;
  if (effEndDate)
    url += `&end_date=${effEndDate}`;

  interface TxRecord {
    order_no?: string;
    type?: string;
    amount?: number;
    balance?: number;
    created_at?: string;
    remark?: string;
    username?: string;
    user_name?: string;
    is_admin?: boolean;
    is_agent?: boolean;
  }
  const res = (await backendGet(
    url,
    user.backendToken
  )) as {
    code: number;
    data?: {
      list?: TxRecord[];
      items?: TxRecord[];
      total?: number;
    };
  };

  const list =
    res.data?.list ?? res.data?.items ?? [];
  if (!list.length) {
    return {
      message: t(
        lang,
        `${who}暂无交易记录。`,
        `${who}No transactions found.`
      ),
    };
  }

  function fmtTxType(tx: TxRecord): string {
    const raw = (tx.type || '').toLowerCase();
    if (raw === 'consume' || raw === 'consumption') {
      if ((tx as TxRecord & { is_admin?: boolean })
        .is_admin) {
        return t(lang, '管理员消费', 'Admin consume');
      }
      if ((tx as TxRecord & { is_agent?: boolean })
        .is_agent) {
        return t(lang, '代理商消费', 'Agent consume');
      }
      return t(lang, '用户消费', 'User consume');
    }
    const map: Record<string, [string, string]> = {
      recharge: ['充值', 'Recharge'],
      refund: ['退款', 'Refund'],
      admin_refund: ['管理员退款', 'Admin refund'],
      refund_deduction: ['退款扣减', 'Refund deduction'],
      adjust: ['额度调整', 'Adjustment'],
      adjustment: ['额度调整', 'Adjustment'],
      admin_consumption: ['管理员消费', 'Admin consume'],
      agent_consumption: ['代理商消费', 'Agent consume'],
      reconcile: ['对账', 'Reconcile'],
      reconcile_mark: ['对账标记', 'Reconcile mark'],
      force_update: ['强制更新', 'Force update'],
    };
    const v = map[raw];
    return v ? t(lang, v[0], v[1]) : (tx.type || '—');
  }

  function fmtMoney(n?: number): string {
    if (n == null) return '—';
    return `¥${Math.abs(n).toFixed(2)}`;
  }

  function fmtDateTime(v?: string): string {
    if (!v) return '—';
    return v.replace('T', ' ').slice(0, 19);
  }

  const total = res.data?.total ?? list.length;
  const isToday = effStartDate === effEndDate &&
    effStartDate === new Date()
      .toISOString().slice(0, 10);
  const titleDate = isToday
    ? t(lang, '今日', "Today's ")
    : effStartDate
      ? `${effStartDate} `
      : '';
  let msg = t(
    lang,
    `📋 ${who}${titleDate}交易记录（第 ${page} 页）\n\n`,
    `📋 ${who}${titleDate}Transactions (Page ${page})\n\n`
  );
  for (let i = 0; i < list.length; i++) {
    const tx = list[i];
    const idx = (page - 1) * pageSize + i + 1;
    const orderNo = tx.order_no || '—';
    const uName =
      tx.user_name || tx.username || '—';
    const type = fmtTxType(tx);
    const amountStr = fmtMoney(tx.amount);
    const bal = fmtMoney(tx.balance);
    const date = fmtDateTime(tx.created_at);
    const remark = tx.remark || '';

    msg += `${idx}. ${orderNo}\n`;
    if (user.isAdmin || user.isAgent) {
      msg += t(
        lang,
        `用户名：${uName} ${type}\n`,
        `User: ${uName} ${type}\n`
      );
    } else {
      msg += `${type}\n`;
    }
    msg += t(
      lang,
      `消费额：${amountStr}，余额 ${bal}\n`,
      `Amount: ${amountStr}, Balance ${bal}\n`
    );
    if (remark) {
      msg += t(
        lang,
        `备注：${remark}\n`,
        `Remark: ${remark}\n`
      );
    }
    msg += t(
      lang,
      `创建时间：${date}\n`,
      `Created: ${date}\n`
    );
    msg += '\n';
  }

  msg += paginationFooter(
    page, pageSize, total, lang
  );

  return {
    message: msg.trim(),
    data: { transactions: list, total },
  };
}

/* ─── Misc ─── */

interface IpQualityData {
  ip_address: string;
  composite_score: number;
  fraud_score: number;
  abuse_score: number;
  abuse_reports: number;
  vt_malicious: number;
  vt_suspicious: number;
  risk_level: string;
  recommendation: string;
  is_proxy: boolean;
  is_vpn: boolean;
  is_tor: boolean;
  is_bot: boolean;
  recent_abuse: boolean;
  is_datacenter: boolean;
  isp: string;
  asn: number;
  organization: string;
  ip_type: string;
  country: string;
  region: string;
  city: string;
  sources_used: string;
  created_at: string;
  error?: string;
}

function fmtRisk(level: string, lang: Lang): string {
  const map: Record<string, string> = {
    low: lang === 'zh' ? '🟢 低风险' : '🟢 Low',
    medium: lang === 'zh' ? '🟡 中风险' : '🟡 Medium',
    high: lang === 'zh' ? '🔴 高风险' : '🔴 High',
  };
  return map[level] || level;
}

function fmtBool(v: boolean, lang: Lang): string {
  return v
    ? (lang === 'zh' ? '✗ 是' : '✗ Yes')
    : (lang === 'zh' ? '✓ 否' : '✓ No');
}

function fmtRec(
  rec: string, lang: Lang
): string {
  const zhMap: Record<string, string> = {
    excellent: '🟢 优秀',
    good: '🟢 良好',
    fair: '🟡 一般',
    poor: '🟠 较差',
    bad: '🔴 不推荐',
  };
  const enMap: Record<string, string> = {
    excellent: '🟢 Excellent',
    good: '🟢 Good',
    fair: '🟡 Fair',
    poor: '🟠 Poor',
    bad: '🔴 Bad',
  };
  const m = lang === 'zh' ? zhMap : enMap;
  return m[rec] || rec;
}

function fmtSources(
  src: string, lang: Lang
): string {
  if (!src) return '—';
  const names: Record<string, string> = {
    ipqualityscore: 'IPQualityScore',
    abuseipdb: 'AbuseIPDB',
    virustotal: 'VirusTotal',
    ipinfo: 'IPinfo',
    ip2location: 'IP2Location',
  };
  return src
    .split(',')
    .map((s) => names[s.trim()] || s.trim())
    .join(' / ');
}

function fmtIpQuality(
  d: IpQualityData,
  lang: Lang
): string {
  if (d.error) return `${d.ip_address}: ${d.error}`;
  const loc = [d.country, d.region, d.city]
    .filter(Boolean)
    .join(' / ');
  const srcStr = fmtSources(
    d.sources_used || '', lang
  );

  const flags: string[] = [];
  if (d.is_proxy)
    flags.push(t(lang, '代理', 'Proxy'));
  if (d.is_vpn) flags.push('VPN');
  if (d.is_tor) flags.push('TOR');
  if (d.is_bot) flags.push('Bot');
  if (d.recent_abuse)
    flags.push(t(lang, '近期滥用', 'Abuse'));
  if (d.is_datacenter)
    flags.push(t(lang, '数据中心', 'DC'));
  const flagStr = flags.length
    ? flags.join(' / ')
    : t(lang, '无', 'None');

  const cs = d.composite_score ?? '—';
  const fs = d.fraud_score ?? '—';
  const as2 = d.abuse_score ?? '—';
  const ar = d.abuse_reports ?? '—';
  const vm = d.vt_malicious ?? 0;
  const vs = d.vt_suspicious ?? 0;

  if (lang === 'zh') {
    return (
      `🔍 IP 综合质量报告: ${d.ip_address}\n` +
      `━━━━━━━━━━━━━━━━━━━━━━━━\n\n` +
      `📊 综合评估\n` +
      `  综合评分: ${cs}/100 (越低越好)\n` +
      `  风险等级: ${fmtRisk(d.risk_level, lang)}\n` +
      `  采购建议: ${fmtRec(d.recommendation, lang)}\n\n` +
      `🚩 风险标志: ${flagStr}\n\n` +
      `📈 各源评分\n` +
      `  IPQualityScore 欺诈分: ${fs}/100\n` +
      `  AbuseIPDB 滥用置信度: ${as2}%` +
      ` (举报${ar}次)\n` +
      `  VirusTotal: ${vm}个恶意` +
      ` / ${vs}个可疑\n\n` +
      `🌐 网络信息\n` +
      `  ISP: ${d.isp || '—'}\n` +
      `  ASN: ${d.asn || '—'}\n` +
      `  组织: ${d.organization || '—'}\n` +
      (d.ip_type
        ? `  IP类型: ${d.ip_type}\n`
        : '') +
      `  位置: ${loc || '—'}\n\n` +
      `📋 信息来源: ${srcStr}\n` +
      `⏱ 查询时间: ${d.created_at || '—'}\n\n` +
      `⚠️ 检测网站数据可能存在延迟，结果仅供参考。`
    );
  }
  return (
    `🔍 IP Quality Report: ${d.ip_address}\n` +
    `━━━━━━━━━━━━━━━━━━━━━━━━\n\n` +
    `📊 Overall Assessment\n` +
    `  Score: ${cs}/100 (lower is better)\n` +
    `  Risk: ${fmtRisk(d.risk_level, lang)}\n` +
    `  Verdict: ${fmtRec(d.recommendation, lang)}\n\n` +
    `🚩 Flags: ${flagStr}\n\n` +
    `📈 Source Scores\n` +
    `  IPQualityScore Fraud: ${fs}/100\n` +
    `  AbuseIPDB Confidence: ${as2}%` +
    ` (${ar} reports)\n` +
    `  VirusTotal: ${vm} malicious` +
    ` / ${vs} suspicious\n\n` +
    `🌐 Network\n` +
    `  ISP: ${d.isp || '—'}\n` +
    `  ASN: ${d.asn || '—'}\n` +
    `  Org: ${d.organization || '—'}\n` +
    (d.ip_type ? `  Type: ${d.ip_type}\n` : '') +
    `  Location: ${loc || '—'}\n\n` +
    `📋 Sources: ${srcStr}\n` +
    `⏱ Checked: ${d.created_at || '—'}\n\n` +
    `⚠️ Detection data may be delayed; ` +
    `results are for reference only.`
  );
}

export async function executeCheckIpQuality(
  slots: Record<string, unknown>,
  user: NLUserContext,
  lang: Lang
): Promise<ExecResult> {
  const ip = slots.ip_segment as string | undefined;
  if (!ip) {
    return {
      message: t(
        lang,
        '请提供要检测的 IP 地址。\n例如：查询 2.3.4.5 的质量',
        'Please provide an IP.\ne.g.: check quality of 2.3.4.5'
      ),
    };
  }

  const res = (await backendGet(
    `/api/ip-quality/check?ip=${encodeURIComponent(ip)}`,
    user.backendToken
  )) as {
    code: number;
    msg?: string;
    data?: IpQualityData;
    cached?: boolean;
  };

  if (res.code !== 0 || !res.data) {
    return {
      message: t(
        lang,
        `IP 质量检测失败: ${res.msg || '未知错误'}`,
        `IP quality check failed: ${res.msg || 'Unknown error'}`
      ),
    };
  }

  const cacheTag = res.cached
    ? t(lang, '\n\n(结果来自缓存)', '\n\n(Cached result)')
    : '';
  return {
    message: fmtIpQuality(res.data, lang) + cacheTag,
    data: res.data as unknown as Record<string, unknown>,
  };
}

export async function executeFindBestIp(
  slots: Record<string, unknown>,
  user: NLUserContext,
  lang: Lang
): Promise<ExecResult> {
  const country = (slots.country as string) || '';
  const city = (slots.city as string) || '';
  const maxCheck = (slots.max_check as number) || 5;

  if (!country && !city) {
    return {
      message: t(
        lang,
        '请指定要查找的地区。\n例如：开通一个美国质量最好的IP',
        'Please specify a region.\ne.g.: open the best quality US IP'
      ),
    };
  }

  const productRes = await executeQueryStaticProducts(
    { country, city, sort: 'price_asc' },
    user,
    lang
  );
  const products = (
    productRes.data?.products as PriceItem[] | undefined
  ) || [];

  if (!products.length) {
    const loc = city
      ? codeToName(city)
      : countryCodeToName(country);
    return {
      message: t(
        lang,
        `未找到 ${loc} 的可用 IP 产品。`,
        `No available IPs in ${loc}.`
      ),
    };
  }

  const ipCandidates: string[] = [];
  for (const p of products) {
    if (ipCandidates.length >= maxCheck) break;
    if (p.ipRangePrices?.length) {
      for (const rp of p.ipRangePrices) {
        if (ipCandidates.length >= maxCheck) break;
        const base = rp.ipRange?.split('/')[0];
        if (base) {
          const testIp = base.replace(/\.0$/, '.1');
          ipCandidates.push(testIp);
        }
      }
    }
  }

  if (!ipCandidates.length) {
    return {
      message: t(
        lang,
        '未找到可检测的 IP 段。',
        'No IP ranges available for quality check.'
      ),
    };
  }

  const costHint = t(
    lang,
    `⚠️ 即将对 ${ipCandidates.length} 个 IP ` +
      `进行多源质量检测（IPQualityScore / ` +
      `AbuseIPDB / VirusTotal / IPinfo / ` +
      `IP2Location），可能产生 API 费用。\n\n` +
      `正在检测中...`,
    `⚠️ Checking ${ipCandidates.length} IPs ` +
      `across 5 sources (may incur costs).\n\n` +
      `Checking...`
  );

  const qualityResults: IpQualityData[] = [];
  for (const testIp of ipCandidates) {
    const qRes = (await backendGet(
      `/api/ip-quality/check?ip=` +
        `${encodeURIComponent(testIp)}`,
      user.backendToken
    )) as {
      code: number;
      data?: IpQualityData;
    };
    if (qRes.code === 0 && qRes.data) {
      qualityResults.push(qRes.data);
    }
  }

  if (!qualityResults.length) {
    return {
      message: t(
        lang,
        'IP 质量检测全部失败，请稍后重试。',
        'All quality checks failed. Please try later.'
      ),
    };
  }

  qualityResults.sort(
    (a, b) =>
      (a.composite_score ?? 100) -
      (b.composite_score ?? 100)
  );
  const best = qualityResults[0];
  const locName = city
    ? codeToName(city)
    : countryCodeToName(country);

  let msg = t(
    lang,
    `🏆 ${locName} 质量最好的 IP:\n\n`,
    `🏆 Best quality IP in ${locName}:\n\n`
  );
  msg += fmtIpQuality(best, lang);
  msg += '\n\n';

  if (qualityResults.length > 1) {
    msg += t(
      lang,
      `📊 所有检测结果排名（综合评分从低到高）:\n\n`,
      `📊 All results (lowest score first):\n\n`
    );
    for (const r of qualityResults) {
      const cs = r.composite_score ?? '—';
      msg +=
        `• ${r.ip_address}  ` +
        `${t(lang, '综合', 'Score')}: ${cs}  ` +
        `${fmtRec(r.recommendation, lang)}\n`;
    }
  }

  const bestBase = best.ip_address
    .replace(/\.\d+$/, '.0');
  msg += t(
    lang,
    `\n如需开通，请输入：开通一个 ${bestBase} 的 IP`,
    `\nTo provision: open ${bestBase}`
  );

  return {
    message: costHint + '\n\n' + msg,
    data: {
      best: best as unknown as Record<string, unknown>,
      all: qualityResults,
    },
    suggestions: [
      t(
        lang,
        `开通一个 ${bestBase} 的 IP，30天`,
        `Open ${bestBase}, 30 days`
      ),
    ],
  };
}

/* ═══════════════════════════════════════════════
   复合意图 executors
   ═══════════════════════════════════════════════ */

export async function executeFindAndEvaluateIps(
  slots: Record<string, unknown>,
  user: NLUserContext,
  lang: Lang
): Promise<ExecResult> {
  const ctx =
    (slots._searchContext as SearchContext) ||
    undefined;

  const queryResult = await executeQueryStaticProducts(
    slots, user, lang
  );
  const products =
    (queryResult.data?.products as PriceItem[]) || [];

  if (!products.length) return queryResult;

  if (ctx) {
    ctx.lastResultSet = products as unknown as
      Array<Record<string, unknown>>;
    ctx.lastFilters = {
      country: slots.country as string | undefined,
      city: slots.city as string | undefined,
      quality: slots.quality as string | undefined,
      qualityMin: slots.qualityMin as
        number | undefined,
      sort: slots.sort as string | undefined,
    };
    ctx.mode = 'evaluating';
    ctx.currentPage = 0;
    ctx.shownIds = [];
  }

  const maxCheck = Math.min(
    (slots.quantity as number) || 5, 10
  );
  const ipCandidates: Array<{
    ip: string;
    product: PriceItem;
  }> = [];
  for (const p of products) {
    if (ipCandidates.length >= maxCheck) break;
    if (p.ipRangePrices?.length) {
      for (const rp of p.ipRangePrices) {
        if (ipCandidates.length >= maxCheck) break;
        const base = rp.ipRange?.split('/')[0];
        if (base) {
          ipCandidates.push({
            ip: base.replace(/\.0$/, '.1'),
            product: p,
          });
        }
      }
    }
  }

  if (!ipCandidates.length) return queryResult;

  let msg = t(
    lang,
    `🔍 正在评估 ${ipCandidates.length} 个候选 IP 质量...\n\n`,
    `🔍 Evaluating ${ipCandidates.length} candidate IPs...\n\n`
  );

  const results: Array<{
    ip: string;
    product: PriceItem;
    quality: IpQualityData | null;
  }> = [];

  for (const c of ipCandidates) {
    const qRes = (await backendGet(
      `/api/ip-quality/check?ip=` +
        `${encodeURIComponent(c.ip)}`,
      user.backendToken
    )) as {
      code: number;
      data?: IpQualityData;
    };
    results.push({
      ip: c.ip,
      product: c.product,
      quality:
        qRes.code === 0 ? (qRes.data ?? null) : null,
    });
  }

  const qualityMin =
    (slots.qualityMin as number) || 0;
  const scored = results
    .filter((r) => r.quality !== null)
    .sort((a, b) => {
      const sa = a.quality!.composite_score ?? 100;
      const sb = b.quality!.composite_score ?? 100;
      return sa - sb;
    });

  if (ctx) {
    ctx.qualityResults =
      scored as unknown as
        Array<Record<string, unknown>>;
  }

  if (!scored.length) {
    msg += t(
      lang,
      '⚠️ 质量检测全部失败\n\n',
      '⚠️ All quality checks failed\n\n'
    );
    msg += queryResult.message;
    return { message: msg };
  }

  msg += t(
    lang,
    `📊 质量评估结果（综合评分从低到高 = 越好）:\n\n`,
    `📊 Quality results (lower score = better):\n\n`
  );

  const suggestions: string[] = [];
  for (let i = 0; i < scored.length; i++) {
    const r = scored[i];
    const q = r.quality!;
    const cs = q.composite_score ?? '—';
    const rec = q.recommendation || '';
    const loc = fmtLocation(r.product);
    const price = fmtPrice(r.product, user, lang);
    const pass =
      qualityMin > 0 &&
      typeof cs === 'number' &&
      cs <= qualityMin;
    const badge = pass ? '✅' : '';
    msg +=
      `${i + 1}. ${r.ip} ${badge}\n` +
      `   ${loc}  ${price}\n` +
      `   ${t(lang, '综合', 'Score')}: ${cs}  ` +
      `${fmtRec(rec, lang)}\n\n`;

    if (i === 0) {
      const base = r.ip.replace(/\.\d+$/, '.0');
      suggestions.push(
        t(
          lang,
          `开通 ${base} 的 IP，30天`,
          `Open ${base}, 30 days`
        )
      );
    }
  }

  suggestions.push(
    t(lang, '下一批', 'next batch'),
    t(
      lang,
      '换便宜一点的',
      'switch to cheaper'
    )
  );

  return {
    message: msg.trim(),
    data: {
      qualityResults: scored,
      products,
      total: products.length,
    },
    suggestions,
  };
}

export async function executeRefineSearchResults(
  slots: Record<string, unknown>,
  user: NLUserContext,
  lang: Lang
): Promise<ExecResult> {
  const ctx =
    slots._searchContext as SearchContext | undefined;

  if (
    !ctx ||
    (ctx.lastResultSet.length === 0 &&
      ctx.mode === 'idle')
  ) {
    return {
      message: t(
        lang,
        '没有正在进行的搜索。请先告诉我你想查找什么，例如：\n' +
          '- 帮我找纽约的IP\n' +
          '- 查一下美国住宅IP',
        'No active search. Please start by saying:\n' +
          '- Find IPs in New York\n' +
          '- Search US residential IPs'
      ),
      suggestions: [
        t(
          lang,
          '帮我找美国的IP',
          'Find US IPs'
        ),
      ],
    };
  }

  const quality =
    (slots.quality as string) ||
    ctx.lastFilters.quality;
  const qualityMin =
    (slots.qualityMin as number) ||
    ctx.lastFilters.qualityMin;
  const sort =
    (slots.sort as string) ||
    ctx.lastFilters.sort;
  const qty =
    (slots.quantity as number) ||
    ctx.lastFilters.quantity ||
    5;

  if (quality) ctx.lastFilters.quality = quality;
  if (qualityMin)
    ctx.lastFilters.qualityMin = qualityMin;
  if (sort) ctx.lastFilters.sort = sort;
  ctx.lastFilters.quantity = qty;

  ctx.currentPage += 1;

  const allProducts =
    ctx.lastResultSet as unknown as PriceItem[];
  const shown = new Set(ctx.shownIds);
  let remaining = allProducts.filter(
    (p) =>
      !shown.has(p.product_no || '') &&
      !ctx.rejectedIds.includes(p.product_no || '')
  );

  if (quality === 'residential') {
    remaining = remaining.filter(
      (p) => (p.proxyType ?? 0) === 101
    );
  } else if (quality === 'datacenter') {
    remaining = remaining.filter(
      (p) => (p.proxyType ?? 0) === 103
    );
  }

  if (sort === 'price_asc') {
    remaining.sort(
      (a, b) => (a.price ?? 0) - (b.price ?? 0)
    );
  } else if (sort === 'price_desc') {
    remaining.sort(
      (a, b) => (b.price ?? 0) - (a.price ?? 0)
    );
  }

  const batch = remaining.slice(0, qty);

  if (!batch.length) {
    ctx.mode = 'idle';
    return {
      message: t(
        lang,
        '已没有更多符合条件的产品了。\n' +
          '你可以换一个地区或调整筛选条件。',
        'No more matching products.\n' +
          'Try a different region or adjust filters.'
      ),
      suggestions: [
        t(lang, '换个地区', 'Change region'),
        t(lang, '重新搜索', 'Search again'),
      ],
    };
  }

  for (const p of batch) {
    if (p.product_no) ctx.shownIds.push(p.product_no);
  }
  ctx.mode = 'refining';

  let msg = t(
    lang,
    `📦 第 ${ctx.currentPage + 1} 批结果` +
      `（${batch.length} 个）:\n\n`,
    `📦 Batch ${ctx.currentPage + 1}` +
      ` (${batch.length}):\n\n`
  );

  for (const p of batch) {
    const loc = fmtLocation(p);
    const stock = p.stock ?? 0;
    const price = fmtPrice(p, user, lang);
    msg += `${loc}\n`;
    msg +=
      `${t(lang, '库存', 'Stock')}: ${stock}  ` +
      `${price}\n\n`;
  }

  const moreCount = remaining.length - batch.length;
  if (moreCount > 0) {
    msg += t(
      lang,
      `还有 ${moreCount} 个产品可查看\n`,
      `${moreCount} more available\n`
    );
  }

  return {
    message: msg.trim(),
    data: { products: batch, total: remaining.length },
    suggestions: [
      t(lang, '下一批', 'next batch'),
      t(lang, '这批不行', 'reject this batch'),
      t(lang, '评估质量', 'check quality'),
    ],
  };
}

export async function executeRecommendBestMatch(
  slots: Record<string, unknown>,
  user: NLUserContext,
  lang: Lang
): Promise<ExecResult> {
  const purpose =
    (slots.purpose as string) || 'general';

  const queryResult = await executeQueryStaticProducts(
    slots, user, lang
  );
  const products =
    (queryResult.data?.products as PriceItem[]) || [];

  if (!products.length) return queryResult;

  const maxCheck = Math.min(
    (slots.quantity as number) || 5, 8
  );
  const candidates: Array<{
    ip: string;
    product: PriceItem;
  }> = [];
  for (const p of products) {
    if (candidates.length >= maxCheck) break;
    if (p.ipRangePrices?.length) {
      for (const rp of p.ipRangePrices) {
        if (candidates.length >= maxCheck) break;
        const base = rp.ipRange?.split('/')[0];
        if (base) {
          candidates.push({
            ip: base.replace(/\.0$/, '.1'),
            product: p,
          });
        }
      }
    }
  }

  if (!candidates.length) return queryResult;

  type ScoredCandidate = {
    ip: string;
    product: PriceItem;
    quality: IpQualityData | null;
    matchScore: number;
  };

  const scored: ScoredCandidate[] = [];
  for (const c of candidates) {
    const qRes = (await backendGet(
      `/api/ip-quality/check?ip=` +
        `${encodeURIComponent(c.ip)}`,
      user.backendToken
    )) as {
      code: number;
      data?: IpQualityData;
    };
    const q = qRes.code === 0 ? (qRes.data ?? null) : null;
    let matchScore = 50;

    if (q) {
      const cs = q.composite_score ?? 50;
      matchScore = 100 - cs;
      if (
        purpose === 'tiktok' ||
        purpose === 'instagram'
      ) {
        if (q.is_datacenter) matchScore -= 30;
        if (!q.is_proxy) matchScore += 10;
      }
      if (purpose === 'scraping') {
        if (!q.recent_abuse) matchScore += 10;
      }
      if (
        purpose === 'amazon' ||
        purpose === 'ecommerce'
      ) {
        if (q.is_datacenter) matchScore -= 20;
        if (q.fraud_score < 30) matchScore += 15;
      }
    }

    const price = c.product.price ?? 999;
    matchScore -= price * 0.01;

    scored.push({
      ip: c.ip,
      product: c.product,
      quality: q,
      matchScore,
    });
  }

  scored.sort(
    (a, b) => b.matchScore - a.matchScore
  );

  const purposeLabel =
    PURPOSE_LABELS[lang][purpose] || purpose;

  let msg = t(
    lang,
    `🎯 适合「${purposeLabel}」的推荐 IP:\n\n`,
    `🎯 Recommended IPs for "${purposeLabel}":\n\n`
  );

  const suggestions: string[] = [];
  for (let i = 0; i < scored.length; i++) {
    const r = scored[i];
    const loc = fmtLocation(r.product);
    const price = fmtPrice(r.product, user, lang);
    const cs = r.quality?.composite_score ?? '—';
    const rec = r.quality?.recommendation || '';
    msg +=
      `${i + 1}. ${r.ip}\n` +
      `   ${loc}  ${price}\n` +
      `   ${t(lang, '综合', 'Score')}: ${cs}  ` +
      `${fmtRec(rec, lang)}  ` +
      `${t(lang, '匹配度', 'Match')}: ` +
      `${Math.round(r.matchScore)}\n\n`;

    if (i === 0) {
      const base = r.ip.replace(/\.\d+$/, '.0');
      suggestions.push(
        t(
          lang,
          `开通 ${base} 的 IP，30天`,
          `Open ${base}, 30 days`
        )
      );
    }
  }

  suggestions.push(
    t(lang, '下一批', 'next batch'),
    t(lang, '换个地区', 'change region')
  );

  return {
    message: msg.trim(),
    data: { scored, total: products.length },
    suggestions,
  };
}

const PURPOSE_LABELS: Record<
  string,
  Record<string, string>
> = {
  zh: {
    general: '通用',
    tiktok: 'TikTok',
    amazon: '亚马逊',
    scraping: '爬虫/采集',
    ads: '广告投放',
    registration: '账号注册',
    google: 'Google',
    facebook: 'Facebook',
    instagram: 'Instagram',
    twitter: 'Twitter/X',
    youtube: 'YouTube',
    ecommerce: '电商',
  },
  en: {
    general: 'General',
    tiktok: 'TikTok',
    amazon: 'Amazon',
    scraping: 'Scraping',
    ads: 'Advertising',
    registration: 'Registration',
    google: 'Google',
    facebook: 'Facebook',
    instagram: 'Instagram',
    twitter: 'Twitter/X',
    youtube: 'YouTube',
    ecommerce: 'E-commerce',
  },
};

export async function executePurchaseIp(
  slots: Record<string, unknown>,
  user: NLUserContext,
  lang: Lang
): Promise<ExecResult> {
  return executePurchaseStatic(slots, user, lang);
}

export async function executeCreateSession(
  slots: Record<string, unknown>,
  user: NLUserContext,
  lang: Lang
): Promise<ExecResult> {
  return executePurchaseDynamic(slots, user, lang);
}

/**
 * Agent geo-mapping uses ISO3 (USA/GBR/JPN) but
 * IPWEB backend _generate_ipweb_proxy_info uses
 * ISO2 codes (US/GB/JP) via _convert_chinese_to_
 * country_code. This map converts Agent ISO3 →
 * IPWEB ISO2 to match backend/frontend behavior.
 */
const ISO3_TO_ISO2: Record<string, string> = {
  USA: 'US', GBR: 'GB', JPN: 'JP',
  KOR: 'KR', DEU: 'DE', FRA: 'FR',
  AUS: 'AU', SGP: 'SG', CAN: 'CA',
  BRA: 'BR', IND: 'IN', CHN: 'CN',
  HKG: 'HK', TWN: 'TW', RUS: 'RU',
  ESP: 'ES', ITA: 'IT', MEX: 'MX',
  PHL: 'PH', VNM: 'VN', THA: 'TH',
  MYS: 'MY', IDN: 'ID', ARE: 'AE',
  TUR: 'TR', NLD: 'NL', POL: 'PL',
  IRL: 'IE', CHE: 'CH', NOR: 'NO',
  SWE: 'SE', DNK: 'DK', FIN: 'FI',
  UKR: 'UA', BEL: 'BE', AUT: 'AT',
  PRT: 'PT', GRC: 'GR', CZE: 'CZ',
  HUN: 'HU', ROU: 'RO', BGR: 'BG',
  LVA: 'LV', LTU: 'LT', EST: 'EE',
  HRV: 'HR', SRB: 'RS', PAK: 'PK',
  BGD: 'BD', KAZ: 'KZ', MMR: 'MM',
  KHM: 'KH', LKA: 'LK', NPL: 'NP',
  ISR: 'IL', SAU: 'SA', QAT: 'QA',
  KWT: 'KW', IRQ: 'IQ', IRN: 'IR',
  JOR: 'JO', LBN: 'LB', EGY: 'EG',
  ZAF: 'ZA', NGA: 'NG', KEN: 'KE',
  GHA: 'GH', NZL: 'NZ', ARG: 'AR',
  CHL: 'CL', COL: 'CO', PER: 'PE',
  DOM: 'DO', PAN: 'PA', CRI: 'CR',
  JAM: 'JM', AGO: 'AO', MOZ: 'MZ',
  LAO: 'LA', ALB: 'AL', BLR: 'BY',
  MDA: 'MD', GEO: 'GE', ARM: 'AM',
  ISL: 'IS', MLT: 'MT', CYP: 'CY',
  LUX: 'LU', UZB: 'UZ',
};

const CN_TO_ISO2: Record<string, string> = {
  '美国': 'US', '英国': 'GB', '日本': 'JP',
  '韩国': 'KR', '德国': 'DE', '法国': 'FR',
  '澳大利亚': 'AU', '新加坡': 'SG',
  '加拿大': 'CA', '巴西': 'BR', '印度': 'IN',
  '中国': 'CN', '香港': 'HK', '台湾': 'TW',
  '俄罗斯': 'RU', '西班牙': 'ES',
  '意大利': 'IT', '墨西哥': 'MX',
  '菲律宾': 'PH', '越南': 'VN',
  '泰国': 'TH', '马来西亚': 'MY',
  '印尼': 'ID', '印度尼西亚': 'ID',
  '阿联酋': 'AE', '土耳其': 'TR',
  '荷兰': 'NL', '波兰': 'PL',
  '爱尔兰': 'IE', '瑞士': 'CH',
  '挪威': 'NO', '瑞典': 'SE',
  '丹麦': 'DK', '乌克兰': 'UA',
  '南非': 'ZA', '埃及': 'EG',
  '新西兰': 'NZ', '以色列': 'IL',
  '沙特': 'SA', '沙特阿拉伯': 'SA',
};

function toIpwebCountryCode(raw: string): string {
  const v = raw.trim();
  if (!v) return '';
  const up = v.toUpperCase();
  if (up.length === 2) return up;
  if (ISO3_TO_ISO2[up]) return ISO3_TO_ISO2[up];
  if (CN_TO_ISO2[v]) return CN_TO_ISO2[v];
  return up;
}

/**
 * Convert backend user:pass@host:port →
 * frontend default host:port:user:pass.
 */
function toHostPortUserPass(line: string): string {
  const raw = line.trim();
  if (!raw) return '';

  const atIdx = raw.lastIndexOf('@');
  if (atIdx > 0) {
    const userPass = raw.slice(0, atIdx);
    const hostPort = raw.slice(atIdx + 1);
    const hpParts = hostPort.split(':');
    if (hpParts.length >= 2) {
      const host = hpParts[0];
      const port = hpParts.slice(1).join(':');
      return `${host}:${port}:${userPass}`;
    }
  }

  return raw;
}

export async function executeExtractDynamic(
  slots: Record<string, unknown>,
  user: NLUserContext,
  lang: Lang
): Promise<ExecResult> {
  const targetUserName =
    (slots.target_user as string) || '';
  const rawCountry =
    (slots.country as string) || '';
  const rawCity = (slots.city as string) || '';
  const qty = Number(slots.quantity) || 1;
  const validTime =
    Number(slots.valid_time) || 5;
  const method =
    (slots.method as string) || 'password';
  const timeMode =
    (slots.time_mode as string) || 'specified';

  const country = toIpwebCountryCode(rawCountry);

  let targetUsername = user.username;
  let targetUserId = user.userId;

  if (targetUserName) {
    const adminToken = await getAdminToken();
    const found = await findUserAcrossRoles(
      targetUserName,
      adminToken
    );
    if (!found) {
      return {
        message: t(
          lang,
          `未找到用户 ${targetUserName}`,
          `User ${targetUserName} not found`
        ),
      };
    }
    targetUserId = found.id;
    targetUsername =
      found.username ?? targetUserName;
  }

  const extractCfg: Record<string, unknown> = {
    method,
    protocol: 'socks5',
    dataFormat: 'txt',
    delimiter: 1,
    quantity: qty,
    validTime,
    timeMode,
    ipwebCountry: country || undefined,
    ipwebState: undefined,
    ipwebCity: rawCity || undefined,
  };

  const body: Record<string, unknown> = {
    userId: targetUserId,
    username: targetUsername,
    productNo: 'dynamic_ipweb',
    proxyType: 104,
    flow: 0,
    maxFlowLimit: 0,
    unitPrice: 0,
    totalAmount: 0,
    extractConfig: extractCfg,
  };

  const res = (await backendPost(
    '/api/business/dynamic-proxy/extract',
    body,
    user.backendToken
  )) as {
    code: number;
    data?: {
      proxy?: {
        url?: string;
        list?: string[];
        proxyUrl?: string;
        message?: string;
      };
    };
    msg?: string;
  };

  if (res.code !== 0) {
    const errStr = res.msg || '未知错误';
    const rec = helpForFailure(
      'extract_dynamic', errStr, lang
    );
    return {
      message: t(
        lang,
        `提取失败: ${errStr}`,
        `Extraction failed: ${errStr}`
      ) + rec.recoveryHint,
      suggestions: rec.suggestions,
    };
  }

  const proxy = res.data?.proxy;
  let proxyInfo = '';
  if (proxy?.list?.length) {
    proxyInfo = proxy.list
      .map((l) => toHostPortUserPass(l))
      .filter(Boolean)
      .join('\n');
  } else if (proxy?.url || proxy?.proxyUrl) {
    proxyInfo = toHostPortUserPass(
      proxy.url || proxy.proxyUrl || ''
    );
  }

  if (!proxyInfo) {
    return {
      message: t(
        lang,
        '提取成功，但未返回代理信息。' +
          '请确认用户已开通动态代理。',
        'Extraction succeeded but no proxy ' +
          'info returned.'
      ),
    };
  }

  const mLabel =
    method === 'api'
      ? t(lang, 'API提取', 'API')
      : t(lang, '账密提取', 'Password');

  return {
    message: t(
      lang,
      `✅ 动态代理提取成功！\n\n` +
        `• 用户: ${targetUsername}\n` +
        `• 提取方式: ${mLabel}\n` +
        `• 数量: ${qty}\n` +
        `• 有效时长: ${validTime}分钟\n` +
        (country
          ? `• 地区: ${country}\n`
          : '') +
        `• 代理信息:\n${proxyInfo}`,
      `✅ Dynamic proxy extracted!\n\n` +
        `• User: ${targetUsername}\n` +
        `• Method: ${mLabel}\n` +
        `• Quantity: ${qty}\n` +
        `• Valid: ${validTime} min\n` +
        (country
          ? `• Region: ${country}\n`
          : '') +
        `• Proxy:\n${proxyInfo}`
    ),
    data: res.data as Record<string, unknown>,
  };
}

export async function executeQueryExpiringIps(
  slots: Record<string, unknown>,
  user: NLUserContext,
  lang: Lang
): Promise<ExecResult> {
  const targetUserName =
    (slots.target_user as string) || '';

  const token = user.backendToken;
  let qp = '?page=1&pageSize=50' +
    '&skip_statistics=true&status=active';

  if (
    targetUserName &&
    (user.isAdmin || user.isAgent)
  ) {
    qp += `&username=${encodeURIComponent(
      targetUserName
    )}`;
  }

  const res = (await backendGet(
    `/api/open/app/static/order/list/v2${qp}`,
    token
  )) as {
    code: number;
    data?: {
      list?: Array<{
        order_no?: string;
        status?: string;
        instances?: Array<{
          proxy_ip?: string;
          proxy_port?: number;
          username?: string;
          password?: string;
          expire_time?: string;
          created_at?: string;
        }>;
        country_code?: string;
        city_code?: string;
        proxy_type?: number;
      }>;
    };
    msg?: string;
  };

  if (res.code !== 0 || !res.data?.list?.length) {
    return {
      message: t(
        lang,
        '未查询到活跃的静态代理订单。',
        'No active static proxy orders found.'
      ),
    };
  }

  type ExpItem = {
    ip: string;
    port: number;
    user: string;
    pwd: string;
    expire: string;
    orderNo: string;
  };

  const expiring: ExpItem[] = [];
  for (const o of res.data.list) {
    if (!o.instances?.length) continue;
    for (const inst of o.instances) {
      if (!inst.expire_time) continue;
      expiring.push({
        ip: inst.proxy_ip || '—',
        port: inst.proxy_port ?? 0,
        user: inst.username || '—',
        pwd: inst.password || '—',
        expire: inst.expire_time,
        orderNo: o.order_no || '—',
      });
    }
  }

  if (!expiring.length) {
    return {
      message: t(
        lang,
        '没有即将到期的IP。',
        'No IPs are expiring soon.'
      ),
    };
  }

  expiring.sort(
    (a, b) =>
      new Date(a.expire).getTime() -
      new Date(b.expire).getTime()
  );

  const total = expiring.length;
  const page = (slots.page as number) || 1;
  const count = (slots.count as number) || DEFAULT_PAGE_SIZE;
  const pageSize = Math.min(count, 50);
  const start = (page - 1) * pageSize;
  const slice = expiring.slice(
    start, start + pageSize
  );

  let msg = t(
    lang,
    `⏰ 到期IP列表（第 ${page} 页）\n\n`,
    `⏰ Expiring IPs (Page ${page})\n\n`
  );

  for (let i = 0; i < slice.length; i++) {
    const item = slice[i];
    const idx = start + i + 1;
    const proxy =
      `${item.ip}:${item.port}:` +
      `${item.user}:${item.pwd}`;
    const expDate = item.expire
      .replace('T', ' ').slice(0, 16);
    msg += `${idx}. ${proxy}\n`;
    msg += `   ${t(lang, '到期', 'Exp')}: ` +
      `${expDate}` +
      `  |  ${t(lang, '订单', 'Order')}: ` +
      `${item.orderNo}\n`;
  }

  msg += paginationFooter(
    page, pageSize, total, lang
  );

  return {
    message: msg.trim(),
    data: { total },
  };
}

/* ─── Single IP Info Query ─── */

export async function executeQueryIpInfo(
  slots: Record<string, unknown>,
  user: NLUserContext,
  lang: Lang
): Promise<ExecResult> {
  const ip = (slots.ip as string) || '';
  if (!ip) {
    return {
      message: t(
        lang,
        '请提供要查询的 IP 地址。\n' +
          '例如：160.250.198.41什么时候到期',
        'Please provide an IP address.\n' +
          'Example: when does 160.250.198.41 expire'
      ),
    };
  }

  const token = user.backendToken;
  const qp =
    '?page=1&pageSize=200' +
    '&skip_statistics=true&status=active';

  const res = (await backendGet(
    `/api/open/app/static/order/list/v2${qp}`,
    token
  )) as {
    code: number;
    data?: {
      list?: Array<{
        order_no?: string;
        status?: string;
        instances?: Array<{
          proxy_ip?: string;
          proxy_port?: number;
          username?: string;
          password?: string;
          expire_time?: string;
          created_at?: string;
        }>;
        country_code?: string;
        city_code?: string;
        proxy_type?: number;
      }>;
    };
    msg?: string;
  };

  if (res.code !== 0 || !res.data?.list?.length) {
    return {
      message: t(
        lang,
        `未找到 IP ${ip} 的相关订单信息。`,
        `No order info found for IP ${ip}.`
      ),
    };
  }

  type IpMatch = {
    ip: string;
    port: number;
    user: string;
    pwd: string;
    expire: string;
    created: string;
    orderNo: string;
    country: string;
    city: string;
  };

  const matches: IpMatch[] = [];
  for (const o of res.data.list) {
    if (!o.instances?.length) continue;
    for (const inst of o.instances) {
      if (inst.proxy_ip === ip) {
        matches.push({
          ip: inst.proxy_ip,
          port: inst.proxy_port ?? 0,
          user: inst.username || '—',
          pwd: inst.password || '—',
          expire: inst.expire_time || '—',
          created: inst.created_at || '—',
          orderNo: o.order_no || '—',
          country: o.country_code || '—',
          city: o.city_code || '—',
        });
      }
    }
  }

  if (matches.length === 0) {
    return {
      message: t(
        lang,
        `未找到 IP ${ip}，该 IP 可能不属于` +
          '您的订单或已过期。',
        `IP ${ip} not found. It may not belong ` +
          'to your orders or has expired.'
      ),
      suggestions: lang === 'zh'
        ? ['查看我的到期IP', '查看静态订单']
        : ['Show expiring IPs', 'Show static orders'],
    };
  }

  const lines: string[] = [];
  lines.push(t(
    lang,
    `🔍 IP ${ip} 信息：\n`,
    `🔍 IP ${ip} Info:\n`
  ));

  for (const m of matches) {
    const expDate = m.expire
      .replace('T', ' ').slice(0, 16);
    const creDate = m.created
      .replace('T', ' ').slice(0, 16);
    const now = Date.now();
    const expMs = new Date(m.expire).getTime();
    const daysLeft = Math.ceil(
      (expMs - now) / 86400000
    );

    let status: string;
    if (daysLeft < 0) {
      status = t(lang, '❌ 已过期', '❌ Expired');
    } else if (daysLeft <= 3) {
      status = t(
        lang,
        `⚠️ ${daysLeft} 天后到期`,
        `⚠️ Expires in ${daysLeft}d`
      );
    } else if (daysLeft <= 7) {
      status = t(
        lang,
        `🟡 ${daysLeft} 天后到期`,
        `🟡 Expires in ${daysLeft}d`
      );
    } else {
      status = t(
        lang,
        `🟢 ${daysLeft} 天后到期`,
        `🟢 Expires in ${daysLeft}d`
      );
    }

    const countryName =
      countryCodeToName(m.country);
    const cityName = codeToName(m.city);
    const loc = cityName !== m.city
      ? `${countryName}-${cityName}`
      : countryName;

    lines.push(
      t(lang, '• 代理: ', '• Proxy: ') +
      `${m.ip}:${m.port}:${m.user}:${m.pwd}`
    );
    lines.push(
      t(lang, '• 地区: ', '• Region: ') + loc
    );
    lines.push(
      t(lang, '• 到期: ', '• Expires: ') +
      `${expDate}  ${status}`
    );
    lines.push(
      t(lang, '• 创建: ', '• Created: ') + creDate
    );
    lines.push(
      t(lang, '• 订单: ', '• Order: ') + m.orderNo
    );
  }

  lines.push('');
  lines.push(t(
    lang,
    '您可以输入：\n' +
      `• "续费 ${matches[0].orderNo}" — 续费此IP\n` +
      '• "查看到期IP" — 查看所有到期IP',
    'You can type:\n' +
      `• "renew ${matches[0].orderNo}"\n` +
      '• "show expiring IPs"'
  ));

  return {
    message: lines.join('\n'),
    suggestions: lang === 'zh'
      ? [
          `续费 ${matches[0].orderNo}`,
          '查看到期IP',
          '查看静态订单',
        ]
      : [
          `Renew ${matches[0].orderNo}`,
          'Show expiring IPs',
          'Show static orders',
        ],
    data: { ip, matches },
  };
}

/* ─── Proxy QR Code / Link Generation ─── */

function toBase64(str: string): string {
  return Buffer.from(str, 'utf-8').toString(
    'base64'
  );
}

function buildProxyUrls(proxy: {
  ip: string;
  port: number;
  user: string;
  pwd: string;
}): {
  socks5: string;
  http: string;
  https: string;
} {
  const { ip, port, user, pwd } = proxy;
  const authHost = `${user}:${pwd}@${ip}:${port}`;
  return {
    socks5: `socks://${toBase64(authHost)}`,
    http: `http://${authHost}`,
    https: `https://${authHost}`,
  };
}

export async function executeGenerateProxyQr(
  slots: Record<string, unknown>,
  user: NLUserContext,
  lang: Lang
): Promise<ExecResult> {
  const ip = (slots.ip as string) || '';
  const protocol =
    (slots.protocol as string) || 'socks5';

  if (!ip) {
    return {
      message: t(
        lang,
        '请提供要生成二维码的 IP 地址。\n' +
          '例如：163.61.209.63 二维码',
        'Please provide an IP address.\n' +
          'Example: QR code for 163.61.209.63'
      ),
      suggestions: lang === 'zh'
        ? ['查看我的静态订单', '查看到期IP']
        : ['Show my static orders', 'Show expiring IPs'],
    };
  }

  const token = user.backendToken;
  const qp =
    '?page=1&pageSize=200' +
    '&skip_statistics=true&status=active';

  const res = (await backendGet(
    `/api/open/app/static/order/list/v2${qp}`,
    token
  )) as {
    code: number;
    data?: {
      list?: Array<{
        order_no?: string;
        instances?: Array<{
          proxy_ip?: string;
          proxy_port?: number;
          username?: string;
          password?: string;
          expire_time?: string;
        }>;
        country_code?: string;
        city_code?: string;
      }>;
    };
  };

  if (res.code !== 0 || !res.data?.list?.length) {
    return {
      message: t(
        lang,
        `未找到 IP ${ip} 的订单信息。`,
        `No order found for IP ${ip}.`
      ),
    };
  }

  let match: {
    ip: string;
    port: number;
    user: string;
    pwd: string;
    orderNo: string;
    expire: string;
    country: string;
    city: string;
  } | null = null;

  for (const o of res.data.list) {
    if (!o.instances?.length) continue;
    for (const inst of o.instances) {
      if (inst.proxy_ip === ip) {
        match = {
          ip: inst.proxy_ip,
          port: inst.proxy_port ?? 30000,
          user: inst.username || '',
          pwd: inst.password || '',
          orderNo: o.order_no || '—',
          expire: inst.expire_time || '—',
          country: o.country_code || '',
          city: o.city_code || '',
        };
        break;
      }
    }
    if (match) break;
  }

  if (!match) {
    return {
      message: t(
        lang,
        `未找到 IP ${ip}，该 IP 可能不属于` +
          '您的订单或已过期。',
        `IP ${ip} not found in your orders.`
      ),
      suggestions: lang === 'zh'
        ? ['查看我的静态订单', '查看到期IP']
        : ['Show static orders', 'Expiring IPs'],
    };
  }

  const urls = buildProxyUrls(match);
  const expDate = match.expire
    .replace('T', ' ').slice(0, 16);

  const countryName =
    countryCodeToName(match.country);
  const cityName = codeToName(match.city);
  const loc = cityName !== match.city
    ? `${countryName}-${cityName}`
    : countryName;

  const lines: string[] = [];
  lines.push(t(
    lang,
    '请使用 Shadowrocket 扫描二维码' +
      '【建议 SOCKS5 协议】\n',
    'Scan QR code with Shadowrocket ' +
      '(SOCKS5 recommended)\n'
  ));

  lines.push('');
  lines.push('**HTTP**');
  lines.push('');
  lines.push('**HTTPS**');
  lines.push('');
  lines.push('**SOCKS5**');
  lines.push('');

  lines.push(
    t(lang, '代理地址：', 'Host: ') + match.ip
  );
  lines.push(
    t(lang, '端口：', 'Port: ') +
      String(match.port)
  );
  lines.push(
    t(lang, '用户名：', 'Username: ') + match.user
  );
  lines.push(
    t(lang, '密码：', 'Password: ') + match.pwd
  );
  lines.push(
    t(lang, '地区：', 'Region: ') + loc
  );
  lines.push(
    t(lang, '到期：', 'Expires: ') + expDate
  );
  lines.push(
    t(lang, '订单：', 'Order: ') + match.orderNo
  );

  lines.push('');
  lines.push(
    t(lang, '链接：', 'Link: ') + urls.socks5
  );
  lines.push(
    t(
      lang,
      '注意：SOCKS5 链接已使用 Base64 编码格式，' +
        '适用于大多数代理客户端',
      'Note: SOCKS5 link is Base64 encoded, ' +
        'compatible with most proxy clients'
    )
  );

  return {
    message: lines.join('\n'),
    suggestions: lang === 'zh'
      ? [
          `查询 ${ip}`,
          `续费 ${match.orderNo}`,
          '查看我的静态订单',
        ]
      : [
          `Check ${ip}`,
          `Renew ${match.orderNo}`,
          'Show static orders',
        ],
    data: {
      ip: match.ip,
      port: match.port,
      username: match.user,
      password: match.pwd,
      protocol,
      urls,
      orderNo: match.orderNo,
      expire: match.expire,
      region: loc,
    },
  };
}

export async function executeQueryTodayOrders(
  slots: Record<string, unknown>,
  user: NLUserContext,
  lang: Lang
): Promise<ExecResult> {
  const today = new Date().toISOString().slice(0, 10);

  const staticRes = (await backendGet(
    `/api/open/app/static/order/list/v2` +
      `?page=1&pageSize=20&skip_statistics=true` +
      `&start_date=${today}&end_date=${today}`,
    user.backendToken
  )) as {
    code: number;
    data?: {
      list?: Array<{
        order_no?: string;
        status?: string;
        country_code?: string;
        city_code?: string;
        product_no?: string;
        static_type?: string;
        user_price?: number;
        created_at?: string;
        instances?: Array<{
          proxy_ip?: string;
          proxy_port?: number;
        }>;
      }>;
    };
  };

  const dynRes = (await backendGet(
    `/api/dynamic?page=1&page_size=20` +
      `&start_date=${today}&end_date=${today}`,
    user.backendToken
  )) as {
    code: number;
    data?: {
      list?: Array<{
        order_no?: string;
        status?: string;
        traffic?: number;
        total_amount?: number;
        created_at?: string;
      }>;
    };
  };

  const statics = staticRes.data?.list || [];
  const dynamics = dynRes.data?.list || [];

  if (!statics.length && !dynamics.length) {
    return {
      message: t(
        lang,
        `今天暂无订单记录。`,
        `No orders today.`
      ),
    };
  }

  let msg = t(
    lang,
    `📋 今天的订单记录 (${today})：\n\n`,
    `📋 Today's orders (${today}):\n\n`
  );

  if (statics.length) {
    msg += t(
      lang,
      `🌐 静态代理 (${statics.length} 笔)：\n`,
      `🌐 Static Proxy (${statics.length}):\n`
    );
    for (const o of statics.slice(0, 10)) {
      const cn = o.country_code
        ? countryCodeToName(o.country_code)
        : '';
      const ct = o.city_code
        ? codeToName(o.city_code)
        : '';
      const region = ct && cn && ct !== cn
        ? `${cn}-${ct}` : ct || cn || '—';
      const ip = o.instances?.[0]?.proxy_ip || '—';
      const price = o.user_price ?? 0;
      const pType = resolveProductType(
        o.product_no, o.static_type, lang
      );
      msg += `• ${ip}  ${region}  ${pType}` +
        `  ¥${price}  ${o.status || ''}\n`;
    }
    msg += '\n';
  }

  if (dynamics.length) {
    msg += t(
      lang,
      `⚡ 动态代理 (${dynamics.length} 笔)：\n`,
      `⚡ Dynamic Proxy (${dynamics.length}):\n`
    );
    for (const o of dynamics.slice(0, 10)) {
      const flow = o.traffic
        ? `${o.traffic}GB` : '—';
      const amount = o.total_amount ?? 0;
      msg += `• ${o.order_no || '—'}  ${flow}` +
        `  ¥${amount}  ${o.status || ''}\n`;
    }
  }

  return {
    message: msg.trim(),
    data: {
      static_orders: statics,
      dynamic_orders: dynamics,
    },
  };
}

// ========== Phase 2/3: Profile Intent Handlers ==========

import * as profileSvc from '../profile/profile.service';
import {
  generateFingerprint,
  validateFingerprint as validateFp,
} from '../profile/fingerprint.service';
import * as proxyMgrSvc from '../profile/proxy-manager.service';
import * as browserSvc from '../browser/browser.service';
import * as taskSvc from '../task/task.service';
import { countryCodeToName as c2n } from './geo-mapping';
import { prisma } from '../../app';
import crypto from 'crypto';

async function resolveAgentId(
  user: NLUserContext
): Promise<number> {
  const existing = await prisma.agentApp.findFirst({
    where: { backendUserId: user.userId },
    select: { id: true },
  });
  if (existing) return existing.id;

  const app = await prisma.agentApp.create({
    data: {
      name: `NL-${user.username}`,
      apiKey: `nlk_${crypto.randomBytes(28).toString('hex')}`,
      apiSecretHash: crypto
        .randomBytes(32)
        .toString('hex'),
      backendUserId: user.userId,
      backendUsername: user.username,
      status: 'active',
      authMode: 'api_key_only',
    },
  });
  return app.id;
}

function fmtFpSummary(
  fp: Record<string, unknown>,
  lang: Lang
): string {
  const os = fp.os ?? '—';
  const br = fp.browser ?? '—';
  const ua = fp.user_agent
    ? String(fp.user_agent).slice(0, 60) + '…'
    : '—';
  const tz =
    (fp.location as Record<string, unknown>)
      ?.timezone ?? '—';
  const locale =
    (fp.location as Record<string, unknown>)
      ?.locale ?? '—';
  return t(
    lang,
    `  OS: ${os} | 浏览器: ${br}\n` +
      `  UA: ${ua}\n  时区: ${tz} | 语言: ${locale}`,
    `  OS: ${os} | Browser: ${br}\n` +
      `  UA: ${ua}\n  TZ: ${tz} | Locale: ${locale}`
  );
}

export async function executeProfileIntent(
  slots: Record<string, unknown>,
  user: NLUserContext,
  lang: Lang
): Promise<ExecResult> {
  const intent = (slots._intent as string) ?? '';
  const aid = await resolveAgentId(user);

  switch (intent) {
    case 'create_profile': {
      const name =
        (slots.name as string) ??
        `Profile-${Date.now().toString(36)}`;
      const os = slots.os as string | undefined;
      const browser =
        slots.browser as string | undefined;
      const country =
        slots.country as string | undefined;
      const result = await profileSvc.createProfile(
        aid,
        {
          name,
          auto_generate_fingerprint: true,
          fingerprint: { os, browser } as never,
        }
      );
      const fp = result.fingerprint as Record<
        string,
        unknown
      >;
      const countryLabel = country
        ? c2n(country)
        : '';
      return {
        message: t(
          lang,
          `✅ 浏览器配置创建成功！\n\n` +
            `• Profile ID: ${result.profile_id}\n` +
            `• 名称: ${result.name}\n` +
            (countryLabel
              ? `• 地区: ${countryLabel}\n`
              : '') +
            `• 指纹概要:\n${fmtFpSummary(fp, lang)}`,
          `✅ Profile created!\n\n` +
            `• Profile ID: ${result.profile_id}\n` +
            `• Name: ${result.name}\n` +
            (countryLabel
              ? `• Region: ${countryLabel}\n`
              : '') +
            `• Fingerprint:\n${fmtFpSummary(fp, lang)}`
        ),
        data: result as unknown as Record<
          string,
          unknown
        >,
        suggestions: [
          t(
            lang,
            `查看配置 ${result.profile_id}`,
            `View profile ${result.profile_id}`
          ),
        ],
      };
    }

    case 'list_profiles': {
      const result = await profileSvc.listProfiles(
        aid,
        { page: 1, page_size: 10, status: 'active' }
      );
      if (!result.items.length) {
        return {
          message: t(
            lang,
            '📋 暂无浏览器配置。请先创建一个。',
            '📋 No profiles yet. Create one first.'
          ),
          suggestions: [
            t(
              lang,
              '创建一个 Chrome 浏览器配置',
              'Create a Chrome profile'
            ),
          ],
        };
      }
      let msg = t(
        lang,
        `📋 浏览器配置列表 (${result.total} 个):\n\n`,
        `📋 Profiles (${result.total} total):\n\n`
      );
      for (const p of result.items) {
        const fp = p.fingerprint as Record<
          string,
          unknown
        >;
        msg +=
          `• ${p.name} [${p.profile_id}]\n` +
          `  ${fp.os ?? '—'}/${fp.browser ?? '—'} ` +
          `| ${p.status}\n`;
      }
      return { message: msg.trim(), data: result };
    }

    case 'update_profile': {
      const pid = slots.profile_id as string;
      if (!pid) {
        return {
          message: t(
            lang,
            '请提供要更新的 Profile ID。',
            'Please provide a profile ID.'
          ),
        };
      }
      const updateData: Record<string, unknown> = {};
      if (slots.name) updateData.name = slots.name;
      if (slots.tags) updateData.tags = slots.tags;
      const result = await profileSvc.updateProfile(
        aid,
        pid,
        updateData as never
      );
      return {
        message: t(
          lang,
          `✅ 配置 ${pid} 已更新`,
          `✅ Profile ${pid} updated`
        ),
        data: result as unknown as Record<
          string,
          unknown
        >,
      };
    }

    case 'delete_profile': {
      const pid = slots.profile_id as string;
      if (!pid) {
        return {
          message: t(
            lang,
            '请提供要删除的 Profile ID。',
            'Please provide a profile ID.'
          ),
        };
      }
      await profileSvc.deleteProfile(aid, pid);
      return {
        message: t(
          lang,
          `✅ 配置 ${pid} 已删除`,
          `✅ Profile ${pid} deleted`
        ),
      };
    }

    case 'duplicate_profile': {
      const pid = slots.profile_id as string;
      if (!pid) {
        return {
          message: t(
            lang,
            '请提供要复制的 Profile ID。',
            'Please provide a profile ID.'
          ),
        };
      }
      const result = await profileSvc.duplicateProfile(
        aid,
        pid,
        undefined,
        true
      );
      return {
        message: t(
          lang,
          `✅ 配置已复制，新 ID: ${result.profile_id}`,
          `✅ Duplicated. New ID: ${result.profile_id}`
        ),
        data: result as unknown as Record<
          string,
          unknown
        >,
      };
    }

    case 'batch_create_profiles': {
      const count = (slots.count as number) ?? 5;
      const result =
        await profileSvc.batchCreateProfiles(
          aid,
          Math.min(count, 50)
        );
      return {
        message: t(
          lang,
          `✅ 批量创建完成，共 ${result.created_count} 个`,
          `✅ Batch created ${result.created_count} profiles`
        ),
        data: result,
      };
    }

    case 'generate_fingerprint': {
      const os = slots.os as string | undefined;
      const browser =
        slots.browser as string | undefined;
      const country =
        slots.country as string | undefined;
      const fp = generateFingerprint({
        os,
        browser,
        country,
      });
      return {
        message:
          t(
            lang,
            '✅ 指纹已生成:\n',
            '✅ Fingerprint generated:\n'
          ) +
          fmtFpSummary(
            fp as unknown as Record<string, unknown>,
            lang
          ),
        data: fp as unknown as Record<string, unknown>,
      };
    }

    case 'bind_proxy': {
      const pid = slots.profile_id as string;
      const proxyId = slots.proxy_id as string;
      if (!pid) {
        return {
          message: t(
            lang,
            '请提供 Profile ID 和代理 ID。',
            'Please provide profile ID and proxy ID.'
          ),
        };
      }
      const result = await profileSvc.bindProxy(
        aid,
        pid,
        { proxy_id: proxyId, auto_match: !proxyId }
      );
      return {
        message: t(
          lang,
          `✅ 代理已绑定到 ${pid}`,
          `✅ Proxy bound to ${pid}`
        ),
        data: result as unknown as Record<
          string,
          unknown
        >,
      };
    }

    case 'validate_fingerprint':
    case 'auto_match_proxy': {
      const pid = slots.profile_id as string;
      const country =
        slots.country as string | undefined;
      if (pid) {
        const profile = await profileSvc.getProfile(
          aid,
          pid
        );
        const fp =
          profile.fingerprint as Record<
            string,
            unknown
          >;
        const v = validateFp(fp as never, country);
        const statusIcon = v.valid ? '✅' : '⚠️';
        let msg = t(
          lang,
          `${statusIcon} 一致性评分: ${v.consistency_score}/100`,
          `${statusIcon} Consistency: ${v.consistency_score}/100`
        );
        if (v.warnings.length) {
          msg +=
            '\n' +
            v.warnings.map((w) => `  ⚠ ${w}`).join('\n');
        }
        return {
          message: msg,
          data: v as unknown as Record<string, unknown>,
        };
      }
      const fp = generateFingerprint({
        country: country ?? 'US',
      });
      const v = validateFp(fp as never, country);
      return {
        message: t(
          lang,
          `✅ 一致性评分: ${v.consistency_score}/100`,
          `✅ Consistency: ${v.consistency_score}/100`
        ),
        data: v as unknown as Record<string, unknown>,
      };
    }

    case 'set_user_agent':
    case 'set_timezone':
    case 'set_language':
    case 'set_canvas':
    case 'set_webgl':
    case 'set_audio':
    case 'set_webrtc':
    case 'set_fonts':
    case 'set_plugins':
    case 'set_client_hints': {
      const pid = slots.profile_id as string;
      if (!pid) {
        return {
          message: t(
            lang,
            '请先指定 Profile ID。\n' +
              '例如: 设置 PRF-xxx 的时区为 America/New_York',
            'Please provide a profile ID first.'
          ),
        };
      }
      const fpPatch = buildFingerprintPatch(
        intent,
        slots
      );
      const result = await profileSvc.updateProfile(
        aid,
        pid,
        { fingerprint: fpPatch } as never
      );
      const label = intent
        .replace('set_', '')
        .replace(/_/g, ' ');
      return {
        message: t(
          lang,
          `✅ ${label} 已更新 (${pid})`,
          `✅ ${label} updated (${pid})`
        ),
        data: result as unknown as Record<
          string,
          unknown
        >,
      };
    }

    case 'group_profile':
    case 'tag_profile':
    case 'import_profile':
    case 'export_profile': {
      const pid = slots.profile_id as string;
      if (intent === 'group_profile' && pid) {
        const group =
          (slots.group as string) ?? 'default';
        const result =
          await profileSvc.updateProfile(aid, pid, {
            group_id: group,
          } as never);
        return {
          message: t(
            lang,
            `✅ ${pid} 已加入分组 "${group}"`,
            `✅ ${pid} added to group "${group}"`
          ),
          data: result as unknown as Record<
            string,
            unknown
          >,
        };
      }
      if (intent === 'tag_profile' && pid) {
        const tag = (slots.tag as string) ?? '';
        const result =
          await profileSvc.updateProfile(aid, pid, {
            tags: [tag],
          } as never);
        return {
          message: t(
            lang,
            `✅ ${pid} 已添加标签 "${tag}"`,
            `✅ ${pid} tagged with "${tag}"`
          ),
          data: result as unknown as Record<
            string,
            unknown
          >,
        };
      }
      return {
        message: t(
          lang,
          '请提供所需参数（Profile ID 等）。',
          'Please provide required parameters.'
        ),
      };
    }

    case 'add_proxy': {
      const url = slots.proxy_url as string;
      if (!url) {
        return {
          message: t(
            lang,
            '请提供代理地址。\n' +
              '例如: 添加代理 socks5://1.2.3.4:1080',
            'Please provide proxy URL.\n' +
              'e.g.: add proxy socks5://1.2.3.4:1080'
          ),
        };
      }
      const parsed = parseProxyUrl(url);
      const result = await proxyMgrSvc.addProxy(
        aid,
        parsed
      );
      return {
        message: t(
          lang,
          `✅ 代理已添加\n` +
            `• ID: ${result.proxy_id}\n` +
            `• 地址: ${result.full_url}\n` +
            `• 状态: ${result.status}`,
          `✅ Proxy added\n` +
            `• ID: ${result.proxy_id}\n` +
            `• URL: ${result.full_url}\n` +
            `• Status: ${result.status}`
        ),
        data: result,
      };
    }

    case 'list_proxy': {
      const result = await proxyMgrSvc.listProxies(
        aid,
        { page: '1', page_size: '20' }
      );
      if (!result.items.length) {
        return {
          message: t(
            lang,
            '📋 暂无代理。请先添加。',
            '📋 No proxies yet.'
          ),
        };
      }
      let msg = t(
        lang,
        `📋 代理列表 (${result.total} 个):\n\n`,
        `📋 Proxies (${result.total}):\n\n`
      );
      for (const p of result.items) {
        msg +=
          `• ${p.proxy_id} | ` +
          `${p.type}://${p.host}:${p.port} | ` +
          `${p.status}\n`;
      }
      return { message: msg.trim(), data: result };
    }

    case 'verify_proxy': {
      const proxyId = slots.proxy_id as string;
      if (!proxyId) {
        return {
          message: t(
            lang,
            '请提供要验证的代理 ID。',
            'Please provide proxy ID.'
          ),
        };
      }
      const result = await proxyMgrSvc.verifyProxy(
        aid,
        proxyId
      );
      const icon =
        result.status === 'active' ? '✅' : '❌';
      return {
        message: t(
          lang,
          `${icon} 代理 ${proxyId}: ${result.status}` +
            ` (延迟: ${result.latency_ms}ms)`,
          `${icon} Proxy ${proxyId}: ${result.status}` +
            ` (latency: ${result.latency_ms}ms)`
        ),
        data: result,
      };
    }

    case 'import_proxy':
    case 'rotate_proxy':
      return {
        message: t(
          lang,
          '该功能即将上线，敬请期待',
          'This feature is coming soon'
        ),
      };

    case 'pause_profile': {
      const pid = slots.profile_id as string;
      if (!pid) return { message: t(lang, '请提供配置ID', 'Please provide profile ID') };
      await profileSvc.updateProfile(aid, pid, { status: 'paused' });
      return { message: t(lang, `⏸️ 配置 ${pid} 已暂停`, `⏸️ Profile ${pid} paused`) };
    }
    case 'resume_profile': {
      const pid = slots.profile_id as string;
      if (!pid) return { message: t(lang, '请提供配置ID', 'Please provide profile ID') };
      await profileSvc.updateProfile(aid, pid, { status: 'active' });
      return { message: t(lang, `▶️ 配置 ${pid} 已恢复`, `▶️ Profile ${pid} resumed`) };
    }
    case 'archive_profile': {
      const pid = slots.profile_id as string;
      if (!pid) return { message: t(lang, '请提供配置ID', 'Please provide profile ID') };
      await profileSvc.updateProfile(aid, pid, { status: 'archived' });
      return { message: t(lang, `📦 配置 ${pid} 已归档`, `📦 Profile ${pid} archived`) };
    }
    case 'delete_proxy': {
      const proxyId = slots.proxy_id as string;
      if (!proxyId) return { message: t(lang, '请提供代理ID', 'Please provide proxy ID') };
      await proxyMgrSvc.deleteProxy(aid, proxyId);
      return { message: t(lang, `✅ 代理 ${proxyId} 已删除`, `✅ Proxy ${proxyId} deleted`) };
    }
    case 'proxy_speed_test': {
      const pxId = slots.proxy_id as string;
      if (!pxId) {
        return {
          message: t(lang,
            '请提供代理ID，例如: 测试代理 prx_xxx 速度',
            'Please provide proxy ID'
          ),
        };
      }
      const speedResult = await proxyMgrSvc.verifyProxy(aid, pxId);
      return {
        message: t(lang,
          `🚀 代理 ${pxId} 测速完成\n` +
          `  状态: ${speedResult.status}\n` +
          `  延迟: ${speedResult.latency_ms}ms\n` +
          `  检测时间: ${speedResult.tested_at}`,
          `🚀 Proxy ${pxId} speed test done\n` +
          `  Status: ${speedResult.status}\n` +
          `  Latency: ${speedResult.latency_ms}ms\n` +
          `  Tested: ${speedResult.tested_at}`
        ),
      };
    }
    case 'proxy_quality_check': {
      const pxId = slots.proxy_id as string;
      if (!pxId) {
        return {
          message: t(lang,
            '请提供代理ID，例如: 检测代理 prx_xxx 质量',
            'Please provide proxy ID'
          ),
        };
      }
      const qResult = await proxyMgrSvc.verifyProxy(aid, pxId);
      const quality = (qResult.latency_ms ?? 9999) < 200
        ? 'excellent' : (qResult.latency_ms ?? 9999) < 500
        ? 'good' : (qResult.latency_ms ?? 9999) < 1000
        ? 'fair' : 'poor';
      return {
        message: t(lang,
          `🔍 代理 ${pxId} 质量检测\n` +
          `  状态: ${qResult.status}\n` +
          `  延迟: ${qResult.latency_ms}ms\n` +
          `  质量: ${quality}`,
          `🔍 Proxy ${pxId} quality check\n` +
          `  Status: ${qResult.status}\n` +
          `  Latency: ${qResult.latency_ms}ms\n` +
          `  Quality: ${quality}`
        ),
      };
    }
    case 'auto_select_proxy': {
      const targetPid = slots.profile_id as string;
      if (!targetPid) {
        return {
          message: t(lang,
            '请提供配置ID',
            'Please provide profile ID'
          ),
        };
      }
      const best = await proxyPoolSvc.autoSelectProxy(
        aid, targetPid
      );
      if (!best.proxy_id) {
        return {
          message: t(lang,
            '❌ 没有可用的活跃代理',
            '❌ No active proxies available'
          ),
        };
      }
      return {
        message: t(lang,
          `✅ 为配置 ${targetPid} 推荐代理\n` +
          `  代理: ${best.proxy_id}\n` +
          `  类型: ${best.type}\n` +
          `  延迟: ${best.latency_ms ?? '未知'}ms`,
          `✅ Recommended proxy for ${targetPid}\n` +
          `  Proxy: ${best.proxy_id}\n` +
          `  Type: ${best.type}\n` +
          `  Latency: ${best.latency_ms ?? 'N/A'}ms`
        ),
      };
    }

    case 'set_os':
    case 'set_cpu':
    case 'set_memory':
    case 'set_gpu':
    case 'set_screen':
    case 'set_media_devices':
    case 'set_battery':
    case 'set_webgpu':
    case 'set_navigator':
    case 'set_device_memory':
    case 'set_gamepad': {
      const pid = slots.profile_id as string;
      if (!pid) return { message: t(lang, '请提供配置ID', 'Please provide profile ID') };
      const patch = buildFingerprintPatch(intent, slots);
      await profileSvc.updateProfile(aid, pid, {
        fingerprint: patch,
      });
      return {
        message: t(lang,
          `✅ 配置 ${pid} 的 ${intent.replace('set_', '')} 已更新`,
          `✅ Profile ${pid} ${intent.replace('set_', '')} updated`
        ),
      };
    }

    default:
      return {
        message: t(
          lang,
          '该功能即将上线，敬请期待',
          'This feature is coming soon'
        ),
      };
  }
}

function buildFingerprintPatch(
  intent: string,
  slots: Record<string, unknown>
): Record<string, unknown> {
  const val = slots.value as string | undefined;
  const mode =
    (slots.fp_mode as string) ?? 'noise';
  switch (intent) {
    case 'set_user_agent':
      return { user_agent: val };
    case 'set_timezone':
      return {
        location: { timezone: val ?? slots.timezone },
      };
    case 'set_language':
      return {
        location: {
          locale: val ?? slots.language,
          languages: val
            ? [val, val.split('-')[0]]
            : undefined,
        },
      };
    case 'set_canvas':
      return { canvas: { mode } };
    case 'set_webgl':
      return { webgl: { mode } };
    case 'set_audio':
      return { audio: { mode } };
    case 'set_webrtc':
      return {
        webrtc: {
          mode:
            (slots.webrtc_mode as string) ?? 'fake',
        },
      };
    case 'set_fonts':
      return {
        fonts: val
          ? val.split(',').map((f) => f.trim())
          : undefined,
      };
    case 'set_plugins':
      return {
        plugins: val
          ? val.split(',').map((p) => p.trim())
          : undefined,
      };
    case 'set_client_hints':
      return { client_hints: {} };
    case 'set_os':
      return { os: { name: slots.os ?? val } };
    case 'set_cpu':
      return { cpu: { cores: slots.cpu_cores ?? 8 } };
    case 'set_memory':
      return { memory: { deviceMemory: slots.memory_gb ?? 8 } };
    case 'set_gpu':
      return { gpu: { renderer: slots.gpu_model ?? val } };
    case 'set_screen': {
      const res = (slots.resolution as string) ?? '1920x1080';
      const [w, h] = res.split('x').map(Number);
      return { screen: { width: w || 1920, height: h || 1080 } };
    }
    case 'set_media_devices':
      return { mediaDevices: { cameras: 1, microphones: 1, speakers: 1 } };
    case 'set_battery':
      return { battery: { mode: mode === 'block' ? 'disabled' : 'enabled' } };
    case 'set_webgpu':
      return { webgpu: { mode } };
    case 'set_navigator':
      return { navigator: {} };
    case 'set_device_memory':
      return { deviceMemory: slots.memory_gb ?? 8 };
    case 'set_gamepad':
      return { gamepad: { enabled: mode !== 'block' } };
    default:
      return {};
  }
}

function parseProxyUrl(
  url: string
): Record<string, unknown> {
  const m = url.match(
    /^(https?|socks[45]?):\/\/(?:([^:]+):([^@]+)@)?([^:]+):(\d+)/i
  );
  if (m) {
    return {
      type: m[1].toLowerCase(),
      username: m[2] ?? null,
      password: m[3] ?? null,
      host: m[4],
      port: parseInt(m[5], 10),
    };
  }
  const parts = url.split(':');
  return {
    type: 'socks5',
    host: parts[0] ?? url,
    port: parseInt(parts[1] ?? '1080', 10),
    username: parts[2] ?? null,
    password: parts[3] ?? null,
  };
}

// ========== Phase 3: Browser Intent Handlers ==========

export async function executeBrowserIntent(
  slots: Record<string, unknown>,
  user: NLUserContext,
  lang: Lang
): Promise<ExecResult> {
  const intent = (slots._intent as string) ?? '';
  const aid = await resolveAgentId(user);

  switch (intent) {
    case 'launch_browser': {
      const pid = slots.profile_id as string;
      if (!pid) {
        return {
          message: t(
            lang,
            '请先指定要启动的 Profile ID。\n' +
              '例如: 启动浏览器 PRF-xxx',
            'Please provide a profile ID.\n' +
              'e.g.: launch browser PRF-xxx'
          ),
        };
      }
      const headless =
        (slots.headless as boolean) ?? true;
      const result = await browserSvc.launchBrowser(
        aid,
        {
          profile_id: pid,
          headless,
          options: slots.url
            ? { start_url: slots.url as string }
            : undefined,
        }
      );
      return {
        message: t(
          lang,
          `✅ 浏览器已启动\n` +
            `• 实例 ID: ${result.instance_id}\n` +
            `• Profile: ${result.profile_id}\n` +
            `• 状态: ${result.status}\n` +
            `• Headless: ${result.headless}`,
          `✅ Browser launched\n` +
            `• Instance: ${result.instance_id}\n` +
            `• Profile: ${result.profile_id}\n` +
            `• Status: ${result.status}\n` +
            `• Headless: ${result.headless}`
        ),
        data: result as unknown as Record<
          string,
          unknown
        >,
        suggestions: [
          t(
            lang,
            `导航到 https://example.com`,
            `Navigate to https://example.com`
          ),
        ],
      };
    }

    case 'close_browser': {
      const iid = slots.instance_id as string;
      if (!iid) {
        return {
          message: t(
            lang,
            '请提供要关闭的实例 ID。',
            'Please provide instance ID.'
          ),
        };
      }
      const result = await browserSvc.closeBrowser(
        aid,
        iid
      );
      return {
        message: t(
          lang,
          `✅ 浏览器 ${iid} 已关闭`,
          `✅ Browser ${iid} closed`
        ),
        data: result,
      };
    }

    case 'restart_browser': {
      const iid = slots.instance_id as string;
      if (!iid) {
        return {
          message: t(
            lang,
            '请提供实例 ID。',
            'Please provide instance ID.'
          ),
        };
      }
      const result =
        await browserSvc.restartBrowser(aid, iid);
      return {
        message: t(
          lang,
          `✅ 浏览器 ${iid} 已重启`,
          `✅ Browser ${iid} restarted`
        ),
        data: result,
      };
    }

    case 'list_browsers': {
      const result =
        await browserSvc.listInstances(aid, {
          page: 1,
          page_size: 20,
        });
      if (!result.items.length) {
        return {
          message: t(
            lang,
            '📋 无运行中的浏览器实例。',
            '📋 No browser instances.'
          ),
        };
      }
      let msg = t(
        lang,
        `📋 浏览器实例 (${result.total} 个):\n\n`,
        `📋 Instances (${result.total}):\n\n`
      );
      for (const i of result.items) {
        msg +=
          `• ${i.instance_id} | ` +
          `${i.status} | ${i.current_url ?? '—'}\n`;
      }
      return { message: msg.trim(), data: result };
    }

    case 'batch_launch_browser': {
      const pids =
        (slots.profile_ids as string[]) ?? [];
      if (!pids.length) {
        return {
          message: t(
            lang,
            '请提供要批量启动的 Profile IDs。',
            'Please provide profile IDs.'
          ),
        };
      }
      const result = await browserSvc.batchLaunch(
        aid,
        pids,
        true
      );
      return {
        message: t(
          lang,
          `✅ 批量启动完成: ${result.launched_count} 个`,
          `✅ Batch launched: ${result.launched_count}`
        ),
        data: result as unknown as Record<
          string,
          unknown
        >,
      };
    }

    case 'batch_close_browser': {
      const result = await browserSvc.batchClose(aid);
      return {
        message: t(
          lang,
          `✅ 批量关闭完成: ${result.closed_count} 个`,
          `✅ Batch closed: ${result.closed_count}`
        ),
        data: result as unknown as Record<
          string,
          unknown
        >,
      };
    }

    case 'navigate_to': {
      const iid = slots.instance_id as string;
      const url = slots.url as string;
      if (!iid || !url) {
        return {
          message: t(
            lang,
            '请提供实例 ID 和目标 URL。',
            'Please provide instance ID and URL.'
          ),
        };
      }
      const result = await browserSvc.navigate(
        aid,
        iid,
        { url, timeout_ms: 30000, wait_until: 'load' }
      );
      return {
        message: t(
          lang,
          `✅ 已导航到 ${result.current_url}`,
          `✅ Navigated to ${result.current_url}`
        ),
        data: result,
      };
    }

    case 'take_screenshot': {
      const iid = slots.instance_id as string;
      if (!iid) {
        return {
          message: t(
            lang,
            '请提供实例 ID。',
            'Please provide instance ID.'
          ),
        };
      }
      const result =
        await browserSvc.takeScreenshot(aid, iid, {
          type: 'viewport',
          format: 'png',
        });
      return {
        message: t(
          lang,
          `✅ 截图完成: ${result.screenshot_url}`,
          `✅ Screenshot: ${result.screenshot_url}`
        ),
        data: result,
      };
    }

    case 'submit_task': {
      const pid = slots.profile_id as string;
      if (!pid) {
        return {
          message: t(
            lang,
            '请提供 Profile ID 和任务配置。',
            'Please provide profile ID.'
          ),
        };
      }
      const result = await taskSvc.submitTask(aid, {
        profile_id: pid,
        task_type: 'custom_script',
        target_url: slots.url as string,
        steps: [],
        priority: 'normal',
        timeout_ms: 60000,
        max_retries: 1,
      });
      return {
        message: t(
          lang,
          `✅ 任务已提交: ${result.task_id}`,
          `✅ Task submitted: ${result.task_id}`
        ),
        data: result,
      };
    }

    case 'query_task': {
      const tid = slots.task_id as string;
      if (!tid) {
        const result = await taskSvc.listTasks(aid, {
          page: 1,
          page_size: 10,
        });
        if (!result.items.length) {
          return {
            message: t(
              lang,
              '📋 暂无任务。',
              '📋 No tasks.'
            ),
          };
        }
        let msg = t(
          lang,
          `📋 任务列表 (${result.total} 个):\n\n`,
          `📋 Tasks (${result.total}):\n\n`
        );
        for (const tk of result.items) {
          msg +=
            `• ${tk.task_id} | ` +
            `${tk.status} | ${tk.task_type}\n`;
        }
        return { message: msg.trim(), data: result };
      }
      const task = await taskSvc.getTask(aid, tid);
      return {
        message: t(
          lang,
          `📋 任务 ${tid}\n` +
            `• 状态: ${task.status}\n` +
            `• 类型: ${task.task_type}\n` +
            `• 重试: ${task.retry_count}/${task.max_retries}`,
          `📋 Task ${tid}\n` +
            `• Status: ${task.status}\n` +
            `• Type: ${task.task_type}\n` +
            `• Retries: ${task.retry_count}/${task.max_retries}`
        ),
        data: task as unknown as Record<
          string,
          unknown
        >,
      };
    }

    case 'run_script': {
      const iid = slots.instance_id as string;
      if (!iid) {
        return {
          message: t(
            lang,
            '请提供实例 ID。',
            'Please provide instance ID.'
          ),
        };
      }
      const script =
        (slots.script as string) ??
        'document.title';
      const result = await browserSvc.evaluate(
        aid,
        iid,
        script
      );
      return {
        message: t(
          lang,
          `✅ 脚本已执行 (${result.duration_ms}ms)`,
          `✅ Script executed (${result.duration_ms}ms)`
        ),
        data: result,
      };
    }

    case 'schedule_task':
    case 'batch_task':
    case 'run_detection_test':
      return {
        message: t(
          lang,
          '该功能即将上线，敬请期待',
          'This feature is coming soon'
        ),
      };

    default:
      return {
        message: t(
          lang,
          '该功能即将上线，敬请期待',
          'This feature is coming soon'
        ),
      };
  }
}

export async function executeShowHelp(
  slots: Record<string, unknown>,
  user: NLUserContext,
  lang: Lang
): Promise<ExecResult> {
  const topic = (slots.topic as string) || '';
  const result = showHelp(
    user,
    lang,
    topic || undefined
  );
  return {
    message: result.message,
    suggestions: result.suggestions,
  };
}

export async function executeQuerySuggestions(
  _slots: Record<string, unknown>,
  user: NLUserContext,
  lang: Lang
): Promise<ExecResult> {
  const result = showHelp(user, lang, 'query');
  return {
    message: result.message,
    suggestions: result.suggestions,
  };
}

export async function executeUnknown(
  _slots: Record<string, unknown>,
  _user: NLUserContext,
  lang: Lang
): Promise<ExecResult> {
  return {
    message: t(
      lang,
      '抱歉，我暂时无法理解这个指令。',
      "Sorry, I couldn't understand that."
    ),
    suggestions: [
      t(lang, '帮助', 'help'),
    ],
  };
}

/* ─── Phase 4: Workspace ─── */

import * as workspaceSvc from '../workspace/workspace.service';
import * as workflowSvc from '../workflow/workflow.service';
import * as systemSvc from '../system/system.service';
import * as proxyPoolSvc from '../profile/proxy-pool.service';

async function executeWorkspaceIntent(
  slots: Record<string, unknown>,
  user: NLUserContext,
  lang: Lang
): Promise<ExecResult> {
  const intent = slots._intent as string;
  const agentId = await resolveAgentId(user);

  switch (intent) {
    case 'create_workspace': {
      const name = (slots.name as string) || 'Untitled';
      const ws = await workspaceSvc.createWorkspace(
        agentId, { name }
      );
      return {
        message: t(lang,
          `✅ 工作区「${ws.name}」已创建 (${ws.workspaceId})`,
          `✅ Workspace "${ws.name}" created (${ws.workspaceId})`
        ),
      };
    }
    case 'list_workspaces': {
      const list = await workspaceSvc.listWorkspaces(agentId);
      if (!list.length) {
        return {
          message: t(lang,
            '📁 暂无工作区，输入 "创建工作区 名称" 创建',
            '📁 No workspaces. Type "create workspace name" to create'
          ),
        };
      }
      const lines = list.map(
        (w) => `• ${w.name} (${w.profile_count} 配置)`
      );
      return {
        message: t(lang, '📁 工作区列表：\n', '📁 Workspaces:\n') +
          lines.join('\n'),
      };
    }
    case 'delete_workspace': {
      const wsName = (slots.name as string) ||
        (slots.workspace_id as string) || '';
      await workspaceSvc.deleteWorkspace(agentId, wsName);
      return {
        message: t(lang,
          '✅ 工作区已删除',
          '✅ Workspace deleted'
        ),
      };
    }
    case 'move_to_workspace': {
      const profileId = slots.profile_id as string;
      const wsName = (slots.workspace_name as string) ||
        (slots.name as string) || '';
      if (!profileId || !wsName) {
        return {
          message: t(lang,
            '请提供配置ID和工作区名称',
            'Please provide profile ID and workspace name'
          ),
        };
      }
      const result = await workspaceSvc.moveProfileToWorkspace(
        agentId, profileId, wsName
      );
      return {
        message: t(lang,
          `✅ 配置 ${result.profile_id} 已移到工作区「${result.workspace}」`,
          `✅ Profile ${result.profile_id} moved to "${result.workspace}"`
        ),
      };
    }
    case 'create_proxy_pool': {
      const poolName = (slots.name as string) || 'Untitled Pool';
      const pool = await proxyPoolSvc.createProxyPool(
        agentId, { name: poolName }
      );
      return {
        message: t(lang,
          `✅ 代理池「${pool.name}」已创建 (${pool.pool_id})`,
          `✅ Proxy pool "${pool.name}" created (${pool.pool_id})`
        ),
      };
    }
    case 'list_proxy_pools': {
      const pools = await proxyPoolSvc.listProxyPools(agentId);
      if (!pools.length) {
        return {
          message: t(lang,
            '🌐 暂无代理池，输入 "创建代理池 名称" 创建',
            '🌐 No proxy pools. Type "create proxy pool name"'
          ),
        };
      }
      const lines = pools.map(
        (p) => `• ${p.name} [${p.proxy_type}] (${p.proxy_count} 代理)`
      );
      return {
        message: t(lang,
          '🌐 代理池列表：\n', '🌐 Proxy pools:\n'
        ) + lines.join('\n'),
      };
    }
    case 'delete_proxy_pool': {
      const poolId = (slots.pool_id as string) ||
        (slots.name as string) || '';
      if (!poolId) {
        return {
          message: t(lang,
            '请提供代理池ID',
            'Please provide proxy pool ID'
          ),
        };
      }
      await proxyPoolSvc.deleteProxyPool(agentId, poolId);
      return {
        message: t(lang,
          '✅ 代理池已删除',
          '✅ Proxy pool deleted'
        ),
      };
    }
    default:
      return {
        message: t(lang,
          '⏳ 该功能即将上线',
          '⏳ This feature is coming soon'
        ),
      };
  }
}

/* ─── Phase 4: Workflow ─── */

async function executeWorkflowIntent(
  slots: Record<string, unknown>,
  user: NLUserContext,
  lang: Lang
): Promise<ExecResult> {
  const intent = slots._intent as string;
  const agentId = await resolveAgentId(user);

  switch (intent) {
    case 'create_workflow': {
      const name = (slots.name as string) || 'Untitled Workflow';
      const wf = await workflowSvc.createWorkflow(
        agentId, { name }
      );
      return {
        message: t(lang,
          `✅ 流程「${wf.name}」已创建 (${wf.workflow_id})`,
          `✅ Workflow "${wf.name}" created (${wf.workflow_id})`
        ),
      };
    }
    case 'list_workflows': {
      const list = await workflowSvc.listWorkflows(agentId);
      if (!list.length) {
        return {
          message: t(lang,
            '⚡ 暂无自动化流程',
            '⚡ No workflows yet'
          ),
        };
      }
      const lines = list.map(
        (w) => `• ${w.name} [${w.status}] (${w.step_count} 步骤, 运行 ${w.run_count} 次)`
      );
      return {
        message: t(lang, '⚡ 自动化流程：\n', '⚡ Workflows:\n') +
          lines.join('\n'),
      };
    }
    case 'run_workflow': {
      const wfId = slots.workflow_id as string;
      if (!wfId) {
        return {
          message: t(lang,
            '请提供流程ID',
            'Please provide workflow ID'
          ),
        };
      }
      const result = await workflowSvc.runWorkflow(agentId, wfId);
      return {
        message: t(lang,
          `🚀 流程「${result.name}」已开始执行 (${result.steps} 步骤)`,
          `🚀 Workflow "${result.name}" started (${result.steps} steps)`
        ),
      };
    }
    case 'delete_workflow': {
      const wfId = slots.workflow_id as string;
      if (!wfId) {
        return {
          message: t(lang,
            '请提供流程ID',
            'Please provide workflow ID'
          ),
        };
      }
      await workflowSvc.deleteWorkflow(agentId, wfId);
      return {
        message: t(lang,
          '✅ 流程已删除',
          '✅ Workflow deleted'
        ),
      };
    }
    case 'schedule_workflow': {
      const wfId = slots.workflow_id as string;
      if (!wfId) {
        return {
          message: t(lang,
            '请提供流程ID，例如: 每天运行流程 wf_xxx',
            'Please provide workflow ID'
          ),
        };
      }
      await prisma.workflow.update({
        where: { workflowId: wfId },
        data: {
          triggerType: 'scheduled',
          scheduleCron: '0 0 * * *',
          scheduleTimezone: 'UTC',
        },
      });
      return {
        message: t(lang,
          `⏰ 流程 ${wfId} 已设置为每日执行 (00:00 UTC)`,
          `⏰ Workflow ${wfId} scheduled daily (00:00 UTC)`
        ),
      };
    }
    default:
      return {
        message: t(lang,
          '⏳ 该流程功能即将上线',
          '⏳ This workflow feature is coming soon'
        ),
      };
  }
}

/* ─── Phase 4: System ─── */

async function executeSystemIntent(
  slots: Record<string, unknown>,
  user: NLUserContext,
  lang: Lang
): Promise<ExecResult> {
  const intent = slots._intent as string;
  const agentId = await resolveAgentId(user);

  switch (intent) {
    case 'system_status': {
      const s = await systemSvc.getSystemStatus(agentId);
      return {
        message: t(lang,
          `🔧 系统状态: ${s.status}\n` +
          `  配置数: ${s.profiles}\n` +
          `  运行中浏览器: ${s.running_browsers}\n` +
          `  排队任务: ${s.queued_tasks}\n` +
          `  运行时间: ${s.uptime_seconds}s`,
          `🔧 System: ${s.status}\n` +
          `  Profiles: ${s.profiles}\n` +
          `  Running browsers: ${s.running_browsers}\n` +
          `  Queued tasks: ${s.queued_tasks}\n` +
          `  Uptime: ${s.uptime_seconds}s`
        ),
      };
    }
    case 'resource_usage': {
      const r = await systemSvc.getResourceUsage();
      return {
        message: t(lang,
          `📊 资源使用:\n` +
          `  堆内存: ${r.memory.heap_used_mb}MB / ${r.memory.heap_total_mb}MB\n` +
          `  RSS: ${r.memory.rss_mb}MB\n` +
          `  CPU: ${r.cpu.cores} 核\n` +
          `  负载: ${r.cpu.load_avg.map((v: number) => v.toFixed(2)).join(', ')}`,
          `📊 Resources:\n` +
          `  Heap: ${r.memory.heap_used_mb}MB / ${r.memory.heap_total_mb}MB\n` +
          `  RSS: ${r.memory.rss_mb}MB\n` +
          `  CPU: ${r.cpu.cores} cores\n` +
          `  Load: ${r.cpu.load_avg.map((v: number) => v.toFixed(2)).join(', ')}`
        ),
      };
    }
    case 'view_logs': {
      const logs = await systemSvc.getRecentLogs(agentId, 10);
      if (!logs.length) {
        return {
          message: t(lang, '📋 暂无日志', '📋 No logs yet'),
        };
      }
      const lines = logs.map(
        (l) => `${l.method} ${l.path} → ${l.status ?? '?'} (${l.latency_ms ?? '?'}ms)`
      );
      return {
        message: t(lang, '📋 最近操作日志：\n', '📋 Recent logs:\n') +
          lines.join('\n'),
      };
    }
    default:
      return {
        message: t(lang,
          '⏳ 该系统功能即将上线',
          '⏳ This system feature is coming soon'
        ),
      };
  }
}

/* ─── Phase 4: Browser Actions ─── */

async function executeBrowserActionIntent(
  slots: Record<string, unknown>,
  user: NLUserContext,
  lang: Lang
): Promise<ExecResult> {
  const intent = slots._intent as string;
  const agentId = await resolveAgentId(user);
  const instanceId = slots.instance_id as string;
  const selector = slots.selector as string;

  if (!instanceId && intent !== 'download_file') {
    return {
      message: t(lang,
        '请提供浏览器实例ID，例如: 在浏览器 inst_xxx 点击 #btn',
        'Please provide instance ID'
      ),
    };
  }

  switch (intent) {
    case 'click_element': {
      if (!selector) {
        return {
          message: t(lang,
            '请提供选择器，例如: 点击 #login',
            'Please provide a selector'
          ),
        };
      }
      const r = await browserSvc.executeActions(
        agentId, instanceId,
        { actions: [{ type: 'click', selector }] }
      );
      return {
        message: t(lang,
          `✅ 已点击元素 ${selector} (${r.total_duration_ms}ms)`,
          `✅ Clicked ${selector} (${r.total_duration_ms}ms)`
        ),
      };
    }
    case 'input_text': {
      const text = (slots.text as string) || '';
      if (!selector || !text) {
        return {
          message: t(lang,
            '请提供选择器和文本，例如: 在 #search 输入 "iphone"',
            'Please provide selector and text'
          ),
        };
      }
      const r = await browserSvc.executeActions(
        agentId, instanceId,
        { actions: [{ type: 'fill', selector, value: text }] }
      );
      return {
        message: t(lang,
          `✅ 已在 ${selector} 输入 "${text}" (${r.total_duration_ms}ms)`,
          `✅ Typed "${text}" in ${selector} (${r.total_duration_ms}ms)`
        ),
      };
    }
    case 'scroll_page': {
      const dir = (slots.direction as string) || 'down';
      const r = await browserSvc.executeActions(
        agentId, instanceId,
        { actions: [{ type: 'scroll', direction: dir }] }
      );
      return {
        message: t(lang,
          `✅ 页面已${dir === 'up' ? '上' : '下'}滚 (${r.total_duration_ms}ms)`,
          `✅ Scrolled ${dir} (${r.total_duration_ms}ms)`
        ),
      };
    }
    case 'wait_for_element': {
      if (!selector) {
        return {
          message: t(lang,
            '请提供等待的选择器',
            'Please provide a selector to wait for'
          ),
        };
      }
      const r = await browserSvc.executeActions(
        agentId, instanceId,
        { actions: [{
          type: 'wait',
          selector,
          state: 'visible',
          timeout_ms: 10000,
        }] }
      );
      return {
        message: t(lang,
          `✅ 元素 ${selector} 已出现 (${r.total_duration_ms}ms)`,
          `✅ Element ${selector} appeared (${r.total_duration_ms}ms)`
        ),
      };
    }
    case 'hover_element': {
      if (!selector) {
        return {
          message: t(lang,
            '请提供选择器',
            'Please provide a selector'
          ),
        };
      }
      const r = await browserSvc.executeActions(
        agentId, instanceId,
        { actions: [{ type: 'hover', selector }] }
      );
      return {
        message: t(lang,
          `✅ 已悬停在 ${selector} (${r.total_duration_ms}ms)`,
          `✅ Hovered over ${selector} (${r.total_duration_ms}ms)`
        ),
      };
    }
    case 'select_option': {
      if (!selector) {
        return {
          message: t(lang,
            '请提供选择器',
            'Please provide a selector'
          ),
        };
      }
      const val = (slots.text as string) || '';
      const r = await browserSvc.executeActions(
        agentId, instanceId,
        { actions: [{
          type: 'select', selector, values: val ? [val] : [],
        }] }
      );
      return {
        message: t(lang,
          `✅ 已选择 ${selector} (${r.total_duration_ms}ms)`,
          `✅ Selected in ${selector} (${r.total_duration_ms}ms)`
        ),
      };
    }
    case 'extract_text': {
      const script = selector
        ? `document.querySelector('${selector}')?.textContent || ''`
        : 'document.body.innerText.slice(0, 2000)';
      const r = await browserSvc.evaluate(
        agentId, instanceId, script
      );
      return {
        message: t(lang,
          `📄 提取结果 (${r.duration_ms}ms):\n${r.result ?? '(空)'}`,
          `📄 Extracted (${r.duration_ms}ms):\n${r.result ?? '(empty)'}`
        ),
      };
    }
    case 'extract_html': {
      const script = selector
        ? `document.querySelector('${selector}')?.innerHTML || ''`
        : 'document.documentElement.outerHTML.slice(0, 5000)';
      const r = await browserSvc.evaluate(
        agentId, instanceId, script
      );
      return {
        message: t(lang,
          `📄 HTML 提取完成 (${r.duration_ms}ms)`,
          `📄 HTML extracted (${r.duration_ms}ms)`
        ),
        data: { html: r.result },
      };
    }
    case 'extract_links': {
      const script =
        `JSON.stringify([...document.querySelectorAll('a[href]')]` +
        `.map(a => ({text: a.textContent?.trim(), href: a.href}))` +
        `.slice(0, 100))`;
      const r = await browserSvc.evaluate(
        agentId, instanceId, script
      );
      return {
        message: t(lang,
          `🔗 链接提取完成 (${r.duration_ms}ms)`,
          `🔗 Links extracted (${r.duration_ms}ms)`
        ),
        data: { links: r.result },
      };
    }
    case 'extract_table': {
      const sel = selector || 'table';
      const script =
        `JSON.stringify((() => {` +
        `const t = document.querySelector('${sel}');` +
        `if(!t) return [];` +
        `return [...t.rows].map(r =>` +
        `  [...r.cells].map(c => c.textContent?.trim())` +
        `).slice(0, 200);` +
        `})())`;
      const r = await browserSvc.evaluate(
        agentId, instanceId, script
      );
      return {
        message: t(lang,
          `📊 表格提取完成 (${r.duration_ms}ms)`,
          `📊 Table extracted (${r.duration_ms}ms)`
        ),
        data: { table: r.result },
      };
    }
    case 'export_cookies': {
      const r = await browserSvc.executeActions(
        agentId, instanceId,
        { actions: [{ type: 'getCookies' }] }
      );
      return {
        message: t(lang,
          `🍪 Cookie 导出完成 (${r.total_duration_ms}ms)`,
          `🍪 Cookies exported (${r.total_duration_ms}ms)`
        ),
        data: { cookies: r.results },
      };
    }
    case 'import_cookies': {
      const r = await browserSvc.executeActions(
        agentId, instanceId,
        { actions: [{ type: 'setCookies' }] }
      );
      return {
        message: t(lang,
          `🍪 Cookie 导入完成 (${r.total_duration_ms}ms)`,
          `🍪 Cookies imported (${r.total_duration_ms}ms)`
        ),
      };
    }
    case 'clear_cookies': {
      const r = await browserSvc.executeActions(
        agentId, instanceId,
        { actions: [{ type: 'clearCookies' }] }
      );
      return {
        message: t(lang,
          `🍪 Cookie 已清除 (${r.total_duration_ms}ms)`,
          `🍪 Cookies cleared (${r.total_duration_ms}ms)`
        ),
      };
    }
    case 'upload_file': {
      const filePath = slots.file_path as string;
      const r = await browserSvc.executeActions(
        agentId, instanceId,
        { actions: [{
          type: 'upload',
          selector: selector || 'input[type="file"]',
          file_path: filePath,
        }] }
      );
      return {
        message: t(lang,
          `📁 文件上传完成 (${r.total_duration_ms}ms)`,
          `📁 File uploaded (${r.total_duration_ms}ms)`
        ),
      };
    }
    case 'download_file': {
      const url = slots.url as string;
      if (!instanceId || !url) {
        return {
          message: t(lang,
            '请提供实例ID和下载URL',
            'Please provide instance ID and URL'
          ),
        };
      }
      const r = await browserSvc.executeActions(
        agentId, instanceId,
        { actions: [{
          type: 'download', url,
        }] }
      );
      return {
        message: t(lang,
          `⬇️ 文件下载已启动 (${r.total_duration_ms}ms)`,
          `⬇️ Download started (${r.total_duration_ms}ms)`
        ),
      };
    }
    default:
      return {
        message: t(lang,
          `⏳ 浏览器操作「${intent}」即将上线`,
          `⏳ Browser action "${intent}" coming soon`
        ),
      };
  }
}

/* ─── Phase 4: Data Management ─── */

async function executeDataIntent(
  slots: Record<string, unknown>,
  user: NLUserContext,
  lang: Lang
): Promise<ExecResult> {
  const intent = slots._intent as string;
  const agentId = await resolveAgentId(user);
  const profileId = slots.profile_id as string;

  if (!profileId) {
    return {
      message: t(lang,
        '请提供配置ID，例如: 导出配置 prof_xxx 的数据',
        'Please provide profile ID'
      ),
    };
  }

  const profile = await prisma.browserProfile.findFirst({
    where: { profileId, agentId },
  });
  if (!profile) {
    return {
      message: t(lang,
        `❌ 未找到配置 ${profileId}`,
        `❌ Profile ${profileId} not found`
      ),
    };
  }

  switch (intent) {
    case 'export_browser_data': {
      const data = {
        profile_id: profileId,
        fingerprint: profile.fingerprint,
        storage_data: profile.storageData,
        proxy_binding: profile.proxyBinding,
        extensions: profile.extensions,
        tags: profile.tags,
      };
      return {
        message: t(lang,
          `📦 配置 ${profileId} 数据已导出`,
          `📦 Profile ${profileId} data exported`
        ),
        data,
      };
    }
    case 'import_browser_data': {
      return {
        message: t(lang,
          `📦 配置 ${profileId} 数据导入功能已就绪，请通过 API 提交数据`,
          `📦 Profile ${profileId} data import ready, submit via API`
        ),
        suggestions: [
          t(lang,
            `PUT /v1/profiles/${profileId}`,
            `PUT /v1/profiles/${profileId}`
          ),
        ],
      };
    }
    case 'clear_cache': {
      const storage = (profile.storageData ?? {}) as Record<
        string, unknown
      >;
      await prisma.browserProfile.update({
        where: { id: profile.id },
        data: {
          storageData: { ...storage, cache: null },
        },
      });
      return {
        message: t(lang,
          `🧹 配置 ${profileId} 的缓存已清理`,
          `🧹 Cache cleared for ${profileId}`
        ),
      };
    }
    case 'clear_storage': {
      await prisma.browserProfile.update({
        where: { id: profile.id },
        data: { storageData: {} },
      });
      return {
        message: t(lang,
          `🧹 配置 ${profileId} 的存储数据已清理`,
          `🧹 Storage cleared for ${profileId}`
        ),
      };
    }
    default:
      return {
        message: t(lang,
          `⏳ 数据管理「${intent}」即将上线`,
          `⏳ Data management "${intent}" coming soon`
        ),
      };
  }
}

/* ─── NL History Query ─── */

export async function executeQueryNlHistory(
  slots: Record<string, unknown>,
  user: NLUserContext,
  lang: Lang
): Promise<ExecResult> {
  const { queryNlChatLogs } =
    await import('./nl-history.service');

  const page = (slots.page as number) || 1;
  const count = (slots.count as number) || DEFAULT_PAGE_SIZE;
  const pageSize = Math.min(count, 100);
  const targetUser =
    slots.target_user as string | undefined;
  const search =
    slots.search as string | undefined;

  const params: {
    userId?: number;
    username?: string;
    search?: string;
    page: number;
    pageSize: number;
  } = { page, pageSize };

  if (user.isAdmin && targetUser) {
    params.username = targetUser;
  } else if (!user.isAdmin) {
    params.userId = user.userId;
  }

  if (search) params.search = search;

  const { list, total } =
    await queryNlChatLogs(params);

  if (list.length === 0) {
    return {
      message: t(
        lang,
        '📭 暂无历史记录。',
        '📭 No history found.'
      ),
      data: { list: [], total: 0 },
    };
  }

  const title = user.isAdmin && !targetUser
    ? t(
        lang,
        `📜 所有用户对话历史（第 ${page} 页）`,
        `📜 All Users Chat History (Page ${page})`
      )
    : user.isAdmin && targetUser
      ? t(
          lang,
          `📜 用户 ${targetUser} 的对话历史` +
            `（第 ${page} 页）`,
          `📜 History of ${targetUser}` +
            ` (Page ${page})`
        )
      : t(
          lang,
          `📜 我的对话历史（第 ${page} 页）`,
          `📜 My Chat History (Page ${page})`
        );

  let msg = title + '\n\n';

  for (let i = 0; i < list.length; i++) {
    const item = list[i];
    const idx = (page - 1) * pageSize + i + 1;
    const time = item.createdAt
      .toISOString()
      .replace('T', ' ')
      .slice(0, 16);
    const intent = item.intent || '—';
    const uname = user.isAdmin
      ? `[${item.username}] ` : '';
    const userQ = item.userMessage.length > 40
      ? item.userMessage.slice(0, 40) + '…'
      : item.userMessage;
    const sysA = item.assistantMessage.length > 60
      ? item.assistantMessage.slice(0, 60) + '…'
      : item.assistantMessage;

    msg +=
      `${idx}. ${uname}${time}\n` +
      `   ${t(lang, '意图', 'Intent')}: ` +
      `${intent}\n` +
      `   ${t(lang, '用户', 'User')}: ${userQ}\n` +
      `   ${t(lang, '系统', 'System')}: ` +
      `${sysA}\n\n`;
  }

  msg += paginationFooter(
    page, pageSize, total, lang
  );

  const safeList = list.map((item) => ({
    ...item,
    id: item.id.toString(),
    createdAt: item.createdAt.toISOString(),
  }));

  return {
    message: msg.trim(),
    data: { list: safeList, total },
  };
}

/* ─── Follow-up (Multi-turn) Handlers ─── */

import type {
  FollowUpInfo,
} from './intent-parser';
import type {
  LastResult,
} from './conversation-context';

export async function executeFollowUpSelect(
  slots: Record<string, unknown>,
  user: NLUserContext,
  lang: Lang
): Promise<ExecResult> {
  const fu = slots._followUp as FollowUpInfo;
  const lr = slots._lastResult as LastResult;
  if (!fu || !lr) {
    return {
      message: t(
        lang,
        '没有找到上下文，请先执行一次查询。',
        'No context found. Please run a query first.'
      ),
    };
  }

  const items = lr.items;
  if (fu.indices && fu.indices.length > 0) {
    return selectByIndices(items, fu.indices, lang);
  }
  if (fu.quantity) {
    const selected = items.slice(0, fu.quantity);
    return formatSelected(
      selected, lr.intent, lang
    );
  }
  return formatSelected(items, lr.intent, lang);
}

export async function executeFollowUpRecommend(
  slots: Record<string, unknown>,
  user: NLUserContext,
  lang: Lang
): Promise<ExecResult> {
  const fu = slots._followUp as FollowUpInfo;
  const lr = slots._lastResult as LastResult;
  if (!fu || !lr) {
    return {
      message: t(
        lang,
        '没有找到上下文，请先执行一次查询。',
        'No context found. Please run a query first.'
      ),
    };
  }

  const items = [...lr.items];
  const qty = fu.quantity || 2;

  if (fu.criteria === 'cheapest') {
    items.sort((a, b) => {
      const pa = numVal(a, 'price', 'globalPrice');
      const pb = numVal(b, 'price', 'globalPrice');
      return pa - pb;
    });
  } else if (fu.criteria === 'best_quality') {
    items.sort((a, b) => {
      const sa = numVal(b, 'stock');
      const sb = numVal(a, 'stock');
      return sa - sb;
    });
  } else if (fu.criteria === 'most_stock') {
    items.sort((a, b) =>
      numVal(b, 'stock') - numVal(a, 'stock')
    );
  }

  const selected = items.slice(0, qty);
  const lines: string[] = [];
  const criteriaLabel = fu.criteria === 'cheapest'
    ? t(lang, '最便宜', 'cheapest')
    : fu.criteria === 'best_quality'
      ? t(lang, '质量最好', 'best quality')
      : t(lang, '库存最多', 'most stock');

  lines.push(t(
    lang,
    `🎯 为您推荐 ${criteriaLabel} 的` +
      ` ${selected.length} 个产品：\n`,
    `🎯 Top ${selected.length} ` +
      `${criteriaLabel} products:\n`
  ));

  for (let i = 0; i < selected.length; i++) {
    lines.push(formatProductLine(
      i + 1, selected[i], lang
    ));
  }

  lines.push('');
  lines.push(t(
    lang,
    '您可以输入：\n' +
      '• "帮我开通第1个" — 购买选中的产品\n' +
      '• "选第2个" — 查看详情\n' +
      '• "换便宜的" — 重新筛选',
    'You can type:\n' +
      '• "Purchase #1"\n' +
      '• "Select #2" — view details\n' +
      '• "Show cheapest" — re-filter'
  ));

  return {
    message: lines.join('\n'),
    suggestions: lang === 'zh'
      ? ['帮我开通第1个', '选第2个', '换便宜的']
      : ['Purchase #1', 'Select #2', 'Cheapest'],
    data: { products: selected },
  };
}

export async function executeFollowUpAction(
  slots: Record<string, unknown>,
  user: NLUserContext,
  lang: Lang
): Promise<ExecResult> {
  const fu = slots._followUp as FollowUpInfo;
  const lr = slots._lastResult as LastResult;
  if (!fu || !lr) {
    return {
      message: t(
        lang,
        '没有找到上下文，请先执行一次查询。',
        'No context found. Please run a query first.'
      ),
    };
  }

  const items = lr.items;

  if (fu.action === 'purchase') {
    let target: Record<string, unknown>;
    if (fu.indices && fu.indices.length > 0) {
      const idx = fu.indices[0] - 1;
      if (idx < 0 || idx >= items.length) {
        return {
          message: t(
            lang,
            `序号超出范围，共 ${items.length} 个。`,
            `Index out of range (${items.length} items).`
          ),
        };
      }
      target = items[idx];
    } else {
      target = items[0];
    }

    const productNo =
      (target.product_no as string) ??
      (target.productNo as string) ?? '';
    const country =
      (target.country as string) ?? '';
    const city =
      (target.city as string) ?? '';

    if (!productNo) {
      return {
        message: t(
          lang,
          '未找到产品编号，请直接使用购买命令。',
          'Product ID not found. Use purchase command.'
        ),
      };
    }

    const state = (target.state as string) ?? '';
    const cn = country
      ? countryCodeToName(country) : '';
    const st = state
      ? stateCodeToName(state) : '';
    const ct = city ? codeToName(city) : '';
    const locParts: string[] = [];
    if (cn) locParts.push(cn);
    if (st && st !== cn && st !== ct)
      locParts.push(st);
    if (ct && ct !== cn) locParts.push(ct);
    const loc = locParts.join('-') || '—';

    const ip =
      (target.ipRange as string) ??
      (target.ip as string) ?? '';
    const cleanIp = ip.replace(/\/\d+$/, '');
    const price =
      (target.price as number) ??
      (target.globalPrice as number) ?? 0;

    const ipLine = cleanIp
      ? `• IP: ${cleanIp}\n` : '';
    return {
      message: t(
        lang,
        `📦 已为您选中产品：\n` +
          `${ipLine}` +
          `• 位置: ${loc}\n` +
          `• 价格: ¥${price}\n\n` +
          `确认开通吗？(回复"确认"执行购买)`,
        `📦 Selected product:\n` +
          `${ipLine}` +
          `• Location: ${loc}\n` +
          `• Price: ¥${price}\n\n` +
          `Confirm purchase? (reply "confirm")`
      ),
      suggestions: lang === 'zh'
        ? ['确认', '取消', '换一个']
        : ['Confirm', 'Cancel', 'Change'],
      data: {
        selectedProduct: target,
        product_no: productNo,
      },
    };
  }

  return {
    message: t(
      lang,
      '请告诉我要执行什么操作。',
      'Please specify the action to perform.'
    ),
  };
}

export async function executeFollowUpRefine(
  slots: Record<string, unknown>,
  user: NLUserContext,
  lang: Lang
): Promise<ExecResult> {
  const fu = slots._followUp as FollowUpInfo;
  const lr = slots._lastResult as LastResult;
  if (!fu || !lr) {
    return {
      message: t(
        lang,
        '没有找到上下文，请先执行一次查询。',
        'No context found. Please run a query first.'
      ),
    };
  }

  const items = [...lr.items];
  if (fu.criteria === 'cheapest') {
    items.sort((a, b) =>
      numVal(a, 'price', 'globalPrice') -
      numVal(b, 'price', 'globalPrice')
    );
  } else if (fu.criteria === 'most_stock') {
    items.sort((a, b) =>
      numVal(b, 'stock') - numVal(a, 'stock')
    );
  }

  return formatSelected(items, lr.intent, lang);
}

function numVal(
  item: Record<string, unknown>,
  ...keys: string[]
): number {
  for (const k of keys) {
    const v = item[k];
    if (typeof v === 'number') return v;
  }
  return Infinity;
}

function selectByIndices(
  items: Array<Record<string, unknown>>,
  indices: number[],
  lang: Lang
): ExecResult {
  const selected: Array<Record<string, unknown>> = [];
  for (const idx of indices) {
    const i = idx - 1;
    if (i >= 0 && i < items.length) {
      selected.push(items[i]);
    }
  }
  if (selected.length === 0) {
    return {
      message: t(
        lang,
        `序号超出范围，共 ${items.length} 个。`,
        `Index out of range (${items.length} items).`
      ),
    };
  }
  const lines: string[] = [];
  lines.push(t(
    lang,
    `📋 您选中的 ${selected.length} 个产品：\n`,
    `📋 ${selected.length} selected:\n`
  ));
  for (let i = 0; i < selected.length; i++) {
    lines.push(formatProductLine(
      i + 1, selected[i], lang
    ));
  }
  lines.push('');
  lines.push(t(
    lang,
    '输入 "帮我开通" 可直接购买。',
    'Type "purchase" to buy.'
  ));
  return {
    message: lines.join('\n'),
    suggestions: lang === 'zh'
      ? ['帮我开通', '换一个', '查看其他']
      : ['Purchase', 'Change', 'View others'],
    data: { products: selected },
  };
}

function formatSelected(
  items: Array<Record<string, unknown>>,
  prevIntent: string,
  lang: Lang
): ExecResult {
  const lines: string[] = [];
  const show = items.slice(0, 10);
  lines.push(t(
    lang,
    `📋 您选中的 ${show.length} 个产品：\n`,
    `📋 ${show.length} selected:\n`
  ));
  for (let i = 0; i < show.length; i++) {
    lines.push(formatProductLine(
      i + 1, show[i], lang
    ));
  }
  if (items.length > 10) {
    lines.push(t(
      lang,
      `\n... 还有 ${items.length - 10} 个`,
      `\n... ${items.length - 10} more`
    ));
  }
  lines.push('');
  lines.push(t(
    lang,
    '输入 "帮我开通" 可直接购买。',
    'Type "purchase" to buy.'
  ));
  return {
    message: lines.join('\n'),
    data: { products: items },
  };
}

function formatProductLine(
  idx: number,
  item: Record<string, unknown>,
  lang: Lang
): string {
  const country =
    (item.country as string) ?? '';
  const state =
    (item.state as string) ?? '';
  const city =
    (item.city as string) ?? '';
  const cn = country
    ? countryCodeToName(country) : '';
  const st = state
    ? stateCodeToName(state) : '';
  const ct = city ? codeToName(city) : '';
  const parts: string[] = [];
  if (cn) parts.push(cn);
  if (st && st !== cn && st !== ct)
    parts.push(st);
  if (ct && ct !== cn) parts.push(ct);
  const loc = parts.join('-') || '—';

  const stock = item.stock ?? 0;
  const price =
    (item.price as number) ??
    (item.globalPrice as number) ?? 0;
  const ip =
    (item.ipRange as string) ??
    (item.ip as string) ?? '';
  const cleanIp = ip
    ? ` | ${ip.replace(/\/\d+$/, '')}`
    : '';
  return (
    `${idx}. ${loc}` +
    t(lang, '  库存: ', '  Stock: ') +
    `${fmtNum(stock as number)}` +
    t(lang, '  售价: ¥', '  Price: ¥') +
    `${price}${cleanIp}`
  );
}

/* ─── Handler Map ─── */

export const INTENT_HANDLERS: Record<
  string,
  IntentHandler
> = {
  query_users: executeQueryUsers,
  create_user: executeCreateUser,
  batch_create_users: executeBatchCreateUsers,
  assign_balance: executeAssignBalance,
  reset_password: executeResetPassword,
  get_referral_code: executeGetReferralCode,
  query_balance: executeQueryBalance,
  query_stats: executeQueryStats,
  query_dashboard: executeQueryDashboard,
  query_dynamic_resource: executeQueryDynamicResource,
  query_static_resource: executeQueryStaticResource,
  query_user_detail: executeQueryUserDetail,
  query_today_orders: executeQueryTodayOrders,
  query_static_products: executeQueryStaticProducts,
  query_products: executeQueryProducts,
  query_ip_inventory: executeQueryIpInventory,
  query_dynamic_orders: executeQueryDynamicOrders,
  query_static_orders: executeQueryStaticOrders,
  query_transactions: executeQueryTransactions,
  purchase_dynamic: executePurchaseDynamic,
  purchase_static: executePurchaseStatic,
  purchase_ip: executePurchaseIp,
  create_session: executeCreateSession,
  extract_dynamic: executeExtractDynamic,
  query_expiring_ips: executeQueryExpiringIps,
  query_ip_info: executeQueryIpInfo,
  generate_proxy_qr: executeGenerateProxyQr,
  renew_static: executeRenewStatic,
  set_product_price: executeSetProductPrice,
  check_ip_quality: executeCheckIpQuality,
  find_best_ip: executeFindBestIp,
  find_and_evaluate_ips: executeFindAndEvaluateIps,
  refine_search_results: executeRefineSearchResults,
  recommend_best_match: executeRecommendBestMatch,
  // Phase 2: Profile Management
  create_profile: executeProfileIntent,
  list_profiles: executeProfileIntent,
  update_profile: executeProfileIntent,
  delete_profile: executeProfileIntent,
  duplicate_profile: executeProfileIntent,
  batch_create_profiles: executeProfileIntent,
  generate_fingerprint: executeProfileIntent,
  bind_proxy: executeProfileIntent,
  import_profile: executeProfileIntent,
  export_profile: executeProfileIntent,
  group_profile: executeProfileIntent,
  tag_profile: executeProfileIntent,
  // Phase 2: Fingerprint Control
  set_user_agent: executeProfileIntent,
  set_timezone: executeProfileIntent,
  set_language: executeProfileIntent,
  set_canvas: executeProfileIntent,
  set_webgl: executeProfileIntent,
  set_audio: executeProfileIntent,
  set_webrtc: executeProfileIntent,
  set_fonts: executeProfileIntent,
  set_plugins: executeProfileIntent,
  set_client_hints: executeProfileIntent,
  // Phase 2: Proxy Management
  add_proxy: executeProfileIntent,
  import_proxy: executeProfileIntent,
  verify_proxy: executeProfileIntent,
  rotate_proxy: executeProfileIntent,
  list_proxy: executeProfileIntent,
  // Phase 2: Validation
  validate_fingerprint: executeProfileIntent,
  auto_match_proxy: executeProfileIntent,
  // Phase 3: Browser Management
  launch_browser: executeBrowserIntent,
  close_browser: executeBrowserIntent,
  restart_browser: executeBrowserIntent,
  batch_launch_browser: executeBrowserIntent,
  batch_close_browser: executeBrowserIntent,
  list_browsers: executeBrowserIntent,
  navigate_to: executeBrowserIntent,
  take_screenshot: executeBrowserIntent,
  // Phase 3: Task Management
  submit_task: executeBrowserIntent,
  run_script: executeBrowserIntent,
  schedule_task: executeBrowserIntent,
  batch_task: executeBrowserIntent,
  query_task: executeBrowserIntent,
  run_detection_test: executeBrowserIntent,
  // Phase 4: Profile Lifecycle
  pause_profile: executeProfileIntent,
  resume_profile: executeProfileIntent,
  archive_profile: executeProfileIntent,
  // Phase 4: Extended Fingerprints
  set_os: executeProfileIntent,
  set_cpu: executeProfileIntent,
  set_memory: executeProfileIntent,
  set_gpu: executeProfileIntent,
  set_screen: executeProfileIntent,
  set_media_devices: executeProfileIntent,
  set_battery: executeProfileIntent,
  set_webgpu: executeProfileIntent,
  set_navigator: executeProfileIntent,
  set_device_memory: executeProfileIntent,
  set_gamepad: executeProfileIntent,
  // Phase 4: Proxy Expansion
  delete_proxy: executeProfileIntent,
  proxy_speed_test: executeProfileIntent,
  proxy_quality_check: executeProfileIntent,
  create_proxy_pool: executeWorkspaceIntent,
  list_proxy_pools: executeWorkspaceIntent,
  delete_proxy_pool: executeWorkspaceIntent,
  auto_select_proxy: executeProfileIntent,
  // Phase 4: Browser Page Actions
  click_element: executeBrowserActionIntent,
  input_text: executeBrowserActionIntent,
  scroll_page: executeBrowserActionIntent,
  wait_for_element: executeBrowserActionIntent,
  hover_element: executeBrowserActionIntent,
  select_option: executeBrowserActionIntent,
  extract_text: executeBrowserActionIntent,
  extract_html: executeBrowserActionIntent,
  extract_links: executeBrowserActionIntent,
  extract_table: executeBrowserActionIntent,
  export_cookies: executeBrowserActionIntent,
  import_cookies: executeBrowserActionIntent,
  clear_cookies: executeBrowserActionIntent,
  upload_file: executeBrowserActionIntent,
  download_file: executeBrowserActionIntent,
  // Phase 4: Workspace
  create_workspace: executeWorkspaceIntent,
  list_workspaces: executeWorkspaceIntent,
  delete_workspace: executeWorkspaceIntent,
  move_to_workspace: executeWorkspaceIntent,
  // Phase 4: Workflow
  create_workflow: executeWorkflowIntent,
  list_workflows: executeWorkflowIntent,
  run_workflow: executeWorkflowIntent,
  delete_workflow: executeWorkflowIntent,
  schedule_workflow: executeWorkflowIntent,
  // Phase 4: Data Management
  export_browser_data: executeDataIntent,
  import_browser_data: executeDataIntent,
  clear_cache: executeDataIntent,
  clear_storage: executeDataIntent,
  // Phase 4: System
  system_status: executeSystemIntent,
  resource_usage: executeSystemIntent,
  view_logs: executeSystemIntent,
  show_help: executeShowHelp,
  query_nl_history: executeQueryNlHistory,
  follow_up_select: executeFollowUpSelect,
  follow_up_recommend: executeFollowUpRecommend,
  follow_up_action: executeFollowUpAction,
  follow_up_refine: executeFollowUpRefine,
  unknown: executeUnknown,
};
