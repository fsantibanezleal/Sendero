import expoConfig from 'eslint-config-expo/flat.js';

export default [
  ...expoConfig,
  {
    ignores: ['dist/**', '.expo/**', 'android/**', 'ios/**', 'node_modules/**', 'pipeline/**', 'modules/*/android/**'],
  },
];
