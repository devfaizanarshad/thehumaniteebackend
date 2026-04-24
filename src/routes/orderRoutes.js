const express = require('express');
const { createOrder, getOrderDetails } = require('../controllers/orderController');

const router = express.Router();

router.post('/', createOrder);
router.get('/:id', getOrderDetails);

module.exports = router;
