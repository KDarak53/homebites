# HomeBites — Home Meal Marketplace

MERN marketplace connecting home chefs (vendors) with customers, supporting
Direct orders, Pre-book & Collect, and Pre-book & Deliver fulfillment.

## Stack

- **Backend**: Node.js, Express, Mongoose, Socket.IO (live order/dashboard updates), JWT auth
- **Frontend**: React (Vite), Redux Toolkit + RTK Query, React Router, Tailwind CSS v4, socket.io-client

## Prerequisites

- Node.js 18+
- MongoDB **running as a replica set** (even a single-node one). Order creation
  uses a multi-document transaction to atomically deduct inventory and prevent
  overselling when two customers buy the last plate at once — this requires
  a replica set; a plain standalone `mongod` will throw
  `Transaction numbers are only allowed on a replica set member`.

  To run a local single-node replica set for development:
  ```bash
  mongod --dbpath /path/to/data --replSet rs0 --port 27017
  # in another terminal, one-time setup:
  mongosh --eval "rs.initiate()"
  ```
  (If you already have MongoDB running as a plain service on 27017, either
  stop it and run the command above, or run this one on a different port
  and update `MONGO_URI` accordingly. MongoDB Atlas is already a replica set,
  so no extra setup is needed there.)

## Setup

```bash
# Backend
cd backend
cp .env.example .env   # fill in MONGO_URI (must point at a replica set) and JWT_SECRET
npm install
npm run dev             # http://localhost:5000

# Frontend (separate terminal)
cd frontend
cp .env.example .env
npm install
npm run dev              # http://localhost:5173
```

## What's implemented

- **Auth**: customer + vendor registration/login (JWT, role-based), phone
  validation, geolocation stored as GeoJSON.
- **Discovery**: `2dsphere` geospatial vendor search with distance, veg-only,
  and rating/orders-completed sort filters.
- **Menu**: vendor CRUD, veg/non-veg, per-batch quantity, a `prebookCutoffTime`
  window that gates a separate `nextBatchQuantity` pool from the live
  `currentQuantity` pool. "Add to Cart" is disabled per the currentQuantity
  vs. pre-book-window rule from the spec.
- **Ordering**: cart is single-vendor and single-orderType (an order is either
  all-Direct or all-Prebook, matching the Order schema). Checkout validates
  delivery radius server-side via haversine distance against the vendor's
  kitchen coordinates.
- **Inventory safety**: `createOrder` runs inside a MongoDB session
  transaction using `findOneAndUpdate` with a `$gte` quantity guard, so
  concurrent checkouts for the last unit can't oversell (verified manually —
  see below).
- **Order lifecycle**: `Pending → Accepted/Rejected → Preparing → Ready →
  OutForDelivery/Completed`, enforced server-side as an explicit state
  machine. Socket.IO pushes `order:new` to the vendor's dashboard and
  `order:status` to the customer in real time.
- **Vendor dashboard**: live Immediate vs. Pre-booked streams, accept/reject,
  and a weekly/daily revenue + popular-items analytics endpoint.
- **Ratings**: customers rate completed orders; vendor's running average is
  updated incrementally.

## Known gaps / next steps

- No image upload wired yet (`multer` is installed; add an
  `/api/products/:id/image` endpoint + S3/Cloudinary when needed).
- No payment gateway integration (Razorpay/Stripe) — orders are created
  unpaid; add a payment step before/after `createOrder` if you need real
  payments.
- `VendorProfile.isApproved` exists for future admin moderation but defaults
  to `true` since there's no admin app yet — every vendor can transact
  immediately after registering.
- No automated test suite yet — the core inventory-race and order-status
  logic was verified manually via concurrent `curl` requests during
  development; consider adding Jest/Supertest coverage for
  `orderController.createOrder` before production use.
