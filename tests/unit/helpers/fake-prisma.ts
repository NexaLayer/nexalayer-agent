// Minimal in-memory stand-in for the Prisma calls used by the support
// module. Only the query shapes the code actually uses are supported.

type Row = Record<string, any>;

function matches(row: Row, where: Row = {}): boolean {
  for (const [key, cond] of Object.entries(where)) {
    if (key === 'NOT') {
      const conds = Array.isArray(cond) ? cond : [cond];
      if (conds.some((c) => matches(row, c))) return false;
      continue;
    }
    if (key === 'OR') {
      if (!(cond as Row[]).some((c) => matches(row, c))) return false;
      continue;
    }
    const value = row[key];
    if (cond !== null && typeof cond === 'object' && !(cond instanceof Date)) {
      if ('in' in cond && !cond.in.includes(value)) return false;
      if ('notIn' in cond && cond.notIn.includes(value)) return false;
      if ('gte' in cond && !(value >= cond.gte)) return false;
      if ('lte' in cond && !(value <= cond.lte)) return false;
      if ('not' in cond && value === cond.not) return false;
      if ('startsWith' in cond && !(typeof value === 'string' && value.startsWith(cond.startsWith))) return false;
    } else if (value !== cond) {
      return false;
    }
  }
  return true;
}

function order(rows: Row[], orderBy?: Row): Row[] {
  if (!orderBy) return rows;
  const [[key, dir]] = Object.entries(orderBy);
  return [...rows].sort((a, b) => (a[key] < b[key] ? -1 : a[key] > b[key] ? 1 : 0) * (dir === 'desc' ? -1 : 1));
}

export function createFakePrisma() {
  let seq = 1;
  const db = {
    agentApp: [] as Row[],
    agentIdempotencyKey: [] as Row[],
    agentApiLog: [] as Row[],
    agentSession: [] as Row[],
    supportTicket: [] as Row[],
    supportTicketEvent: [] as Row[],
    statusComponent: [] as Row[],
    statusIncident: [] as Row[],
    upstreamCleanupJob: [] as Row[],
  };
  let clock = Date.now();
  const tick = () => new Date((clock += 1));

  const withEvents = (t: Row | undefined) =>
    t ? { ...t, events: db.supportTicketEvent.filter((e) => e.ticketId === t.id).sort((a, b) => a.createdAt - b.createdAt) } : null;

  const prisma = {
    agentApp: {
      findUnique: async ({ where }: Row) => db.agentApp.find((a) => matches(a, where)) ?? null,
      update: async ({ where, data }: Row) => Object.assign(db.agentApp.find((a) => matches(a, where))!, data),
    },
    agentIdempotencyKey: {
      findUnique: async ({ where }: Row) => {
        const { agentId, idempotencyKey } = where.uq_agent_idempotency;
        return db.agentIdempotencyKey.find((r) => r.agentId === agentId && r.idempotencyKey === idempotencyKey) ?? null;
      },
      create: async ({ data }: Row) => {
        const row = { id: BigInt(seq++), responseStatus: null, responseBody: null, ...data };
        db.agentIdempotencyKey.push(row);
        return row;
      },
      update: async ({ where, data }: Row) => Object.assign(db.agentIdempotencyKey.find((r) => r.id === where.id)!, data),
    },
    agentApiLog: {
      create: async ({ data }: Row) => { const row = { id: seq++, createdAt: tick(), ...data }; db.agentApiLog.push(row); return row; },
      findMany: async ({ where, orderBy, take }: Row) => order(db.agentApiLog.filter((r) => matches(r, where)), orderBy).slice(0, take ?? 1000),
    },
    agentSession: {
      findFirst: async ({ where }: Row) => db.agentSession.find((r) => matches(r, where)) ?? null,
    },
    supportTicket: {
      findUnique: async ({ where, include }: Row) => {
        let row: Row | undefined;
        if (where.uq_support_ticket_idempotency) {
          const { agentId, idempotencyKey } = where.uq_support_ticket_idempotency;
          row = db.supportTicket.find((t) => t.agentId === agentId && t.idempotencyKey === idempotencyKey);
        } else row = db.supportTicket.find((t) => matches(t, where));
        return include ? withEvents(row) : row ?? null;
      },
      findFirst: async ({ where, include, orderBy }: Row) => {
        const row = order(db.supportTicket.filter((t) => matches(t, where)), orderBy)[0];
        return include ? withEvents(row) : row ?? null;
      },
      findMany: async ({ where, include, orderBy, take }: Row) =>
        order(db.supportTicket.filter((t) => matches(t, where)), orderBy).slice(0, take ?? 1000).map((t) => (include ? withEvents(t) : t)),
      count: async ({ where }: Row) => db.supportTicket.filter((t) => matches(t, where)).length,
      create: async ({ data }: Row) => {
        const { events, ...rest } = data;
        const now = tick();
        const row = { id: seq++, duplicateCount: 0, resolution: null, createdAt: now, updatedAt: now, ...rest };
        db.supportTicket.push(row);
        for (const e of events?.create ?? []) db.supportTicketEvent.push({ id: seq++, ticketId: row.id, createdAt: tick(), note: null, ...e });
        return withEvents(row);
      },
      update: async ({ where, data }: Row) => {
        const row = db.supportTicket.find((t) => matches(t, where))!;
        const { events, duplicateCount, ...rest } = data;
        Object.assign(row, rest, { updatedAt: tick() });
        if (duplicateCount?.increment) row.duplicateCount += duplicateCount.increment;
        if (events?.create) db.supportTicketEvent.push({ id: seq++, ticketId: row.id, createdAt: tick(), ...events.create });
        return withEvents(row);
      },
    },
    supportTicketEvent: {
      create: async ({ data }: Row) => { const row = { id: seq++, createdAt: tick(), ...data }; db.supportTicketEvent.push(row); return row; },
    },
    statusComponent: {
      findMany: async ({ where }: Row = {}) => db.statusComponent.filter((r) => matches(r, where)),
      findUnique: async ({ where }: Row) => db.statusComponent.find((r) => r.id === where.id) ?? null,
      upsert: async ({ where, create, update }: Row) => {
        const row = db.statusComponent.find((r) => r.id === where.id);
        if (row) return Object.assign(row, update, { updatedAt: tick() });
        const created = { ...create, updatedAt: tick() };
        db.statusComponent.push(created);
        return created;
      },
    },
    statusIncident: {
      findFirst: async ({ where, orderBy }: Row) => order(db.statusIncident.filter((r) => matches(r, where)), orderBy)[0] ?? null,
      findMany: async ({ where, orderBy, take }: Row) => order(db.statusIncident.filter((r) => matches(r, where)), orderBy).slice(0, take ?? 1000),
      create: async ({ data }: Row) => { const row = { resolvedAt: null, ...data }; db.statusIncident.push(row); return row; },
      update: async ({ where, data }: Row) => Object.assign(db.statusIncident.find((r) => r.id === where.id)!, data),
    },
    upstreamCleanupJob: {
      findUnique: async ({ where }: Row) => db.upstreamCleanupJob.find((r) => r.sessionId === where.sessionId) ?? null,
      findMany: async ({ where, orderBy, take }: Row) => order(db.upstreamCleanupJob.filter((r) => matches(r, where)), orderBy).slice(0, take ?? 1000),
      upsert: async ({ where, create, update }: Row) => {
        const row = db.upstreamCleanupJob.find((r) => r.sessionId === where.sessionId);
        if (row) return Object.assign(row, update);
        const created = { id: seq++, completedAt: null, ...create };
        db.upstreamCleanupJob.push(created);
        return created;
      },
      update: async ({ where, data }: Row) => Object.assign(db.upstreamCleanupJob.find((r) => r.id === where.id)!, data),
    },
  };
  return { prisma, db };
}
