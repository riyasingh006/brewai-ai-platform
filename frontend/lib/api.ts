import type {
  AdminCustomer,
  AdminOrder,
  CartItem,
  ChatMessage,
  ChatSession,
  Coupon,
  CustomerDashboard,
  DashboardAnalytics,
  MenuItem,
  Order,
  SSEEvent,
  User,
} from "./types";

export const API_URL =
  process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

export const DEV_EMAIL_KEY = "brewai.dev_email";
export const AUTH_TOKEN_KEY = "brewai.token";
export const AUTH_COOKIE = "brewai.session";

export function getDevEmail(): string | null {
  if (typeof window === "undefined") return null;
  return window.localStorage.getItem(DEV_EMAIL_KEY);
}

export function setDevEmail(email: string) {
  window.localStorage.setItem(DEV_EMAIL_KEY, email);
}

export function getAuthToken(): string | null {
  if (typeof window === "undefined") return null;
  return window.localStorage.getItem(AUTH_TOKEN_KEY);
}

/** Persist the first-party session token (localStorage for API calls + a
 * cookie readable by the Next proxy for server-side route protection). */
export function setAuthToken(token: string | null) {
  if (typeof window === "undefined") return;
  if (token) {
    window.localStorage.setItem(AUTH_TOKEN_KEY, token);
    const maxAge = 60 * 60 * 24 * 7; // matches backend session TTL default
    document.cookie = `${AUTH_COOKIE}=${encodeURIComponent(token)}; path=/; max-age=${maxAge}; SameSite=Lax`;
  } else {
    window.localStorage.removeItem(AUTH_TOKEN_KEY);
    document.cookie = `${AUTH_COOKIE}=; path=/; max-age=0; SameSite=Lax`;
  }
}

export class ApiError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

async function parseError(res: Response): Promise<ApiError> {
  let detail = `HTTP ${res.status}`;
  try {
    const body = await res.json();
    if (typeof body.detail === "string") detail = body.detail;
    else if (Array.isArray(body.detail) && body.detail[0]?.msg)
      detail = body.detail.map((d: { msg: string }) => d.msg).join("; ");
    else if (body.message) detail = body.message;
  } catch {
    /* ignore */
  }
  return new ApiError(res.status, detail);
}

async function request<T>(
  path: string,
  init: RequestInit = {},
  devEmail: string | null = null,
): Promise<T> {
  const headers: Record<string, string> = {
    Accept: "application/json",
    ...(init.headers as Record<string, string>),
  };
  const token = getAuthToken();
  if (token) headers["Authorization"] = `Bearer ${token}`;
  else if (devEmail) headers["X-Dev-User"] = devEmail;
  const res = await fetch(`${API_URL}${path}`, { ...init, headers });
  if (!res.ok) throw await parseError(res);
  return (await res.json()) as T;
}

export const api = {
  async me(devEmail: string | null): Promise<User> {
    return request("/api/me", {}, devEmail);
  },
  async register(
    email: string,
    password: string,
    name?: string,
  ): Promise<{ user: User; token: string }> {
    return request("/api/auth/register", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password, name }),
    });
  },
  async login(
    email: string,
    password: string,
  ): Promise<{ user: User; token: string }> {
    return request("/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password }),
    });
  },
  async adminRegister(
    email: string,
    password: string,
    adminKey: string,
    name?: string,
  ): Promise<{ user: User; token: string }> {
    return request("/api/auth/admin/register", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password, name, adminKey }),
    });
  },
  async adminLogin(
    email: string,
    password: string,
    adminKey: string,
  ): Promise<{ user: User; token: string }> {
    return request("/api/auth/admin/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password, adminKey }),
    });
  },
  async updateProfile(
    devEmail: string | null,
    data: {
      name?: string;
      phone?: string;
      birthday?: string;
      imageUrl?: string;
    },
  ): Promise<User> {
    return request(
      "/api/me",
      {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      },
      devEmail,
    );
  },
  async menu(devEmail: string | null): Promise<MenuItem[]> {
    return request("/api/menu", {}, devEmail);
  },
  async addFavorite(devEmail: string | null, menuItemId: number) {
    return request(`/api/me/favorites/${menuItemId}`, { method: "POST" }, devEmail);
  },
  async removeFavorite(devEmail: string | null, menuItemId: number) {
    return request(`/api/me/favorites/${menuItemId}`, { method: "DELETE" }, devEmail);
  },
  async favorites(devEmail: string | null): Promise<
    { id: number; menuItem: MenuItem }[]
  > {
    return request("/api/me/favorites", {}, devEmail);
  },
  async search(
    devEmail: string | null,
    q: string,
    category?: string,
    tag?: string,
  ): Promise<{ items: MenuItem[]; count: number }> {
    const params = new URLSearchParams();
    if (q) params.set("q", q);
    if (category && category !== "All") params.set("category", category);
    if (tag) params.set("tag", tag);
    const qs = params.toString();
    return request(`/api/menu/search${qs ? `?${qs}` : ""}`, {}, devEmail);
  },
  async trending(devEmail: string | null): Promise<{
    popular: MenuItem[];
    new: MenuItem[];
    bestSellers: MenuItem[];
  }> {
    return request("/api/menu/trending", {}, devEmail);
  },
  async cart(devEmail: string | null): Promise<CartItem[]> {
    return request("/api/cart", {}, devEmail);
  },
  async addToCart(
    devEmail: string | null,
    menuItemId: number,
    quantity = 1,
    customization?: Record<string, string | string[]>,
  ): Promise<CartItem> {
    return request(
      "/api/cart",
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ menuItemId, quantity, customization }),
      },
      devEmail,
    );
  },
  async updateCartItem(
    devEmail: string | null,
    cartItemId: number,
    quantity: number,
  ): Promise<CartItem> {
    return request(
      `/api/cart/${cartItemId}`,
      {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ quantity }),
      },
      devEmail,
    );
  },
  async removeCartItem(devEmail: string | null, cartItemId: number) {
    return request(`/api/cart/${cartItemId}`, { method: "DELETE" }, devEmail);
  },
  async clearCart(devEmail: string | null) {
    return request("/api/cart", { method: "DELETE" }, devEmail);
  },
  async checkout(
    devEmail: string | null,
    payload: {
      paymentMethod: string;
      couponCode?: string;
      tip?: number;
      notes?: string;
    },
  ): Promise<Order> {
    return request(
      "/api/orders",
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      },
      devEmail,
    );
  },
  async orders(devEmail: string | null): Promise<Order[]> {
    return request("/api/orders", {}, devEmail);
  },
  async order(
    devEmail: string | null,
    orderId: string,
  ): Promise<Order> {
    return request(`/api/orders/${orderId}`, {}, devEmail);
  },
  async reviewOrder(
    devEmail: string | null,
    orderId: string,
    rating: number,
    comment: string,
  ) {
    return request(
      `/api/orders/${orderId}/review`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ rating, comment }),
      },
      devEmail,
    );
  },
  async coupons(devEmail: string | null): Promise<Coupon[]> {
    return request("/api/coupons", {}, devEmail);
  },
  async sessions(devEmail: string | null): Promise<ChatSession[]> {
    return request("/api/chat/sessions", {}, devEmail);
  },
  async sessionMessages(
    devEmail: string | null,
    sessionId: string,
  ): Promise<ChatMessage[]> {
    return request(`/api/chat/sessions/${sessionId}/messages`, {}, devEmail);
  },
  async deleteSession(devEmail: string | null, sessionId: string) {
    return request(`/api/chat/sessions/${sessionId}`, { method: "DELETE" }, devEmail);
  },
  async dashboardAnalytics(
    devEmail: string | null,
    params: { period?: string; start?: string; end?: string } = {},
  ): Promise<DashboardAnalytics> {
    const qs = new URLSearchParams();
    if (params.period) qs.set("period", params.period);
    if (params.start) qs.set("start", params.start);
    if (params.end) qs.set("end", params.end);
    const query = qs.toString();
    return request(
      `/api/admin/dashboard${query ? `?${query}` : ""}`,
      {},
      devEmail,
    );
  },
  async adminSummary(devEmail: string | null): Promise<
    Record<string, number>
  > {
    return request("/api/admin/summary", {}, devEmail);
  },
  async adminRevenue(devEmail: string | null): Promise<
    { date: string; revenue: number; orders: number }[]
  > {
    return request("/api/admin/revenue", {}, devEmail);
  },
  async adminPopular(devEmail: string | null): Promise<
    { name: string; quantity: number; revenue: number }[]
  > {
    return request("/api/admin/popular", {}, devEmail);
  },
  async adminPeakHours(devEmail: string | null): Promise<
    { hour: number; orders: number }[]
  > {
    return request("/api/admin/peak-hours", {}, devEmail);
  },
  async adminOrders(devEmail: string | null): Promise<AdminOrder[]> {
    return request("/api/admin/orders", {}, devEmail);
  },
  async adminUpdateStatus(
    devEmail: string | null,
    orderId: string,
    status: string,
  ) {
    return request(
      `/api/admin/orders/${orderId}/status`,
      {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      },
      devEmail,
    );
  },
  async adminCustomers(
    devEmail: string | null,
    opts: { search?: string; status?: string; sort?: string } = {},
  ): Promise<AdminCustomer[]> {
    const qs = new URLSearchParams();
    if (opts.search) qs.set("search", opts.search);
    if (opts.status && opts.status !== "all") qs.set("status", opts.status);
    if (opts.sort) qs.set("sort", opts.sort);
    const query = qs.toString();
    return request(
      `/api/admin/customers${query ? `?${query}` : ""}`,
      {},
      devEmail,
    );
  },
  async adminCreateMenuItem(
    devEmail: string | null,
    payload: {
      name: string;
      category?: string;
      price: number;
      description?: string;
      available?: boolean;
      imageUrl?: string | null;
      featured?: boolean;
      tags?: string[];
    },
  ): Promise<MenuItem> {
    return request(
      "/api/admin/menu",
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      },
      devEmail,
    );
  },
  async adminUpdateMenuItem(
    devEmail: string | null,
    menuItemId: number,
    payload: {
      name?: string;
      category?: string;
      price?: number;
      description?: string;
      available?: boolean;
      imageUrl?: string | null;
      featured?: boolean;
      tags?: string[];
    },
  ): Promise<MenuItem> {
    return request(
      `/api/admin/menu/${menuItemId}`,
      {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      },
      devEmail,
    );
  },
  async adminDeleteMenuItem(devEmail: string | null, menuItemId: number) {
    return request(
      `/api/admin/menu/${menuItemId}`,
      { method: "DELETE" },
      devEmail,
    );
  },
  async meDashboard(devEmail: string | null): Promise<CustomerDashboard> {
    return request("/api/me/dashboard", {}, devEmail);
  },
  async health(): Promise<{ status: string; provider: string; env: string }> {
    return request("/api/health", {});
  },
};

/** Stream a chat message over SSE, invoking `onEvent` per parsed event. */
export async function streamChat(
  devEmail: string | null,
  message: string,
  history: { role: "user" | "assistant"; text: string }[],
  onEvent: (ev: SSEEvent) => void,
  signal?: AbortSignal,
): Promise<void> {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    Accept: "text/event-stream",
  };
  const token = getAuthToken();
  if (token) headers["Authorization"] = `Bearer ${token}`;
  else headers["X-Dev-User"] = devEmail ?? "";
  const res = await fetch(`${API_URL}/api/chat`, {
    method: "POST",
    headers,
    body: JSON.stringify({ message, history }),
    signal,
  });
  if (!res.ok) throw await parseError(res);
  if (!res.body) throw new ApiError(0, "No response body.");

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });

    let idx: number;
    while ((idx = buffer.indexOf("\n\n")) !== -1) {
      const raw = buffer.slice(0, idx);
      buffer = buffer.slice(idx + 2);
      const event = parseSSE(raw);
      if (event) onEvent(event);
    }
  }
}

function parseSSE(raw: string): SSEEvent | null {
  let name = "message";
  const dataLines: string[] = [];
  for (const line of raw.split("\n")) {
    if (line.startsWith("event:")) name = line.slice(6).trim();
    else if (line.startsWith("data:")) dataLines.push(line.slice(5).trim());
  }
  if (!dataLines.length) return null;
  try {
    const data = JSON.parse(dataLines.join("\n"));
    return { event: name, data } as SSEEvent;
  } catch {
    return null;
  }
}
