import { randomBytes } from 'crypto';
import { Prisma } from '@prisma/client';
import { prisma } from '../../app';
import { env } from '../../config/env';
import { OPS_ALERT_EVENTS, sendOpsAlert } from '../ops/ops-alert.service';

// Statuspage-compatible vocabulary so existing tooling can parse it.
export const COMPONENT_STATUSES = [
  'operational', 'degraded_performance', 'partial_outage', 'major_outage', 'under_maintenance',
] as const;
export type ComponentStatus = (typeof COMPONENT_STATUSES)[number];
export type StatusSource = 'auto' | 'admin';

export const COMPONENTS = [
  { id: 'api', name: 'NexaLayer API', description: 'REST API and authentication.' },
  { id: 'sessions', name: 'Proxy sessions', description: 'Create, rotate, renew, and terminate sessions.' },
  { id: 'billing', name: 'Billing', description: 'Balance, transactions, and spend caps.' },
  { id: 'catalog', name: 'Product catalog', description: 'Products and live prices.' },
  { id: 'upstream_network', name: 'Upstream network', description: 'Upstream proxy network reachability.' },
] as const;
export type ComponentId = (typeof COMPONENTS)[number]['id'];

const RANK: Record<ComponentStatus, number> = {
  operational: 0, under_maintenance: 1, degraded_performance: 2, partial_outage: 3, major_outage: 4,
};

export function isComponentId(value: string): value is ComponentId {
  return COMPONENTS.some((c) => c.id === value);
}
export function isComponentStatus(value: string): value is ComponentStatus {
  return (COMPONENT_STATUSES as readonly string[]).includes(value);
}

export function worstStatus(statuses: ComponentStatus[]): ComponentStatus {
  return statuses.reduce<ComponentStatus>((w, s) => (RANK[s] > RANK[w] ? s : w), 'operational');
}

export function overallIndicator(components: Array<{ id: string; status: ComponentStatus }>): 'none' | 'minor' | 'major' | 'critical' {
  let level: 'none' | 'minor' | 'major' | 'critical' = 'none';
  const order = ['none', 'minor', 'major', 'critical'] as const;
  const bump = (to: typeof order[number]) => { if (order.indexOf(to) > order.indexOf(level)) level = to; };
  for (const c of components) {
    if (c.status === 'major_outage') bump(c.id === 'api' || c.id === 'sessions' ? 'critical' : 'major');
    else if (c.status === 'partial_outage') bump('major');
    else if (c.status === 'degraded_performance' || c.status === 'under_maintenance') bump('minor');
  }
  return level;
}

function impactFor(status: ComponentStatus): string {
  if (status === 'major_outage') return 'critical';
  if (status === 'partial_outage') return 'major';
  if (status === 'under_maintenance') return 'maintenance';
  return 'minor';
}

// ---------------------------------------------------------------------------
// Component state

type ComponentRow = { id: string; status: string; source: string; reason: string | null; updatedAt: Date };

async function readComponentRows(): Promise<Map<string, ComponentRow>> {
  const rows = await prisma.statusComponent.findMany();
  return new Map(rows.map((r) => [r.id, r]));
}

export type SetStatusResult = { changed: boolean; skipped?: 'admin_override' | 'unchanged'; from: ComponentStatus; to: ComponentStatus };

/**
 * Change a component's status. `auto` changes never override an admin
 * override; an admin setting `operational` hands control back to `auto`.
 * Every change records incident history and sends an owner alert.
 */
export async function setComponentStatus(
  id: ComponentId,
  status: ComponentStatus,
  source: StatusSource,
  reason: string | null,
  now: Date = new Date()
): Promise<SetStatusResult> {
  const current = await prisma.statusComponent.findUnique({ where: { id } });
  const from = (current && isComponentStatus(current.status) ? current.status : 'operational') as ComponentStatus;
  const currentSource = (current?.source ?? 'auto') as StatusSource;

  if (source === 'auto' && currentSource === 'admin') {
    return { changed: false, skipped: 'admin_override', from, to: status };
  }
  const nextSource: StatusSource = source === 'admin' && status !== 'operational' ? 'admin' : 'auto';
  if (from === status && currentSource === nextSource) {
    return { changed: false, skipped: 'unchanged', from, to: status };
  }

  const safeReason = reason ? reason.slice(0, 300) : null;
  await prisma.statusComponent.upsert({
    where: { id },
    create: { id, status, source: nextSource, reason: safeReason },
    update: { status, source: nextSource, reason: safeReason },
  });

  if (from !== status) {
    await recordIncidentTransition(id, from, status, source, safeReason, now);
    void sendOpsAlert(
      OPS_ALERT_EVENTS.COMPONENT_STATUS_CHANGED,
      RANK[status] >= RANK.partial_outage ? 'critical' : status === 'operational' ? 'info' : 'warning',
      { component: id, from, to: status, source, reason: safeReason ?? '' },
      { dedupeKey: `${id}:${status}` }
    );
  }
  return { changed: from !== status, from, to: status };
}

async function recordIncidentTransition(
  componentId: string,
  from: ComponentStatus,
  to: ComponentStatus,
  source: StatusSource,
  reason: string | null,
  now: Date
): Promise<void> {
  const open = await prisma.statusIncident.findFirst({
    where: { componentId, resolvedAt: null },
    orderBy: { startedAt: 'desc' },
  });
  const update = { at: now.toISOString(), from, to, source, reason };
  if (!open) {
    if (to === 'operational') return;
    await prisma.statusIncident.create({
      data: {
        id: `inc_${now.toISOString().slice(0, 10).replace(/-/g, '')}_${randomBytes(4).toString('hex')}`,
        componentId,
        status: 'investigating',
        impact: impactFor(to),
        source,
        reason,
        updates: [update] as Prisma.InputJsonValue,
        startedAt: now,
      },
    });
    return;
  }
  const updates: unknown[] = Array.isArray(open.updates) ? [...(open.updates as unknown[])] : [];
  updates.push(update);
  await prisma.statusIncident.update({
    where: { id: open.id },
    data: to === 'operational'
      ? { status: 'resolved', resolvedAt: now, updates: updates as Prisma.InputJsonValue }
      : { status: 'identified', impact: impactFor(to), reason, updates: updates as Prisma.InputJsonValue },
  });
}

// ---------------------------------------------------------------------------
// Public read model

export async function getPublicStatus(now: Date = new Date()) {
  let rows = new Map<string, ComponentRow>();
  let incidents: Awaited<ReturnType<typeof prisma.statusIncident.findMany>> = [];
  let degradedRead = false;
  try {
    rows = await readComponentRows();
    incidents = await prisma.statusIncident.findMany({
      where: { OR: [{ resolvedAt: null }, { startedAt: { gte: new Date(now.getTime() - 30 * 86_400_000) } }] },
      orderBy: { startedAt: 'desc' },
      take: 50,
    });
  } catch {
    degradedRead = true;
  }

  const components = COMPONENTS.map((c) => {
    const row = rows.get(c.id);
    const status = (row && isComponentStatus(row.status) ? row.status : 'operational') as ComponentStatus;
    return {
      id: c.id,
      name: c.name,
      description: c.description,
      status,
      source: row?.source ?? 'auto',
      reason: row?.reason ?? null,
      updated_at: row?.updatedAt?.toISOString() ?? null,
    };
  });
  if (degradedRead) {
    const api = components.find((c) => c.id === 'api');
    if (api) { api.status = 'degraded_performance'; api.reason = 'Status store unavailable'; }
  }

  const toPublic = (i: (typeof incidents)[number]) => ({
    id: i.id,
    component: i.componentId,
    status: i.status,
    impact: i.impact,
    source: i.source,
    reason: i.reason,
    started_at: i.startedAt.toISOString(),
    resolved_at: i.resolvedAt?.toISOString() ?? null,
    updates: i.updates,
  });

  return {
    indicator: overallIndicator(components),
    updated_at: now.toISOString(),
    components,
    active_incidents: incidents.filter((i) => !i.resolvedAt).map(toPublic),
    incident_history: incidents.filter((i) => i.resolvedAt).map(toPublic),
    scheduled_maintenance: [],
    links: {
      known_issues: '/v1/public/known-issues',
      errors: '/v1/public/errors',
      sla: '/v1/public/sla',
      human: 'https://nexalayer.net/status.html',
    },
  };
}

/** Components that are currently not operational (for triage). */
export async function nonOperationalComponents(): Promise<string[]> {
  try {
    const rows = await prisma.statusComponent.findMany({ where: { NOT: { status: 'operational' } } });
    return rows.map((r) => r.id);
  } catch {
    return [];
  }
}

// ---------------------------------------------------------------------------
// Automatic signals: error rates and health probes

const ERROR_WINDOW_MS = 5 * 60_000;
const MIN_SAMPLES = 20;

type Sample = { at: number; is5xx: boolean };
const samples = new Map<ComponentId, Sample[]>();

export function componentForPath(path: string): ComponentId | null {
  const p = path.split('?')[0];
  if (!p.startsWith('/v1/')) return null;
  if (p.startsWith('/v1/public/status') || p.startsWith('/v1/health') || p.startsWith('/v1/admin')) return null;
  if (p.startsWith('/v1/sessions')) return 'sessions';
  if (p.startsWith('/v1/billing') || p.startsWith('/v1/account/budget')) return 'billing';
  if (p.startsWith('/v1/products') || p.startsWith('/v1/public/products')) return 'catalog';
  return 'api';
}

export function recordRequestOutcome(path: string, statusCode: number, now = Date.now()): void {
  const component = componentForPath(path);
  if (!component) return;
  const add = (id: ComponentId) => {
    const list = samples.get(id) ?? [];
    list.push({ at: now, is5xx: statusCode >= 500 });
    while (list.length > 0 && list[0].at < now - ERROR_WINDOW_MS) list.shift();
    if (list.length > 5_000) list.splice(0, list.length - 5_000);
    samples.set(id, list);
  };
  add(component);
  if (component !== 'api') add('api');
}

export function resetStatusSignalsForTests(): void {
  samples.clear();
  consecutiveProbeFailures = 0;
}

/** Status implied by the 5xx rate over the last 5 minutes. */
export function errorRateStatus(id: ComponentId, now = Date.now()): { status: ComponentStatus; rate: number; samples: number } {
  const list = (samples.get(id) ?? []).filter((s) => s.at >= now - ERROR_WINDOW_MS);
  if (list.length < MIN_SAMPLES) return { status: 'operational', rate: 0, samples: list.length };
  const rate = list.filter((s) => s.is5xx).length / list.length;
  const status: ComponentStatus = rate >= 0.5 ? 'partial_outage' : rate >= 0.2 ? 'degraded_performance' : 'operational';
  return { status, rate, samples: list.length };
}

let consecutiveProbeFailures = 0;

export function probeStatus(failures: number): ComponentStatus {
  if (failures >= 5) return 'major_outage';
  if (failures >= 2) return 'partial_outage';
  return 'operational';
}

export async function checkBackendReachable(): Promise<{ reachable: boolean; error: string }> {
  try {
    const r = await fetch(`${env.BACKEND_BASE_URL}/api/auth/login`, {
      method: 'POST',
      signal: AbortSignal.timeout(5000),
      headers: { 'Content-Type': 'application/json' },
      body: '{}',
    });
    return { reachable: r.status < 500, error: r.status < 500 ? '' : `HTTP ${r.status}` };
  } catch (err) {
    const cause = (err as Error).cause ? String((err as Error).cause) : '';
    return { reachable: false, error: `${(err as Error).message}${cause ? ` [${cause}]` : ''}` };
  }
}

export async function runStatusChecks(
  probe: () => Promise<{ reachable: boolean; error: string }> = checkBackendReachable,
  now = Date.now()
): Promise<Record<string, ComponentStatus>> {
  const probeResult = await probe();
  consecutiveProbeFailures = probeResult.reachable ? 0 : consecutiveProbeFailures + 1;
  const applied: Record<string, ComponentStatus> = {};

  for (const c of COMPONENTS) {
    const er = errorRateStatus(c.id, now);
    let desired = er.status;
    let reason: string | null = er.status === 'operational'
      ? null
      : `5xx rate ${(er.rate * 100).toFixed(0)}% over ${er.samples} requests in 5 minutes`;
    if (c.id === 'upstream_network') {
      const ps = probeStatus(consecutiveProbeFailures);
      if (RANK[ps] > RANK[desired]) {
        desired = ps;
        reason = `Upstream health probe failed ${consecutiveProbeFailures} times in a row`;
      }
    }
    await setComponentStatus(c.id, desired, 'auto', reason, new Date(now));
    applied[c.id] = desired;
  }
  return applied;
}

type MonitorLogger = { error: (obj: object, msg?: string) => void };

export function startStatusMonitor(logger: MonitorLogger): () => void {
  const tick = () => {
    void runStatusChecks().catch((error) => {
      logger.error({ error: error instanceof Error ? error.message : String(error) }, 'Status monitor failed');
    });
  };
  const timer = setInterval(tick, env.STATUS_CHECK_INTERVAL_SECONDS * 1_000);
  timer.unref();
  return () => clearInterval(timer);
}
