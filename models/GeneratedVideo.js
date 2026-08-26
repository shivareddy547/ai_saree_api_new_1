const { Model, DataTypes } = require('sequelize');
module.exports = (sequelize) => {
  class GeneratedVideo extends Model {
    static associate(models) {
      GeneratedVideo.belongsTo(models.User, {
        foreignKey: 'userId',
        as: 'user',
      });
    }
  }
  GeneratedVideo.init(
    {
      id: {
        type: DataTypes.UUID,
        defaultValue: DataTypes.UUIDV4,
        primaryKey: true,
        allowNull: false,
      },
      userId: {
        type: DataTypes.UUID,
        allowNull: false,
        references: {
          model: 'users',
          key: 'id',
        },
      },
      title: {
        type: DataTypes.STRING,
        allowNull: true,
      },
      videoUrl: {
        type: DataTypes.STRING,
        allowNull: true,
      },
      thumbnailUrl: {
        type: DataTypes.STRING,
        allowNull: true,
      },
      imageUrls: {
        type: DataTypes.JSONB,
        allowNull: false,
        defaultValue: [],
      },
      audioMode: {
        type: DataTypes.ENUM('none', 'upload', 'ai', 'recorded'),
        allowNull: false,
        defaultValue: 'none',
      },
      audioUrl: {
        type: DataTypes.STRING,
        allowNull: true,
      },
      audioScript: {
        type: DataTypes.TEXT,
        allowNull: true,
      },
      audioLanguage: {
        type: DataTypes.STRING,
        allowNull: true,
      },
      voiceGender: {
        type: DataTypes.ENUM('male', 'female', 'neutral'),
        allowNull: true,
      },
      durationSeconds: {
        type: DataTypes.INTEGER,
        allowNull: true,
      },
      status: {
        type: DataTypes.ENUM('pending', 'processing', 'completed', 'failed'),
        allowNull: false,
        defaultValue: 'pending',
      },
      errorMessage: {
        type: DataTypes.TEXT,
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
      modelName: 'GeneratedVideo',
      tableName: 'generated_videos',
    }
  );
  return GeneratedVideo;
};
