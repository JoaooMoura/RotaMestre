import {GuiaDeNavegacao, PlanoDeNavegacao} from './navegacao';

/**
 * Alertas de navegação (US05.05). Valores de PV07 adotados pelo agente (ajuste se quiser):
 * - excesso: velocidade acima do limite + 5 km/h em 3 leituras seguidas, com precisão de até 30 m;
 * - liberação: 3 leituras seguidas dentro do limite;
 * - repetição do aviso falado, se o excesso continuar: a cada 60 s.
 * O limite só vem de fonte validada (maxspeed explícito do OpenStreetMap). Sem ele, nada é estimado.
 */
export const POLITICA_ALERTAS = {
  toleranciaKmh: 5,
  leiturasParaAlertar: 3,
  leiturasParaLiberar: 3,
  precisaoMaximaM: 30,
  repeticaoMs: 60_000,
  aproximacaoM: 300,
} as const;

export type InfoDeVelocidade = {
  /** Velocidade observada; nula quando não há como saber. */
  kmh: number | null;
  /** Limite validado do trecho; nulo quando indisponível (nunca estimado). */
  limiteKmh: number | null;
  excesso: boolean;
};

export const SEM_VELOCIDADE: InfoDeVelocidade = {kmh: null, limiteKmh: null, excesso: false};

export type EstadoDaVelocidade = {excesso: boolean; leiturasAcima: number; leiturasDentro: number; ultimoAlertaEm: number | null};

export const ESTADO_INICIAL_DA_VELOCIDADE: EstadoDaVelocidade = {excesso: false, leiturasAcima: 0, leiturasDentro: 0, ultimoAlertaEm: null};

export type LeituraDeVelocidade = {
  kmh: number | null;
  limiteKmh: number | null;
  precisaoM: number | null;
  agora: number;
};

/** Limite validado no ponto `progressoM` da rota, ou `null` quando o trecho não tem limite conhecido. */
export function limiteEm(plano: PlanoDeNavegacao, progressoM: number): number | null {
  let limite: number | null = null;
  for (const trecho of plano.limites) {
    if (trecho.deM > progressoM) {
      break;
    }
    limite = trecho.kmh;
  }
  return limite;
}

export function avaliarVelocidade(
  anterior: EstadoDaVelocidade,
  leitura: LeituraDeVelocidade,
): {estado: EstadoDaVelocidade; info: InfoDeVelocidade; alertar: boolean} {
  const {toleranciaKmh, leiturasParaAlertar, leiturasParaLiberar, precisaoMaximaM, repeticaoMs} = POLITICA_ALERTAS;
  const {kmh, limiteKmh, precisaoM, agora} = leitura;

  // Sem limite validado: nenhum alerta e nenhum valor estimado no lugar.
  if (limiteKmh === null) {
    return {estado: ESTADO_INICIAL_DA_VELOCIDADE, info: {kmh, limiteKmh: null, excesso: false}, alertar: false};
  }
  // Sem velocidade ou com precisão ruim a leitura não decide nada (o estado anterior vale).
  if (kmh === null || (precisaoM !== null && precisaoM > precisaoMaximaM)) {
    return {estado: anterior, info: {kmh, limiteKmh, excesso: anterior.excesso}, alertar: false};
  }

  let estado = anterior;
  let alertar = false;
  if (kmh > limiteKmh + toleranciaKmh) {
    estado = {...anterior, leiturasAcima: anterior.leiturasAcima + 1, leiturasDentro: 0};
    if (!estado.excesso && estado.leiturasAcima >= leiturasParaAlertar) {
      estado = {...estado, excesso: true, ultimoAlertaEm: agora};
      alertar = true;
    } else if (estado.excesso && estado.ultimoAlertaEm !== null && agora - estado.ultimoAlertaEm >= repeticaoMs) {
      estado = {...estado, ultimoAlertaEm: agora};
      alertar = true;
    }
  } else if (kmh <= limiteKmh) {
    estado = {...anterior, leiturasAcima: 0, leiturasDentro: anterior.leiturasDentro + 1};
    if (estado.excesso && estado.leiturasDentro >= leiturasParaLiberar) {
      estado = ESTADO_INICIAL_DA_VELOCIDADE;
    }
  } else {
    // Entre o limite e a tolerância: não conta como excesso novo e não libera o excesso em curso.
    estado = {...anterior, leiturasAcima: 0, leiturasDentro: 0};
  }
  return {estado, info: {kmh, limiteKmh, excesso: estado.excesso}, alertar};
}

export type AlertaDeAproximacao = {titulo: string; distanciaM: number; final: boolean};

/** Aviso visual de que a parada (ou o destino final) está a menos de 300 m. */
export function alertaDeAproximacao(guia: GuiaDeNavegacao | null): AlertaDeAproximacao | null {
  const manobra = guia?.manobra;
  if (!guia || !manobra || manobra.tipo !== 'arrive' || guia.chegou || guia.foraDaRota) {
    return null;
  }
  if (guia.distanciaAteManobraM > POLITICA_ALERTAS.aproximacaoM) {
    return null;
  }
  const final = manobra.contexto.destinoFinal !== false;
  const numero = manobra.contexto.numeroDaParada;
  return {
    titulo: final ? 'Chegando ao destino' : numero ? `Chegando à parada ${numero}` : 'Chegando à parada',
    distanciaM: guia.distanciaAteManobraM,
    final,
  };
}

export function textoDoExcesso(info: InfoDeVelocidade): string {
  return `Velocidade acima do limite de ${info.limiteKmh} quilômetros por hora.`;
}
