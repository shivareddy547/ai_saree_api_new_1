const { Model, DataTypes } = require('sequelize');
module.exports = (sequelize) => {
  class PageView extends Model {
    static associate(models) {}
  }
  PageView.init({
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
    },
    path: {
      type: DataTypes.STRING,
      allowNull: false,
      unique: true,
    },
    totalViews: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 0,
    },
    guestViews: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 0,
    },
    providerViews: {
      type: DataTypes.JSONB,
      allowNull: false,
      defaultValue: {},
    },
  }, {
    sequelize,
    modelName: 'PageView',
    tableName: 'page_views',
    timestamps: true,
  });
  return PageView;
};
