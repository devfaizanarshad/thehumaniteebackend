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

const confirmTestPaymentIntent = async (paymentIntentId, paymentMethod = 'pm_card_visa') => {
  return await stripe.paymentIntents.confirm(paymentIntentId, {
    payment_method: paymentMethod,
  });
};

const verifyWebhookSignature = (payload, signature, secret) => {
  return stripe.webhooks.constructEvent(payload, signature, secret);
};

module.exports = {
  confirmTestPaymentIntent,
  createPaymentIntent,
  retrievePaymentIntent,
  verifyWebhookSignature,
};
