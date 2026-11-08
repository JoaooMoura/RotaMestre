import {POLITICA_NAVEGACAO, PlanoDeNavegacao} from './navegacao';
import {ParadaNoMapa} from './tipos';

export const POLITICA_PREVISAO = {
  /** Tempo de serviço por parada (PV08): descarregar, coletar assinatura. */
  servicoPorParadaS: 180,
} as const;

export type PrevisaoDeParada = {
  paradaId: string;
  /** Posição na rota, começando em 1. */
  numero: number;
  destinatario: string;
  /** Instante previsto de chegada, em ms; `null` quando o trajeto não permite estimar. */
  chegadaEm: number | null;
  /** Distância que falta, pela rota, até a parada. */
  distanciaM: number;
};

/** Distância, ao longo da rota, em que cada parada fica (a primeira é o início do trajeto). */
function posicoesDasParadas(plano: PlanoDeNavegacao, quantidade: number): (number | null)[] {
  const posicoes: (number | null)[] = [0];
  for (let i = 1; i < quantidade; i++) {
    const chegada = plano.manobras.find(m => m.tipo === 'arrive' && m.perna === i - 1);
    posicoes.push(chegada ? chegada.posicaoM : null);
  }
  return posicoes;
}

/**
 * Previsão de chegada às paradas ainda não concluídas (PV08): distância pela rota dividida pela
 * velocidade média do trajeto, mais 3 min de serviço em cada parada anterior que ainda será atendida.
 * Não considera trânsito. Reavalia-se com novo `progressoM`, `agora` ou trajeto (recálculo).
 */
export function calcularPrevisoes(
  plano: PlanoDeNavegacao,
  paradas: ParadaNoMapa[],
  progressoM: number,
  agora: number,
): PrevisaoDeParada[] {
  const posicoes = posicoesDasParadas(plano, paradas.length);
  const velocidadeMs = plano.duracaoS > 0 ? plano.totalM / plano.duracaoS : 0;
  const previsoes: PrevisaoDeParada[] = [];
  let servicosAntes = 0;

  paradas.forEach((parada, indice) => {
    if (parada.status === 'Concluída') {
      return;
    }
    const posicao = posicoes[indice];
    if (posicao === null || velocidadeMs <= 0) {
      previsoes.push({paradaId: parada.id, numero: parada.numero ?? indice + 1, destinatario: parada.destinatario, chegadaEm: null, distanciaM: 0});
      return;
    }
    // Parada que ficou para trás sem ser concluída não será atendida no caminho: não soma serviço.
    const aindaSeraAtendida = posicao >= progressoM - POLITICA_NAVEGACAO.chegadaM;
    const distanciaM = Math.max(0, posicao - progressoM);
    const viagemS = distanciaM / velocidadeMs;
    previsoes.push({
      paradaId: parada.id,
      numero: parada.numero ?? indice + 1,
      destinatario: parada.destinatario,
      chegadaEm: agora + (viagemS + servicosAntes * POLITICA_PREVISAO.servicoPorParadaS) * 1000,
      distanciaM,
    });
    if (aindaSeraAtendida) {
      servicosAntes++;
    }
  });
  return previsoes;
}

export function formatarHorario(instante: number): string {
  const data = new Date(instante);
  const dois = (n: number) => String(n).padStart(2, '0');
  return `${dois(data.getHours())}:${dois(data.getMinutes())}`;
}
