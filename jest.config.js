module.exports = {
  preset: '@react-native/jest-preset',
  testPathIgnorePatterns: ['/node_modules/', '/backend/'],
  moduleNameMapper: {'\\.(ttf|otf)$': '<rootDir>/__mocks__/arquivoEstatico.js'},
};
