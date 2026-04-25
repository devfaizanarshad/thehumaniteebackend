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

module.exports = {
  runSmokeTestCheckout,
};
