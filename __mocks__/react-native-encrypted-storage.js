const itens = new Map();

module.exports = {
  __esModule: true,
  default: {
    setItem: jest.fn(async (chave, valor) => {
      itens.set(chave, valor);
    }),
    getItem: jest.fn(async chave => (itens.has(chave) ? itens.get(chave) : null)),
    removeItem: jest.fn(async chave => {
      itens.delete(chave);
    }),
    clear: jest.fn(async () => itens.clear()),
  },
};
