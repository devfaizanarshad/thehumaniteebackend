const prisma = require('../database/db');
const { getProductQuote } = require('../config/products');

const isValidPositiveInteger = (value) => Number.isInteger(Number(value)) && Number(value) > 0;

const normalizeEmail = (email) => String(email || '').trim().toLowerCase();

const validateOrderBody = (body) => {
  const requiredFields = [
    'first_name',
    'last_name',
    'email',
    'product_key',
    'size',
    'quantity',
    'address_line_1',
    'city',
    'postal_code',
    'country',
  ];

  const missingFields = requiredFields.filter((field) => !body[field]);

  if (missingFields.length > 0) {
    return { error: `Missing required fields: ${missingFields.join(', ')}` };
  }

  const email = normalizeEmail(body.email);
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return { error: 'Invalid email address' };
  }

  if (!isValidPositiveInteger(body.quantity)) {
    return { error: 'Quantity must be a positive integer' };
  }

  const quantity = Number(body.quantity);
  if (quantity > 10) {
    return { error: 'Quantity cannot be greater than 10' };
  }

  const quote = getProductQuote({
    productKey: body.product_key,
    size: body.size,
    quantity,
  });

  if (quote.error) {
    return { error: quote.error };
  }

  if (body.total_amount !== undefined) {
    const clientTotal = Number(body.total_amount);

    if (!Number.isFinite(clientTotal) || Math.abs(clientTotal - quote.totalAmount) > 0.01) {
      return { error: 'Order total does not match product pricing' };
    }
  }

  return { email, quantity, quote };
};

const parseBigIntId = (id) => {
  if (!/^\d+$/.test(String(id))) {
    return null;
  }

  return BigInt(id);
};

const createOrder = async (req, res) => {
  try {
    const {
      first_name,
      last_name,
      date_of_birth,
      phone,
      product_key,
      size,
      address_line_1,
      address_line_2,
      city,
      postal_code,
      country,
    } = req.body;

    const validation = validateOrderBody(req.body);

    if (validation.error) {
      return res.status(400).json({ error: validation.error });
    }

    // 1. Create or Find Customer
    let customer = await prisma.customers.findUnique({
      where: { email: validation.email },
    });

    if (!customer) {
      customer = await prisma.customers.create({
        data: {
          first_name,
          last_name,
          date_of_birth: date_of_birth ? new Date(date_of_birth) : null,
          email: validation.email,
          phone,
        },
      });
    }

    // 2. Create Order
    // Generate a unique order number
    const order_number = `ORD-${Date.now()}-${Math.floor(Math.random() * 1000)}`;

    const order = await prisma.orders.create({
      data: {
        customer_id: customer.id,
        order_number,
        product_key,
        product_name: validation.quote.productName,
        size,
        quantity: validation.quantity,
        total_amount: validation.quote.totalAmount,
        address_line_1,
        address_line_2,
        city,
        postal_code,
        country,
        status: 'pending',
      },
    });

    res.status(201).json({
      message: 'Order created successfully',
      order,
    });
  } catch (error) {
    console.error('Error creating order:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

const getOrderDetails = async (req, res) => {
  try {
    const { id } = req.params;
    const orderId = parseBigIntId(id);

    if (!orderId) {
      return res.status(400).json({ error: 'Invalid order ID' });
    }

    const order = await prisma.orders.findUnique({
      where: { id: orderId },
      include: {
        customer: true,
        humanity_num: true,
      },
    });

    if (!order) {
      return res.status(404).json({ error: 'Order not found' });
    }

    res.status(200).json({ order });
  } catch (error) {
    console.error('Error fetching order details:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

module.exports = {
  createOrder,
  getOrderDetails,
};
