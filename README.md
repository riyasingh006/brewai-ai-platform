☕✨ BrewAI --- AI Coffee Shop Assistant

<p align="center">

<strong>{=html}🤖 AI-powered coffee experience for customers, cafés &modern digital commerce.</strong>{=html}

</p>

<p align="center">

☕ AI Assistant • 🛒 Smart Ordering • 📊 Admin Analytics • 🗺️ NearbyCafés • 🔐 Secure RBAC

</p>

🌟 Overview

BrewAI is a premium full-stack AI-powered Coffee Shop Assistant &SaaS platform that combines conversational AI, personalized coffeediscovery, online ordering, customer engagement, business analytics andsecure administrator workflows.

It is more than a static coffee-shop website:

🤖 Generative AI + ☕ Coffee Commerce + 📊 BusinessAnalytics + 🔐 Role-Based Security + 🗺️ Location Services

🚀 Core Features

👤 Customer Experience

☕ Browse the menu

🤖 AI-powered coffee assistant

🧠 Personalized recommendations

🛒 Cart and ordering workflow

📦 Order tracking

🏆 Loyalty / reward points

💰 Spending overview

❤️ Favorite drinks

💬 Recent AI chats

👤 Dynamic customer profile

🗺️ Nearby café discovery

👑 Admin Experience

📊 Business dashboard

💰 Revenue overview

🛍️ Order management

🍵 Menu Manager

👥 Customer management

📈 Top-selling items

🕐 Orders-by-time analytics

🔄 Order-status management

⚙️ Settings

🔐 Protected administrator APIs

🧠 AI Layer

BrewAI integrates Google Gemini for its conversational AIexperience.

🤖 AI Use Cases

💬 Natural-language conversations

☕ Coffee recommendations

🧠 Personalized suggestions

🛍️ Conversational shopping assistance

❤️ Preference-aware experiences

Example:

👤 Customer:
"I want something cold and not too sweet."

🤖 BrewAI:
"Here are some refreshing options that match your preference..."

🏗️ Architecture

                         ☕ BREWAI
                            │
              ┌─────────────┴─────────────┐
              │                           │
        👤 CUSTOMER                    👑 ADMIN
              │                           │
      ┌───────┼────────┐          ┌───────┼────────┐
      │       │        │          │       │        │
    Menu     AI      Orders     Analytics Orders  Menu
      │       │        │          │       │        │
      └───────┼────────┘          └───────┼────────┘
              │                           │
              └──────────┬────────────────┘
                         │
                  🔐 Authentication
                         │
                    REST / API Layer
                         │
              ┌──────────┴──────────┐
              │                     │
        🤖 Gemini AI          🗺️ Google Maps
              │                     │
              └──────────┬──────────┘
                         │
                  💾 Application Data

💻 Technology Stack

Layer          Technology                 Purpose

🎨 Frontend    Next.js                    Web application framework⚛️ UI          React                      Component-based interface📘 Language    TypeScript                 Type safety⚙️ Backend     Python                     Application/API logic🔌 APIs        REST APIs                  Frontend/backend communication🤖 AI          Google Gemini              Conversational AI🗺️ Location    Google Maps Platform       Nearby cafés🔐 Security    Authentication + RBAC      Customer/admin separation📊 Analytics   Dashboard visualizations   Business insights

⚠️ Exact package versions should be taken from the project's currentpackage.json / Python dependency file.

🔐 Authentication & RBAC

BrewAI separates users into two protected roles:

👤 CUSTOMER
👑 ADMIN

Customer

Register
   ↓
role = customer
   ↓
Login
   ↓
/dashboard

Admin

Select Admin
   ↓
Email + Password
   ↓
ADMIN_SECRET_KEY verification
   ↓
role = admin
   ↓
/admin/dashboard

🛡️ Security Boundaries

👤 Customer → /admin/dashboard
             ↓
           🚫 Blocked

👤 Customer → Admin API
             ↓
           🚫 403

👑 Admin → Admin API
             ↓
           ✅ 200

🧪 Forged role/cookie
             ↓
           🚫 No escalation

The project also verifies invalid admin secrets, protected APIs, invalidsessions and logout/session clearing.

🗺️ Nearby Cafés

BrewAI includes location-based café discovery using Google MapsPlatform.

📍 Customer Location
        ↓
🗺️ Google Maps
        ↓
☕ Nearby Cafés
        ↓
👤 Customer Discovery

Environment variable:

NEXT_PUBLIC_GOOGLE_MAPS_API_KEY=your_google_maps_key

📊 Admin Analytics

The administrator dashboard turns order activity into business insights.

📈 KPIs

💰 Total Revenue

🛒 Total Orders

👥 Total Customers

💵 Average Order Value

📊 Analytics

📈 Revenue Overview

🏆 Top Selling Items

🕐 Orders by Time

🔄 Order Status

👥 Customer Statistics

This makes BrewAI relevant to both SaaS product engineering andbusiness analytics.

📦 Order Workflow

☕ Menu
   ↓
🛒 Cart
   ↓
🧾 Order
   ↓
📦 Order Tracking
   ↓
🔄 Status Updates

Admin can update order states while the customer receives the lateststatus.

Typical workflow:

🟡 Pending
   ↓
🔵 Confirmed
   ↓
🟠 Preparing
   ↓
🟢 Completed

🎨 UI / UX

BrewAI follows a premium coffee-inspired SaaS design system:

🌑 Dark interface

🟠 Warm coffee/amber accents

🧊 Modern cards

✨ Interactive states

📱 Responsive layouts

🧭 Clear navigation

👤 Dynamic user identity

👑 Separate customer/admin experiences

☕ Consistent BrewAI branding

🧭 Application Structure

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

Representative backend modules include:

backend/
├── routers/
│   └── auth.py
│
├── services/
│   └── auth_service.py
│
└── ...

🔑 Environment Configuration

Example local configuration:

# 🤖 AI
GEMINI_API_KEY=your_gemini_api_key

# 🗺️ Maps
NEXT_PUBLIC_GOOGLE_MAPS_API_KEY=your_google_maps_api_key

# 🔐 Admin
ADMIN_SECRET_KEY=your_private_admin_secret

🚨 Never commit secrets

❌ API keys
❌ Admin secret
❌ Passwords
❌ Private tokens
❌ Production credentials

Keep local secrets in .env / .env.local and ensure they are ignoredby Git.

🛠️ Local Development

1️⃣ Clone

git clone <your-repository-url>
cd coffee-shop-ai-agent

2️⃣ Install frontend dependencies

npm install

3️⃣ Configure environment variables

Create the required local .env file.

4️⃣ Start frontend

npm run dev

Frontend:

http://localhost:3000

5️⃣ Start backend

Start the Python API using the server command configured in yourproject.

Backend development server:

http://localhost:8000

💡 Use the exact backend command from your current projectconfiguration rather than copying a generic command.

🧪 Verification & Security Testing

The project has been tested around both normal flows and authorizationboundaries.

Scenario                        Expected

👤 Customer registration        ✅ Customer role👤 Customer login               ✅ /dashboard🚫 Customer → Admin dashboard   🚫 Blocked🔑 Wrong admin secret           🚫 Rejected👑 Correct admin credentials    ✅ Admin access👑 Admin → Admin API            ✅ Allowed👤 Customer → Admin API         🚫 403🧪 Forged role                  🚫 No escalation🍪 Invalid cookie/session       🚫 Rejected🚪 Logout                       ✅ Session cleared

📚 What This Project Demonstrates

💻 Full-Stack Development

React

Next.js

TypeScript

Python backend

REST APIs

Responsive UI

Component architecture

🤖 AI / Generative AI

Gemini integration

Conversational interfaces

AI recommendations

Prompt-driven workflows

🔐 Security

Authentication

Authorization

RBAC

Protected routes

Protected APIs

Secret management

Session validation

Privilege-escalation prevention

📊 Analytics

KPI design

Revenue analytics

Order analytics

Customer analytics

Product performance

🧠 Product Engineering

Customer journeys

Admin workflows

SaaS architecture

Real-world business requirements

Role-specific UX

🛣️ Future Roadmap

🤖 AI

🧠 Long-term preference memory

🎯 Advanced recommendation engine

🗣️ Voice ordering

🔊 AI voice responses

🌐 Multi-language assistant

🌦️ Weather-aware recommendations

💳 Commerce

💳 Payment gateway

🧾 Automatic PDF receipts

🎟️ Coupons

💰 Wallet / credits

🚚 Delivery tracking

🏪 Marketplace

🏬 Multiple cafés

🧑‍🍳 Restaurant onboarding

📋 Restaurant dashboards

🚚 Delivery-fee management

💼 Platform commission

🗺️ Multi-café discovery

📊 Advanced Analytics

🔮 Demand forecasting

📦 Inventory analytics

🧠 Customer segmentation

📈 Predictive sales analytics

💼 Resume-Ready Description

BrewAI --- AI-Powered Coffee Shop Assistant

Built a full-stack AI-powered coffee commerce SaaS platform withseparate customer and administrator experiences. Integrated Gemini forconversational AI, Google Maps for nearby café discovery, securerole-based authentication, online ordering, order tracking andbusiness analytics. Developed protected administrator APIs andauthorization controls to prevent unauthorized role escalation whiledelivering a responsive premium dashboard experience.

🧰 Tech Stack

Next.js • React • TypeScript • Python
REST APIs • Gemini API • Google Maps API
Authentication • RBAC • Analytics
Responsive UI • SaaS Architecture

🌟 Why BrewAI?

A traditional café website:

🌐 Website
   ↓
☕ Menu
   ↓
📞 Contact

BrewAI:

                    ☕ BREWAI
                       │
        ┌──────────────┼──────────────┐
        ↓              ↓              ↓
      🤖 AI          🛒 Orders      📊 Analytics
        │              │              │
        ↓              ↓              ↓
  Personalization   Customers      Business
        │              │              │
        └──────────────┼──────────────┘
                       ↓
                 🔐 Secure SaaS

👩‍💻 Author

Riya Singh

🚀 AI / Data / Full-Stack Enthusiast☕ Creator of BrewAI

<p align="center">

<strong>{=html}☕ Brew smarter. Live better. 🤖</strong>{=html}

</p>

<p align="center">

⭐ Built with curiosity, creativity & code.

</p>