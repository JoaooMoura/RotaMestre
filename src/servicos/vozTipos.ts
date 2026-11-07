export type DisponibilidadeDaVoz = 'disponivel' | 'semPortugues' | 'indisponivel';

export type OpcoesDeFala = {
  /** Interrompe o que estiver sendo falado (manobra iminente). */
  interromper?: boolean;
};

export type ServicoVoz = {
  verificarDisponibilidade: () => Promise<DisponibilidadeDaVoz>;
  falar: (texto: string, opcoes?: OpcoesDeFala) => Promise<void>;
  parar: () => Promise<void>;
  /** Abre a tela do Android para baixar vozes (quando não há voz em português). */
  instalarVozes: () => Promise<void>;
};

/** Voz que não fala: usada quando nenhum serviço de voz foi fornecido (telas isoladas e testes). */
export const servicoVozNulo: ServicoVoz = {
  verificarDisponibilidade: async () => 'disponivel',
  falar: async () => {},
  parar: async () => {},
  instalarVozes: async () => {},
};
