const prisma = require('../database/db');
const { runCheckoutSmokeTest } = require('../services/smokeTestService');

const getSmokeTestSecretFromRequest = (req) => {
  const authorization = req.headers.authorization || '';

  if (authorization.startsWith('Bearer ')) {
    return authorization.slice('Bearer '.length).trim();
  }

  return req.headers['x-smoke-test-secret'];
};

const runSmokeTestCheckout = async (req, res) => {
  try {
    const providedSecret = getSmokeTestSecretFromRequest(req);

    if (!process.env.SMOKE_TEST_SECRET) {
      return res.status(503).json({
        error: 'Smoke test endpoint is not configured',
      });
    }

    if (!providedSecret || providedSecret !== process.env.SMOKE_TEST_SECRET) {
      return res.status(401).json({
        error: 'Unauthorized',
      });
    }

    const result = await runCheckoutSmokeTest(req.body || {});

    return res.status(201).json(result);
  } catch (error) {
    if (error.statusCode) {
      return res.status(error.statusCode).json({
        error: error.message,
      });
    }

    console.error('Smoke test checkout failed:', error);
    return res.status(500).json({
      error: 'Internal server error',
    });
  }
};

const getCustomersWithUniqueNumbers = async (req, res) => {
  try {
    const page = Math.max(1, parseInt(req.query.page, 10) || 1);
    const limit = Math.max(1, Math.min(100, parseInt(req.query.limit, 10) || 20));
    const search = req.query.search ? String(req.query.search).trim() : '';
    const sortBy = req.query.sortBy || 'created_at';
    const sortOrder = req.query.sortOrder === 'asc' ? 'asc' : 'desc';

    // Build Prisma query condition
    const where = {};
    if (search) {
      const isNumeric = /^\d+$/.test(search);
      where.OR = [
        {
          customer: {
            OR: [
              { first_name: { contains: search, mode: 'insensitive' } },
              { last_name: { contains: search, mode: 'insensitive' } },
              { email: { contains: search, mode: 'insensitive' } },
              { phone: { contains: search, mode: 'insensitive' } },
            ],
          },
        },
        {
          order: {
            OR: [
              { order_number: { contains: search, mode: 'insensitive' } },
              { product_name: { contains: search, mode: 'insensitive' } },
            ],
          },
        },
        ...(isNumeric ? [{ humanity_number: BigInt(search) }] : []),
      ];
    }

    // Determine sorting criteria
    let orderBy = { created_at: sortOrder };
    if (sortBy === 'humanity_number') {
      orderBy = { humanity_number: sortOrder };
    } else if (sortBy === 'customer_name') {
      orderBy = { customer: { last_name: sortOrder } };
    } else if (sortBy === 'total_amount') {
      orderBy = { order: { total_amount: sortOrder } };
    }

    // Execute queries in parallel for efficiency
    const [data, totalCount, totalUniqueNumbers, totalCustomers] = await Promise.all([
      prisma.humanity_numbers.findMany({
        where,
        include: {
          customer: true,
          order: {
            include: {
              payments: {
                orderBy: { created_at: 'desc' },
              },
            },
          },
        },
        skip: (page - 1) * limit,
        take: limit,
        orderBy,
      }),
      prisma.humanity_numbers.count({ where }),
      prisma.humanity_numbers.count(),
      prisma.customers.count(),
    ]);

    return res.status(200).json({
      data,
      pagination: {
        total: totalCount,
        page,
        limit,
        totalPages: Math.ceil(totalCount / limit),
      },
      stats: {
        totalUniqueNumbers,
        totalCustomers,
      },
    });
  } catch (error) {
    console.error('Error fetching customers with humanity numbers:', error);
    return res.status(500).json({
      error: 'Internal server error',
    });
  }
};

module.exports = {
  runSmokeTestCheckout,
  getCustomersWithUniqueNumbers,
};

