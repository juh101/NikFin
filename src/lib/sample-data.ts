export const TRANSACTIONS = [
  {
    id: '1',
    description: 'Starbucks Coffee',
    amount: 450.00,
    category: 'Food and snacks',
    type: 'expense' as const,
    date: '2024-03-10',
    icon: 'Coffee'
  },
  {
    id: '2',
    description: 'Monthly Salary',
    amount: 85000.00,
    category: 'Salary',
    type: 'income' as const,
    date: '2024-03-01',
    icon: 'Wallet'
  },
  {
    id: '3',
    description: 'Apple Music Subscription',
    amount: 99.00,
    category: 'Entertainment',
    type: 'expense' as const,
    date: '2024-03-05',
    icon: 'Music'
  },
  {
    id: '4',
    description: 'Grocery Shopping',
    amount: 2500.50,
    category: 'Groceries',
    type: 'expense' as const,
    date: '2024-03-08',
    icon: 'ShoppingBag'
  },
  {
    id: '5',
    description: 'Uber Ride',
    amount: 350.00,
    category: 'Transport',
    type: 'expense' as const,
    date: '2024-03-09',
    icon: 'Car'
  },
  {
    id: '6',
    description: 'Internet Bill',
    amount: 999.00,
    category: 'Utilities',
    type: 'expense' as const,
    date: '2024-03-02',
    icon: 'Globe'
  }
];

export const CATEGORIES = [
  'Salary', 'Bonus', 'Side Hustle', 'Rent', 'Utilities', 'Transport', 'Groceries', 'Entertainment', 'Other', 'Investments', 'Food and snacks', 'Securities'
];

export const PAYMENT_MODES = [
  'Cash', 'UPI', 'Card', 'Bank', 'Other'
];

export const SPENDING_BY_CATEGORY = [
  { category: 'Food and snacks', amount: 3500, fill: 'hsl(var(--chart-1))' },
  { category: 'Groceries', amount: 5000, fill: 'hsl(var(--chart-2))' },
  { category: 'Transport', amount: 2000, fill: 'hsl(var(--chart-3))' },
  { category: 'Entertainment', amount: 1500, fill: 'hsl(var(--chart-4))' },
  { category: 'Others', amount: 1000, fill: 'hsl(var(--chart-5))' },
];
