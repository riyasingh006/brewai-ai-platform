# ☕ BrewAI — AI-Powered Coffee Shop Assistant

> 🤖 **An AI-powered coffee commerce platform combining intelligent conversations, personalized recommendations, online ordering, customer engagement, business analytics, and secure admin management.**

---

## 🌟 Overview

**BrewAI** is a full-stack AI-powered Coffee Shop Assistant and SaaS platform designed to create a modern, intelligent, and personalized coffee ordering experience.

The platform combines **Generative AI, coffee commerce, customer personalization, online ordering, location-based café discovery, analytics, and role-based administration** into one application.

### What BrewAI Combines

* 🤖 Generative AI
* ☕ Coffee Commerce
* 🛒 Online Ordering
* 🧠 Personalized Recommendations
* 📊 Business Analytics
* 🔐 Role-Based Security
* 🗺️ Location Services
* 👤 Customer Management
* 👑 Admin Management

---

# 🚀 Core Features

## 👤 Customer Experience

* ☕ Browse coffee menu
* 🤖 AI-powered coffee assistant
* 🧠 Personalized coffee recommendations
* 🛒 Shopping cart
* 📦 Order management
* 🏆 Loyalty / reward points
* 💰 Spending overview
* ❤️ Favorite drinks
* 💬 Recent AI conversations
* 👤 Dynamic customer profile
* 🗺️ Nearby café discovery
* 📍 Location-based café search
* 🔄 Order status tracking

---

## 👑 Admin Experience

* 📊 Admin dashboard
* 💰 Revenue overview
* 🛍️ Order management
* 🍵 Menu management
* 👥 Customer management
* 📈 Top-selling products
* 🕐 Orders-by-time analytics
* 🔄 Order-status management
* ⚙️ Admin settings
* 🔐 Protected administrator APIs
* 📊 Business performance analytics

---

# 🤖 AI Integration

BrewAI integrates **Google Gemini** to provide conversational AI capabilities.

### AI Use Cases

* 💬 Natural-language conversations
* ☕ Coffee recommendations
* 🧠 Personalized suggestions
* 🛍️ Conversational shopping assistance
* ❤️ Preference-aware recommendations
* 🤖 AI-powered customer assistance

### Example

**Customer:**

> I want something cold and not too sweet.

**BrewAI:**

> Here are some refreshing options that match your preference.

---

# 🏗️ System Architecture

```text
                         ☕ BREWAI
                            │
              ┌─────────────┴─────────────┐
              │                           │
        👤 CUSTOMER                    👑 ADMIN
              │                           │
       ┌──────┼───────┐            ┌──────┼───────┐
       │      │       │            │      │       │
      Menu    AI    Orders      Analytics Orders  Menu
       │      │       │            │      │       │
       └──────┼───────┘            └──────┼───────┘
              │                           │
              └─────────────┬─────────────┘
                            │
                   🔐 Authentication
                            │
                      REST API Layer
                            │
                 ┌──────────┴──────────┐
                 │                     │
           🤖 Gemini AI          🗺️ Google Maps
                 │                     │
                 └──────────┬──────────┘
                            │
                     💾 Application Data
```

---

# 🛠️ Technology Stack

| Layer        | Technology               | Purpose                        |
| ------------ | ------------------------ | ------------------------------ |
| 🎨 Frontend  | Next.js                  | Web application framework      |
| ⚛️ UI        | React                    | Component-based interface      |
| 📘 Language  | TypeScript               | Type-safe development          |
| ⚙️ Backend   | Python                   | API and application logic      |
| 🔌 APIs      | REST APIs                | Frontend/backend communication |
| 🤖 AI        | Google Gemini            | Conversational AI              |
| 🗺️ Location | Google Maps Platform     | Nearby café discovery          |
| 🔐 Security  | Authentication + RBAC    | Customer/admin access control  |
| 📊 Analytics | Dashboard Visualizations | Business insights              |

---

# 🔐 Authentication & Role-Based Access Control

BrewAI separates users into two protected roles:

* 👤 **CUSTOMER**
* 👑 **ADMIN**

## 👤 Customer Authentication Flow

```text
Register
   ↓
Customer Role
   ↓
Login
   ↓
Customer Dashboard
```

## 👑 Admin Authentication Flow

```text
Admin Login
   ↓
Email + Password
   ↓
ADMIN_SECRET_KEY Verification
   ↓
Admin Role
   ↓
Admin Dashboard
```

## 🛡️ Security Boundaries

| Scenario                         | Expected Result            |
| -------------------------------- | -------------------------- |
| 👤 Customer → `/admin/dashboard` | 🚫 Blocked                 |
| 👤 Customer → Admin API          | 🚫 403 Forbidden           |
| 👑 Admin → Admin API             | ✅ Allowed                  |
| 🔑 Invalid admin secret          | 🚫 Rejected                |
| 🍪 Invalid session               | 🚫 Rejected                |
| 🧪 Forged role/cookie            | 🚫 No privilege escalation |
| 🚪 Logout                        | ✅ Session cleared          |

---

# 🗺️ Nearby Café Discovery

BrewAI includes location-based café discovery using **Google Maps Platform**.

```text
📍 Customer Location
        ↓
🗺️ Google Maps
        ↓
☕ Nearby Cafés
        ↓
👤 Customer Discovery
```

### Environment Variable

```env
NEXT_PUBLIC_GOOGLE_MAPS_API_KEY=your_google_maps_key
```

---

# 📊 Admin Analytics

The administrator dashboard converts coffee-shop activity into useful business insights.

## 📈 Key Performance Indicators

* 💰 Total Revenue
* 🛒 Total Orders
* 👥 Total Customers
* 💵 Average Order Value

## 📊 Analytics

* 📈 Revenue Overview
* 🏆 Top Selling Items
* 🕐 Orders by Time
* 🔄 Order Status
* 👥 Customer Statistics
* 📦 Product Performance

---

# 📦 Order Workflow

```text
☕ Menu
   ↓
🛒 Cart
   ↓
🧾 Order
   ↓
📦 Order Tracking
   ↓
🔄 Status Updates
```

## 🔄 Order Status

```text
🟡 Pending
   ↓
🔵 Confirmed
   ↓
🟠 Preparing
   ↓
🟢 Completed
```

---

# 🧭 Application Structure

```text
/
├── /auth
│
├── /dashboard
│   ├── Customer Dashboard
│   ├── Chat
│   ├── Menu
│   ├── Orders
│   ├── Profile
│   └── Nearby Cafés
│
└── /admin
    └── /dashboard
        ├── Dashboard
        ├── Orders
        ├── Menu Manager
        ├── Customers
        └── Settings
```

---

# 📁 Project Structure

```text
coffee-shop-ai-agent/
│
├── app/
│
├── backend/
│   ├── routers/
│   │   └── auth.py
│   │
│   ├── services/
│   │   └── auth_service.py
│   │
│   └── ...
│
├── frontend/
│
├── data/
│
├── pictures/
│
├── .env.example
├── .gitignore
├── README.md
├── requirements.txt
└── VERIFICATION-REPORT.md
```

---

# 🔑 Environment Configuration

Create a local `.env` file and configure the required credentials.

### 🤖 Google Gemini

```env
GEMINI_API_KEY=your_gemini_api_key
```

### 🗺️ Google Maps

```env
NEXT_PUBLIC_GOOGLE_MAPS_API_KEY=your_google_maps_api_key
```

### 🔐 Administrator

```env
ADMIN_SECRET_KEY=your_private_admin_secret
```

> ⚠️ **Never commit your `.env` file or expose API keys and private secrets publicly.**

Make sure `.env` is included in your `.gitignore`.

---

# 🛠️ Local Development

## 1️⃣ Clone the Repository

```bash
git clone <your-repository-url>
cd coffee-shop-ai-agent
```

## 2️⃣ Install Dependencies

```bash
npm install
```

For the Python backend:

```bash
pip install -r requirements.txt
```

## 3️⃣ Configure Environment

Create a `.env` file and add:

```env
GEMINI_API_KEY=your_gemini_api_key
NEXT_PUBLIC_GOOGLE_MAPS_API_KEY=your_google_maps_api_key
ADMIN_SECRET_KEY=your_private_admin_secret
```

## 4️⃣ Start the Frontend

```bash
npm run dev
```

Frontend:

```text
http://localhost:3000
```

## 5️⃣ Start the Backend

Start the Python backend using the server configuration included in the project.

Backend:

```text
http://localhost:8000
```

> 💡 Use the exact backend command configured in your project.

---

# 🧪 Verification & Security Testing

The application should verify the following scenarios:

| Test                          | Expected Result            |
| ----------------------------- | -------------------------- |
| 👤 Customer registration      | ✅ Customer role            |
| 👤 Customer login             | ✅ Customer dashboard       |
| 👑 Admin authentication       | ✅ Admin role               |
| 🔑 Wrong admin secret         | 🚫 Rejected                |
| 🚫 Customer → Admin dashboard | 🚫 Blocked                 |
| 👑 Admin → Admin API          | ✅ Allowed                  |
| 👤 Customer → Admin API       | 🚫 403 Forbidden           |
| 🧪 Forged role                | 🚫 No privilege escalation |
| 🍪 Invalid session            | 🚫 Rejected                |
| 🚪 Logout                     | ✅ Session cleared          |

---

# 📚 What This Project Demonstrates

## 💻 Full-Stack Development

* React
* Next.js
* TypeScript
* Python
* REST APIs
* Responsive UI
* Component architecture
* Frontend/backend integration

## 🤖 AI / Generative AI

* Google Gemini API integration
* Conversational AI
* AI-powered recommendations
* Prompt-based workflows
* AI-assisted user experiences

## 🔐 Security

* Authentication
* Authorization
* Role-Based Access Control
* Protected routes
* Protected APIs
* Secret management
* Session validation
* Privilege-escalation prevention

## 📊 Analytics

* KPI design
* Revenue analytics
* Order analytics
* Customer analytics
* Product performance analysis

## 🧠 Product Engineering

* Customer journey design
* Admin workflows
* SaaS architecture
* Real-world business requirements
* Role-specific interfaces
* Dashboard design

---

# 🛣️ Future Roadmap

## 🤖 AI

* 🧠 Long-term preference memory
* 🎯 Advanced recommendation engine
* 🗣️ Voice ordering
* 🔊 AI voice responses
* 🌐 Multi-language assistant
* 🌦️ Weather-aware recommendations

## 💳 Commerce

* 💳 Payment gateway
* 🧾 Automatic PDF receipts
* 🎟️ Coupons
* 💰 Wallet / credits
* 🚚 Delivery tracking

## 🏪 Marketplace

* 🏬 Multiple cafés
* 🧑‍🍳 Café onboarding
* 📋 Restaurant dashboards
* 🚚 Delivery-fee management
* 💼 Platform commission
* 🗺️ Multi-café discovery

## 📊 Advanced Analytics

* 🔮 Demand forecasting
* 📦 Inventory analytics
* 🧠 Customer segmentation
* 📈 Predictive sales analytics

---

# 👩‍💻 Author

## Riya Singh

🚀 **AI / Data / Full-Stack Enthusiast**
☕ **Creator of BrewAI**

---

# ⭐ Project Vision

BrewAI aims to transform traditional coffee ordering into an **intelligent, personalized, and data-driven experience** by combining AI assistance, digital commerce, customer engagement, and business analytics in a single platform.

---

<div align="center">

# ☕ BrewAI

### Your Intelligent Coffee Companion 🤖

**AI • Coffee • Commerce • Analytics • Personalization**

</div>
