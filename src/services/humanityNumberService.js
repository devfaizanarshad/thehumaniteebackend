const { randomInt } = require('crypto');

const HUMANITY_NUMBER_MIN = 1n;
const HUMANITY_NUMBER_MAX = 8000000000n;
const HUMANITY_NUMBER_GENERATION_ATTEMPTS = 10;

const generateHumanityNumberCandidate = () => {
  return BigInt(randomInt(Number(HUMANITY_NUMBER_MIN), Number(HUMANITY_NUMBER_MAX) + 1));
};

const findOrCreateHumanityNumber = async ({ tx, orderId, customerId }) => {
  const existing = await tx.humanity_numbers.findUnique({
    where: { order_id: orderId },
  });

  if (existing?.humanity_number) {
    return existing;
  }

  for (let attempt = 0; attempt < HUMANITY_NUMBER_GENERATION_ATTEMPTS; attempt += 1) {
    const candidate = generateHumanityNumberCandidate();

    try {
      if (existing) {
        return await tx.humanity_numbers.update({
          where: { id: existing.id },
          data: {
            humanity_number: candidate,
          },
        });
      }

      return await tx.humanity_numbers.create({
        data: {
          humanity_number: candidate,
          customer_id: customerId,
          order_id: orderId,
        },
      });
    } catch (error) {
      if (error.code !== 'P2002') {
        throw error;
      }

      const alreadyAssigned = await tx.humanity_numbers.findUnique({
        where: { order_id: orderId },
      });

      if (alreadyAssigned?.humanity_number) {
        return alreadyAssigned;
      }
    }
  }

  throw new Error('Unable to generate a unique Human Number after multiple attempts.');
};

const backfillMissingHumanityNumbers = async (prisma) => {
  const records = await prisma.humanity_numbers.findMany({
    where: { humanity_number: null },
    select: {
      id: true,
      order_id: true,
      customer_id: true,
    },
    orderBy: { id: 'asc' },
  });

  for (const record of records) {
    await prisma.$transaction((tx) => findOrCreateHumanityNumber({
      tx,
      orderId: record.order_id,
      customerId: record.customer_id,
    }));
  }

  return records.length;
};

module.exports = {
  HUMANITY_NUMBER_MIN,
  HUMANITY_NUMBER_MAX,
  backfillMissingHumanityNumbers,
  findOrCreateHumanityNumber,
};
