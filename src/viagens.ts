import {distanciaMetros} from './geo';
import {Coordenada} from './tipos';

/**
 * Registro do trajeto percorrido (US09.02). Fica só no aparelho (armazenamento cifrado). Valores adotados
 * pelo agente (ajuste se quiser):
 * - um ponto novo a cada 20 m andados (mais o primeiro e o último da viagem);
 * - leitura com precisão pior que 50 m não é gravada;
 * - passou mais de 120 s sem leitura aceita = LACUNA: o ponto seguinte começa um novo trecho (a reprodução
 *   não liga os dois com uma linha e a viagem conta a lacuna; nunca se inventam pontos no meio);
 * - o que está na memória vai para o armazenamento a cada 20 pontos ou 30 s;
 * - no máximo 5000 pontos por viagem e 10 viagens por motorista (as mais antigas saem).
 */
export const POLITICA_REGISTRO = {
  distanciaMinimaM: 20,
  precisaoMaximaM: 50,
  lacunaMs: 120_000,
  descarregarACadaPontos: 20,
  descarregarACadaMs: 30_000,
  maximoDePontos: 5000,
  maximoDeViagens: 10,
} as const;

/** Um ponto gravado: lat, lon, instante da leitura (ms), precisão (m) e se começa depois de uma lacuna. */
export type PontoRegistrado = {la: number; lo: number; t: number; p: number | null; g?: 1};

export type ResumoDaViagem = {
  id: string;
  usuarioId: string;
  rotaId: string;
  rotaNome: string;
  iniciadaEm: number;
  /** Nulo enquanto a viagem está em andamento (ou foi interrompida sem fechar). */
  encerradaEm: number | null;
  ultimoPontoEm: number | null;
  pontos: number;
  lacunas: number;
  distanciaM: number;
  /** Quantos blocos de pontos estão gravados. */
  segmentos: number;
  /** A gravação parou por chegar ao limite de pontos. */
  cheia?: boolean;
};

export function deveGravar(ultimo: PontoRegistrado | null, leitura: {latitude: number; longitude: number}): boolean {
  if (!ultimo) {
    return true;
  }
  return distanciaMetros({latitude: ultimo.la, longitude: ultimo.lo}, leitura) >= POLITICA_REGISTRO.distanciaMinimaM;
}

/** Trechos contínuos, cortados onde há lacuna. Dois trechos nunca se ligam por uma linha. */
export function trechosDoTrajeto(pontos: PontoRegistrado[]): Coordenada[][] {
  const trechos: Coordenada[][] = [];
  for (const ponto of pontos) {
    if (trechos.length === 0 || ponto.g === 1) {
      trechos.push([]);
    }
    trechos[trechos.length - 1].push([ponto.lo, ponto.la]);
  }
  return trechos;
}

export function duracaoDaViagemMs(resumo: Pick<ResumoDaViagem, 'iniciadaEm' | 'encerradaEm' | 'ultimoPontoEm'>): number {
  const fim = resumo.encerradaEm ?? resumo.ultimoPontoEm ?? resumo.iniciadaEm;
  return Math.max(0, fim - resumo.iniciadaEm);
}

export function formatarDuracaoCurta(ms: number): string {
  const minutos = Math.round(ms / 60_000);
  if (minutos < 1) {
    return 'menos de 1 min';
  }
  if (minutos < 60) {
    return `${minutos} min`;
  }
  return `${Math.floor(minutos / 60)} h${minutos % 60 ? ` ${minutos % 60} min` : ''}`;
}

export function formatarDistanciaViagem(metros: number): string {
  return metros < 1000 ? `${Math.round(metros)} m` : `${(metros / 1000).toFixed(1).replace('.', ',')} km`;
}

const dois = (n: number) => String(n).padStart(2, '0');

export function formatarDataHora(instante: number): string {
  const d = new Date(instante);
  return `${dois(d.getDate())}/${dois(d.getMonth() + 1)} ${dois(d.getHours())}:${dois(d.getMinutes())}`;
}

export function formatarHoraCompleta(instante: number): string {
  const d = new Date(instante);
  return `${dois(d.getHours())}:${dois(d.getMinutes())}:${dois(d.getSeconds())}`;
}

/** "2 lacunas sem localização" / "sem lacunas". */
export function descreverLacunas(lacunas: number): string {
  if (lacunas === 0) {
    return 'sem lacunas de localização';
  }
  return `${lacunas} ${lacunas === 1 ? 'lacuna' : 'lacunas'} sem localização`;
}

export function validarResumo(dados: unknown): dados is ResumoDaViagem {
  const r = dados as Partial<ResumoDaViagem> | null;
  return (
    !!r &&
    typeof r.id === 'string' &&
    typeof r.usuarioId === 'string' &&
    typeof r.rotaId === 'string' &&
    typeof r.rotaNome === 'string' &&
    typeof r.iniciadaEm === 'number' &&
    (r.encerradaEm === null || typeof r.encerradaEm === 'number') &&
    (r.ultimoPontoEm === null || typeof r.ultimoPontoEm === 'number') &&
    Number.isInteger(r.pontos) &&
    Number.isInteger(r.lacunas) &&
    typeof r.distanciaM === 'number' &&
    Number.isInteger(r.segmentos)
  );
}

export function validarPontos(dados: unknown): dados is PontoRegistrado[] {
  return (
    Array.isArray(dados) &&
    dados.every(
      p =>
        p &&
        Number.isFinite(p.la) &&
        Number.isFinite(p.lo) &&
        Math.abs(p.la) <= 90 &&
        Math.abs(p.lo) <= 180 &&
        Number.isFinite(p.t) &&
        (p.p === null || Number.isFinite(p.p)) &&
        (p.g === undefined || p.g === 1),
    )
  );
}

/** Passo da reprodução: espera (ms) até o próximo ponto, comprimindo o tempo real. */
export function atrasoDoPasso(atual: PontoRegistrado, proximo: PontoRegistrado, velocidade: number): number {
  if (proximo.g === 1) {
    return 500; // lacuna: salta, sem fingir deslocamento
  }
  // No mínimo 80 ms por passo: o mapa não precisa redesenhar mais de ~12 vezes por segundo.
  return Math.min(800, Math.max(80, (proximo.t - atual.t) / velocidade));
}
