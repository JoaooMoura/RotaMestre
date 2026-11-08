import {MotoristaNaFrota} from './tipos';

/**
 * Regras da frota no mapa (US03.04). Valores adotados pelo agente (ajuste se quiser):
 * - o motorista envia a posição a cada 15 s, no mínimo, andando 30 m ou mais; e a cada 60 s no máximo, mesmo parado;
 * - para o gestor, posição com mais de 150 s (2,5× o intervalo máximo) é "desatualizada";
 * - o gestor consulta a frota a cada 15 s enquanto a tela está aberta e o app, em primeiro plano.
 */
export const POLITICA_FROTA = {
  desatualizadaMs: 150_000,
  consultaMs: 15_000,
} as const;

export type SituacaoDaPosicao = 'atual' | 'desatualizada' | 'semPosicao';

export function situacaoDaPosicao(motorista: MotoristaNaFrota, idadeExtraMs = 0): SituacaoDaPosicao {
  if (!motorista.posicao) {
    return 'semPosicao';
  }
  return motorista.posicao.idadeMs + idadeExtraMs > POLITICA_FROTA.desatualizadaMs ? 'desatualizada' : 'atual';
}

/** "agora", "há 40 s", "há 5 min", "há 2 h 10 min". */
export function descreverIdadeDaPosicao(idadeMs: number): string {
  const segundos = Math.round(idadeMs / 1000);
  if (segundos < 10) {
    return 'agora';
  }
  if (segundos < 60) {
    return `há ${segundos} s`;
  }
  const minutos = Math.floor(segundos / 60);
  if (minutos < 60) {
    return `há ${minutos} min`;
  }
  const horas = Math.floor(minutos / 60);
  return `há ${horas} h${minutos % 60 ? ` ${minutos % 60} min` : ''}`;
}

export type DescricaoDaPosicao = {
  icone: 'crosshairs-gps' | 'clock-alert-outline' | 'crosshairs-off' | 'pause-circle-outline';
  texto: string;
  /** Aviso (laranja) em vez de normal. */
  aviso: boolean;
};

/** Ícone + texto (nunca só cor) da situação da localização de um motorista. */
export function descreverPosicaoDoMotorista(motorista: MotoristaNaFrota, idadeExtraMs = 0): DescricaoDaPosicao {
  const situacao = situacaoDaPosicao(motorista, idadeExtraMs);
  if (motorista.rota.status === 'Pausada') {
    return {icone: 'pause-circle-outline', texto: 'Rota pausada: localização não compartilhada', aviso: false};
  }
  if (situacao === 'semPosicao' || !motorista.posicao) {
    return {icone: 'crosshairs-off', texto: 'Sem localização recebida', aviso: true};
  }
  const idade = descreverIdadeDaPosicao(motorista.posicao.idadeMs + idadeExtraMs);
  return situacao === 'atual'
    ? {icone: 'crosshairs-gps', texto: `Localização ${idade}`, aviso: false}
    : {icone: 'clock-alert-outline', texto: `Localização desatualizada (${idade})`, aviso: true};
}

export function descreverAndamento(motorista: MotoristaNaFrota): string {
  const {total, encerradas, proxima} = motorista.paradas;
  const base = `${encerradas} de ${total} ${total === 1 ? 'parada' : 'paradas'}`;
  return proxima ? `${base} • próxima: ${proxima.destinatario}` : `${base} • sem paradas pendentes`;
}
