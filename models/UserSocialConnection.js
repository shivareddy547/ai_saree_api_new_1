const { Model, DataTypes } = require('sequelize');
module.exports = (sequelize) => {
  class UserSocialConnection extends Model {
    static associate(models) {
      UserSocialConnection.belongsTo(models.User, {
        foreignKey: 'userId',
        as: 'user',
      });
      UserSocialConnection.belongsTo(models.Provider, {
        foreignKey: 'providerId',
        as: 'provider',
      });
    }
  }
  UserSocialConnection.init(
    {
      id: {
        type: DataTypes.UUID,
        defaultValue: DataTypes.UUIDV4,
        primaryKey: true,
      },
      userId: {
        type: DataTypes.UUID,
        allowNull: false,
        references: {
          model: 'users',
          key: 'id',
        },
      },
      providerId: {
        type: DataTypes.UUID,
        allowNull: false,
        references: {
          model: 'providers',
          key: 'id',
        },
      },
      providerType: {
        type: DataTypes.STRING,
        allowNull: false,
        comment: 'social provider key e.g., instagram, youtube, etc.',
      },
      accessToken: {
        type: DataTypes.TEXT,
        allowNull: true,
      },
      refreshToken: {
        type: DataTypes.TEXT,
        allowNull: true,
      },
      tokenExpiresAt: {
        type: DataTypes.DATE,
        allowNull: true,
      },
      accountId: {
        type: DataTypes.STRING,
        allowNull: true,
      },
      username: {
        type: DataTypes.STRING,
        allowNull: true,
      },
      accountType: {
        type: DataTypes.STRING,
        allowNull: true,
      },
      metadata: {
        type: DataTypes.JSONB,
        allowNull: true,
        defaultValue: {},
      },
    },
    {
      sequelize,
      modelName: 'UserSocialConnection',
      tableName: 'user_social_connections',
      indexes: [
        {
          unique: true,
          fields: ['userId', 'providerId'],
        },
      ],
    }
  );
  return UserSocialConnection;
};
