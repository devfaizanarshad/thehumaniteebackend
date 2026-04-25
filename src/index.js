require('dotenv').config();
const express = require('express');
const cors = require('cors');

const orderRoutes = require('./routes/orderRoutes');
const paymentRoutes = require('./routes/paymentRoutes');
const adminRoutes = require('./routes/adminRoutes');
const webhookRoutes = require('./routes/webhookRoutes');

const app = express();

const allowedOrigins = process.env.CORS_ORIGIN
  ? process.env.CORS_ORIGIN.split(',').map((origin) => origin.trim()).filter(Boolean)
  : null;

app.use(cors({
  origin: allowedOrigins || true,
}));

// Webhook route needs raw body for Stripe signature verification
// So we define it BEFORE the global express.json() middleware
app.use('/webhook', express.raw({ type: 'application/json' }), webhookRoutes);

app.use(express.json({ limit: '1mb' }));

// Routes
app.use('/orders', orderRoutes);
app.use('/payments', paymentRoutes);
app.use('/admin', adminRoutes);

// Health check
app.get('/health', (req, res) => {
  res.status(200).json({ status: 'ok', message: 'Humanity API is running.' });
});

app.use((req, res) => {
  res.status(404).json({ error: 'Route not found' });
});

// BigInt JSON conversion override
BigInt.prototype.toJSON = function() {
  return this.toString();
};

const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});
