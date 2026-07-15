const express = require('express');
const { runSmokeTestCheckout, getCustomersWithUniqueNumbers } = require('../controllers/adminController');

const router = express.Router();

router.post('/smoke-test/checkout', runSmokeTestCheckout);
router.get('/customers', getCustomersWithUniqueNumbers);

module.exports = router;

