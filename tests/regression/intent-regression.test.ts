/**
 * NL 意图识别回归测试
 *
 * 四层记录：
 *   L1 — 原始输入
 *   L2 — 规则引擎输出 (intent + slots + confidence)
 *   L3 — LLM 输出 (预留，目前为 null)
 *   L4 — 最终执行意图/槽位
 *
 * 运行: npx vitest run tests/regression/intent-regression.test.ts
 * 报告: tests/regression/results/ 目录
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import {
  ruleParseIntent,
  detectCompound,
} from '../../src/modules/nl-agent/intent-parser';
import * as fs from 'fs';
import * as path from 'path';

interface SlotExpectation {
  [key: string]: unknown;
}

interface PlanStepExpectation {
  step: number;
  intent: string;
  slots: SlotExpectation;
  condition: string;
}

interface TestCase {
  input: string;
  slots?: SlotExpectation;
  expected_intent?: string;
  is_compound?: boolean;
  expected_plan?: PlanStepExpectation[];
  should_confirm?: boolean;
  should_clarify?: boolean;
  missing_slots?: string[];
  failure_type?: string;
}

interface TestSuite {
  intent: string;
  description: string;
  is_multi_intent_suite?: boolean;
  cases: TestCase[];
}

interface Fixtures {
  _meta: { version: string; description: string };
  suites: TestSuite[];
}

interface ResultRecord {
  input: string;
  expected_intent: string;
  expected_slots: SlotExpectation;
  should_confirm?: boolean;
  should_clarify?: boolean;
  missing_slots?: string[];
  failure_type?: string;
  rule_engine: {
    intent: string;
    slots: Record<string, unknown>;
    confidence: number;
    lang: string;
  };
  llm_output: null;
  final: {
    intent: string;
    slots: Record<string, unknown>;
  };
  intent_match: boolean;
  slot_match: boolean;
  pass: boolean;
}

interface SuiteSummary {
  intent: string;
  description: string;
  total: number;
  passed: number;
  failed: number;
  accuracy: string;
  failures: Array<{
    input: string;
    expected_intent?: string;
    got_intent: string;
    got_slots: Record<string, unknown>;
    failure_type?: string;
  }>;
}

const FIXTURES_PATH = path.join(
  __dirname, 'intent-test-fixtures.json'
);
const RESULTS_DIR = path.join(__dirname, 'results');

let fixtures: Fixtures;
let allResults: ResultRecord[] = [];
let suiteSummaries: SuiteSummary[] = [];

function slotsMatch(
  expected: SlotExpectation,
  actual: Record<string, unknown>
): boolean {
  for (const [key, val] of Object.entries(expected)) {
    if (actual[key] === undefined) return false;
    const a = actual[key];
    const e = val;
    if (typeof e === 'number') {
      if (Number(a) !== e) return false;
    } else if (typeof e === 'string') {
      const aStr = String(a).toLowerCase();
      const eStr = String(e).toLowerCase();
      if (!aStr.includes(eStr) && !eStr.includes(aStr)) {
        return false;
      }
    }
  }
  return true;
}

beforeAll(() => {
  fixtures = JSON.parse(
    fs.readFileSync(FIXTURES_PATH, 'utf-8')
  );
  allResults = [];
  suiteSummaries = [];
  if (!fs.existsSync(RESULTS_DIR)) {
    fs.mkdirSync(RESULTS_DIR, { recursive: true });
  }
});

afterAll(() => {
  const ts = new Date()
    .toISOString()
    .replace(/[:.]/g, '-')
    .slice(0, 19);

  const totalCases = allResults.length;
  const totalPass = allResults.filter((r) => r.pass).length;
  const totalFail = totalCases - totalPass;
  const intentOnly = allResults.filter(
    (r) => r.intent_match
  ).length;

  const report = {
    timestamp: new Date().toISOString(),
    summary: {
      total_cases: totalCases,
      passed: totalPass,
      failed: totalFail,
      accuracy: `${((totalPass / totalCases) * 100).toFixed(1)}%`,
      intent_accuracy: `${((intentOnly / totalCases) * 100).toFixed(1)}%`,
    },
    by_intent: suiteSummaries,
    details: allResults,
  };

  const reportPath = path.join(
    RESULTS_DIR, `regression-${ts}.json`
  );
  fs.writeFileSync(
    reportPath,
    JSON.stringify(report, null, 2),
    'utf-8'
  );

  const latestPath = path.join(
    RESULTS_DIR, 'regression-latest.json'
  );
  fs.writeFileSync(
    latestPath,
    JSON.stringify(report, null, 2),
    'utf-8'
  );

  // 生成人类可读的 Markdown 报告
  let md = `# NL 意图识别回归测试报告\n\n`;
  md += `> ${report.timestamp}\n\n`;
  md += `## 总览\n\n`;
  md += `| 指标 | 值 |\n|------|----|\n`;
  md += `| 总测试用例 | ${totalCases} |\n`;
  md += `| 通过 | ${totalPass} |\n`;
  md += `| 失败 | ${totalFail} |\n`;
  md += `| 总准确率 (意图+槽位) | ${report.summary.accuracy} |\n`;
  md += `| 意图准确率 | ${report.summary.intent_accuracy} |\n\n`;

  md += `## 各意图结果\n\n`;
  md += `| 意图 | 描述 | 总数 | 通过 | 失败 | 准确率 |\n`;
  md += `|------|------|------|------|------|--------|\n`;
  for (const s of suiteSummaries) {
    const icon = s.failed === 0 ? '✅' : '❌';
    md += `| ${icon} ${s.intent} | ${s.description} `;
    md += `| ${s.total} | ${s.passed} | ${s.failed} `;
    md += `| ${s.accuracy} |\n`;
  }

  md += `\n## 失败用例详情\n\n`;
  for (const s of suiteSummaries) {
    if (!s.failures.length) continue;
    md += `### ${s.intent} (${s.description})\n\n`;
    md += `| 输入 | 期望意图 | 实际意图 `;
    md += `| 实际槽位 | 类型 |\n`;
    md += `|------|---------|---------|`;
    md += `----------|------|\n`;
    for (const f of s.failures) {
      const slotStr = JSON.stringify(f.got_slots);
      const expIntent = f.expected_intent || s.intent;
      const fType = f.failure_type || '-';
      md += `| ${f.input} | ${expIntent} `;
      md += `| ${f.got_intent} | ${slotStr} `;
      md += `| ${fType} |\n`;
    }
    md += `\n`;
  }

  const mdPath = path.join(
    RESULTS_DIR, `regression-${ts}.md`
  );
  fs.writeFileSync(mdPath, md, 'utf-8');

  const latestMdPath = path.join(
    RESULTS_DIR, 'regression-latest.md'
  );
  fs.writeFileSync(latestMdPath, md, 'utf-8');

  console.log(`\n${'='.repeat(60)}`);
  console.log(`NL 意图识别回归测试报告`);
  console.log(`${'='.repeat(60)}`);
  console.log(
    `总用例: ${totalCases}  ` +
    `通过: ${totalPass}  ` +
    `失败: ${totalFail}`
  );
  console.log(
    `总准确率: ${report.summary.accuracy}  ` +
    `意图准确率: ${report.summary.intent_accuracy}`
  );
  console.log(`${'─'.repeat(60)}`);
  for (const s of suiteSummaries) {
    const bar = s.failed === 0 ? '✅' : '❌';
    console.log(
      `  ${bar} ${s.intent.padEnd(25)} ` +
      `${s.passed}/${s.total} (${s.accuracy})`
    );
  }
  console.log(`${'='.repeat(60)}`);
  console.log(`报告: ${reportPath}`);
  console.log(`Markdown: ${mdPath}`);
});

describe('NL 代理IP意图识别回归测试', () => {
  for (const suite of JSON.parse(
    fs.readFileSync(FIXTURES_PATH, 'utf-8')
  ).suites as TestSuite[]) {
    if (suite.is_multi_intent_suite) continue;

    describe(`${suite.intent} — ${suite.description}`, () => {
      const suiteResults: ResultRecord[] = [];

      afterAll(() => {
        const passed = suiteResults.filter((r) => r.pass).length;
        const failed = suiteResults.length - passed;
        const summary: SuiteSummary = {
          intent: suite.intent,
          description: suite.description,
          total: suiteResults.length,
          passed,
          failed,
          accuracy: `${((passed / suiteResults.length) * 100).toFixed(1)}%`,
          failures: suiteResults
            .filter((r) => !r.pass)
            .map((r) => ({
              input: r.input,
              expected_intent: r.expected_intent,
              got_intent: r.rule_engine.intent,
              got_slots: r.rule_engine.slots,
              failure_type: r.failure_type,
            })),
        };
        suiteSummaries.push(summary);
      });

      for (const tc of suite.cases) {
        const expectedIntent =
          tc.expected_intent || suite.intent;

        it(`"${tc.input}" → ${expectedIntent}`, () => {
          const parsed = ruleParseIntent(tc.input);

          const intentOk =
            parsed.intent === expectedIntent;
          const slotOk = slotsMatch(
            tc.slots || {}, parsed.slots
          );
          const pass = intentOk && slotOk;

          const record: ResultRecord = {
            input: tc.input,
            expected_intent: expectedIntent,
            expected_slots: tc.slots || {},
            ...(tc.should_confirm && {
              should_confirm: true,
            }),
            ...(tc.should_clarify && {
              should_clarify: true,
              missing_slots: tc.missing_slots,
            }),
            ...(tc.failure_type && {
              failure_type: tc.failure_type,
            }),
            rule_engine: {
              intent: parsed.intent,
              slots: parsed.slots,
              confidence: parsed.confidence,
              lang: parsed.lang,
            },
            llm_output: null,
            final: {
              intent: parsed.intent,
              slots: parsed.slots,
            },
            intent_match: intentOk,
            slot_match: slotOk,
            pass,
          };

          suiteResults.push(record);
          allResults.push(record);

          expect(
            parsed.intent,
            `输入: "${tc.input}"\n` +
            `期望: ${expectedIntent}\n` +
            `实际: ${parsed.intent}\n` +
            `槽位: ${JSON.stringify(parsed.slots)}`
          ).toBe(expectedIntent);

          if (
            tc.slots &&
            Object.keys(tc.slots).length > 0
          ) {
            for (const [key, val] of Object.entries(
              tc.slots
            )) {
              expect(
                parsed.slots[key],
                `槽位 "${key}" 缺失\n` +
                `输入: "${tc.input}"\n` +
                `期望: ${JSON.stringify(val)}\n` +
                `实际槽位: ${JSON.stringify(parsed.slots)}`
              ).toBeDefined();
            }
          }
        });
      }
    });
  }
});

describe('复合句检测回归测试', () => {
  const allSuites = JSON.parse(
    fs.readFileSync(FIXTURES_PATH, 'utf-8')
  ).suites as TestSuite[];

  const multiSuite = allSuites.find(
    (s) => s.is_multi_intent_suite
  );

  if (!multiSuite) return;

  const compoundResults: Array<{
    input: string;
    expected: boolean;
    actual: boolean;
    pass: boolean;
  }> = [];

  afterAll(() => {
    const passed = compoundResults.filter(
      (r) => r.pass
    ).length;
    const total = compoundResults.length;
    const summary: SuiteSummary = {
      intent: '_suite_F_compound_detect',
      description: '复合句检测',
      total,
      passed,
      failed: total - passed,
      accuracy:
        `${((passed / total) * 100).toFixed(1)}%`,
      failures: compoundResults
        .filter((r) => !r.pass)
        .map((r) => ({
          input: r.input,
          expected_intent: r.expected
            ? 'compound' : 'single',
          got_intent: r.actual
            ? 'compound' : 'single',
          got_slots: {},
        })),
    };
    suiteSummaries.push(summary);
  });

  for (const tc of multiSuite.cases) {
    const expected = tc.is_compound ?? false;
    const label = expected
      ? 'compound' : 'single';

    it(`detectCompound("${tc.input}") → ${label}`, () => {
      const actual = detectCompound(tc.input);
      compoundResults.push({
        input: tc.input,
        expected,
        actual,
        pass: actual === expected,
      });
      expect(
        actual,
        `输入: "${tc.input}"\n` +
        `期望: ${label}\n` +
        `实际: ${actual ? 'compound' : 'single'}`
      ).toBe(expected);
    });
  }
});
