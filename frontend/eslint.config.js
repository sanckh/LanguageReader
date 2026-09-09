const expo = require('eslint-config-expo/flat');
const prettier = require('eslint-config-prettier');
module.exports = [...expo, prettier, { ignores: ['dist/**', '.expo/**'] }];
