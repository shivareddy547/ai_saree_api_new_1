'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    const tables = await queryInterface.showAllTables();
    const list = tables.map((t) => (typeof t === 'object' ? t.tableName : t));

    if (!list.includes('user_voices')) {
      await queryInterface.createTable('user_voices', {
        id: { type: Sequelize.INTEGER, autoIncrement: true, primaryKey: true, allowNull: false },
        userId: { type: Sequelize.UUID, allowNull: false, references: { model: 'users', key: 'id' }, onUpdate: 'CASCADE', onDelete: 'CASCADE' },
        name: { type: Sequelize.STRING, allowNull: false },
        sampleAudioUrl: { type: Sequelize.STRING, allowNull: true },
        voiceProviderData: { type: Sequelize.JSON, allowNull: true },
        createdAt: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.literal('CURRENT_TIMESTAMP') },
        updatedAt: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.literal('CURRENT_TIMESTAMP') },
      });
    }

    if (!list.includes('generated_videos')) {
      await queryInterface.createTable('generated_videos', {
        id: { type: Sequelize.UUID, defaultValue: Sequelize.UUIDV4, primaryKey: true, allowNull: false },
        userId: { type: Sequelize.UUID, allowNull: false, references: { model: 'users', key: 'id' }, onUpdate: 'CASCADE', onDelete: 'CASCADE' },
        title: { type: Sequelize.STRING, allowNull: true },
        videoUrl: { type: Sequelize.STRING, allowNull: true },
        thumbnailUrl: { type: Sequelize.STRING, allowNull: true },
        imageUrls: { type: Sequelize.JSONB, allowNull: false, defaultValue: [] },
        audioMode: { type: Sequelize.ENUM('none', 'upload', 'ai', 'recorded'), allowNull: false, defaultValue: 'none' },
        audioUrl: { type: Sequelize.STRING, allowNull: true },
        audioScript: { type: Sequelize.TEXT, allowNull: true },
        audioLanguage: { type: Sequelize.STRING, allowNull: true },
        voiceGender: { type: Sequelize.ENUM('male', 'female', 'neutral'), allowNull: true },
        durationSeconds: { type: Sequelize.INTEGER, allowNull: true },
        status: { type: Sequelize.ENUM('pending', 'processing', 'completed', 'failed'), allowNull: false, defaultValue: 'pending' },
        errorMessage: { type: Sequelize.TEXT, allowNull: true },
        metadata: { type: Sequelize.JSONB, allowNull: true, defaultValue: {} },
        createdAt: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.literal('CURRENT_TIMESTAMP') },
        updatedAt: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.literal('CURRENT_TIMESTAMP') },
      });
      await queryInterface.addIndex('generated_videos', ['userId']);
      await queryInterface.addIndex('generated_videos', ['status']);
    }

    if (!list.includes('providers')) {
      await queryInterface.createTable('providers', {
        id: { type: Sequelize.UUID, defaultValue: Sequelize.UUIDV4, primaryKey: true, allowNull: false },
        provider_type: { type: Sequelize.ENUM('smtp', 'sms', 'social', 'payment', 'shipment'), allowNull: false },
        name: { type: Sequelize.STRING, allowNull: false },
        provider_key: { type: Sequelize.STRING, allowNull: true },
        is_enabled: { type: Sequelize.BOOLEAN, allowNull: false, defaultValue: false },
        credentials: { type: Sequelize.JSONB, allowNull: false, defaultValue: {} },
        createdAt: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.literal('CURRENT_TIMESTAMP') },
        updatedAt: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.literal('CURRENT_TIMESTAMP') },
      });
    }

    if (!list.includes('user_social_connections')) {
      await queryInterface.createTable('user_social_connections', {
        id: { type: Sequelize.UUID, defaultValue: Sequelize.UUIDV4, primaryKey: true, allowNull: false },
        userId: { type: Sequelize.UUID, allowNull: false, references: { model: 'users', key: 'id' }, onUpdate: 'CASCADE', onDelete: 'CASCADE' },
        providerId: { type: Sequelize.UUID, allowNull: false, references: { model: 'providers', key: 'id' }, onUpdate: 'CASCADE', onDelete: 'CASCADE' },
        providerType: { type: Sequelize.STRING, allowNull: false },
        accessToken: { type: Sequelize.TEXT, allowNull: true },
        refreshToken: { type: Sequelize.TEXT, allowNull: true },
        tokenExpiresAt: { type: Sequelize.DATE, allowNull: true },
        accountId: { type: Sequelize.STRING, allowNull: true },
        username: { type: Sequelize.STRING, allowNull: true },
        accountType: { type: Sequelize.STRING, allowNull: true },
        metadata: { type: Sequelize.JSONB, allowNull: true, defaultValue: {} },
        createdAt: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.literal('CURRENT_TIMESTAMP') },
        updatedAt: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.literal('CURRENT_TIMESTAMP') },
      });
      await queryInterface.addConstraint('user_social_connections', {
        fields: ['userId', 'providerId'],
        type: 'unique',
        name: 'unique_user_provider_connection',
      });
    }

    if (!list.includes('stores')) {
      await queryInterface.createTable('stores', {
        id: { type: Sequelize.UUID, defaultValue: Sequelize.UUIDV4, primaryKey: true, allowNull: false },
        name: { type: Sequelize.STRING, allowNull: false },
        caption: { type: Sequelize.STRING, allowNull: true },
        logo: { type: Sequelize.STRING, allowNull: true },
        favicon: { type: Sequelize.STRING, allowNull: true },
        createdAt: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.literal('CURRENT_TIMESTAMP') },
        updatedAt: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.literal('CURRENT_TIMESTAMP') },
      });
    }

    if (!list.includes('help_us')) {
      await queryInterface.createTable('help_us', {
        id: { type: Sequelize.UUID, defaultValue: Sequelize.UUIDV4, primaryKey: true, allowNull: false },
        name: { type: Sequelize.STRING, allowNull: false },
        description: { type: Sequelize.TEXT, allowNull: false },
        createdAt: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.literal('CURRENT_TIMESTAMP') },
        updatedAt: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.literal('CURRENT_TIMESTAMP') },
      });
    }

    if (!list.includes('page_views')) {
      await queryInterface.createTable('page_views', {
        id: { type: Sequelize.UUID, defaultValue: Sequelize.UUIDV4, primaryKey: true, allowNull: false },
        path: { type: Sequelize.STRING, allowNull: false, unique: true },
        totalViews: { type: Sequelize.INTEGER, allowNull: false, defaultValue: 0 },
        guestViews: { type: Sequelize.INTEGER, allowNull: false, defaultValue: 0 },
        providerViews: { type: Sequelize.JSONB, allowNull: false, defaultValue: {} },
        createdAt: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.literal('CURRENT_TIMESTAMP') },
        updatedAt: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.literal('CURRENT_TIMESTAMP') },
      });
      await queryInterface.addIndex('page_views', ['path'], { unique: true, name: 'page_views_path_unique' });
    }

    if (!list.includes('page_view_logs')) {
      await queryInterface.createTable('page_view_logs', {
        id: { type: Sequelize.UUID, defaultValue: Sequelize.UUIDV4, primaryKey: true, allowNull: false },
        path: { type: Sequelize.STRING, allowNull: false },
        ipAddress: { type: Sequelize.STRING, allowNull: true },
        city: { type: Sequelize.STRING, allowNull: true },
        region: { type: Sequelize.STRING, allowNull: true },
        country: { type: Sequelize.STRING, allowNull: true },
        countryCode: { type: Sequelize.STRING, allowNull: true },
        isGuest: { type: Sequelize.BOOLEAN, allowNull: false, defaultValue: true },
        provider: { type: Sequelize.STRING, allowNull: true },
        userAgent: { type: Sequelize.TEXT, allowNull: true },
        createdAt: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.literal('CURRENT_TIMESTAMP') },
        updatedAt: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.literal('CURRENT_TIMESTAMP') },
      });
      await queryInterface.addIndex('page_view_logs', ['path']);
      await queryInterface.addIndex('page_view_logs', ['createdAt']);
      await queryInterface.addIndex('page_view_logs', ['ipAddress']);
    }

    if (!list.includes('ai_providers')) {
      await queryInterface.createTable('ai_providers', {
        id: { type: Sequelize.UUID, defaultValue: Sequelize.UUIDV4, primaryKey: true, allowNull: false },
        name: { type: Sequelize.STRING, allowNull: false, unique: true },
        provider: { type: Sequelize.STRING, allowNull: false },
        api_key: { type: Sequelize.TEXT, allowNull: true },
        api_secret: { type: Sequelize.TEXT, allowNull: true },
        endpoint: { type: Sequelize.STRING, allowNull: true },
        organization_id: { type: Sequelize.STRING, allowNull: true },
        project_id: { type: Sequelize.STRING, allowNull: true },
        region: { type: Sequelize.STRING, allowNull: true },
        enabled: { type: Sequelize.BOOLEAN, allowNull: false, defaultValue: true },
        default_provider: { type: Sequelize.BOOLEAN, allowNull: false, defaultValue: false },
        timeout: { type: Sequelize.INTEGER, allowNull: false, defaultValue: 60 },
        max_retries: { type: Sequelize.INTEGER, allowNull: false, defaultValue: 3 },
        metadata: { type: Sequelize.JSONB, allowNull: false, defaultValue: {} },
        createdAt: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.literal('CURRENT_TIMESTAMP') },
        updatedAt: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.literal('CURRENT_TIMESTAMP') },
      });
    }

    if (!list.includes('ai_models')) {
      await queryInterface.createTable('ai_models', {
        id: { type: Sequelize.UUID, defaultValue: Sequelize.UUIDV4, primaryKey: true, allowNull: false },
        ai_provider_id: { type: Sequelize.UUID, allowNull: false, references: { model: 'ai_providers', key: 'id' }, onUpdate: 'CASCADE', onDelete: 'CASCADE' },
        name: { type: Sequelize.STRING, allowNull: false },
        model_identifier: { type: Sequelize.STRING, allowNull: false },
        model_type: { type: Sequelize.STRING, allowNull: false },
        context_window: { type: Sequelize.INTEGER, allowNull: true },
        max_output_tokens: { type: Sequelize.INTEGER, allowNull: true },
        supports_streaming: { type: Sequelize.BOOLEAN, allowNull: false, defaultValue: false },
        supports_function_calling: { type: Sequelize.BOOLEAN, allowNull: false, defaultValue: false },
        supports_json_mode: { type: Sequelize.BOOLEAN, allowNull: false, defaultValue: false },
        supports_vision: { type: Sequelize.BOOLEAN, allowNull: false, defaultValue: false },
        enabled: { type: Sequelize.BOOLEAN, allowNull: false, defaultValue: true },
        is_default: { type: Sequelize.BOOLEAN, allowNull: false, defaultValue: false },
        metadata: { type: Sequelize.JSONB, allowNull: false, defaultValue: {} },
        createdAt: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.literal('CURRENT_TIMESTAMP') },
        updatedAt: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.literal('CURRENT_TIMESTAMP') },
      });
      await queryInterface.addIndex('ai_models', ['ai_provider_id']);
    }
  },

  down: async (queryInterface) => {
    await queryInterface.dropTable('ai_models');
    await queryInterface.dropTable('ai_providers');
    await queryInterface.dropTable('page_view_logs');
    await queryInterface.dropTable('page_views');
    await queryInterface.dropTable('help_us');
    await queryInterface.dropTable('stores');
    await queryInterface.dropTable('user_social_connections');
    await queryInterface.dropTable('providers');
    await queryInterface.dropTable('generated_videos');
    await queryInterface.dropTable('user_voices');
  },
};
