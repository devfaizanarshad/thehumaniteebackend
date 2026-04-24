const prisma = require('../database/db');
const { sendOrderEmails } = require('./emailService');
const { findOrCreateHumanityNumber } = require('./humanityNumberService');

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

  const transactionResult = await prisma.$transaction(async (tx) => {
    const [updatedPayment, updatedOrder, humanityNumber] = await Promise.all([
      tx.payments.update({
        where: { id: payment.id },
        data: { status: 'successful' },
      }),
      tx.orders.update({
        where: { id: orderId },
        data: { status: 'paid' },
      }),
      findOrCreateHumanityNumber({ tx, orderId, customerId }),
    ]);

    return {
      updatedPayment,
      updatedOrder,
      humanityNumber,
    };
  });

  const { updatedPayment, updatedOrder, humanityNumber } = transactionResult;

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
