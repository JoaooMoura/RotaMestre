import {Rota} from './tipos';

/**
 * Atualização da programação em segundo plano (US06.05). Valores adotados pelo agente (ajuste se quiser):
 * - o Android agenda a tarefa a cada 15 min (o mínimo permitido); ele pode adiar (economia de bateria, Soneca);
 * - só roda com rede e sessão guardada ("Manter conectado neste aparelho");
 * - se a atualização não aconteceu, é recuperada ao abrir o app ou voltar a ele: mais de 30 min sem sucesso,
 *   ou última tentativa com falha há mais de 2 min;
 * - cada execução baixa só a rota atual (poucos KB); o trajeto só é baixado de novo se as paradas mudaram.
 */
export const POLITICA_ATUALIZACAO = {
  intervaloDoAgendadorMin: 15,
  recuperarAposMs: 30 * 60_000,
  novaTentativaAposFalhaMs: 2 * 60_000,
} as const;

export type ResultadoDaAtualizacao =
  | 'atualizada'
  | 'novaRota'
  | 'semRota'
  | 'semPacote'
  | 'semSessao'
  | 'sessaoExpirada'
  | 'naoAplicavel'
  | 'falhou';

export type EstadoDaAtualizacao = {
  ultimaTentativaEm: number;
  /** Última vez que o servidor respondeu e a programação local ficou em dia. */
  ultimoSucessoEm: number | null;
  resultado: ResultadoDaAtualizacao;
  /** A programação mudou nesta atualização (rota ou paradas diferentes das que estavam no aparelho). */
  mudou: boolean;
  /** O servidor tem uma rota diferente da baixada: é preciso abrir e baixar de novo para usar sem internet. */
  novaRota: {id: string; nome: string} | null;
  /** O trajeto não pôde ser atualizado depois de a programação mudar: o mapa pode estar desatualizado. */
  trajetoDesatualizado: boolean;
  mensagem: string | null;
  /** Contadores desde a instalação, para medir periodicidade e consumo (ensaio de campo). */
  execucoes: number;
  falhas: number;
  bytesAprox: number;
};

export const ESTADO_INICIAL_DA_ATUALIZACAO: EstadoDaAtualizacao = {
  ultimaTentativaEm: 0,
  ultimoSucessoEm: null,
  resultado: 'semRota',
  mudou: false,
  novaRota: null,
  trajetoDesatualizado: false,
  mensagem: null,
  execucoes: 0,
  falhas: 0,
  bytesAprox: 0,
};

/** Identifica as paradas e suas coordenadas, na ordem: se mudar, o trajeto guardado deixa de valer. */
export function assinaturaDasParadas(rota: Rota): string {
  return JSON.stringify(rota.paradas.map(p => [p.id, p.latitude ?? null, p.longitude ?? null]));
}

export function deveRecuperar(estado: EstadoDaAtualizacao | null, agora: number): boolean {
  if (!estado || estado.ultimoSucessoEm === null) {
    return true;
  }
  if (agora - estado.ultimoSucessoEm > POLITICA_ATUALIZACAO.recuperarAposMs) {
    return true;
  }
  return estado.resultado === 'falhou' && agora - estado.ultimaTentativaEm > POLITICA_ATUALIZACAO.novaTentativaAposFalhaMs;
}

const dois = (n: number) => String(n).padStart(2, '0');

export function descreverAtualizacao(estado: EstadoDaAtualizacao | null): string | null {
  if (!estado) {
    return null;
  }
  if (estado.resultado === 'semSessao') {
    return 'Atualização em segundo plano desligada: entre com "Manter conectado neste aparelho" para ativá-la.';
  }
  if (estado.resultado === 'sessaoExpirada') {
    return 'Atualização em segundo plano pausada: entre de novo na sua conta.';
  }
  if (estado.ultimoSucessoEm === null) {
    return estado.resultado === 'falhou' ? 'Ainda não foi possível atualizar a programação em segundo plano.' : null;
  }
  const d = new Date(estado.ultimoSucessoEm);
  const hora = `${dois(d.getHours())}:${dois(d.getMinutes())}`;
  return estado.resultado === 'falhou'
    ? `Última atualização da programação: ${hora}. A tentativa mais recente falhou e será refeita.`
    : `Programação atualizada às ${hora}.`;
}

export function validarEstadoDaAtualizacao(dados: unknown): dados is EstadoDaAtualizacao {
  const e = dados as Partial<EstadoDaAtualizacao> | null;
  return (
    !!e &&
    typeof e.ultimaTentativaEm === 'number' &&
    (e.ultimoSucessoEm === null || typeof e.ultimoSucessoEm === 'number') &&
    typeof e.resultado === 'string' &&
    typeof e.mudou === 'boolean' &&
    (e.novaRota === null || (typeof e.novaRota?.id === 'string' && typeof e.novaRota?.nome === 'string')) &&
    typeof e.execucoes === 'number' &&
    typeof e.falhas === 'number' &&
    typeof e.bytesAprox === 'number'
  );
}
