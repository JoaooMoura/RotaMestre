import {distanciaMetros, PontoGeografico} from './geo';

export type Posicao = PontoGeografico & {
  precisaoM: number | null;
  velocidadeMs: number | null;
  rumoGraus: number | null;
  /** Instante da leitura, informado pelo provedor de localização (ms desde 1970). */
  registradaEm: number;
  /** Instante em que o app recebeu a leitura, pelo relógio do app (ms desde 1970). */
  recebidaEm: number;
};

export type LeituraBruta = Omit<Posicao, 'recebidaEm'>;

export type ModoColeta = 'emMovimento' | 'parado';

export const POLITICA_LOCALIZACAO = {
  intervaloMs: {emMovimento: 1000, parado: 10000},
  limiarParadoKmh: 2,
  limiarMovimentoKmh: 8,
  leiturasParaParar: 3,
  precisaoMaximaParaMovimentoM: 30,
  desatualizadaFator: 3,
  desatualizadaMinimaMs: 15000,
  semSinalMs: 60000,
  baixaPrecisaoM: 50,
} as const;

export type EstadoDoModo = {modo: ModoColeta; leiturasLentas: number};

export const ESTADO_INICIAL_DO_MODO: EstadoDoModo = {modo: 'emMovimento', leiturasLentas: 0};

export const msParaKmh = (metrosPorSegundo: number) => metrosPorSegundo * 3.6;

/**
 * Velocidade em km/h: a informada pelo GPS ou, na falta dela, a calculada entre duas leituras.
 * Devolve nulo quando não há como saber (nunca inventa um valor).
 */
export function velocidadeKmh(atual: LeituraBruta, anterior?: LeituraBruta | null): number | null {
  if (atual.velocidadeMs !== null && Number.isFinite(atual.velocidadeMs) && atual.velocidadeMs >= 0) {
    return msParaKmh(atual.velocidadeMs);
  }
  if (!anterior) {
    return null;
  }
  const segundos = (atual.registradaEm - anterior.registradaEm) / 1000;
  if (segundos < 0.5) {
    return null;
  }
  return msParaKmh(distanciaMetros(anterior, atual) / segundos);
}

/**
 * Decide o modo de coleta depois de uma leitura.
 * - Em movimento → parado: 3 leituras seguidas abaixo do limiar de parado.
 * - Parado → em movimento: 1 leitura acima do limiar de movimento, com precisão aceitável.
 * - Entre os dois limiares, mantém o modo atual (histerese).
 */
export function proximoModo(estado: EstadoDoModo, leitura: LeituraBruta, velocidade: number | null): EstadoDoModo {
  const {limiarParadoKmh, limiarMovimentoKmh, leiturasParaParar, precisaoMaximaParaMovimentoM} = POLITICA_LOCALIZACAO;
  if (velocidade === null) {
    return estado;
  }
  if (estado.modo === 'emMovimento') {
    if (velocidade >= limiarParadoKmh) {
      return estado.leiturasLentas === 0 ? estado : {modo: 'emMovimento', leiturasLentas: 0};
    }
    const leiturasLentas = estado.leiturasLentas + 1;
    return leiturasLentas >= leiturasParaParar
      ? {modo: 'parado', leiturasLentas: 0}
      : {modo: 'emMovimento', leiturasLentas};
  }
  const precisaoBoa = leitura.precisaoM === null || leitura.precisaoM <= precisaoMaximaParaMovimentoM;
  return velocidade >= limiarMovimentoKmh && precisaoBoa ? {modo: 'emMovimento', leiturasLentas: 0} : estado;
}

export const intervaloDoModo = (modo: ModoColeta) => POLITICA_LOCALIZACAO.intervaloMs[modo];

export const idadeMs = (posicao: Posicao, agora: number) => Math.max(0, agora - posicao.recebidaEm);

export function limiteDeDesatualizacaoMs(modo: ModoColeta) {
  const {desatualizadaFator, desatualizadaMinimaMs} = POLITICA_LOCALIZACAO;
  return Math.max(desatualizadaMinimaMs, desatualizadaFator * intervaloDoModo(modo));
}

export const estaDesatualizada = (posicao: Posicao, agora: number, modo: ModoColeta) =>
  idadeMs(posicao, agora) > limiteDeDesatualizacaoMs(modo);

export const temBaixaPrecisao = (posicao: Posicao) =>
  posicao.precisaoM !== null && posicao.precisaoM > POLITICA_LOCALIZACAO.baixaPrecisaoM;

export function descreverIdade(ms: number) {
  const segundos = Math.round(ms / 1000);
  if (segundos < 60) {
    return `${segundos} s`;
  }
  const minutos = Math.floor(segundos / 60);
  return minutos < 60 ? `${minutos} min` : `${Math.floor(minutos / 60)} h ${minutos % 60} min`;
}
