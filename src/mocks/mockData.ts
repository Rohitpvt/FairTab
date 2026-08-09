export interface MockGroup {
  id: string;
  name: string;
  type: "trip" | "home" | "couple" | "event" | "project" | "other";
  baseCurrency: string;
  balance: number; // positive = user is owed, negative = user owes, 0 = settled
  members: Array<{
    id: string;
    name: string;
    avatarUrl?: string;
    isUser?: boolean;
  }>;
  lastActivity: string;
}

export interface MockExpense {
  id: string;
  title: string;
  amountMinor: number; // e.g. 300000 = 3000.00
  currency: string;
  date: string;
  category: string;
  payerName: string;
  payerAvatar?: string;
  syncStatus: "synced" | "queued" | "syncing" | "failed" | "conflict";
  groupName: string;
  splitSummary: string;
}

export interface MockSettlement {
  id: string;
  fromName: string;
  toName: string;
  amountMinor: number;
  currency: string;
  method: string;
  date: string;
}

export interface MockRecurringTemplate {
  id: string;
  title: string;
  amountMinor: number;
  currency: string;
  frequency: "daily" | "weekly" | "monthly" | "yearly";
  nextDue: string;
  participantsCount: number;
  isActive: boolean;
}

export interface MockNotification {
  id: string;
  type: "invite" | "expense_created" | "expense_updated" | "settlement_created" | "sync_failed";
  title: string;
  body: string;
  date: string;
  read: boolean;
}

export const MOCK_USER = {
  id: "user-123",
  name: "Alexander Pierce",
  email: "alex.pierce@fintech.io",
  avatarUrl: "https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=150&q=80",
  netBalanceMinor: 145000, // +1,450.00
  owedMinor: 245000,
  owesMinor: 100000,
  currency: "INR"
};

export const MOCK_GROUPS: MockGroup[] = [
  {
    id: "group-1",
    name: "Himalayan Expedition 2026",
    type: "trip",
    baseCurrency: "INR",
    balance: 85000, // +850.00
    members: [
      { id: "user-123", name: "Alexander Pierce", isUser: true },
      { id: "m-1", name: "Rohan Gupta" },
      { id: "m-2", name: "Priya Sharma" },
      { id: "m-3", name: "Vikram Malhotra" }
    ],
    lastActivity: "2 hours ago"
  },
  {
    id: "group-2",
    name: "Apartment 4B Groceries & Rent",
    type: "home",
    baseCurrency: "INR",
    balance: -42000, // -420.00
    members: [
      { id: "user-123", name: "Alexander Pierce", isUser: true },
      { id: "m-4", name: "Kunal Sen" },
      { id: "m-5", name: "Neha Bajaj" }
    ],
    lastActivity: "1 day ago"
  },
  {
    id: "group-3",
    name: "Weekend Getaway (Goa)",
    type: "trip",
    baseCurrency: "INR",
    balance: 0, // Settled
    members: [
      { id: "user-123", name: "Alexander Pierce", isUser: true },
      { id: "m-1", name: "Rohan Gupta" },
      { id: "m-5", name: "Neha Bajaj" }
    ],
    lastActivity: "1 week ago"
  }
];

export const MOCK_EXPENSES: MockExpense[] = [
  {
    id: "exp-1",
    title: "Mountain Equipment & Gear Rental",
    amountMinor: 1250000, // 12,500.00
    currency: "INR",
    date: "2026-08-06",
    category: "Equipment",
    payerName: "Alexander Pierce",
    syncStatus: "synced",
    groupName: "Himalayan Expedition 2026",
    splitSummary: "You paid, split equally among all members"
  },
  {
    id: "exp-2",
    title: "Organic Vegetables & Whole Foods",
    amountMinor: 320000, // 3,200.00
    currency: "INR",
    date: "2026-08-05",
    category: "Groceries",
    payerName: "Kunal Sen",
    syncStatus: "synced",
    groupName: "Apartment 4B Groceries & Rent",
    splitSummary: "Kunal paid, you owe 1,066.67"
  },
  {
    id: "exp-3",
    title: "Highway Tolls & Fuel Refuel",
    amountMinor: 450000, // 4,500.00
    currency: "INR",
    date: "2026-08-05",
    category: "Transport",
    payerName: "Alexander Pierce",
    syncStatus: "queued",
    groupName: "Weekend Getaway (Go Goa)",
    splitSummary: "You paid (offline request), split equally"
  },
  {
    id: "exp-4",
    title: "Starbucks Coffee & Snacks",
    amountMinor: 85000, // 850.00
    currency: "INR",
    date: "2026-08-04",
    category: "Café",
    payerName: "Priya Sharma",
    syncStatus: "synced",
    groupName: "Himalayan Expedition 2026",
    splitSummary: "Priya paid, Priya owes you 212.50"
  },
  {
    id: "exp-5",
    title: "Broadband Wifi Bill (August)",
    amountMinor: 99900, // 999.00
    currency: "INR",
    date: "2026-08-01",
    category: "Utilities",
    payerName: "Alexander Pierce",
    syncStatus: "conflict",
    groupName: "Apartment 4B Groceries & Rent",
    splitSummary: "Edit version conflict (requires resolution)"
  }
];

export const MOCK_SETTLEMENTS: MockSettlement[] = [
  {
    id: "set-1",
    fromName: "Neha Bajaj",
    toName: "Alexander Pierce",
    amountMinor: 250000,
    currency: "INR",
    method: "UPI",
    date: "2026-08-03"
  },
  {
    id: "set-2",
    fromName: "Alexander Pierce",
    toName: "Kunal Sen",
    amountMinor: 150000,
    currency: "INR",
    method: "Cash",
    date: "2026-08-01"
  }
];

export const MOCK_RECURRING_TEMPLATES: MockRecurringTemplate[] = [
  {
    id: "rec-1",
    title: "Apartment Rent Payment",
    amountMinor: 3500000, // 35,000.00
    currency: "INR",
    frequency: "monthly",
    nextDue: "2026-09-01",
    participantsCount: 3,
    isActive: true
  },
  {
    id: "rec-2",
    title: "Netflix Premium Family Account",
    amountMinor: 64900, // 649.00
    currency: "INR",
    frequency: "monthly",
    nextDue: "2026-08-15",
    participantsCount: 4,
    isActive: true
  },
  {
    id: "rec-3",
    title: "Gym Membership Shared Pass",
    amountMinor: 400000, // 4,000.00
    currency: "INR",
    frequency: "monthly",
    nextDue: "2026-08-20",
    participantsCount: 2,
    isActive: false
  }
];

export const MOCK_NOTIFICATIONS: MockNotification[] = [
  {
    id: "not-1",
    type: "invite",
    title: "Group Invitation",
    body: "Rohan Gupta invited you to join 'Roadtrip to Manali'",
    date: "10 mins ago",
    read: false
  },
  {
    id: "not-2",
    type: "expense_created",
    title: "New Expense Added",
    body: "Neha Bajaj added 'Electricity Bill' (₹1,850.00) in Apartment 4B",
    date: "1 hour ago",
    read: false
  },
  {
    id: "not-3",
    type: "sync_failed",
    title: "Synchronization Warning",
    body: "Offline edit 'Broadband Wifi Bill' failed to sync due to a version conflict.",
    date: "2 hours ago",
    read: true
  },
  {
    id: "not-4",
    type: "settlement_created",
    title: "Settlement Received",
    body: "Rohan Gupta recorded a UPI settlement of ₹5,000.00 to you",
    date: "1 day ago",
    read: true
  }
];
