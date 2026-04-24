const prisma = require('../database/db');
const stripeService = require('../services/stripeService');
const { markOrderPaid } = require('../services/orderService');

const handleWebhook = async (req, res) => {
  const sig = req.headers['stripe-signature'];
  let event;

  try {
    // If Stripe secret is provided, verify webhook signature
    // Otherwise rely on the parsed body for testing
    if (process.env.STRIPE_WEBHOOK_SECRET) {
      event = stripeService.verifyWebhookSignature(req.body, sig, process.env.STRIPE_WEBHOOK_SECRET);
    } else {
      // If req.body is a Buffer (due to express.raw), parse it
      event = Buffer.isBuffer(req.body) ? JSON.parse(req.body.toString()) : req.body;
    }
  } catch (err) {
    console.error('Webhook signature verification failed:', err.message);
    return res.status(400).send(`Webhook Error: ${err.message}`);
  }

  // Handle the event
  if (event.type === 'payment_intent.succeeded') {
    const paymentIntent = event.data.object;
    
    // We need to extract the order ID. This could be in the metadata or we look up by payment provider ID.
    // Assuming metadata mapping in createPaymentIntent or look up:
    try {
      const payment = await prisma.payments.findFirst({
        where: { provider_payment_id: paymentIntent.id },
        include: { order: true }
      });

      if (payment) {
        const result = await markOrderPaid(payment.id);

        console.log(`Payment succeeded. Humanity number generated: ${result.humanityNumber.id}`);

        if (result.shouldSendConfirmationEmail && result.emailResult && !result.emailResult.skipped) {
          console.log(
            `Order emails sent for order ${result.order.order_number}: customer=${result.emailResult.customerEmail?.id || 'n/a'} manager=${result.emailResult.managerEmail?.id || 'n/a'}`
          );
        }
      }
    } catch (err) {
      console.error('Error processing successful payment webhook:', err);
      // Return 500 to tell Stripe to retry
      return res.status(500).json({ error: 'Internal server error' });
    }
  } else if (event.type === 'payment_intent.payment_failed') {
    const paymentIntent = event.data.object;
    
    try {
      const payment = await prisma.payments.findFirst({
        where: { provider_payment_id: paymentIntent.id }
      });

      if (payment) {
        await prisma.payments.update({
          where: { id: payment.id },
          data: { status: 'failed' },
        });
      }
    } catch (err) {
      console.error('Error processing failed payment webhook:', err);
    }
  }

  // Return a 200 response to acknowledge receipt of the event
  res.status(200).json({ received: true });
};

module.exports = {
  handleWebhook,
};
