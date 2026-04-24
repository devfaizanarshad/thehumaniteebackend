const { PrismaClient } = require('@prisma/client');

// PrismaClient is attached to the `global` object in development to prevent 
// exhausting your database connection limit.
const prisma = global.prisma || new PrismaClient();

if (process.env.NODE_ENV === 'development') {
  global.prisma = prisma;
}

// Ensure BigInt serializes to JSON correctly
BigInt.prototype.toJSON = function () {
  return this.toString();
};

module.exports = prisma;
