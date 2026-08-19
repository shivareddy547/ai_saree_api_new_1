const { PickupLocation, sequelize } = require('../models');
const { Op } = require('sequelize');
class PickupLocationService {
  async getAll() {
    return PickupLocation.findAll({
      order: [
        ['isDefault', 'DESC'],
        ['isActive', 'DESC'],
        ['createdAt', 'DESC'],
      ],
    });
  }
  async getById(id) {
    return PickupLocation.findByPk(id);
  }
  async create(data) {
    if (!data.name || !data.name.trim()) {
      const err = new Error('Name is required');
      err.status = 400;
      throw err;
    }
    if (!data.streetAddress || !data.streetAddress.trim()) {
      const err = new Error('Street address is required');
      err.status = 400;
      throw err;
    }
    if (!data.city || !data.city.trim()) {
      const err = new Error('City is required');
      err.status = 400;
      throw err;
    }
    const transaction = await sequelize.transaction();
    try {
      const isDefault = !!data.isDefault;
      if (isDefault) {
        await PickupLocation.update(
          { isDefault: false },
          { where: { isDefault: true }, transaction }
        );
      }
      const location = await PickupLocation.create(
        {
          name: data.name.trim(),
          streetAddress: data.streetAddress.trim(),
          apartment: data.apartment ? data.apartment.trim() : null,
          city: data.city.trim(),
          state: data.state ? data.state.trim() : null,
          zipCode: data.zipCode ? data.zipCode.trim() : null,
          country: data.country ? data.country.trim() : 'India',
          phone: data.phone ? data.phone.trim() : null,
          isActive: data.isActive !== undefined ? !!data.isActive : true,
          isDefault,
        },
        { transaction }
      );
      await transaction.commit();
      return location;
    } catch (error) {
      await transaction.rollback();
      throw error;
    }
  }
  async update(id, data) {
    const location = await PickupLocation.findByPk(id);
    if (!location) {
      const err = new Error('Pickup location not found');
      err.status = 404;
      throw err;
    }
    const transaction = await sequelize.transaction();
    try {
      if (data.isDefault === true) {
        await PickupLocation.update(
          { isDefault: false },
          { where: { isDefault: true, id: { [Op.ne]: id } }, transaction }
        );
      }
      const updates = {};
      if (data.name !== undefined) updates.name = data.name.trim();
      if (data.streetAddress !== undefined) updates.streetAddress = data.streetAddress.trim();
      if (data.apartment !== undefined) updates.apartment = data.apartment ? data.apartment.trim() : null;
      if (data.city !== undefined) updates.city = data.city.trim();
      if (data.state !== undefined) updates.state = data.state ? data.state.trim() : null;
      if (data.zipCode !== undefined) updates.zipCode = data.zipCode ? data.zipCode.trim() : null;
      if (data.country !== undefined) updates.country = data.country ? data.country.trim() : 'India';
      if (data.phone !== undefined) updates.phone = data.phone ? data.phone.trim() : null;
      if (data.isActive !== undefined) updates.isActive = !!data.isActive;
      if (data.isDefault !== undefined) updates.isDefault = !!data.isDefault;
      await location.update(updates, { transaction });
      await transaction.commit();
      return location.reload();
    } catch (error) {
      await transaction.rollback();
      throw error;
    }
  }
  async setActive(id, isActive) {
    const location = await PickupLocation.findByPk(id);
    if (!location) {
      const err = new Error('Pickup location not found');
      err.status = 404;
      throw err;
    }
    await location.update({ isActive: !!isActive });
    return location;
  }
  async setDefault(id) {
    const location = await PickupLocation.findByPk(id);
    if (!location) {
      const err = new Error('Pickup location not found');
      err.status = 404;
      throw err;
    }
    const transaction = await sequelize.transaction();
    try {
      await PickupLocation.update(
        { isDefault: false },
        { where: { isDefault: true }, transaction }
      );
      await location.update({ isDefault: true, isActive: true }, { transaction });
      await transaction.commit();
      return location.reload();
    } catch (error) {
      await transaction.rollback();
      throw error;
    }
  }
  async delete(id) {
    const location = await PickupLocation.findByPk(id);
    if (!location) {
      const err = new Error('Pickup location not found');
      err.status = 404;
      throw err;
    }
    await location.destroy();
    return true;
  }
}
module.exports = new PickupLocationService();
