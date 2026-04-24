const prisma = require('../database/db');
const { sendOrderEmails } = require('./emailService');

const markOrderPaid = async (paymentId) => {
  const payment = await prisma.payments.findUnique({
    where: { id: paymentId },
    include: { order: true },
  });

  if (!payment) {
    return { error: 'Payment not found' };
  }

  const shouldSendConfirmationEmail = payment.order.status === 'pending';
  const orderId = payment.order_id;
  const customerId = payment.order.customer_id;

  const [updatedPayment, updatedOrder, humanityNumber] = await prisma.$transaction([
    prisma.payments.update({
      where: { id: payment.id },
      data: { status: 'successful' },
    }),
    prisma.orders.update({
      where: { id: orderId },
      data: { status: 'paid' },
    }),
    prisma.humanity_numbers.upsert({
      where: { order_id: orderId },
      update: {},
      create: {
        customer_id: customerId,
        order_id: orderId,
      },
    }),
  ]);

  let emailResult = null;

  if (shouldSendConfirmationEmail) {
    const paidOrder = await prisma.orders.findUnique({
      where: { id: orderId },
      include: {
        customer: true,
        humanity_num: true,
        payments: {
          orderBy: { created_at: 'desc' },
        },
      },
    });

    try {
      emailResult = await sendOrderEmails({
        order: paidOrder,
        customer: paidOrder.customer,
        humanityNumber: paidOrder.humanity_num,
      });
    } catch (error) {
      console.error('Order confirmation email failed:', error.message);
    }
  }

  return {
    payment: updatedPayment,
    order: updatedOrder,
    humanityNumber,
    emailResult,
    shouldSendConfirmationEmail,
  };
};

module.exports = {
  markOrderPaid,
};
