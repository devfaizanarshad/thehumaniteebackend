# The Humanitee Backend

Express + Prisma + Stripe backend for The Humanitee order flow.

This API handles:
- order creation
- Stripe payment intent creation
- Stripe webhook processing
- unique human number generation in the `1` to `8,000,000,000` range
- customer and manager order emails

## Stack

- Node.js
- Express
- Prisma
- PostgreSQL
- Stripe
- Resend

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
ORDER_MANAGER_EMAIL="manager@example.com"
EMAIL_TO="manager@example.com"
RESEND_API_KEY="re_..."
```

### Optional

Use this if you want product pricing configurable from env:

```env
PRODUCT_CATALOG_JSON={"humanity-tee-black":{"name":"Humanity Tee Black","currency":"usd","prices":{"XS":29.99,"S":29.99,"M":29.99,"L":29.99,"XL":29.99,"XXL":29.99}}}
```

For local development email routing:

```env
QUOTE_EMAIL_DEV="dev@example.com"
```

## Local Setup

1. Install dependencies:

```bash
npm install
```

2. Add `.env`

3. Push schema to database:

```bash
npm run prisma:push
```

4. Start server:

```bash
npm run dev
```

Health check:

```text
GET /health
```

## API Endpoints

### Health

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

### Create Order

```http
POST /orders
```

Request body:

```json
{
  "first_name": "Faiza",
  "last_name": "Raja",
  "date_of_birth": "1999-03-20",
  "email": "faiza@example.com",
  "phone": "+15550123000",
  "product_key": "humanity-tee-black",
  "product_name": "Ignored on server",
  "size": "M",
  "quantity": 1,
  "total_amount": 29.99,
  "address_line_1": "123 Test Street",
  "address_line_2": "Suite 1",
  "city": "Karachi",
  "postal_code": "74000",
  "country": "PK"
}
```

Notes:
- `product_name` from client is ignored
- `total_amount` is validated against server-side pricing
- invalid totals are rejected

Success response:

```json
{
  "message": "Order created successfully",
  "order": {
    "id": "1",
    "order_number": "ORD-...",
    "status": "pending"
  }
}
```

### Get Order Details

```http
GET /orders/:id
```

Returns:
- order
- customer
- human number record if generated

Example paid-order detail shape:

```json
{
  "order": {
    "id": "16",
    "status": "paid",
    "humanity_num": {
      "id": "11",
      "humanity_number": "4759322983",
      "order_id": "16"
    }
  }
}
```

### Create Payment Intent

```http
POST /payments
```

Request body:

```json
{
  "order_id": "1"
}
```

Behavior:
- creates Stripe payment intent for unpaid order
- reuses existing pending payment intent for same order
- reconciles already-succeeded payment if webhook was missed briefly

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

### Stripe Webhook

```http
POST /webhook
```

Handled events:
- `payment_intent.succeeded`
- `payment_intent.payment_failed`

On successful payment:
- payment status becomes `successful`
- order status becomes `paid`
- unique human number is reserved and created
- customer confirmation email is sent
- manager order email is sent

## Email Behavior

When payment succeeds:

### Customer email

Sent to the buyer email address.

Contains:
- order number
- human number
- product
- size
- quantity
- total paid
- shipping address

### Manager email

Sent to:

```env
ORDER_MANAGER_EMAIL
```

Contains:
- order number
- human number
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

Pricing is server-side.

Default product catalog:
- `humanity-tee-black`
- sizes: `XS`, `S`, `M`, `L`, `XL`, `XXL`
- default price: `29.99`

If you need different products or prices, use `PRODUCT_CATALOG_JSON`.

## Database Models

Prisma models:
- `customers`
- `orders`
- `payments`
- `humanity_numbers`

`humanity_numbers.humanity_number` is the public-facing reserved human number.
It is unique and generated in the `1` to `8,000,000,000` range.

## Production Notes

Before going live:
- use a cloud PostgreSQL database
- use live Stripe keys
- use a real public backend URL
- register your live Stripe webhook URL
- verify your Resend sender domain
- rotate any credentials that were shared in chat

Recommended production webhook URL:

```text
https://your-api-domain.com/webhook
```

## Deployment Checklist

- set production `.env`
- run `npm install`
- run `npm run prisma:push`
- run `npm run start`
- verify `GET /health`
- verify Stripe webhook endpoint
- place one real or final test checkout

## Current Flow Summary

Current tested flow:
1. customer creates order
2. frontend requests payment intent
3. Stripe confirms payment
4. Stripe sends webhook
5. backend marks order paid
6. backend creates human number
7. backend sends customer + manager emails
