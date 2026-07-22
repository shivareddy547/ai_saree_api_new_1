/**
 * Dev Assistant Utilities
 * Placeholder utilities for Dev Assistant
 */

module.exports = {
    log: (message, level = 'info') => {
        console.log(`[Dev Assistant ${level.toUpperCase()}] ${message}`);
    },

    error: (message) => {
        console.error(`[Dev Assistant ERROR] ${message}`);
    },

    formatTimestamp: () => {
        return new Date().toISOString();
    }
};
