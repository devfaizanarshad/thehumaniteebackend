const express = require('express');
const { 
  runSmokeTestCheckout, 
  getCustomersWithUniqueNumbers,
  deleteHumanityNumber,
  bulkDeleteHumanityNumbers
} = require('../controllers/adminController');

const router = express.Router();

router.post('/smoke-test/checkout', runSmokeTestCheckout);
router.get('/customers', getCustomersWithUniqueNumbers);
router.delete('/customers/:id', deleteHumanityNumber);
router.post('/customers/bulk-delete', bulkDeleteHumanityNumbers);

module.exports = router;

