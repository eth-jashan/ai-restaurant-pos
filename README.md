# OrderMind - AI-Powered Restaurant POS

A modern, AI-powered Point of Sale system for restaurants built with TypeScript, React, and Express.

## Features

- **AI Assistant**: Natural language commands for menu management and sales queries
- **Real-time Updates**: Socket.io for live order and KOT updates
- **Multi-role Support**: Owner, Manager, Cashier, Waiter, Kitchen roles
- **Complete POS Flow**: Tables, Orders, KOT, Billing, Invoicing
- **Indian Compliance**: GST, FSSAI, Indian currency support

## Tech Stack

### Backend (apps/api)
- Express.js with TypeScript
- Prisma ORM with PostgreSQL
- Socket.io for real-time updates
- OpenAI API for AI features
- JWT authentication

### Frontend (apps/web)
- React 18 with TypeScript
- Vite for build tooling
- TailwindCSS for styling
- Zustand for state management
- React Query for data fetching

## Quick Start

### Prerequisites
- Node.js 18+
- pnpm 8+
- PostgreSQL 16+ (or use Docker)
- OpenAI API key (optional, for AI features)

### Development Setup

1. **Clone and install dependencies**
```bash
git clone <repo-url>
cd ordermind
pnpm install
```

2. **Start PostgreSQL (with Docker)**
```bash
docker-compose up -d postgres redis
```

3. **Configure environment**
```bash
cp apps/api/.env.example apps/api/.env
# Edit .env with your settings
```

4. **Setup database**
```bash
pnpm db:migrate
pnpm db:seed
```

5. **Start development servers**
```bash
pnpm dev
```

The API will be available at `http://localhost:3001` and the frontend at `http://localhost:5173`.

### Demo Credentials
- **Restaurant**: demo-restaurant
- **Email**: owner@spicegarden.com
- **Password**: demo123
- **PIN**: 1234

## AI Commands

The AI Assistant supports natural language commands:

### Menu Management
- `"86 the paneer tikka"` - Mark item unavailable
- `"Mark biryani available"` - Mark item available
- `"Increase starters by 10%"` - Bulk price update
- `"Set butter chicken to 380"` - Set specific price

### Sales Queries
- `"How's today going?"` - Today's sales summary
- `"What are the top sellers?"` - Best selling items
- `"Show table status"` - Table overview

## Project Structure

```
ordermind/
├── apps/
│   ├── api/                 # Backend API
│   │   ├── src/
│   │   │   ├── routes/      # API routes
│   │   │   ├── services/    # Business logic
│   │   │   ├── middleware/  # Express middleware
│   │   │   └── ai/          # AI intent parsing
│   │   └── prisma/          # Database schema
│   │
│   └── web/                 # Frontend SPA
│       ├── src/
│       │   ├── components/  # React components
│       │   ├── pages/       # Page components
│       │   ├── stores/      # Zustand stores
│       │   └── services/    # API client
│       └── public/
│
├── docker-compose.yml       # Local development
├── turbo.json               # Turborepo config
└── package.json             # Root package
```

## Scripts

```bash
# Development
pnpm dev           # Start all services
pnpm build         # Build all packages
pnpm lint          # Lint all packages

# Database
pnpm db:migrate    # Run migrations
pnpm db:generate   # Generate Prisma client
pnpm db:seed       # Seed demo data
pnpm db:studio     # Open Prisma Studio
```

## API Endpoints

### Authentication
- `POST /api/v1/auth/login` - Login with email/password
- `POST /api/v1/auth/login/pin` - Quick PIN login
- `POST /api/v1/auth/register` - Register restaurant
- `POST /api/v1/auth/refresh` - Refresh token

### Menu
- `GET /api/v1/menu/categories` - List categories
- `GET /api/v1/menu/items` - List menu items
- `POST /api/v1/menu/items/:id/availability` - Toggle availability

### Orders
- `GET /api/v1/orders/active` - Active orders
- `POST /api/v1/orders` - Create order
- `POST /api/v1/orders/:id/kot` - Create KOT

### Billing
- `POST /api/v1/billing/invoices` - Create invoice
- `POST /api/v1/billing/payments` - Process payment

### AI
- `POST /api/v1/ai/message` - Send AI command
- `POST /api/v1/ai/confirm` - Confirm pending action

## License

MIT
