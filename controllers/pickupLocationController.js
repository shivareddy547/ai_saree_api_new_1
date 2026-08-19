const pickupLocationService = require('../services/pickupLocationService');
class PickupLocationController {
  async getAll(req, res, next) {
    try {
      const locations = await pickupLocationService.getAll();
      res.status(200).json({ success: true, data: locations });
    } catch (error) {
      next(error);
    }
  }
  async getById(req, res, next) {
    try {
      const { id } = req.params;
      const location = await pickupLocationService.getById(id);
      if (!location) {
        const err = new Error('Pickup location not found');
        err.status = 404;
        throw err;
      }
      res.status(200).json({ success: true, data: location });
    } catch (error) {
      next(error);
    }
  }
  async create(req, res, next) {
    try {
      const location = await pickupLocationService.create(req.body);
      res.status(201).json({ success: true, data: location, message: 'Pickup location created successfully' });
    } catch (error) {
      next(error);
    }
  }
  async update(req, res, next) {
    try {
      const { id } = req.params;
      const location = await pickupLocationService.update(id, req.body);
      res.status(200).json({ success: true, data: location, message: 'Pickup location updated successfully' });
    } catch (error) {
      next(error);
    }
  }
  async setActive(req, res, next) {
    try {
      const { id } = req.params;
      const isActive = req.body.isActive !== undefined ? !!req.body.isActive : true;
      const location = await pickupLocationService.setActive(id, isActive);
      res.status(200).json({
        success: true,
        data: location,
        message: isActive ? 'Pickup location activated' : 'Pickup location deactivated',
      });
    } catch (error) {
      next(error);
    }
  }
  async setDefault(req, res, next) {
    try {
      const { id } = req.params;
      const location = await pickupLocationService.setDefault(id);
      res.status(200).json({ success: true, data: location, message: 'Default pickup location updated' });
    } catch (error) {
      next(error);
    }
  }
  async delete(req, res, next) {
    try {
      const { id } = req.params;
      await pickupLocationService.delete(id);
      res.status(200).json({ success: true, message: 'Pickup location deleted successfully' });
    } catch (error) {
      next(error);
    }
  }
}
module.exports = new PickupLocationController();
