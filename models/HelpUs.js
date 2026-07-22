'use strict';
const { Model } = require('sequelize');

module.exports = (sequelize, DataTypes) => {
  class HelpUs extends Model {
    static associate(models) {
      // No associations yet
    }
  }

  HelpUs.init(
    {
      id: {
        type: DataTypes.UUID,
        defaultValue: DataTypes.UUIDV4,
        primaryKey: true,
      },
      name: {
        type: DataTypes.STRING(255),
        allowNull: false,
      },
      description: {
        type: DataTypes.TEXT,
        allowNull: false,
      },
    },
    {
      sequelize,
      modelName: 'HelpUs',
      tableName: 'help_us',
      timestamps: true,
    }
  );

  return HelpUs;
};
