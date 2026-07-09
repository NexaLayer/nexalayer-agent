import { v4 as uuidv4 } from 'uuid';
export function generateSessionId(): string {
  return `sess_${uuidv4()}`;
}

export function generateEventId(): string {
  return `evt_${uuidv4().replace(/-/g, '').slice(0, 16)}`;
}

export function generateProfileId(): string {
  return `prof_${uuidv4().replace(/-/g, '').slice(0, 12)}`;
}

export function generateGroupId(): string {
  return `grp_${uuidv4().replace(/-/g, '').slice(0, 12)}`;
}

export function generateProxyId(): string {
  return `prx_${uuidv4().replace(/-/g, '').slice(0, 12)}`;
}

export function generateInstanceId(): string {
  return `inst_${uuidv4().replace(/-/g, '').slice(0, 12)}`;
}

export function generateTaskId(): string {
  return `task_${uuidv4().replace(/-/g, '').slice(0, 12)}`;
}

export function generateId(prefix: string): string {
  return `${prefix}_${uuidv4().replace(/-/g, '').slice(0, 12)}`;
}

export function generateBackendUsername(
  agentName: string,
  agentId: number
): string {
  const cleaned = agentName
    .replace(/[^a-zA-Z0-9]/g, '')
    .toLowerCase()
    .slice(0, 8);
  return `ag_${cleaned}${agentId}`;
}

export function generateBackendPassword(): string {
  const chars =
    'abcdefghijklmnopqrstuvwxyz' +
    'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let password = '';
  for (let i = 0; i < 16; i++) {
    const idx = Math.floor(Math.random() * chars.length);
    password += chars[idx];
  }
  return password;
}
