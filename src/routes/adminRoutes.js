const express = require('express');
const { runSmokeTestCheckout } = require('../controllers/adminController');

const router = express.Router();

router.post('/smoke-test/checkout', runSmokeTestCheckout);

module.exports = router;
