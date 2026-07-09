import {
  ruleParseIntent,
  detectLang,
  detectCompound,
  resolveReference,
  detectFollowUp,
  type ParsedIntent,
  type FollowUpInfo,
} from './intent-parser';
import {
  resolveGeo,
  countryCodeToName,
  stateCodeToName,
  codeToName,
} from './geo-mapping';
import {
  llmParse,
  llmChat,
  llmParsePlan,
  type PlanStep,
  type ExecutionPlan,
} from './llm-parser';
import {
  INTENT_HANDLERS,
  executeUnknown,
  executeQuerySuggestions,
} from './executor';
import {
  validateIntentCoverage,
} from './capability-registry';
import {
  helpForUnknown,
  helpForPermissionDenied,
  helpForFailure,
} from './help-resolver';
import {
  getOrCreate,
  setPending,
  getPending,
  clearPending,
  setPlan,
  getPlan,
  advancePlan,
  clearPlan,
  PAGINATED_INTENTS,
  type Conversation,
  type PendingPlan,
  type LastResult,
} from './conversation-context';
import type { NLUserContext } from './nl-auth.middleware';
import { saveNlChatLog } from './nl-history.service';
import { createModuleLogger } from '../../utils/logger';

const log = createModuleLogger('nl-service');

function fmtGeoName(
  country?: string,
  state?: string,
  city?: string
): string {
  const cn = country
    ? countryCodeToName(country) : '';
  const st = state
    ? stateCodeToName(state) : '';
  const ct = city ? codeToName(city) : '';
  const parts: string[] = [];
  if (cn) parts.push(cn);
  if (st && st !== cn && st !== ct) parts.push(st);
  if (ct && ct !== cn) parts.push(ct);
  return parts.join('-') || '—';
}

interface NLResult {
  conversation_id: string;
  intent: string;
  message: string;
  data?: Record<string, unknown>;
  suggestions?: string[];
  requires_confirmation?: boolean;
  confirmation_id?: string;
}

validateIntentCoverage(Object.keys(INTENT_HANDLERS));

const CONFIRMATION_INTENTS = new Set([
  'create_user',
  'batch_create_users',
  'assign_balance',
  'reset_password',
  'purchase_ip',
  'purchase_dynamic',
  'purchase_static',
  'create_session',
  'set_product_price',
  'renew_static',
]);

const DISABLED_INTENTS = new Set([
  'create_user',
  'batch_create_users',
]);

const PERMISSION_MAP: Record<
  string,
  ('admin' | 'agent')[]
> = {
  create_user: ['agent'],
  batch_create_users: ['agent'],
  assign_balance: ['agent'],
  query_user_detail: ['agent'],
  set_product_price: ['agent'],
  get_referral_code: ['agent'],
};

function checkPermission(
  intent: string,
  user: NLUserContext
): boolean {
  if (DISABLED_INTENTS.has(intent)) {
    return false;
  }

  const required = PERMISSION_MAP[intent];
  if (!required) return true;
  if (user.isAdmin) return true;
  if (required.includes('agent') && user.isAgent)
    return true;
  return false;
}

function permissionError(lang: 'zh' | 'en'): string {
  return lang === 'zh'
    ? '抱歉，您没有执行此操作的权限。需要代理商或管理员权限。'
    : 'Sorry, you do not have permission. Agent or admin role required.';
}

function buildConversationContext(
  conv: Conversation
): string {
  const parts: string[] = [];

  const recent = conv.messages.slice(-6);
  parts.push(
    recent
      .map((m) => `${m.role}: ${m.content}`)
      .join('\n')
  );

  if (conv.lastResult) {
    const lr = conv.lastResult;
    const age = Date.now() - lr.timestamp;
    if (age < 10 * 60 * 1000) {
      parts.push(
        `[Context] Last query: ${lr.intent}, ` +
        `returned ${lr.items.length} items.`
      );
      if (conv.lastIntent) {
        parts.push(
          `[Context] lastIntent=${conv.lastIntent}`
        );
      }
    }
  }

  return parts.join('\n');
}

export class NLService {
  async execute(
    message: string,
    user: NLUserContext,
    conversationId?: string
  ): Promise<NLResult> {
    const traceId = this.buildTraceId();
    const conv = getOrCreate(
      conversationId,
      user.userId
    );
    log.info({
      event: 'nl_request_received',
      trace_id: traceId,
      conversation_id: conv.id,
      user: user.username,
      message: message.slice(0, 160),
    });
    conv.messages.push({
      role: 'user',
      content: message,
    });

    const result = await this._handleMessage(
      message,
      conv,
      user,
      traceId
    );

    const skip =
      result.intent.startsWith('paginate_');
    if (!skip) {
      void saveNlChatLog({
        userId: user.userId,
        username: user.username,
        conversationId: conv.id,
        userMessage: message,
        assistantMessage: result.message,
        intent: result.intent,
        isAdmin: user.isAdmin,
        isAgent: user.isAgent,
      });
    }

    log.info({
      event: 'nl_request_completed',
      trace_id: traceId,
      conversation_id: conv.id,
      intent: result.intent,
      has_data: !!result.data,
      has_suggestions: !!result.suggestions?.length,
    });
    return result;
  }

  private async _handleMessage(
    message: string,
    conv: Conversation,
    user: NLUserContext,
    traceId: string
  ): Promise<NLResult> {
    const confirmCmd =
      await this.matchConfirmationCommand(
        message, conv, user
      );
    if (confirmCmd) {
      log.info({
        event: 'confirm_statemachine_match',
        trace_id: traceId,
        action: confirmCmd.action,
        user: user.username,
      });
      return confirmCmd.result;
    }

    if (detectCompound(message)) {
      const planResult =
        await this.tryParsePlan(message, conv);
      if (planResult) {
        log.info({
          event: 'compound_detected',
          user: user.username,
          steps: planResult.plan.length,
          message: message.slice(0, 100),
        });
        return this.executePlan(
          conv, planResult, user
        );
      }
    }

    const parsed = await this.parseMessage(
      message,
      conv
    );
    parsed.slots._trace_id = traceId;

    log.info({
      event: 'intent_parsed',
      trace_id: traceId,
      user: user.username,
      message: message.slice(0, 100),
      intent: parsed.intent,
      confidence: parsed.confidence,
      slots: parsed.slots,
      lang: parsed.lang,
    });

    if (!checkPermission(parsed.intent, user)) {
      const help = helpForPermissionDenied(
        parsed.intent,
        user,
        parsed.lang
      );
      conv.messages.push({
        role: 'assistant',
        content: help.message,
      });
      return {
        conversation_id: conv.id,
        intent: parsed.intent,
        message: help.message,
        suggestions: help.suggestions,
      };
    }

    if (parsed.intent === 'unknown') {
      const context =
        buildConversationContext(conv);
      const chatReply = await llmChat(
        message,
        context
      );
      if (chatReply) {
        const helpHint =
          parsed.lang === 'zh'
            ? '\n\n💡 输入 "帮助" 查看所有可用命令'
            : '\n\n💡 Type "help" for all commands';
        conv.messages.push({
          role: 'assistant',
          content: chatReply + helpHint,
        });
        return {
          conversation_id: conv.id,
          intent: 'unknown',
          message: chatReply + helpHint,
          suggestions: [
            parsed.lang === 'zh'
              ? '帮助'
              : 'help',
          ],
        };
      }

      const help = helpForUnknown(
        message,
        user,
        parsed.lang
      );
      conv.messages.push({
        role: 'assistant',
        content: help.message,
      });
      return {
        conversation_id: conv.id,
        intent: 'unknown',
        message: help.message,
        suggestions: help.suggestions,
      };
    }

    this.mergeContextSlots(conv, parsed);

    if (parsed.confirmationRequired) {
      return this.requestConfirmation(
        conv,
        parsed,
        user
      );
    }

    return this.executeIntent(conv, parsed, user);
  }

  async confirm(
    conversationId: string,
    confirmationId: string,
    confirmed: boolean,
    user: NLUserContext
  ): Promise<NLResult> {
    const conv = getOrCreate(
      conversationId,
      user.userId
    );
    const pending = getPending(conv, confirmationId);
    if (!pending) {
      return {
        conversation_id: conv.id,
        intent: 'unknown',
        message: 'No pending confirmation found.',
      };
    }

    clearPending(conv);
    const action = confirmed ? '确认' : '取消';
    const userMsg =
      `[${action}] ${pending.intent}`;

    if (!confirmed) {
      const msg =
        pending.lang === 'zh'
          ? '好的，已取消操作。'
          : 'OK, operation cancelled.';
      conv.messages.push({
        role: 'assistant',
        content: msg,
      });
      clearPlan(conv);
      const suggestions =
        pending.lang === 'zh'
          ? ['查看IP库存', '查看余额', '帮助']
          : ['View IPs', 'Check balance', 'Help'];
      const result: NLResult = {
        conversation_id: conv.id,
        intent: 'cancel_confirmed',
        message: msg,
        suggestions,
      };
      void saveNlChatLog({
        userId: user.userId,
        username: user.username,
        conversationId: conv.id,
        userMessage: userMsg,
        assistantMessage: msg,
        intent: pending.intent,
        isAdmin: user.isAdmin,
        isAgent: user.isAgent,
      });
      return result;
    }

    const handler =
      INTENT_HANDLERS[pending.intent] ||
      executeUnknown;

    try {
      const slotsWithIntent = {
        ...pending.slots,
        _intent: pending.intent,
      };
      const result = await handler(
        slotsWithIntent,
        user,
        pending.lang
      );
      conv.messages.push({
        role: 'assistant',
        content: result.message,
      });

      void saveNlChatLog({
        userId: user.userId,
        username: user.username,
        conversationId: conv.id,
        userMessage: userMsg,
        assistantMessage: result.message,
        intent: pending.intent,
        isAdmin: user.isAdmin,
        isAgent: user.isAgent,
      });

      const plan = getPlan(conv);
      if (plan) {
        advancePlan(conv, {
          step: plan.currentStep,
          intent: pending.intent,
          success: true,
          message: result.message,
          data: result.data,
        });
        return this.continuePlan(
          conv, user, result
        );
      }

      return {
        conversation_id: conv.id,
        intent: pending.intent,
        message: result.message,
        data: result.data,
        suggestions: result.suggestions,
      };
    } catch (err: unknown) {
      const errMsg =
        err instanceof Error
          ? err.message
          : 'Execution failed';
      clearPlan(conv);
      const failMsg = pending.lang === 'zh'
        ? `执行失败: ${errMsg}`
        : `Execution failed: ${errMsg}`;
      void saveNlChatLog({
        userId: user.userId,
        username: user.username,
        conversationId: conv.id,
        userMessage: userMsg,
        assistantMessage: failMsg,
        intent: pending.intent,
        isAdmin: user.isAdmin,
        isAgent: user.isAgent,
      });
      return {
        conversation_id: conv.id,
        intent: pending.intent,
        message: failMsg,
      };
    }
  }

  private async matchConfirmationCommand(
    message: string,
    conv: Conversation,
    user: NLUserContext
  ): Promise<{
    action: string;
    result: NLResult;
  } | null> {
    const p = conv.pendingConfirmation;
    if (!p) return null;

    const t = message.trim().toLowerCase();
    const CONFIRM_RE =
      /^(确认|确定|是的?|好的?|可以|ok|yes|confirm|sure|go\s?ahead|proceed)$/i;
    const CANCEL_RE =
      /^(取消|算了|不要了?|不了|不用了?|cancel|no|nope|never\s?mind)$/i;

    if (CONFIRM_RE.test(t)) {
      return {
        action: 'confirm',
        result: await this.confirm(
          conv.id, p.id, true, user
        ),
      };
    }

    if (CANCEL_RE.test(t)) {
      return {
        action: 'cancel',
        result: await this.confirm(
          conv.id, p.id, false, user
        ),
      };
    }

    return null;
  }

  private async parseMessage(
    message: string,
    conv: Conversation
  ): Promise<ParsedIntent> {
    const dynRefine = this.tryDynamicRefine(
      message, conv
    );
    if (dynRefine) return dynRefine;

    const ruleResult = ruleParseIntent(message);
    if (
      ruleResult.intent !== 'unknown' &&
      ruleResult.confidence > 0
    ) {
      return ruleResult;
    }

    const followUp = this.tryFollowUp(
      message, conv
    );
    if (followUp) return followUp;

    const ref = resolveReference(message);
    if (
      ref.type &&
      conv.searchContext.mode !== 'idle'
    ) {
      const lang = detectLang(message);
      return {
        intent: 'refine_search_results',
        slots: { _ref: ref },
        confidence: 0.7,
        lang,
        confirmationRequired: false,
      };
    }

    const context =
      buildConversationContext(conv);
    const llmResult = await llmParse(
      message,
      context
    );
    if (llmResult && llmResult.confidence >= 0.6) {
      if (DISABLED_INTENTS.has(llmResult.intent)) {
        return {
          intent: 'unknown',
          slots: {},
          confidence: 0,
          lang: llmResult.lang,
          confirmationRequired: false,
        };
      }

      const geo = resolveGeo(message);
      if (
        geo.city && !llmResult.slots.city &&
        !geo.ambiguous
      )
        llmResult.slots.city = geo.city;
      if (geo.country && !llmResult.slots.country)
        llmResult.slots.country = geo.country;
      if (
        geo.candidates.length > 0 ||
        geo.matchedNames.length > 0
      )
        llmResult.slots._geo = geo;
      return {
        intent: llmResult.intent,
        slots: llmResult.slots,
        confidence: llmResult.confidence,
        lang: llmResult.lang,
        confirmationRequired:
          CONFIRMATION_INTENTS.has(
            llmResult.intent
          ),
      };
    }

    if (
      conv.searchContext.mode !== 'idle' &&
      message.length < 20
    ) {
      const lang = detectLang(message);
      return {
        intent: 'refine_search_results',
        slots: {},
        confidence: 0.4,
        lang,
        confirmationRequired: false,
      };
    }

    return {
      intent: 'unknown',
      slots: {},
      confidence: 0,
      lang: detectLang(message),
      confirmationRequired: false,
    };
  }

  private async requestConfirmation(
    conv: Conversation,
    parsed: ParsedIntent,
    user: NLUserContext
  ): Promise<NLResult> {
    const confirmId = setPending(
      conv,
      parsed.intent,
      parsed.slots,
      parsed.lang
    );

    const msg = this.buildConfirmationMessage(
      parsed,
      user
    );

    conv.messages.push({
      role: 'assistant',
      content: msg,
    });

    return {
      conversation_id: conv.id,
      intent: parsed.intent,
      message: msg,
      requires_confirmation: true,
      confirmation_id: confirmId,
    };
  }

  private buildConfirmationMessage(
    parsed: ParsedIntent,
    _user: NLUserContext
  ): string {
    const { intent, slots, lang } = parsed;

    switch (intent) {
      case 'create_user': {
        const u =
          (slots.username as string) ||
          (lang === 'zh' ? '(随机)' : '(random)');
        const role =
          (slots.role as string) || 'user';
        const roleLabel =
          lang === 'zh'
            ? { agent: '代理商', admin: '管理员', user: '普通用户' }[role] || '普通用户'
            : role;
        return lang === 'zh'
          ? `确认创建新用户？\n• 用户名: ${u}\n• 角色: ${roleLabel}\n• 密码: (随机生成)`
          : `Confirm creating a new user?\n• Username: ${u}\n• Role: ${roleLabel}\n• Password: (auto-generated)`;
      }
      case 'assign_balance': {
        const target =
          (slots.target_user as string) || '?';
        const amount =
          (slots.amount as number) || '?';
        return lang === 'zh'
          ? `确认给用户 ${target} 分配 ${amount} 元额度？`
          : `Confirm assigning ¥${amount} to user ${target}?`;
      }
      case 'purchase_ip': {
        const ip =
          (slots.ip_segment as string) || 'N/A';
        const qty =
          (slots.quantity as number) || 1;
        const dur =
          (slots.duration as number) || 30;
        const rmk = slots.remark as string;
        const specified =
          ip !== 'N/A' && !ip.endsWith('.0');
        const ipLine = specified
          ? `• 指定IP: ${ip}`
          : `• IP段: ${ip} (随机分配)`;
        const ipLineEn = specified
          ? `• Assigned IP: ${ip}`
          : `• IP Range: ${ip} (random)`;
        let msg = lang === 'zh'
          ? `确认开通静态代理？\n${ipLine}\n• 数量: ${qty}\n• 时长: ${dur} 天`
          : `Confirm static proxy?\n${ipLineEn}\n• Qty: ${qty}\n• Duration: ${dur} days`;
        if (rmk) msg += lang === 'zh' ? `\n• 备注: ${rmk}` : `\n• Remark: ${rmk}`;
        return msg;
      }
      case 'create_session':
      case 'purchase_dynamic': {
        const gb =
          (slots.traffic_gb as number) || 1;
        const tgt =
          (slots.target_user as string) || '';
        const rmk = slots.remark as string;
        let msg = lang === 'zh'
          ? `确认开通动态代理？\n• 流量: ${gb} GB`
          : `Confirm dynamic proxy?\n• Traffic: ${gb} GB`;
        if (tgt) msg += lang === 'zh' ? `\n• 用户: ${tgt}` : `\n• User: ${tgt}`;
        if (rmk) msg += lang === 'zh' ? `\n• 备注: ${rmk}` : `\n• Remark: ${rmk}`;
        return msg;
      }
      case 'purchase_static': {
        const ip =
          (slots.ip_segment as string) || '';
        const qty =
          (slots.quantity as number) || 1;
        const dur =
          (slots.duration as number) || 30;
        const rmk = slots.remark as string;
        const country =
          (slots.country as string) || '';
        const city =
          (slots.city as string) || '';
        const specified =
          !!ip && !ip.endsWith('.0');
        const cleanIp = ip.replace(/\/\d+$/, '');
        let locPart = '';
        if (cleanIp) {
          locPart = specified
            ? `• 指定IP: ${cleanIp}`
            : `• IP段: ${cleanIp} (随机分配)`;
        } else if (city || country) {
          const loc = fmtGeoName(
            country, '', city
          );
          locPart = lang === 'zh'
            ? `• 地区: ${loc}`
            : `• Location: ${loc}`;
        }
        let msg = lang === 'zh'
          ? `确认开通静态代理？\n${locPart}\n• 数量: ${qty}\n• 时长: ${dur} 天`
          : `Confirm static proxy?\n${locPart}\n• Qty: ${qty}\n• Duration: ${dur} days`;
        if (rmk) msg += lang === 'zh' ? `\n• 备注: ${rmk}` : `\n• Remark: ${rmk}`;
        return msg;
      }
      case 'batch_create_users': {
        const qty =
          (slots.quantity as number) || 5;
        const bal =
          (slots.initial_balance as number) || 0;
        return lang === 'zh'
          ? `确认批量创建用户？\n• 数量: ${qty}\n• 初始额度: ¥${bal}`
          : `Confirm batch creation?\n• Count: ${qty}\n• Initial balance: ¥${bal}`;
      }
      case 'reset_password': {
        const target =
          (slots.target_user as string) ||
          (lang === 'zh' ? '(自己)' : '(self)');
        return lang === 'zh'
          ? `确认重置用户 ${target} 的密码？`
          : `Confirm resetting password for ${target}?`;
      }
      case 'set_product_price': {
        const price = slots.price as number;
        const pid =
          (slots.product_id as string) || '—';
        return lang === 'zh'
          ? `确认设置产品 ${pid} 价格为 ¥${price}？`
          : `Confirm setting product ${pid} price to ¥${price}?`;
      }
      default:
        return lang === 'zh'
          ? '确认执行此操作？'
          : 'Confirm this operation?';
    }
  }

  private async executeIntent(
    conv: Conversation,
    parsed: ParsedIntent,
    user: NLUserContext
  ): Promise<NLResult> {
    const isPaginationIntent =
      parsed.intent.startsWith('paginate_');

    if (isPaginationIntent) {
      return this.handlePagination(
        conv, parsed, user
      );
    }

    const handler =
      INTENT_HANDLERS[parsed.intent] ||
      executeUnknown;

    const execStart = Date.now();
    const traceId =
      (parsed.slots._trace_id as string) || 'n/a';
    try {
      const slotsWithIntent = {
        ...parsed.slots,
        _intent: parsed.intent,
        _searchContext: conv.searchContext,
        _paginationCtx: conv.paginationCtx,
      };
      const result = await handler(
        slotsWithIntent,
        user,
        parsed.lang
      );

      log.info({
        event: 'intent_executed',
        trace_id: traceId,
        intent: parsed.intent,
        user: user.username,
        duration_ms: Date.now() - execStart,
        has_data: !!result.data,
      });

      conv.messages.push({
        role: 'assistant',
        content: result.message,
      });

      conv.lastIntent = parsed.intent;
      Object.assign(
        conv.slotsMemory, parsed.slots
      );

      this.saveLastResult(
        conv, parsed, result
      );

      if (PAGINATED_INTENTS.has(parsed.intent)) {
        const total =
          (result.data?.total as number) ?? 0;
        const page =
          (parsed.slots.page as number) || 1;
        const pageSize =
          (parsed.slots.count as number) || 20;
        conv.paginationCtx = {
          lastListIntent: parsed.intent,
          lastListSlots: { ...parsed.slots },
          lastListLang: parsed.lang,
          currentPage: page,
          pageSize,
          totalCount: total,
        };
      }

      const isActionConfirm =
        parsed.intent === 'follow_up_action' &&
        result.data?.selectedProduct &&
        result.suggestions?.some(
          (s: string) =>
            /确认|confirm/i.test(s)
        );
      if (isActionConfirm) {
        const productNo =
          (result.data?.product_no as string) ??
          '';
        const confirmId = setPending(
          conv,
          'purchase_static',
          {
            ...parsed.slots,
            product_no: productNo,
            _selectedProduct:
              result.data?.selectedProduct,
          },
          parsed.lang
        );
        return {
          conversation_id: conv.id,
          intent: parsed.intent,
          message: result.message,
          data: result.data,
          suggestions: result.suggestions,
          requires_confirmation: true,
          confirmation_id: confirmId,
        };
      }

      return {
        conversation_id: conv.id,
        intent: parsed.intent,
        message: result.message,
        data: result.data,
        suggestions: result.suggestions,
      };
    } catch (err: unknown) {
      const errMsg =
        err instanceof Error
          ? err.message
          : 'Execution failed';

      log.error({
        event: 'intent_exec_error',
        trace_id: traceId,
        intent: parsed.intent,
        user: user.username,
        duration_ms: Date.now() - execStart,
        error: errMsg,
      });

      const baseMsg =
        parsed.lang === 'zh'
          ? `执行失败: ${errMsg}`
          : `Execution failed: ${errMsg}`;
      const recovery = helpForFailure(
        parsed.intent,
        errMsg,
        parsed.lang
      );
      const msg = baseMsg + recovery.recoveryHint;
      conv.messages.push({
        role: 'assistant',
        content: msg,
      });
      return {
        conversation_id: conv.id,
        intent: parsed.intent,
        message: msg,
        suggestions: recovery.suggestions,
      };
    }
  }

  private async handlePagination(
    conv: Conversation,
    parsed: ParsedIntent,
    user: NLUserContext
  ): Promise<NLResult> {
    const ctx = conv.paginationCtx;
    if (!ctx.lastListIntent) {
      const msg = parsed.lang === 'zh'
        ? '⚠️ 没有正在浏览的列表。' +
          '请先查询数据，例如：\n' +
          '- "都有哪些IP"\n' +
          '- "查询静态代理订单"\n' +
          '- "查询交易记录"'
        : '⚠️ No active list. Try:\n' +
          '- "Show all IPs"\n' +
          '- "Show static orders"\n' +
          '- "Show transactions"';
      conv.messages.push({
        role: 'assistant', content: msg,
      });
      return {
        conversation_id: conv.id,
        intent: parsed.intent,
        message: msg,
      };
    }

    if (parsed.intent === 'paginate_view_detail') {
      return this.handleViewDetail(
        conv, parsed, user
      );
    }

    const totalPages = Math.max(
      1,
      Math.ceil(ctx.totalCount / ctx.pageSize)
    );
    let newPage = ctx.currentPage;

    switch (parsed.intent) {
      case 'paginate_next':
        newPage = ctx.currentPage + 1;
        break;
      case 'paginate_prev':
        newPage = ctx.currentPage - 1;
        break;
      case 'paginate_to_page':
        newPage =
          (parsed.slots.page as number) || 1;
        break;
      case 'paginate_change_page_size': {
        const newSize =
          (parsed.slots.page_size as number) ||
          ctx.pageSize;
        ctx.pageSize = Math.min(
          Math.max(newSize, 1), 100
        );
        newPage = 1;
        break;
      }
    }

    if (newPage < 1) {
      const msg = parsed.lang === 'zh'
        ? '⚠️ 已经是第一页了。'
        : '⚠️ Already on the first page.';
      conv.messages.push({
        role: 'assistant', content: msg,
      });
      return {
        conversation_id: conv.id,
        intent: parsed.intent,
        message: msg,
      };
    }

    if (newPage > totalPages) {
      const msg = parsed.lang === 'zh'
        ? `⚠️ 已经是最后一页了。` +
          `当前共 ${totalPages} 页。`
        : `⚠️ Already on the last page. ` +
          `Total ${totalPages} pages.`;
      conv.messages.push({
        role: 'assistant', content: msg,
      });
      return {
        conversation_id: conv.id,
        intent: parsed.intent,
        message: msg,
      };
    }

    const replaySlots = {
      ...ctx.lastListSlots,
      page: newPage,
      count: ctx.pageSize,
    };
    const replayParsed: ParsedIntent = {
      intent: ctx.lastListIntent,
      slots: replaySlots,
      confidence: 1,
      lang: ctx.lastListLang,
      confirmationRequired: false,
    };
    const result = await this.executeIntent(
      conv, replayParsed, user
    );
    result.intent = parsed.intent;
    return result;
  }

  private async handleViewDetail(
    conv: Conversation,
    parsed: ParsedIntent,
    user: NLUserContext
  ): Promise<NLResult> {
    const ctx = conv.paginationCtx;
    const idx =
      (parsed.slots.detail_index as number) || 1;
    const itemsOnPage = Math.min(
      ctx.pageSize,
      ctx.totalCount -
        (ctx.currentPage - 1) * ctx.pageSize
    );
    if (idx < 1 || idx > itemsOnPage) {
      const msg = parsed.lang === 'zh'
        ? `⚠️ 当前页只有 ${itemsOnPage} 条，` +
          `请输入 1-${itemsOnPage} 之间的序号。`
        : `⚠️ Current page has ` +
          `${itemsOnPage} items. ` +
          `Please enter 1-${itemsOnPage}.`;
      conv.messages.push({
        role: 'assistant', content: msg,
      });
      return {
        conversation_id: conv.id,
        intent: parsed.intent,
        message: msg,
      };
    }

    const globalIdx =
      (ctx.currentPage - 1) * ctx.pageSize + idx;
    const msg = parsed.lang === 'zh'
      ? `📋 正在查看第 ${globalIdx} 条` +
        `（当前页第 ${idx} 条）`
      : `📋 Viewing item #${globalIdx}` +
        ` (page item #${idx})`;
    conv.messages.push({
      role: 'assistant', content: msg,
    });
    return {
      conversation_id: conv.id,
      intent: parsed.intent,
      message: msg,
      data: {
        detail_index: idx,
        global_index: globalIdx,
        page: ctx.currentPage,
      },
    };
  }

  private async tryParsePlan(
    message: string,
    conv: Conversation
  ): Promise<ExecutionPlan | null> {
    const context =
      buildConversationContext(conv);
    const plan = await llmParsePlan(
      message, context
    );
    if (!plan || plan.plan.length < 2) return null;
    if (plan.confidence < 0.6) return null;
    return plan;
  }

  private async executePlan(
    conv: Conversation,
    plan: ExecutionPlan,
    user: NLUserContext
  ): Promise<NLResult> {
    setPlan(conv, plan.plan, plan.lang);
    const pending = getPlan(conv)!;
    const msgs: string[] = [];
    const allData: Record<string, unknown>[] = [];
    const stepLabel = plan.lang === 'zh'
      ? '步骤' : 'Step';

    for (
      let i = pending.currentStep;
      i < pending.steps.length;
      i++
    ) {
      const step = pending.steps[i];

      if (!this.shouldRunStep(step, pending)) {
        const skip = plan.lang === 'zh'
          ? `${stepLabel} ${step.step}: 跳过（条件不满足）`
          : `${stepLabel} ${step.step}: Skipped (condition not met)`;
        msgs.push(skip);
        advancePlan(conv, {
          step: step.step,
          intent: step.intent,
          success: false,
          message: skip,
        });
        continue;
      }

      if (!checkPermission(step.intent, user)) {
        const deny = plan.lang === 'zh'
          ? `${stepLabel} ${step.step}: 权限不足`
          : `${stepLabel} ${step.step}: Permission denied`;
        msgs.push(deny);
        break;
      }

      if (
        CONFIRMATION_INTENTS.has(step.intent)
      ) {
        pending.currentStep = i;
        const parsed: ParsedIntent = {
          intent: step.intent,
          slots: step.slots,
          confidence: plan.confidence,
          lang: plan.lang,
          confirmationRequired: true,
        };
        const prefix = msgs.length > 0
          ? msgs.join('\n\n') + '\n\n---\n\n'
          : '';
        const confirmResult =
          this.requestConfirmation(
            conv, parsed, user
          );
        const r = await confirmResult;
        r.message = prefix + r.message;
        r.intent = 'multi_intent';
        return r;
      }

      const parsed: ParsedIntent = {
        intent: step.intent,
        slots: step.slots,
        confidence: plan.confidence,
        lang: plan.lang,
        confirmationRequired: false,
      };

      try {
        const result = await this.executeIntent(
          conv, parsed, user
        );
        msgs.push(
          `**${stepLabel} ${step.step}** ` +
          `(${step.intent})\n${result.message}`
        );
        if (result.data) allData.push(result.data);
        advancePlan(conv, {
          step: step.step,
          intent: step.intent,
          success: true,
          message: result.message,
          data: result.data,
        });
      } catch (err: unknown) {
        const errMsg = err instanceof Error
          ? err.message : 'Failed';
        msgs.push(
          `**${stepLabel} ${step.step}** ` +
          `(${step.intent}): ❌ ${errMsg}`
        );
        advancePlan(conv, {
          step: step.step,
          intent: step.intent,
          success: false,
          message: errMsg,
        });
        break;
      }
    }

    clearPlan(conv);
    const finalMsg = msgs.join('\n\n');
    conv.messages.push({
      role: 'assistant',
      content: finalMsg,
    });
    return {
      conversation_id: conv.id,
      intent: 'multi_intent',
      message: finalMsg,
      data: allData.length > 0
        ? { plan_results: allData }
        : undefined,
    };
  }

  private async continuePlan(
    conv: Conversation,
    user: NLUserContext,
    prevResult: {
      message: string;
      data?: Record<string, unknown>;
    }
  ): Promise<NLResult> {
    const pending = getPlan(conv);
    if (!pending) {
      return {
        conversation_id: conv.id,
        intent: 'multi_intent',
        message: prevResult.message,
        data: prevResult.data,
      };
    }

    const plan: ExecutionPlan = {
      plan: pending.steps,
      lang: pending.lang,
      confidence: 0.9,
    };

    const msgs = [prevResult.message];
    const stepLabel = pending.lang === 'zh'
      ? '步骤' : 'Step';

    for (
      let i = pending.currentStep;
      i < pending.steps.length;
      i++
    ) {
      const step = pending.steps[i];

      if (!this.shouldRunStep(step, pending)) {
        const skip = pending.lang === 'zh'
          ? `${stepLabel} ${step.step}: 跳过`
          : `${stepLabel} ${step.step}: Skipped`;
        msgs.push(skip);
        advancePlan(conv, {
          step: step.step,
          intent: step.intent,
          success: false,
          message: skip,
        });
        continue;
      }

      if (
        CONFIRMATION_INTENTS.has(step.intent)
      ) {
        pending.currentStep = i;
        const parsed: ParsedIntent = {
          intent: step.intent,
          slots: step.slots,
          confidence: plan.confidence,
          lang: plan.lang,
          confirmationRequired: true,
        };
        const prefix = msgs.join('\n\n') +
          '\n\n---\n\n';
        const r = await this.requestConfirmation(
          conv, parsed, user
        );
        r.message = prefix + r.message;
        r.intent = 'multi_intent';
        return r;
      }

      const parsed: ParsedIntent = {
        intent: step.intent,
        slots: step.slots,
        confidence: plan.confidence,
        lang: plan.lang,
        confirmationRequired: false,
      };

      try {
        const result = await this.executeIntent(
          conv, parsed, user
        );
        msgs.push(
          `**${stepLabel} ${step.step}** ` +
          `(${step.intent})\n${result.message}`
        );
        advancePlan(conv, {
          step: step.step,
          intent: step.intent,
          success: true,
          message: result.message,
          data: result.data,
        });
      } catch (err: unknown) {
        const errMsg = err instanceof Error
          ? err.message : 'Failed';
        msgs.push(
          `**${stepLabel} ${step.step}** ` +
          `(${step.intent}): ❌ ${errMsg}`
        );
        advancePlan(conv, {
          step: step.step,
          intent: step.intent,
          success: false,
          message: errMsg,
        });
        break;
      }
    }

    clearPlan(conv);
    const finalMsg = msgs.join('\n\n');
    conv.messages.push({
      role: 'assistant',
      content: finalMsg,
    });
    return {
      conversation_id: conv.id,
      intent: 'multi_intent',
      message: finalMsg,
    };
  }

  private shouldRunStep(
    step: PlanStep,
    pending: PendingPlan
  ): boolean {
    if (step.condition === 'always') return true;
    const prev =
      pending.completedResults.at(-1);
    if (!prev) return true;
    if (step.condition === 'on_success') {
      return prev.success;
    }
    if (step.condition === 'on_condition') {
      return prev.success;
    }
    return true;
  }

  private tryFollowUp(
    message: string,
    conv: Conversation
  ): ParsedIntent | null {
    if (!conv.lastResult) return null;
    const age = Date.now() - conv.lastResult.timestamp;
    if (age > 10 * 60 * 1000) return null;

    const fu = detectFollowUp(message);
    if (!fu) return null;

    const lang = detectLang(message);
    const intentMap: Record<string, string> = {
      select: 'follow_up_select',
      recommend: 'follow_up_recommend',
      action: 'follow_up_action',
      refine: 'follow_up_refine',
    };

    log.info({
      event: 'follow_up_detected',
      type: fu.type,
      prevIntent: conv.lastResult.intent,
      raw: fu.raw,
    });

    return {
      intent: intentMap[fu.type] || 'follow_up_select',
      slots: {
        _followUp: fu,
        _lastResult: conv.lastResult,
      },
      confidence: 0.85,
      lang,
      confirmationRequired: false,
    };
  }

  private tryDynamicRefine(
    message: string,
    conv: Conversation
  ): ParsedIntent | null {
    const DYNAMIC_INTENTS = new Set([
      'extract_dynamic',
      'purchase_dynamic',
    ]);
    if (!conv.lastIntent) return null;
    if (!DYNAMIC_INTENTS.has(conv.lastIntent))
      return null;

    const t = message.trim();
    const MODIFY_RE =
      /(?:改成|换成|改为|换为|指定|改|换|不指定|全球随机|change\s+(?:to|it)|switch\s+(?:to|it)|make\s+it|use\s)/i;
    if (!MODIFY_RE.test(t)) return null;

    const lang = detectLang(t);
    const geo = resolveGeo(t);
    const newSlots: Record<string, unknown> = {};

    if (geo.country)
      newSlots.country = geo.country;
    if (geo.city && !geo.ambiguous)
      newSlots.city = geo.city;

    const qtyM = t.match(
      /(\d+)\s*(?:个|条|proxies?)/i
    );
    if (qtyM)
      newSlots.quantity = parseInt(qtyM[1], 10);

    const protoM = t.match(
      /\b(socks5|http|https)\b/i
    );
    if (protoM)
      newSlots.protocol = protoM[1].toLowerCase();

    const validM = t.match(
      /(\d+)\s*(?:分钟|min(?:utes?)?)/i
    );
    if (validM)
      newSlots.valid_time =
        parseInt(validM[1], 10);

    if (/\bapi\b/i.test(t))
      newSlots.method = 'api';
    if (/(?:密码|password)/i.test(t))
      newSlots.method = 'password';

    if (
      /(?:不指定|全球随机|不要.*国家|any\s*country|random|global)/i.test(t)
    ) {
      newSlots.country = '';
    }

    if (Object.keys(newSlots).length === 0)
      return null;

    const merged = {
      ...conv.slotsMemory,
      ...newSlots,
    };

    log.info({
      event: 'dynamic_refine_detected',
      lastIntent: conv.lastIntent,
      newSlots,
    });

    return {
      intent: conv.lastIntent,
      slots: merged,
      confidence: 0.85,
      lang,
      confirmationRequired:
        conv.lastIntent === 'purchase_dynamic',
    };
  }

  private mergeContextSlots(
    conv: Conversation,
    parsed: ParsedIntent
  ): void {
    if (!parsed.slots.city && conv.slotsMemory.city) {
      parsed.slots.city = conv.slotsMemory.city;
    }
    if (
      !parsed.slots.country &&
      conv.slotsMemory.country
    ) {
      parsed.slots.country = conv.slotsMemory.country;
    }
    if (
      !parsed.slots.ip_segment &&
      conv.slotsMemory.ip_segment
    ) {
      parsed.slots.ip_segment =
        conv.slotsMemory.ip_segment;
    }
  }

  private saveLastResult(
    conv: Conversation,
    parsed: ParsedIntent,
    result: { data?: Record<string, unknown> }
  ): void {
    if (!result.data) return;
    const items = extractItems(result.data);
    if (items.length === 0) return;
    conv.lastResult = {
      intent: parsed.intent,
      data: result.data,
      items,
      lang: parsed.lang,
      timestamp: Date.now(),
    };
  }

  private buildTraceId(): string {
    return `nl_${Date.now().toString(36)}_${Math.random()
      .toString(36)
      .slice(2, 8)}`;
  }
}

const ITEM_KEYS = [
  'products', 'list', 'orders',
  'transactions', 'users', 'countries',
  'staticResources', 'statics',
];

function extractItems(
  data: Record<string, unknown>
): Array<Record<string, unknown>> {
  for (const key of ITEM_KEYS) {
    const v = data[key];
    if (Array.isArray(v) && v.length > 0) {
      return v as Array<Record<string, unknown>>;
    }
  }
  return [];
}
