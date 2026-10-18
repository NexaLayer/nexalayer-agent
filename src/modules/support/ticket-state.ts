export const TICKET_STATES = [
  'received', 'triaged', 'needs_info', 'in_progress', 'awaiting_approval',
  'workaround_available', 'resolved', 'closed',
] as const;
export type TicketState = (typeof TICKET_STATES)[number];

export type TicketActor = 'product_bot' | 'reporter' | 'founder' | 'system';

export type Transition = {
  from: TicketState;
  to: TicketState;
  actor: TicketActor;
  reason?: string;
  after?: string;
  within?: string;
};

export const TICKET_TRANSITIONS: Transition[] = [
  { from: 'received', to: 'triaged', actor: 'product_bot', reason: 'auto_classified' },
  { from: 'received', to: 'resolved', actor: 'product_bot', reason: 'duplicate_or_known_issue' },
  { from: 'triaged', to: 'needs_info', actor: 'product_bot', reason: 'missing_request_id_or_cannot_reproduce' },
  { from: 'needs_info', to: 'triaged', actor: 'reporter', reason: 'reporter_replied' },
  { from: 'needs_info', to: 'closed', actor: 'system', reason: 'no_reply', after: 'P7D' },
  { from: 'triaged', to: 'in_progress', actor: 'product_bot', reason: 'assigned' },
  { from: 'in_progress', to: 'awaiting_approval', actor: 'product_bot', reason: 'money_or_public_action' },
  { from: 'awaiting_approval', to: 'in_progress', actor: 'founder', reason: 'founder_approved_or_denied' },
  { from: 'in_progress', to: 'workaround_available', actor: 'product_bot', reason: 'workaround_published' },
  { from: 'workaround_available', to: 'in_progress', actor: 'reporter', reason: 'workaround_failed' },
  { from: 'in_progress', to: 'resolved', actor: 'product_bot', reason: 'fix_deployed_or_answered' },
  { from: 'workaround_available', to: 'resolved', actor: 'product_bot', reason: 'fix_deployed' },
  { from: 'resolved', to: 'in_progress', actor: 'reporter', reason: 'reporter_reopened', within: 'P14D' },
  { from: 'resolved', to: 'closed', actor: 'system', reason: 'auto_close', after: 'P7D' },
];

export function isTicketState(value: string): value is TicketState {
  return (TICKET_STATES as readonly string[]).includes(value);
}

/**
 * Whether `actor` may move a ticket from `from` to `to`. The founder may
 * perform any listed transition (owner override); other actors only their own.
 */
export function canTransition(from: TicketState, to: TicketState, actor: TicketActor): boolean {
  return TICKET_TRANSITIONS.some(
    (t) => t.from === from && t.to === to && (t.actor === actor || actor === 'founder')
  );
}

export function ticketStateMachine() {
  return { states: TICKET_STATES, transitions: TICKET_TRANSITIONS };
}
