const DEFAULT_PRODUCTS = {
  'humanity-tee-black': {
    name: 'Humanity Tee Black',
    currency: 'usd',
    prices: {
      XS: 29.99,
      S: 29.99,
      M: 29.99,
      L: 29.99,
      XL: 29.99,
      XXL: 29.99,
    },
  },
};

const loadProducts = () => {
  if (!process.env.PRODUCT_CATALOG_JSON) {
    return DEFAULT_PRODUCTS;
  }

  try {
    return JSON.parse(process.env.PRODUCT_CATALOG_JSON);
  } catch (error) {
    console.error('Invalid PRODUCT_CATALOG_JSON:', error.message);
    return DEFAULT_PRODUCTS;
  }
};

const getProductQuote = ({ productKey, size, quantity }) => {
  const products = loadProducts();
  const product = products[productKey];

  if (!product) {
    return { error: 'Unknown product' };
  }

  const unitPrice = product.prices?.[size];

  if (unitPrice === undefined) {
    return { error: 'Invalid size for product' };
  }

  const totalAmount = Number((Number(unitPrice) * quantity).toFixed(2));

  return {
    productKey,
    productName: product.name,
    size,
    quantity,
    unitPrice: Number(unitPrice),
    totalAmount,
    currency: product.currency || process.env.ORDER_CURRENCY || 'usd',
  };
};

module.exports = {
  getProductQuote,
};
