const { Address } = require('../models');
const { Op } = require('sequelize');
const getAddressesByUser = async (userId) => {
  const addresses = await Address.findAll({
    where: { userId },
    order: [
      ['isDefault', 'DESC'],
      ['createdAt', 'DESC'],
    ],
  });
  return addresses;
};
const getAddressById = async (id, userId) => {
  const address = await Address.findOne({
    where: { id, userId },
  });
  if (!address) {
    const err = new Error('Address not found');
    err.status = 404;
    throw err;
  }
  return address;
};
const createAddress = async (userId, data) => {
  const {
    fullName,
    streetAddress,
    apartment,
    city,
    state,
    zipCode,
    country,
    phone,
    isDefault,
  } = data;
  if (!fullName || !streetAddress || !city || !country) {
    const err = new Error('fullName, streetAddress, city and country are required');
    err.status = 400;
    throw err;
  }
  if (isDefault) {
    await Address.update(
      { isDefault: false },
      { where: { userId, isDefault: true } }
    );
  }
  const address = await Address.create({
    userId,
    fullName,
    streetAddress,
    apartment: apartment || null,
    city,
    state: state || null,
    zipCode: zipCode || null,
    country: country || 'India',
    phone: phone || null,
    isDefault: !!isDefault,
  });
  return address;
};
const updateAddress = async (id, userId, data) => {
  const address = await getAddressById(id, userId);
  const {
    fullName,
    streetAddress,
    apartment,
    city,
    state,
    zipCode,
    country,
    phone,
    isDefault,
  } = data;
  if (isDefault === true) {
    await Address.update(
      { isDefault: false },
      {
        where: {
          userId,
          isDefault: true,
          id: { [Op.ne]: id },
        },
      }
    );
  }
  await address.update({
    fullName: fullName !== undefined ? fullName : address.fullName,
    streetAddress: streetAddress !== undefined ? streetAddress : address.streetAddress,
    apartment: apartment !== undefined ? apartment : address.apartment,
    city: city !== undefined ? city : address.city,
    state: state !== undefined ? state : address.state,
    zipCode: zipCode !== undefined ? zipCode : address.zipCode,
    country: country !== undefined ? country : address.country,
    phone: phone !== undefined ? phone : address.phone,
    isDefault: isDefault !== undefined ? !!isDefault : address.isDefault,
  });
  return address.reload();
};
const deleteAddress = async (id, userId) => {
  const address = await getAddressById(id, userId);
  await address.destroy();
  return { message: 'Address deleted successfully' };
};
const setDefaultAddress = async (id, userId) => {
  const address = await getAddressById(id, userId);
  await Address.update(
    { isDefault: false },
    { where: { userId, isDefault: true } }
  );
  await address.update({ isDefault: true });
  return address.reload();
};
module.exports = {
  getAddressesByUser,
  getAddressById,
  createAddress,
  updateAddress,
  deleteAddress,
  setDefaultAddress,
};
