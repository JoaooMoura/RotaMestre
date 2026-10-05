module.exports = {
  preset: '@react-native/jest-preset',
  testPathIgnorePatterns: ['/node_modules/', '/backend/'],
  // Fontes (ex.: ícones MaterialDesignIcons) não são JS; nos testes viram um stub.
  moduleNameMapper: {'\\.(ttf|otf)$': '<rootDir>/__mocks__/arquivoEstatico.js'},
};
