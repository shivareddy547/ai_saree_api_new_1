const bcrypt = require('bcryptjs');
const { Op } = require('sequelize');
const { User, Order, OrderItem, Product, ProductVariant, ProductImage } = require('../models');
let Address;
try {
  Address = require('../models').Address;
} catch (e) {
  Address = null;
}
const updateProfile = async (userId, data) => {
  const { fullName, phone } = data;
  const user = await User.findByPk(userId);
  if (!user) {
    const err = new Error('User not found');
    err.status = 404;
    throw err;
  }
  if (fullName !== undefined) {
    if (!fullName || !fullName.trim()) {
      const err = new Error('Full name cannot be empty');
      err.status = 400;
      throw err;
    }
    user.fullName = fullName.trim();
  }
  if (phone !== undefined) {
    user.phone = phone.trim() || null;
  }
  await user.save();
  return {
    id: user.id,
    fullName: user.fullName,
    email: user.email,
    phone: user.phone,
    role: user.role,
    isEmailVerified: user.isEmailVerified,
    isActive: user.isActive !== undefined ? user.isActive : true,
  };
};
const changePassword = async (userId, data) => {
  const { currentPassword, newPassword } = data;
  const user = await User.findByPk(userId);
  if (!user) {
    const err = new Error('User not found');
    err.status = 404;
    throw err;
  }
  const isValid = await bcrypt.compare(currentPassword, user.password);
  if (!isValid) {
    const err = new Error('Current password is incorrect');
    err.status = 400;
    throw err;
  }
  if (newPassword.length < 6) {
    const err = new Error('New password must be at least 6 characters');
    err.status = 400;
    throw err;
  }
  const hashedPassword = await bcrypt.hash(newPassword, 10);
  user.password = hashedPassword;
  await user.save();
  return { message: 'Password updated successfully' };
};
const getUsersAdmin = async (filters = {}) => {
  const {
    search,
    role,
    isActive,
    page = 1,
    limit = 20,
  } = filters;
  const where = {};
  if (role) {
    where.role = role;
  }
  if (isActive !== undefined && isActive !== '' && isActive !== null) {
    where.isActive = isActive === true || isActive === 'true' || isActive === '1';
  }
  if (search && search.trim()) {
    const term = `%${search.trim()}%`;
    where[Op.or] = [
      { fullName: { [Op.iLike]: term } },
      { email: { [Op.iLike]: term } },
      { phone: { [Op.iLike]: term } },
    ];
  }
  const pageNum = Math.max(1, parseInt(page, 10) || 1);
  const limitNum = Math.min(100, Math.max(1, parseInt(limit, 10) || 20));
  const offset = (pageNum - 1) * limitNum;
  const { rows, count } = await User.findAndCountAll({
    where,
    attributes: {
      exclude: ['password', 'otp', 'otpExpires', 'instagramAccessToken'],
    },
    order: [['createdAt', 'DESC']],
    limit: limitNum,
    offset,
  });
  return {
    users: rows,
    pagination: {
      page: pageNum,
      limit: limitNum,
      total: count,
      totalPages: Math.ceil(count / limitNum) || 1,
    },
  };
};
const getUserAdmin = async (userId) => {
  const include = [];
  if (Address) {
    include.push({
      model: Address,
      as: 'addresses',
      required: false,
    });
  }
  const user = await User.findByPk(userId, {
    attributes: {
      exclude: ['password', 'otp', 'otpExpires', 'instagramAccessToken'],
    },
    include,
  });
  if (!user) {
    const err = new Error('User not found');
    err.status = 404;
    throw err;
  }
  return user;
};
const updateUserStatusAdmin = async (userId, isActive) => {
  if (typeof isActive !== 'boolean') {
    const err = new Error('isActive must be a boolean');
    err.status = 400;
    throw err;
  }
  const user = await User.findByPk(userId);
  if (!user) {
    const err = new Error('User not found');
    err.status = 404;
    throw err;
  }
  user.isActive = isActive;
  await user.save();
  return {
    id: user.id,
    fullName: user.fullName,
    email: user.email,
    phone: user.phone,
    role: user.role,
    isEmailVerified: user.isEmailVerified,
    isActive: user.isActive,
    createdAt: user.createdAt,
    updatedAt: user.updatedAt,
  };
};
const getUserOrdersAdmin = async (userId, filters = {}) => {
  const user = await User.findByPk(userId);
  if (!user) {
    const err = new Error('User not found');
    err.status = 404;
    throw err;
  }
  const {
    status,
    paymentStatus,
    search,
    startDate,
    endDate,
    page = 1,
    limit = 20,
  } = filters;
  const where = { userId };
  if (status) where.status = status;
  if (paymentStatus) where.paymentStatus = paymentStatus;
  if (startDate || endDate) {
    where.createdAt = {};
    if (startDate) where.createdAt[Op.gte] = new Date(startDate);
    if (endDate) {
      const end = new Date(endDate);
      end.setHours(23, 59, 59, 999);
      where.createdAt[Op.lte] = end;
    }
  }
  if (search && search.trim()) {
    const term = search.trim();
    const orConditions = [];
    if (!isNaN(term)) {
      orConditions.push({ id: parseInt(term, 10) });
    }
    orConditions.push({ merchantOrderId: { [Op.iLike]: `%${term}%` } });
    where[Op.or] = orConditions;
  }
  const pageNum = Math.max(1, parseInt(page, 10) || 1);
  const limitNum = Math.min(100, Math.max(1, parseInt(limit, 10) || 20));
  const offset = (pageNum - 1) * limitNum;
  const { rows, count } = await Order.findAndCountAll({
    where,
    include: [
      {
        model: OrderItem,
        as: 'items',
        include: [
          {
            model: Product,
            as: 'product',
            attributes: ['id', 'name'],
            include: [
              {
                model: ProductImage,
                as: 'images',
                attributes: ['url'],
                limit: 1,
              },
            ],
          },
          {
            model: ProductVariant,
            as: 'variant',
            attributes: ['id', 'size', 'color', 'sku'],
          },
        ],
      },
    ],
    order: [['createdAt', 'DESC']],
    limit: limitNum,
    offset,
    distinct: true,
  });
  return {
    orders: rows,
    pagination: {
      page: pageNum,
      limit: limitNum,
      total: count,
      totalPages: Math.ceil(count / limitNum) || 1,
    },
  };
};
const updateAddressAdmin = async (userId, addressId, data) => {
  if (!Address) {
    const err = new Error('Address model not available');
    err.status = 500;
    throw err;
  }
  const address = await Address.findOne({
    where: { id: addressId, user_id: userId },
  });
  if (!address) {
    const err = new Error('Address not found');
    err.status = 404;
    throw err;
  }
  const fields = [
    'full_name',
    'street_address',
    'apartment',
    'city',
    'state',
    'zip_code',
    'country',
    'phone',
    'is_default',
  ];
  fields.forEach((field) => {
    if (data[field] !== undefined) {
      address[field] = data[field];
    }
  });
  if (data.is_default === true) {
    await Address.update(
      { is_default: false },
      { where: { user_id: userId, id: { [Op.ne]: addressId } } }
    );
  }
  await address.save();
  return address;
};
module.exports = {
  updateProfile,
  changePassword,
  getUsersAdmin,
  getUserAdmin,
  updateUserStatusAdmin,
  getUserOrdersAdmin,
  updateAddressAdmin,
};
