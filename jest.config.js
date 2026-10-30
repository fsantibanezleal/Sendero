/** Jest: jest-expo preset; tests live next to the code in __tests__ folders. */
module.exports = {
  preset: 'jest-expo',
  testMatch: ['**/__tests__/**/*.test.ts?(x)'],
  testPathIgnorePatterns: ['/node_modules/', '/android/', '/pipeline/'],
  clearMocks: true,
};
