/** Agenda a atualização periódica da programação (WorkManager/JobScheduler do Android). */
export type AgendadorDeAtualizacao = {
  /** Liga o agendamento; `aoExecutar` roda a cada disparo. Devolve se o sistema aceitou agendar. */
  iniciar: (aoExecutar: () => Promise<unknown>) => Promise<boolean>;
  parar: () => Promise<void>;
};

/** Não agenda nada: telas isoladas e testes. */
export const agendadorNulo: AgendadorDeAtualizacao = {
  iniciar: async () => false,
  parar: async () => {},
};
