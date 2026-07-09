export interface SuggestionCategory {
  name: string;
  icon: string;
  items: string[];
}

const ACCOUNT_ITEMS_FOR_AGENT = [
  'Create a new agent account with random credentials',
  'Batch create 5 users with 100 CNY initial balance',
  'Get my referral code',
];

const ACCOUNT_ITEMS_FOR_USER = [
  'Reset my password',
  'Check my balance',
  "Show this month's spending",
];

export function getSuggestionsByRole(
  isAgentOrAdmin: boolean
): SuggestionCategory[] {
  return [
    {
      name: 'Account',
      icon: '👤',
      items: isAgentOrAdmin
        ? ACCOUNT_ITEMS_FOR_AGENT
        : ACCOUNT_ITEMS_FOR_USER,
    },
    {
      name: 'Statistics',
      icon: '📊',
      items: [
        'Show stats overview',
        "Show this month's recharge stats",
        "Show this month's spending",
        "Show this month's profit",
        'Show order statistics',
      ],
    },
    {
      name: 'Resources',
      icon: '⚡',
      items: [
        'Show dynamic proxy resources',
        'Show static proxy resources',
        'Show available static IPs in Washington',
      ],
    },
    {
      name: 'Orders & Purchase',
      icon: '🛒',
      items: [
        'Show dynamic proxy orders',
        'Show static proxy orders',
        'Buy 10GB US dynamic proxy',
        'Buy 5 static IPs in Los Angeles',
      ],
    },
  ];
}

export const DEFAULT_SUGGESTIONS = getSuggestionsByRole(
  false
);
