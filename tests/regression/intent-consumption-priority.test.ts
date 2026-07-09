import { describe, expect, it } from 'vitest';
import { ruleParseIntent } from '../../src/modules/nl-agent/intent-parser';

describe('消费记录 vs NL历史 意图优先级', () => {
  it('查询消费记录 -> query_transactions', () => {
    const p = ruleParseIntent('查询消费记录');
    expect(p.intent).toBe('query_transactions');
  });

  it('消费记录 -> query_transactions', () => {
    const p = ruleParseIntent('消费记录');
    expect(p.intent).toBe('query_transactions');
  });

  it('今天消费记录 -> query_transactions', () => {
    const p = ruleParseIntent('今天消费记录');
    expect(p.intent).toBe('query_transactions');
  });

  it('本月消费记录 -> query_stats(type=consumption, period=month)', () => {
    const p = ruleParseIntent('本月消费记录');
    expect(p.intent).toBe('query_stats');
    expect(p.slots.type).toBe('consumption');
    expect(p.slots.period).toBe('month');
  });

  it('查询对话历史 -> query_nl_history', () => {
    const p = ruleParseIntent('查询对话历史');
    expect(p.intent).toBe('query_nl_history');
  });

  it('查看命令历史 -> query_nl_history', () => {
    const p = ruleParseIntent('查看命令历史');
    expect(p.intent).toBe('query_nl_history');
  });
});

describe('订单 vs 消费/交易 意图严格区分', () => {
  it('今天开通的静态代理订单 -> query_static_orders', () => {
    const p = ruleParseIntent('今天开通的静态代理订单');
    expect(p.intent).toBe('query_static_orders');
    expect(p.slots.period).toBe('day');
  });

  it('我今天开通了哪些静态代理 -> query_static_orders', () => {
    const p = ruleParseIntent('我今天开通了哪些静态代理');
    expect(p.intent).toBe('query_static_orders');
  });

  it('今天的消费记录 -> query_transactions', () => {
    const p = ruleParseIntent('今天的消费记录');
    expect(p.intent).toBe('query_transactions');
    expect(p.slots.period).toBe('day');
  });

  it('今日交易记录 -> query_transactions', () => {
    const p = ruleParseIntent('今日交易记录');
    expect(p.intent).toBe('query_transactions');
    expect(p.slots.period).toBe('day');
  });

  it('今天的静态代理消费 -> query_transactions', () => {
    const p = ruleParseIntent('今天的静态代理消费');
    expect(p.intent).toBe('query_transactions');
    expect(p.slots.period).toBe('day');
  });

  it('最近开通的静态代理订单 -> query_static_orders', () => {
    const p = ruleParseIntent('最近开通的静态代理订单');
    expect(p.intent).toBe('query_static_orders');
  });

  it('今天的订单 -> query_today_orders', () => {
    const p = ruleParseIntent('今天的订单');
    expect(p.intent).toBe('query_today_orders');
  });

  it('今日订单 -> query_today_orders', () => {
    const p = ruleParseIntent('今日订单');
    expect(p.intent).toBe('query_today_orders');
  });

  it('查看交易流水 -> query_transactions', () => {
    const p = ruleParseIntent('查看交易流水');
    expect(p.intent).toBe('query_transactions');
  });

  it('查看消费流水 -> query_transactions', () => {
    const p = ruleParseIntent('查看消费流水');
    expect(p.intent).toBe('query_transactions');
  });
});

