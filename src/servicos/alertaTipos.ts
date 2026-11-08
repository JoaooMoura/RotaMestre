export type TipoDeAlertaSonoro = 'aproximacao' | 'desvio' | 'velocidade';

/** Sinal físico dos alertas de navegação (vibração). A fala fica no serviço de voz. */
export type ServicoAlerta = {
  sinalizar: (tipo: TipoDeAlertaSonoro) => void;
};

/** Não faz nada: usado em telas isoladas e testes. */
export const servicoAlertaNulo: ServicoAlerta = {sinalizar: () => {}};
