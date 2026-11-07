/** Controle da tela do aparelho (manter acesa durante a navegação). */
export type ServicoTela = {
  /** Impede que a tela apague. Deve ser desfeito com `liberar`. */
  manterAcesa: () => void;
  /** Devolve o controle da tela ao sistema. */
  liberar: () => void;
};

/** Não faz nada: usado em telas isoladas e testes. */
export const servicoTelaNulo: ServicoTela = {
  manterAcesa: () => {},
  liberar: () => {},
};
