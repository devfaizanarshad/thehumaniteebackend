const Stripe = require('stripe');
const stripe = process.env.STRIPE_SECRET_KEY ? Stripe(process.env.STRIPE_SECRET_KEY) : null;

const createPaymentIntent = async (amount, currency = 'usd', metadata = {}) => {
  return await stripe.paymentIntents.create({
    amount: Math.round(amount * 100), // Convert to smallest currency unit (cents)
    currency,
    metadata,
    automatic_payment_methods: {
      enabled: true,
      allow_redirects: 'never',
    },
  });
};

const retrievePaymentIntent = async (paymentIntentId) => {
  return await stripe.paymentIntents.retrieve(paymentIntentId);
};

const verifyWebhookSignature = (payload, signature, secret) => {
  return stripe.webhooks.constructEvent(payload, signature, secret);
};

module.exports = {
  createPaymentIntent,
  retrievePaymentIntent,
  verifyWebhookSignature,
};
