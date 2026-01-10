export const INTENTS = {
  // Menu Management
  MENU_PRICE_UPDATE: 'menu.price.update',
  MENU_AVAILABILITY_TOGGLE: 'menu.availability.toggle',
  MENU_CREATE_ITEM: 'menu.item.create',
  MENU_UPDATE_ITEM: 'menu.item.update',
  MENU_SEARCH: 'menu.search',
  MENU_LIST_CATEGORY: 'menu.category.list',

  // Order Management
  ORDER_STATUS: 'order.status',
  ORDER_FIND: 'order.find',

  // Sales & Analytics
  SALES_QUERY_TODAY: 'sales.query.today',
  SALES_QUERY_PERIOD: 'sales.query.period',
  SALES_COMPARE: 'sales.compare',
  ITEM_PERFORMANCE: 'sales.item.performance',
  TOP_SELLERS: 'sales.top.sellers',

  // Table Management
  TABLE_STATUS: 'table.status',
  TABLE_LIST: 'table.list',

  // Help
  HELP: 'help',
  GREETING: 'greeting',
  UNKNOWN: 'unknown',
} as const;

export type IntentType = (typeof INTENTS)[keyof typeof INTENTS];

// Quick patterns for common commands (bypass LLM for speed)
export interface QuickPattern {
  pattern: RegExp;
  intent: IntentType;
  extract: (match: RegExpMatchArray) => Record<string, unknown>;
}

export const QUICK_PATTERNS: QuickPattern[] = [
  // 86 command (mark unavailable)
  {
    pattern: /^86\s+(?:the\s+)?(.+)$/i,
    intent: INTENTS.MENU_AVAILABILITY_TOGGLE,
    extract: (match) => ({ items: [match[1].trim()], available: false }),
  },
  // Mark unavailable
  {
    pattern: /^(?:mark|set)\s+(.+?)\s+(?:as\s+)?(?:unavailable|out|sold\s*out)$/i,
    intent: INTENTS.MENU_AVAILABILITY_TOGGLE,
    extract: (match) => ({ items: [match[1].trim()], available: false }),
  },
  // Mark available
  {
    pattern: /^(?:mark|set)\s+(.+?)\s+(?:as\s+)?(?:available|back|in\s*stock)$/i,
    intent: INTENTS.MENU_AVAILABILITY_TOGGLE,
    extract: (match) => ({ items: [match[1].trim()], available: true }),
  },
  // Bring back (mark available)
  {
    pattern: /^bring\s+(?:back\s+)?(?:the\s+)?(.+)$/i,
    intent: INTENTS.MENU_AVAILABILITY_TOGGLE,
    extract: (match) => ({ items: [match[1].trim()], available: true }),
  },
  // Today's sales
  {
    pattern: /^(?:how(?:'s|\s+is)?|what(?:'s|\s+is)?)\s+(?:today|today's?\s+sales?|sales?\s+today)(?:\s+going)?(?:\?)?$/i,
    intent: INTENTS.SALES_QUERY_TODAY,
    extract: () => ({}),
  },
  {
    pattern: /^(?:show|get|tell)\s+(?:me\s+)?today(?:'s)?\s+(?:sales?|revenue|numbers?)$/i,
    intent: INTENTS.SALES_QUERY_TODAY,
    extract: () => ({}),
  },
  // Price increase by amount
  {
    pattern: /^(?:increase|raise|bump|up)\s+(?:all\s+)?(.+?)\s+(?:prices?|cost)\s+by\s+(?:₹|rs\.?|inr\s*)?\s*(\d+(?:\.\d{2})?)$/i,
    intent: INTENTS.MENU_PRICE_UPDATE,
    extract: (match) => ({
      target: match[1].trim(),
      modifier: 'INCREMENT',
      value: parseFloat(match[2]),
      isPercentage: false,
    }),
  },
  // Price increase by percentage
  {
    pattern: /^(?:increase|raise|bump|up)\s+(?:all\s+)?(.+?)\s+(?:prices?|cost)\s+by\s+(\d+(?:\.\d+)?)\s*%$/i,
    intent: INTENTS.MENU_PRICE_UPDATE,
    extract: (match) => ({
      target: match[1].trim(),
      modifier: 'INCREMENT',
      value: parseFloat(match[2]),
      isPercentage: true,
    }),
  },
  // Price decrease by amount
  {
    pattern: /^(?:decrease|reduce|lower|drop|down)\s+(?:all\s+)?(.+?)\s+(?:prices?|cost)\s+by\s+(?:₹|rs\.?|inr\s*)?\s*(\d+(?:\.\d{2})?)$/i,
    intent: INTENTS.MENU_PRICE_UPDATE,
    extract: (match) => ({
      target: match[1].trim(),
      modifier: 'DECREMENT',
      value: parseFloat(match[2]),
      isPercentage: false,
    }),
  },
  // Price decrease by percentage
  {
    pattern: /^(?:decrease|reduce|lower|drop|down)\s+(?:all\s+)?(.+?)\s+(?:prices?|cost)\s+by\s+(\d+(?:\.\d+)?)\s*%$/i,
    intent: INTENTS.MENU_PRICE_UPDATE,
    extract: (match) => ({
      target: match[1].trim(),
      modifier: 'DECREMENT',
      value: parseFloat(match[2]),
      isPercentage: true,
    }),
  },
  // Set price
  {
    pattern: /^(?:set|change)\s+(.+?)\s+(?:price|cost)\s+to\s+(?:₹|rs\.?|inr\s*)?\s*(\d+(?:\.\d{2})?)$/i,
    intent: INTENTS.MENU_PRICE_UPDATE,
    extract: (match) => ({
      target: match[1].trim(),
      modifier: 'SET',
      value: parseFloat(match[2]),
      isPercentage: false,
    }),
  },
  // Top sellers
  {
    pattern: /^(?:what(?:'s|\s+are)|show|get)\s+(?:the\s+)?(?:top|best)\s+(?:selling|seller|sellers?)(?:\s+items?)?(?:\s+today)?(?:\?)?$/i,
    intent: INTENTS.TOP_SELLERS,
    extract: () => ({ period: 'today' }),
  },
  // Help
  {
    pattern: /^(?:help|what\s+can\s+you\s+do|commands?)(?:\?)?$/i,
    intent: INTENTS.HELP,
    extract: () => ({}),
  },
  // Greeting
  {
    pattern: /^(?:hi|hello|hey|good\s+(?:morning|afternoon|evening))(?:\s+there)?(?:!)?$/i,
    intent: INTENTS.GREETING,
    extract: () => ({}),
  },
  // List tables
  {
    pattern: /^(?:show|list|get)\s+(?:all\s+)?(?:tables?|table\s+status)$/i,
    intent: INTENTS.TABLE_LIST,
    extract: () => ({}),
  },
  // Search items
  {
    pattern: /^(?:find|search|look\s+for)\s+(.+)$/i,
    intent: INTENTS.MENU_SEARCH,
    extract: (match) => ({ query: match[1].trim() }),
  },
];

// Function to attempt quick pattern matching
export function matchQuickPattern(
  message: string
): { intent: IntentType; entities: Record<string, unknown> } | null {
  const trimmedMessage = message.trim();

  for (const pattern of QUICK_PATTERNS) {
    const match = trimmedMessage.match(pattern.pattern);
    if (match) {
      return {
        intent: pattern.intent,
        entities: pattern.extract(match),
      };
    }
  }

  return null;
}
