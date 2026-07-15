const getAdminSecretFromRequest = (req) => {
  const authorization = req.headers.authorization || '';

  if (authorization.startsWith('Bearer ')) {
    return authorization.slice('Bearer '.length).trim();
  }

  return (
    req.headers['x-admin-api-key'] ||
    req.headers['x-smoke-test-secret'] ||
    ''
  );
};

const adminAuth = (req, res, next) => {
  const adminApiKey = process.env.ADMIN_API_KEY;
  const smokeTestSecret = process.env.SMOKE_TEST_SECRET;

  // If neither key is configured, block access to prevent security holes
  if (!adminApiKey && !smokeTestSecret) {
    return res.status(503).json({
      error: 'Admin endpoints are not configured (API key missing)',
    });
  }

  const providedSecret = getAdminSecretFromRequest(req);

  if (!providedSecret) {
    return res.status(401).json({
      error: 'Unauthorized: Missing API key or token',
    });
  }

  // Check against either ADMIN_API_KEY or SMOKE_TEST_SECRET
  const isAuthorized =
    (adminApiKey && providedSecret === adminApiKey) ||
    (smokeTestSecret && providedSecret === smokeTestSecret);

  if (!isAuthorized) {
    return res.status(401).json({
      error: 'Unauthorized: Invalid API key or token',
    });
  }

  next();
};

module.exports = adminAuth;
