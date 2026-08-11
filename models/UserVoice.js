const { Model, DataTypes } = require('sequelize');
module.exports = (sequelize) => {
  class UserVoice extends Model {
    static associate(models) {
      UserVoice.belongsTo(models.User, {
        foreignKey: 'userId',
        as: 'user'
      });
    }
  }
  UserVoice.init({
    id: {
      type: DataTypes.INTEGER,
      autoIncrement: true,
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
    name: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    sampleAudioUrl: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    voiceProviderData: {
      type: DataTypes.JSON,
      allowNull: true,
    },
  }, {
    sequelize,
    modelName: 'UserVoice',
    tableName: 'user_voices',
    timestamps: true,
  });
  return UserVoice;
};
