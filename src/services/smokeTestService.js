const prisma = require('../database/db');
const stripeService = require('./stripeService');
const { getProductQuote } = require('../config/products');
const { markOrderPaid } = require('./orderService');

const createHttpError = (statusCode, message) => {
  const error = new Error(message);
  error.statusCode = statusCode;
  return error;
};

const normalizeEmail = (email) => String(email || '').trim().toLowerCase();

const getDefaultSmokeTestEmail = () => {
  return process.env.EMAIL_TO || process.env.ORDER_MANAGER_EMAIL || 'devfaizanarshad@gmail.com';
};

const getDefaultSmokeTestPayload = () => ({
  first_name: 'Smoke',
  last_name: 'Test',
  email: getDefaultSmokeTestEmail(),
  phone: '+15550000000',
  product_key: 'humanity-tee-black',
  size: 'M',
  quantity: 1,
  address_line_1: '123 Smoke Test Street',
  address_line_2: null,
  city: 'Karachi',
  postal_code: '75500',
  country: 'Pakistan',
});

const findOrCreateCustomer = async ({ first_name, last_name, email, phone }) => {
  const normalizedEmail = normalizeEmail(email);

  if (!normalizedEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizedEmail)) {
    throw createHttpError(400, 'A valid email address is required');
  }

  const existingCustomer = await prisma.customers.findUnique({
    where: { email: normalizedEmail },
  });

  if (existingCustomer) {
    return prisma.customers.update({
      where: { id: existingCustomer.id },
      data: {
        first_name: first_name || existingCustomer.first_name,
        last_name: last_name || existingCustomer.last_name,
        phone: phone || existingCustomer.phone,
      },
    });
  }

  return prisma.customers.create({
    data: {
      first_name,
      last_name,
      email: normalizedEmail,
      phone,
    },
  });
};

const createOrder = async ({ customerId, payload, quote }) => {
  const orderNumber = `ORD-${Date.now()}-${Math.floor(Math.random() * 1000)}`;

  return prisma.orders.create({
    data: {
      customer_id: customerId,
      order_number: orderNumber,
      product_key: payload.product_key,
      product_name: quote.productName,
      size: payload.size,
      quantity: Number(payload.quantity),
      total_amount: quote.totalAmount,
      address_line_1: payload.address_line_1,
      address_line_2: payload.address_line_2 || null,
      city: payload.city,
      postal_code: payload.postal_code,
      country: payload.country,
      status: 'pending',
    },
  });
};

const assertSmokeTestAllowed = () => {
  if (!process.env.STRIPE_SECRET_KEY) {
    throw createHttpError(503, 'STRIPE_SECRET_KEY is not configured');
  }

  const usingTestMode = process.env.STRIPE_SECRET_KEY.startsWith('sk_test_');
  const liveModeAllowed = process.env.ALLOW_SMOKE_TEST_IN_LIVE === 'true';

  if (!usingTestMode && !liveModeAllowed) {
    throw createHttpError(400, 'Smoke test checkout is only allowed with Stripe test keys unless ALLOW_SMOKE_TEST_IN_LIVE=true');
  }
};

const runCheckoutSmokeTest = async (input = {}) => {
  assertSmokeTestAllowed();

  const payload = {
    ...getDefaultSmokeTestPayload(),
    ...input,
  };

  const quantity = Number(payload.quantity);

  if (!Number.isInteger(quantity) || quantity <= 0 || quantity > 10) {
    throw createHttpError(400, 'Quantity must be an integer between 1 and 10');
  }

  const quote = getProductQuote({
    productKey: payload.product_key,
    size: payload.size,
    quantity,
  });

  if (quote.error) {
    throw createHttpError(400, quote.error);
  }

  const customer = await findOrCreateCustomer(payload);
  const order = await createOrder({
    customerId: customer.id,
    payload,
    quote,
  });

  const paymentIntent = await stripeService.createPaymentIntent(
    quote.totalAmount,
    quote.currency,
    {
      order_id: order.id.toString(),
      source: 'smoke-test-endpoint',
    }
  );

  const payment = await prisma.payments.create({
    data: {
      order_id: order.id,
      provider: 'stripe',
      provider_payment_id: paymentIntent.id,
      amount: order.total_amount,
      status: 'pending',
    },
  });

  const confirmedPaymentIntent = await stripeService.confirmTestPaymentIntent(paymentIntent.id);

  if (confirmedPaymentIntent.status !== 'succeeded') {
    throw createHttpError(502, `Smoke test payment did not succeed. Stripe status: ${confirmedPaymentIntent.status}`);
  }

  const result = await markOrderPaid(payment.id);

  const finalOrder = await prisma.orders.findUnique({
    where: { id: order.id },
    include: {
      customer: true,
      humanity_num: true,
      payments: {
        orderBy: { created_at: 'desc' },
      },
    },
  });

  return {
    message: 'Smoke test checkout completed successfully',
    mode: process.env.STRIPE_SECRET_KEY.startsWith('sk_test_') ? 'stripe-test' : 'stripe-live-override',
    order: {
      id: finalOrder.id,
      orderNumber: finalOrder.order_number,
      status: finalOrder.status,
      totalAmount: finalOrder.total_amount,
    },
    payment: {
      id: payment.id,
      paymentIntentId: confirmedPaymentIntent.id,
      status: confirmedPaymentIntent.status,
    },
    humanNumber: {
      recordId: finalOrder.humanity_num?.id || null,
      value: finalOrder.humanity_num?.humanity_number || null,
    },
    email: {
      requestedCustomerEmail: normalizeEmail(payload.email),
      actualManagerRecipient: process.env.ORDER_MANAGER_EMAIL || process.env.EMAIL_TO || null,
      runtimeMode: process.env.NODE_ENV || 'development',
      note: process.env.NODE_ENV === 'production'
        ? 'Emails are sent to the real addresses provided/configured.'
        : 'Non-production mode may redirect email delivery to EMAIL_TO.',
    },
    emailResult: result.emailResult,
  };
};

module.exports = {
  runCheckoutSmokeTest,
};
