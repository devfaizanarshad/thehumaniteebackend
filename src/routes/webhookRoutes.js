const express = require('express');
const { handleWebhook } = require('../controllers/webhookController');

const router = express.Router();

// Stripe requires the raw body to construct the event correctly
// But we can configure express to use raw middleware only for this route in index.js
router.post('/', handleWebhook);

module.exports = router;
