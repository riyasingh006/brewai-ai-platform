export type User = {
  id: string;
  email: string;
  name: string | null;
  imageUrl: string | null;
  role: "customer" | "admin";
  phone: string | null;
  birthday: string | null;
  loyaltyPoints: number;
  referralCode: string;
  createdAt: string;
  orderCount?: number;
  favoriteCount?: number;
};

export type MenuItem = {
  id: number;
  name: string;
  category: string;
  price: number;
  description: string;
  available: boolean;
  imageUrl: string | null;
  tags: string[];
  calories: number | null;
  featured?: boolean;
};

export type CartItem = {
  id: number;
  menuItemId: number;
  name: string;
  unitPrice: number;
  quantity: number;
  customization: Record<string, string | string[]>;
  createdAt: string;
};

export type Receipt = {
  invoiceNumber: string;
  qrCode: string;
  pdfUrl: string;
};

export type OrderItem = {
  id: number;
  name: string;
  unitPrice: number;
  quantity: number;
  customization: Record<string, string | string[]>;
};

export type Order = {
  id: string;
  orderNumber: string;
  status: "pending" | "confirmed" | "preparing" | "ready" | "completed" | "cancelled";
  paymentMethod: string;
  paymentStatus: string;
  subtotal: number;
  discount: number;
  tax: number;
  tip: number;
  total: number;
  couponCode: string | null;
  notes: string | null;
  estMinutes: number;
  createdAt: string;
  completedAt?: string | null;
  statusHistory?: { status: string; timestamp: string }[];
  items: OrderItem[];
  receipt?: Receipt | null;
  review?: { rating: number; comment: string | null } | null;
};

export type Coupon = {
  id: string;
  code: string;
  description: string;
  discountType: string;
  discountValue: number;
  minOrder: number;
  maxDiscount: number | null;
  expiresAt: string | null;
  isActive: boolean;
  used: boolean;
  reason: string;
};

export type ChatSession = {
  id: string;
  title: string;
  createdAt: string;
};

export type ChatMessage = {
  id: string;
  role: "user" | "assistant";
  content: string;
  toolName?: string | null;
  createdAt: string;
};

export type OrderDraft = {
  item: string;
  quantity: number;
  size?: string;
  milk?: string;
  toppings?: string[];
};

export type SSEEvent =
  | { event: "start"; data: { sessionId: string } }
  | {
      event: "tool";
      data: { title: string; items: MenuItem[]; text: string; prompt?: string | null };
    }
  | { event: "order"; data: { draft: OrderDraft; text: string } }
  | { event: "orderCreated"; data: { order: Order; text: string } }
  | { event: "orderCancelled"; data: { order: Order; text: string } }
  | { event: "orderStatus"; data: { order: Order; text: string } }
  | { event: "orderState"; data: { cart: CartItem[]; text: string } }
  | { event: "orderText"; data: { text: string } }
  | { event: "delta"; data: { text: string } }
  | { event: "done"; data: { sessionId: string; replyKind: string; text: string } }
  | { event: "error"; data: { message: string } };

export type OrderDraftEvent = Extract<SSEEvent, { event: "order" }>;

export type DashboardAnalytics = {
  range: { period: string; label: string; start: string; end: string };
  summary: {
    revenue: number;
    orders: number;
    customers: number;
    avg: number;
    prevRevenue: number;
    prevOrders: number;
    prevCustomers: number;
    prevAvg: number;
    revenueDelta: number | null;
    ordersDelta: number | null;
    customersDelta: number | null;
    avgDelta: number | null;
  };
  revenue: { date: string; revenue: number; orders: number }[];
  topItems: { name: string; count: number; revenue: number }[];
  ordersByTime: {
    rows: string[];
    columns: string[];
    matrix: number[][];
    max: number;
  };
  orderStatus: { label: string; value: number; color: string }[];
  customers: { label: string; value: number; color: string }[];
  recentOrders: DashboardRecentOrder[];
};

export type DashboardRecentOrder = {
  id: string;
  orderNumber: string;
  customer: string;
  status: Order["status"];
  total: number;
  createdAt: string;
  items: { name: string; quantity: number }[];
};

export type AdminOrder = {
  id: string;
  orderNumber: string;
  customer: string | null;
  status: Order["status"];
  paymentMethod: string;
  paymentStatus: string;
  total: number;
  createdAt: string;
  itemCount: number;
  invoice: string | null;
};

export type AdminCustomer = {
  id: string;
  name: string | null;
  email: string;
  phone: string | null;
  imageUrl: string | null;
  loyaltyPoints: number;
  referralCode: string | null;
  orderCount: number;
  totalSpend: number;
  avgOrderValue: number;
  lastOrderAt: string | null;
  createdAt: string;
  tier: "new" | "active" | "returning";
};

export type CustomerDashboard = {
  user: {
    id: string;
    name: string | null;
    email: string;
    loyaltyPoints: number;
    referralCode: string | null;
    createdAt: string;
  };
  stats: {
    totalOrders: number;
    totalSpend: number;
    favoriteDrink: string | null;
    visits30d: number;
    memberSince: string;
  };
  loyalty: {
    tier: string;
    nextTier: string | null;
    pointsToNext: number;
    rewardsPerOrder: number;
    referralReward: number;
  };
  activeOrder: DashboardOrder | null;
  recentOrders: DashboardOrder[];
};

export type DashboardOrder = {
  id: string;
  orderNumber: string;
  status: Order["status"];
  total: number;
  createdAt: string;
  items: { name: string; quantity: number }[];
};
