# The Humanitee Backend

Production-oriented Express + Prisma backend for The Humanitee checkout flow.

This API is responsible for:
- creating customers and orders
- creating Stripe PaymentIntents
- processing Stripe webhook events
- assigning a unique public-facing Human Number
- sending customer and manager order emails
- running a protected smoke test checkout endpoint for operations

## Stack

- Node.js
- Express
- Prisma
- PostgreSQL
- Stripe
- Resend

## Project Structure

```text
src/
  config/
    products.js
  controllers/
    adminController.js
    orderController.js
    paymentController.js
    webhookController.js
  database/
    db.js
  routes/
    adminRoutes.js
    orderRoutes.js
    paymentRoutes.js
    webhookRoutes.js
  services/
    emailService.js
    humanityNumberService.js
    orderService.js
    smokeTestService.js
    stripeService.js
  index.js
prisma/
  schema.prisma
```

## Scripts

```bash
npm install
npm run dev
npm run start
npm run check
npm run prisma:generate
npm run prisma:push
```

## Environment Variables

Create a `.env` file based on `.env.example`.

### Required

```env
PORT=3000
NODE_ENV=production

DATABASE_URL="postgresql://USER:PASSWORD@HOST:5432/DB_NAME?schema=public"

STRIPE_SECRET_KEY="sk_live_..."
STRIPE_WEBHOOK_SECRET="whsec_..."

STORE_NAME="The Humanitee"
STORE_URL="https://thehumanitee.com/"
ORDER_CURRENCY="USD"
CORS_ORIGIN="https://thehumanitee.com,https://www.thehumanitee.com"

EMAIL_FROM="The Humanitee <info@yourdomain.com>"
EMAIL_TO="ops@example.com"
ORDER_MANAGER_EMAIL="manager@example.com"
RESEND_API_KEY="re_..."
```

### Optional

```env
PRODUCT_CATALOG_JSON={"humanity-tee-black":{"name":"Humanity Tee Black","currency":"usd","prices":{"XS":29.99,"S":29.99,"M":29.99,"L":29.99,"XL":29.99,"XXL":29.99}}}
QUOTE_EMAIL_DEV="dev@example.com"
SMOKE_TEST_SECRET="replace-with-a-long-random-secret"
ALLOW_SMOKE_TEST_IN_LIVE="false"
```

### Important Environment Notes

- In `development`, outgoing emails are redirected to `EMAIL_TO` when available.
- In `production`, outgoing emails go to the real customer email and manager email.
- The smoke-test endpoint is disabled unless `SMOKE_TEST_SECRET` is set.
- The smoke-test endpoint is intended for Stripe test mode. It is blocked when `STRIPE_SECRET_KEY` is live unless `ALLOW_SMOKE_TEST_IN_LIVE=true`.

## Local Setup

1. Install dependencies:

```bash
npm install
```

2. Create `.env`

3. Sync Prisma schema:

```bash
npm run prisma:push
```

4. Start the API:

```bash
npm run dev
```

5. Verify health:

```bash
curl http://localhost:3000/health
```

## Base URL

Examples in this README use:

```text
http://localhost:3000
```

For production, replace that with your real API URL, for example:

```text
https://api.thehumanitee.com
```

## API Endpoints

### GET /health

Simple health check.

Example:

```http
GET /health
```

Response:

```json
{
  "status": "ok",
  "message": "Humanity API is running."
}
```

### POST /orders

Creates a customer if needed, then creates a pending order.

Example request:

```http
POST /orders
Content-Type: application/json
```

```json
{
  "first_name": "Faiza",
  "last_name": "Raja",
  "date_of_birth": "1999-03-20",
  "email": "faiza@example.com",
  "phone": "+15550123000",
  "product_key": "humanity-tee-black",
  "size": "M",
  "quantity": 1,
  "total_amount": 29.99,
  "address_line_1": "123 Test Street",
  "address_line_2": "Suite 1",
  "city": "Islamabad",
  "postal_code": "74000",
  "country": "PK"
}
```

Validation behavior:

- `product_name` from the client is ignored
- pricing is calculated server-side
- if `total_amount` is supplied and does not match server pricing, the request is rejected
- quantity must be a positive integer between `1` and `10`

Success response:

```json
{
  "message": "Order created successfully",
  "order": {
    "id": "1",
    "customer_id": "1",
    "order_number": "ORD-1777000000000-123",
    "product_key": "humanity-tee-black",
    "product_name": "Humanity Tee Black",
    "size": "M",
    "quantity": 1,
    "total_amount": "29.99",
    "status": "pending"
  }
}
```

### GET /orders/:id

Returns an order with its customer and Human Number record when available.

Example:

```http
GET /orders/1
```

Response shape:

```json
{
  "order": {
    "id": "1",
    "order_number": "ORD-1777000000000-123",
    "status": "paid",
    "customer": {
      "id": "1",
      "email": "faiza@example.com"
    },
    "humanity_num": {
      "id": "1",
      "humanity_number": "4759322983",
      "order_id": "1"
    }
  }
}
```

### POST /payments

Creates a Stripe PaymentIntent for a pending order, or returns an existing pending PaymentIntent.

Example request:

```http
POST /payments
Content-Type: application/json
```

```json
{
  "order_id": "1"
}
```

Behavior:

- only works for `pending` orders
- reuses an existing pending Stripe payment intent
- if a pending Stripe PaymentIntent has already succeeded, it reconciles the order automatically

Success response:

```json
{
  "message": "Payment intent created",
  "clientSecret": "pi_..._secret_...",
  "paymentId": "1"
}
```

Or:

```json
{
  "message": "Existing payment intent returned",
  "clientSecret": "pi_..._secret_...",
  "paymentId": "1"
}
```

Or on reconciliation:

```json
{
  "message": "Existing successful payment reconciled",
  "paymentId": "1",
  "orderStatus": "paid",
  "humanNumber": "4759322983",
  "humanNumberRecordId": "1"
}
```

### POST /webhook

Stripe webhook endpoint.

Register this exact URL in Stripe:

```text
https://your-api-domain.com/webhook
```

Supported events:

- `payment_intent.succeeded`
- `payment_intent.payment_failed`

On successful payment:

- payment status becomes `successful`
- order status becomes `paid`
- a unique Human Number is reserved
- customer email is sent
- manager email is sent

### POST /admin/smoke-test/checkout

Protected operational endpoint for a full smoke test.

What it does:

- creates or updates a customer
- creates a pending order
- creates a Stripe PaymentIntent
- confirms the PaymentIntent using Stripe test card behavior
- runs the paid-order flow
- generates the Human Number
- sends the emails
- returns a single JSON summary

This endpoint is intended for internal use only.

Security requirements:

- `SMOKE_TEST_SECRET` must be set in `.env`
- send the secret either as:
  - `Authorization: Bearer <secret>`
  - or `x-smoke-test-secret: <secret>`

Test-mode safety:

- if `STRIPE_SECRET_KEY` is live, this endpoint is blocked unless `ALLOW_SMOKE_TEST_IN_LIVE=true`

Minimal example:

```http
POST /admin/smoke-test/checkout
Authorization: Bearer your-secret
Content-Type: application/json
```

```json
{}
```

Default behavior when the body is empty:

- customer email defaults to `EMAIL_TO` or `ORDER_MANAGER_EMAIL`
- product defaults to `humanity-tee-black`
- size defaults to `M`
- quantity defaults to `1`

Custom example:

```json
{
  "first_name": "Dev",
  "last_name": "Faizan",
  "email": "devfaizanarshad@gmail.com",
  "phone": "+15550004444",
  "product_key": "humanity-tee-black",
  "size": "L",
  "quantity": 1,
  "address_line_1": "789 Test Road",
  "city": "Karachi",
  "postal_code": "75500",
  "country": "Pakistan"
}
```

Example response:

```json
{
  "message": "Smoke test checkout completed successfully",
  "mode": "stripe-test",
  "order": {
    "id": "19",
    "orderNumber": "ORD-1777051274440-303",
    "status": "paid",
    "totalAmount": "29.99"
  },
  "payment": {
    "id": "20",
    "paymentIntentId": "pi_3TPnPjAwfDJBAVjN4KZOvclB",
    "status": "succeeded"
  },
  "humanNumber": {
    "recordId": "13",
    "value": "2175401471"
  },
  "email": {
    "requestedCustomerEmail": "devfaizanarshad@gmail.com",
    "actualManagerRecipient": "devfaizanarshad@gmail.com",
    "runtimeMode": "production",
    "note": "Emails are sent to the real addresses provided/configured."
  }
}
```

Production curl example:

```bash
curl -X POST https://api.thehumanitee.com/admin/smoke-test/checkout \
  -H "Authorization: Bearer YOUR_SMOKE_TEST_SECRET" \
  -H "Content-Type: application/json" \
  -d "{\"email\":\"devfaizanarshad@gmail.com\"}"
```

## Stripe Integration Notes

### Test Mode

To test the deployed production API safely:

- keep `NODE_ENV=production`
- use `sk_test_...` as `STRIPE_SECRET_KEY`
- use the matching Stripe test-mode webhook secret
- register `https://api.thehumanitee.com/webhook` in Stripe test mode

Test card:

```text
4242 4242 4242 4242
```

Use any future expiry, any 3-digit CVC, and any ZIP/post code.

### Live Mode

Before real launch:

- switch to `sk_live_...`
- create or update the live webhook endpoint
- replace `STRIPE_WEBHOOK_SECRET`
- verify emails with a real sender domain

## Email Behavior

### Customer email

Sent after successful payment.

Contains:

- order number
- Human Number
- product
- size
- quantity
- total paid
- shipping address

### Manager email

Sent after successful payment to:

```env
ORDER_MANAGER_EMAIL
```

Contains:

- order number
- Human Number
- customer name
- customer email
- customer phone
- product
- size
- quantity
- total paid
- payment provider
- payment reference
- order created time
- payment created time
- shipping address
- fulfillment checklist

## Pricing Rules

Pricing is calculated server-side from `PRODUCT_CATALOG_JSON` or the default catalog in `src/config/products.js`.

Default catalog:

- product key: `humanity-tee-black`
- sizes: `XS`, `S`, `M`, `L`, `XL`, `XXL`
- default price: `29.99`

## Human Number Rules

The public Human Number is stored in `humanity_numbers.humanity_number`.

Rules:

- generated automatically after successful payment
- unique across all orders
- generated in the range `1` to `8,000,000,000`
- never intended to be re-assigned

## Database Models

Main Prisma models:

- `customers`
- `orders`
- `payments`
- `humanity_numbers`

## Deployment Checklist

1. Add production `.env`
2. Install dependencies:

```bash
npm install
```

3. Sync schema:

```bash
npx prisma db push
```

4. Start the app:

```bash
npm run start
```

5. Verify health:

```bash
curl https://your-api-domain.com/health
```

6. Register the Stripe webhook:

```text
https://your-api-domain.com/webhook
```

7. Run a smoke test checkout using `/admin/smoke-test/checkout`

## Residual Notes

- Email clients do not support reliable clipboard buttons, so true copy-to-clipboard UI should live on a web page, not inside email HTML.
- The smoke-test endpoint is intentionally protected because it creates real database rows and Stripe test objects.
