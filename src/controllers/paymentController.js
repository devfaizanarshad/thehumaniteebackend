const prisma = require('../database/db');
const stripeService = require('../services/stripeService');
const { markOrderPaid } = require('../services/orderService');

const parseBigIntId = (id) => {
  if (!/^\d+$/.test(String(id))) {
    return null;
  }

  return BigInt(id);
};

const createPayment = async (req, res) => {
  try {
    const { order_id } = req.body;

    if (!order_id) {
      return res.status(400).json({ error: 'Order ID is required' });
    }

    const orderId = parseBigIntId(order_id);

    if (!orderId) {
      return res.status(400).json({ error: 'Invalid order ID' });
    }

    // Find the order
    const order = await prisma.orders.findUnique({
      where: { id: orderId },
    });

    if (!order) {
      return res.status(404).json({ error: 'Order not found' });
    }

    if (order.status !== 'pending') {
      return res.status(400).json({ error: `Order cannot be paid. Current status: ${order.status}` });
    }

    const existingPayment = await prisma.payments.findFirst({
      where: {
        order_id: order.id,
        provider: 'stripe',
        status: 'pending',
      },
      orderBy: { created_at: 'desc' },
    });

    if (existingPayment && process.env.STRIPE_SECRET_KEY) {
      const existingPaymentIntent = await stripeService.retrievePaymentIntent(existingPayment.provider_payment_id);

      if (existingPaymentIntent.status === 'succeeded') {
        const result = await markOrderPaid(existingPayment.id);

        return res.status(200).json({
          message: 'Existing successful payment reconciled',
          paymentId: result.payment.id,
          orderStatus: result.order.status,
          humanityNumber: result.humanityNumber.humanity_number || result.humanityNumber.id,
          humanityNumberRecordId: result.humanityNumber.id,
        });
      }

      return res.status(200).json({
        message: 'Existing payment intent returned',
        clientSecret: existingPaymentIntent.client_secret,
        paymentId: existingPayment.id,
      });
    }

    let paymentIntent;
    
    // Create Stripe PaymentIntent if Stripe secret key is available
    if (process.env.STRIPE_SECRET_KEY) {
      paymentIntent = await stripeService.createPaymentIntent(
        Number(order.total_amount), 
        (process.env.ORDER_CURRENCY || 'usd').toLowerCase(),
        { order_id: order.id.toString() }
      );
    } else {
      // Mock PaymentIntent for testing without Stripe
      paymentIntent = {
        id: `mock_pi_${Date.now()}`,
        client_secret: `mock_secret_${Date.now()}`
      };
    }

    // Create Payment Record
    const payment = await prisma.payments.create({
      data: {
        order_id: order.id,
        provider: 'stripe',
        provider_payment_id: paymentIntent.id,
        amount: order.total_amount,
        status: 'pending',
      },
    });

    res.status(201).json({
      message: 'Payment intent created',
      clientSecret: paymentIntent.client_secret,
      paymentId: payment.id,
    });
  } catch (error) {
    console.error('Error creating payment:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

module.exports = {
  createPayment,
};
