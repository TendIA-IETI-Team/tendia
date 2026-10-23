// Metro ve también packages/tokens (paleta compartida con el portal).
const { getDefaultConfig } = require('expo/metro-config');
const path = require('path');

const config = getDefaultConfig(__dirname);
config.watchFolders = [path.resolve(__dirname, '../../packages/tokens')];

module.exports = config;
