const RESEND_API_URL = 'https://api.resend.com/emails';

const escapeHtml = (value) => {
  if (value === null || value === undefined) {
    return '';
  }

  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
};

const formatMoney = (amount, currency = 'USD') => {
  const numericAmount = Number(amount);

  if (!Number.isFinite(numericAmount)) {
    return `${amount} ${currency}`;
  }

  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency,
  }).format(numericAmount);
};

const formatDateTime = (value) => {
  if (!value) {
    return '-';
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return String(value);
  }

  return new Intl.DateTimeFormat('en-US', {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(date);
};

const getStoreConfig = () => ({
  storeName: process.env.STORE_NAME || 'The Humanitee',
  storeUrl: process.env.STORE_URL || 'https://thehumanitee.com/',
  currency: process.env.ORDER_CURRENCY || 'USD',
});

const getCustomerName = (customer) => `${customer.first_name} ${customer.last_name}`.trim();

const isProduction = () => process.env.NODE_ENV === 'production';

const getDevEmailRecipient = () => process.env.EMAIL_TO || process.env.QUOTE_EMAIL_DEV || null;

const getManagerRecipient = () => process.env.ORDER_MANAGER_EMAIL || process.env.EMAIL_TO;

const getDisplayedHumanityNumber = (humanityNumber) => humanityNumber?.humanity_number ?? humanityNumber?.id ?? '-';

const sendEmail = async ({ to, subject, html, text }) => {
  if (!process.env.RESEND_API_KEY || !process.env.EMAIL_FROM) {
    console.warn('Order email skipped: RESEND_API_KEY or EMAIL_FROM is missing.');
    return { skipped: true };
  }

  const resolvedRecipient = isProduction() ? to : (getDevEmailRecipient() || to);

  const response = await fetch(RESEND_API_URL, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from: process.env.EMAIL_FROM,
      to: resolvedRecipient,
      subject,
      html,
      text,
    }),
  });

  const result = await response.json().catch(() => ({}));

  if (!response.ok) {
    throw new Error(`Resend email failed: ${response.status} ${JSON.stringify(result)}`);
  }

  return result;
};

const buildCustomerOrderEmail = ({ order, customer, humanityNumber }) => {
  const { storeName, storeUrl, currency } = getStoreConfig();
  const customerName = getCustomerName(customer);
  const total = formatMoney(order.total_amount, currency);
  const displayedHumanityNumber = getDisplayedHumanityNumber(humanityNumber);

  const html = `
<!doctype html>
<html>
  <body style="margin:0;background:#f5f0e8;font-family:Georgia,'Times New Roman',serif;color:#201a16;">
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#f5f0e8;padding:32px 16px;">
      <tr>
        <td align="center">
          <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:640px;background:#fffaf2;border:1px solid #e3d6c3;border-radius:20px;overflow:hidden;">
            <tr>
              <td style="background:#201a16;color:#fffaf2;padding:28px 32px;text-align:center;">
                <p style="margin:0 0 8px;font-size:13px;letter-spacing:0.18em;text-transform:uppercase;">${escapeHtml(storeName)}</p>
                <h1 style="margin:0;font-size:30px;font-weight:normal;">Your order is confirmed</h1>
              </td>
            </tr>
            <tr>
              <td style="padding:32px;">
                <p style="margin:0 0 18px;font-size:18px;">Hi ${escapeHtml(customerName || 'there')},</p>
                <p style="margin:0 0 24px;line-height:1.6;">Thank you for your order. Your payment was successful and your Human Number has been generated.</p>

                <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="border-collapse:collapse;margin:0 0 24px;">
                  <tr>
                    <td style="padding:12px;border-bottom:1px solid #eadfce;color:#6f6257;">Order number</td>
                    <td style="padding:12px;border-bottom:1px solid #eadfce;text-align:right;font-weight:bold;">${escapeHtml(order.order_number)}</td>
                  </tr>
                  <tr>
                    <td style="padding:12px;border-bottom:1px solid #eadfce;color:#6f6257;">Human Number</td>
                    <td style="padding:12px;border-bottom:1px solid #eadfce;text-align:right;font-weight:bold;">#${escapeHtml(displayedHumanityNumber)}</td>
                  </tr>
                  <tr>
                    <td style="padding:12px;border-bottom:1px solid #eadfce;color:#6f6257;">Product</td>
                    <td style="padding:12px;border-bottom:1px solid #eadfce;text-align:right;">${escapeHtml(order.product_name)}</td>
                  </tr>
                  <tr>
                    <td style="padding:12px;border-bottom:1px solid #eadfce;color:#6f6257;">Size</td>
                    <td style="padding:12px;border-bottom:1px solid #eadfce;text-align:right;">${escapeHtml(order.size)}</td>
                  </tr>
                  <tr>
                    <td style="padding:12px;border-bottom:1px solid #eadfce;color:#6f6257;">Quantity</td>
                    <td style="padding:12px;border-bottom:1px solid #eadfce;text-align:right;">${escapeHtml(order.quantity)}</td>
                  </tr>
                  <tr>
                    <td style="padding:12px;color:#6f6257;">Total paid</td>
                    <td style="padding:12px;text-align:right;font-size:20px;font-weight:bold;">${escapeHtml(total)}</td>
                  </tr>
                </table>

                <h2 style="margin:0 0 10px;font-size:18px;">Shipping address</h2>
                <p style="margin:0 0 24px;line-height:1.6;color:#4c4038;">
                  ${escapeHtml(order.address_line_1)}<br>
                  ${order.address_line_2 ? `${escapeHtml(order.address_line_2)}<br>` : ''}
                  ${escapeHtml(order.city)}, ${escapeHtml(order.postal_code)}<br>
                  ${escapeHtml(order.country)}
                </p>

                <p style="margin:0 0 24px;line-height:1.6;">We will send another update when your order moves forward.</p>
                <p style="margin:0;">
                  <a href="${escapeHtml(storeUrl)}" style="display:inline-block;background:#201a16;color:#fffaf2;text-decoration:none;padding:12px 20px;border-radius:999px;">Visit ${escapeHtml(storeName)}</a>
                </p>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>`;

  const text = [
    `${storeName} order confirmation`,
    '',
    `Hi ${customerName || 'there'},`,
    '',
    'Thank you for your order. Your payment was successful.',
    `Order number: ${order.order_number}`,
    `Human Number: #${displayedHumanityNumber}`,
    `Product: ${order.product_name}`,
    `Size: ${order.size}`,
    `Quantity: ${order.quantity}`,
    `Total paid: ${total}`,
    '',
    'Shipping address:',
    order.address_line_1,
    order.address_line_2,
    `${order.city}, ${order.postal_code}`,
    order.country,
    '',
    storeUrl,
  ].filter(Boolean).join('\n');

  return {
    subject: `Your ${storeName} order ${order.order_number} is confirmed`,
    html,
    text,
  };
};

const buildManagerOrderEmail = ({ order, customer, humanityNumber }) => {
  const { storeName, storeUrl, currency } = getStoreConfig();
  const customerName = getCustomerName(customer);
  const total = formatMoney(order.total_amount, currency);
  const displayedHumanityNumber = getDisplayedHumanityNumber(humanityNumber);
  const latestPayment = Array.isArray(order.payments) && order.payments.length > 0 ? order.payments[0] : null;
  const paymentStatus = latestPayment?.status || 'successful';
  const paymentReference = latestPayment?.provider_payment_id || '-';
  const paymentProvider = latestPayment?.provider || 'stripe';
  const orderCreatedAt = formatDateTime(order.created_at);
  const paymentCreatedAt = formatDateTime(latestPayment?.created_at);
  const humanityCreatedAt = formatDateTime(humanityNumber.created_at);
  const customerMailto = `mailto:${customer.email}`;
  const customerPhone = customer.phone || '-';

  const html = `
<!doctype html>
<html>
  <body style="margin:0;background:#f3f4f6;font-family:Arial,Helvetica,sans-serif;color:#111827;">
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#f3f4f6;padding:24px 12px;">
      <tr>
        <td align="center">
          <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:720px;background:#ffffff;border:1px solid #dbe1ea;border-radius:20px;overflow:hidden;box-shadow:0 18px 40px rgba(17,24,39,0.08);">
            <tr>
              <td style="background:linear-gradient(135deg,#111827 0%,#1f2937 55%,#374151 100%);color:#ffffff;padding:28px 32px;">
                <table role="presentation" width="100%" cellspacing="0" cellpadding="0">
                  <tr>
                    <td>
                      <p style="margin:0 0 8px;font-size:12px;letter-spacing:0.16em;text-transform:uppercase;opacity:0.82;">${escapeHtml(storeName)}</p>
                      <h1 style="margin:0 0 8px;font-size:30px;line-height:1.2;">New paid order received</h1>
                      <p style="margin:0;font-size:15px;line-height:1.6;opacity:0.88;">A customer payment cleared successfully and this order is ready for fulfillment.</p>
                    </td>
                    <td align="right" style="vertical-align:top;">
                      <div style="display:inline-block;background:#dcfce7;color:#166534;border-radius:999px;padding:10px 16px;font-size:12px;font-weight:bold;letter-spacing:0.08em;text-transform:uppercase;">Paid</div>
                    </td>
                  </tr>
                </table>
              </td>
            </tr>
            <tr>
              <td style="padding:28px 32px 32px;">
                <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="margin:0 0 24px;">
                  <tr>
                    <td style="padding-right:8px;width:33.33%;">
                      <div style="background:#f8fafc;border:1px solid #e5e7eb;border-radius:16px;padding:18px;">
                        <div style="font-size:12px;color:#6b7280;text-transform:uppercase;letter-spacing:0.08em;margin-bottom:6px;">Order Number</div>
                        <div style="font-size:20px;font-weight:bold;color:#111827;">${escapeHtml(order.order_number)}</div>
                        <div style="margin-top:8px;font-size:13px;color:#4b5563;">Created ${escapeHtml(orderCreatedAt)}</div>
                      </div>
                    </td>
                    <td style="padding:0 4px;width:33.33%;">
                      <div style="background:#f8fafc;border:1px solid #e5e7eb;border-radius:16px;padding:18px;">
                        <div style="font-size:12px;color:#6b7280;text-transform:uppercase;letter-spacing:0.08em;margin-bottom:6px;">Total Paid</div>
                        <div style="font-size:20px;font-weight:bold;color:#111827;">${escapeHtml(total)}</div>
                        <div style="margin-top:8px;font-size:13px;color:#4b5563;">Via ${escapeHtml(paymentProvider)}</div>
                      </div>
                    </td>
                    <td style="padding-left:8px;width:33.33%;">
                        <div style="background:#f8fafc;border:1px solid #e5e7eb;border-radius:16px;padding:18px;">
                          <div style="font-size:12px;color:#6b7280;text-transform:uppercase;letter-spacing:0.08em;margin-bottom:6px;">Human Number</div>
                        <div style="font-size:20px;font-weight:bold;color:#111827;">#${escapeHtml(displayedHumanityNumber)}</div>
                        <div style="margin-top:8px;font-size:13px;color:#4b5563;">Issued ${escapeHtml(humanityCreatedAt)}</div>
                      </div>
                    </td>
                  </tr>
                </table>

                <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="margin:0 0 20px;">
                  <tr>
                    <td style="vertical-align:top;padding-right:10px;width:50%;">
                      <div style="border:1px solid #e5e7eb;border-radius:18px;padding:22px;">
                        <h2 style="margin:0 0 16px;font-size:18px;color:#111827;">Customer</h2>
                        <p style="margin:0 0 10px;font-size:17px;font-weight:bold;color:#111827;">${escapeHtml(customerName)}</p>
                        <p style="margin:0 0 8px;font-size:14px;color:#374151;">Email: <a href="${escapeHtml(customerMailto)}" style="color:#111827;">${escapeHtml(customer.email)}</a></p>
                        <p style="margin:0 0 18px;font-size:14px;color:#374151;">Phone: ${escapeHtml(customerPhone)}</p>
                        <div>
                          <a href="${escapeHtml(customerMailto)}" style="display:inline-block;background:#111827;color:#ffffff;text-decoration:none;padding:11px 16px;border-radius:999px;font-size:13px;font-weight:bold;">Email Customer</a>
                        </div>
                      </div>
                    </td>
                    <td style="vertical-align:top;padding-left:10px;width:50%;">
                      <div style="border:1px solid #e5e7eb;border-radius:18px;padding:22px;">
                        <h2 style="margin:0 0 16px;font-size:18px;color:#111827;">Fulfillment</h2>
                        <p style="margin:0 0 8px;font-size:14px;color:#374151;">Product: <strong>${escapeHtml(order.product_name)}</strong></p>
                        <p style="margin:0 0 8px;font-size:14px;color:#374151;">Size: <strong>${escapeHtml(order.size)}</strong></p>
                        <p style="margin:0 0 8px;font-size:14px;color:#374151;">Quantity: <strong>${escapeHtml(order.quantity)}</strong></p>
                        <p style="margin:0 0 0;font-size:14px;color:#374151;">Status: <strong>${escapeHtml(order.status)}</strong></p>
                        <div style="margin-top:18px;padding:14px 16px;background:#f9fafb;border-radius:14px;">
                          <div style="font-size:13px;font-weight:bold;color:#111827;margin-bottom:8px;">Suggested next steps</div>
                          <div style="font-size:13px;line-height:1.8;color:#4b5563;">1. Pick the correct size and variant.<br>2. Pack and label shipment.<br>3. Send dispatch update to customer.</div>
                        </div>
                      </div>
                    </td>
                  </tr>
                </table>

                <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="margin:0 0 20px;">
                  <tr>
                    <td style="vertical-align:top;padding-right:10px;width:50%;">
                      <div style="border:1px solid #e5e7eb;border-radius:18px;padding:22px;">
                        <h2 style="margin:0 0 16px;font-size:18px;color:#111827;">Payment</h2>
                        <p style="margin:0 0 8px;font-size:14px;color:#374151;">Provider: <strong>${escapeHtml(paymentProvider)}</strong></p>
                        <p style="margin:0 0 8px;font-size:14px;color:#374151;">Payment status: <strong>${escapeHtml(paymentStatus)}</strong></p>
                        <p style="margin:0 0 8px;font-size:14px;color:#374151;">Payment reference: <strong>${escapeHtml(paymentReference)}</strong></p>
                        <p style="margin:0;font-size:14px;color:#374151;">Payment created: <strong>${escapeHtml(paymentCreatedAt)}</strong></p>
                      </div>
                    </td>
                    <td style="vertical-align:top;padding-left:10px;width:50%;">
                      <div style="border:1px solid #e5e7eb;border-radius:18px;padding:22px;">
                        <h2 style="margin:0 0 16px;font-size:18px;color:#111827;">Shipping Address</h2>
                        <p style="margin:0;font-size:14px;line-height:1.7;color:#374151;">
                          ${escapeHtml(order.address_line_1)}<br>
                          ${order.address_line_2 ? `${escapeHtml(order.address_line_2)}<br>` : ''}
                          ${escapeHtml(order.city)}, ${escapeHtml(order.postal_code)}<br>
                          ${escapeHtml(order.country)}
                        </p>
                      </div>
                    </td>
                  </tr>
                </table>

                <div style="text-align:center;padding-top:6px;">
                  <a href="${escapeHtml(storeUrl)}" style="display:inline-block;background:#111827;color:#ffffff;text-decoration:none;padding:12px 18px;border-radius:999px;font-size:13px;font-weight:bold;">Open ${escapeHtml(storeName)}</a>
                </div>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>`;

  const text = [
    `${storeName} new paid order`,
    '',
    `Order number: ${order.order_number}`,
    `Human Number: #${displayedHumanityNumber}`,
    `Order created: ${orderCreatedAt}`,
    `Customer: ${customerName}`,
    `Customer email: ${customer.email}`,
    `Phone: ${customerPhone}`,
    `Product: ${order.product_name}`,
    `Size: ${order.size}`,
    `Quantity: ${order.quantity}`,
    `Total paid: ${total}`,
    `Payment provider: ${paymentProvider}`,
    `Payment status: ${paymentStatus}`,
    `Payment reference: ${paymentReference}`,
    `Payment created: ${paymentCreatedAt}`,
    '',
    'Shipping address:',
    order.address_line_1,
    order.address_line_2,
    `${order.city}, ${order.postal_code}`,
    order.country,
    '',
    'Suggested next steps:',
    '1. Pick the correct size and variant.',
    '2. Pack and label shipment.',
    '3. Send dispatch update to customer.',
    '',
    storeUrl,
  ].filter(Boolean).join('\n');

  return {
    subject: `New paid order ${order.order_number} for ${storeName}`,
    html,
    text,
  };
};

const sendOrderEmails = async ({ order, customer, humanityNumber }) => {
  const results = { customerEmail: null, managerEmail: null, skipped: false };

  if (!process.env.RESEND_API_KEY || !process.env.EMAIL_FROM) {
    console.warn('Order email skipped: RESEND_API_KEY or EMAIL_FROM is missing.');
    results.skipped = true;
    return results;
  }

  const customerMessage = buildCustomerOrderEmail({ order, customer, humanityNumber });
  results.customerEmail = await sendEmail({
    to: customer.email,
    subject: customerMessage.subject,
    html: customerMessage.html,
    text: customerMessage.text,
  });

  const managerRecipient = getManagerRecipient();

  if (managerRecipient) {
    const managerMessage = buildManagerOrderEmail({ order, customer, humanityNumber });
    results.managerEmail = await sendEmail({
      to: managerRecipient,
      subject: managerMessage.subject,
      html: managerMessage.html,
      text: managerMessage.text,
    });
  }

  return results;
};

module.exports = {
  sendOrderEmails,
};
