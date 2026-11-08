import {
  assinaturaDasParadas,
  EstadoDaAtualizacao,
  ESTADO_INICIAL_DA_ATUALIZACAO,
  ResultadoDaAtualizacao,
} from '../atualizacao';
import {PacoteOffline} from '../offline';
import {Rota, Sessao, Trajeto} from '../tipos';
import * as api from './api';
import {ArmazenamentoDeAtualizacao, armazenamentoDeAtualizacaoSeguro} from './armazenamentoAtualizacao';
import {armazenamentoOfflineSeguro} from './armazenamentoOffline';
import {armazenamentoSessaoSeguro} from './armazenamentoSessao';

export type DependenciasDoAtualizador = {
  sessao: {ler: () => Promise<Sessao | null>};
  api: {
    tokenEmUso: () => string | null;
    comToken: <T>(token: string, tarefa: () => Promise<T>) => Promise<T>;
    buscarRotaAtual: () => Promise<Rota | null>;
    obterTrajeto: (rotaId: string) => Promise<Trajeto>;
  };
  pacotes: {
    lerPacote: (usuarioId: string) => Promise<PacoteOffline | null>;
    salvarPacote: (pacote: PacoteOffline) => Promise<void>;
  };
  estado: ArmazenamentoDeAtualizacao;
  agora: () => number;
};

export const dependenciasDoAtualizadorPadrao: DependenciasDoAtualizador = {
  sessao: armazenamentoSessaoSeguro,
  api: {
    tokenEmUso: api.tokenEmUso,
    comToken: api.comToken,
    buscarRotaAtual: () => api.buscarRotaAtual(),
    obterTrajeto: api.obterTrajeto,
  },
  pacotes: armazenamentoOfflineSeguro,
  estado: armazenamentoDeAtualizacaoSeguro,
  agora: Date.now,
};

let emExecucao: Promise<EstadoDaAtualizacao> | null = null;

/**
 * Busca a programação atual no servidor e a mantém em dia no aparelho (US06.05). Roda em segundo plano (tarefa
 * agendada pelo Android) ou com o app aberto ("recuperar"). Regras:
 * - sem sessão guardada, expirada ou de outro usuário: não faz nada e registra o motivo;
 * - NUNCA mexe nas assinaturas pendentes nem em outros registros locais (eles têm armazenamento próprio e
 *   continuam sendo aplicados por cima da rota ao exibi-la);
 * - rota de outro id que a baixada: só avisa que há uma nova rota (o pacote baixado não é trocado);
 * - falha de rede não apaga nada; o próximo agendamento (ou a abertura do app) tenta de novo;
 * - duas chamadas ao mesmo tempo viram uma só.
 */
export function atualizarProgramacao(dependencias: DependenciasDoAtualizador = dependenciasDoAtualizadorPadrao): Promise<EstadoDaAtualizacao> {
  if (!emExecucao) {
    emExecucao = executar(dependencias).finally(() => {
      emExecucao = null;
    });
  }
  return emExecucao;
}

async function executar(d: DependenciasDoAtualizador): Promise<EstadoDaAtualizacao> {
  const agora = d.agora();
  const anterior = (await d.estado.ler().catch(() => null)) ?? ESTADO_INICIAL_DA_ATUALIZACAO;

  const registrar = async (
    resultado: ResultadoDaAtualizacao,
    parcial: Partial<EstadoDaAtualizacao> = {},
    sucesso = false,
  ): Promise<EstadoDaAtualizacao> => {
    const novo: EstadoDaAtualizacao = {
      ...anterior,
      ultimaTentativaEm: agora,
      ultimoSucessoEm: sucesso ? agora : anterior.ultimoSucessoEm,
      resultado,
      mudou: false,
      novaRota: null,
      trajetoDesatualizado: false,
      mensagem: null,
      execucoes: anterior.execucoes + 1,
      falhas: anterior.falhas + (resultado === 'falhou' ? 1 : 0),
      ...parcial,
    };
    await d.estado.salvar(novo).catch(() => {});
    return novo;
  };

  const sessao = await d.sessao.ler().catch(() => null);
  if (!sessao) {
    return registrar('semSessao');
  }
  if (sessao.expiraEm <= agora) {
    return registrar('sessaoExpirada');
  }
  if (sessao.usuario.papel !== 'motorista') {
    return registrar('naoAplicavel');
  }
  // Com o app aberto, a sessão da tela vale; se for de outra pessoa, a programação dela não é guardada aqui.
  const emUso = d.api.tokenEmUso();
  if (emUso !== null && emUso !== sessao.token) {
    return registrar('naoAplicavel');
  }

  let rota: Rota | null;
  let bytes = 0;
  try {
    rota = await d.api.comToken(sessao.token, () => d.api.buscarRotaAtual());
    bytes += rota ? JSON.stringify(rota).length : 0;
  } catch (falha) {
    if (falha instanceof api.ErroApi && falha.status === 401) {
      return registrar('sessaoExpirada');
    }
    const semConexao = falha instanceof api.ErroApi && falha.status === api.SEM_CONEXAO;
    return registrar('falhou', {mensagem: semConexao ? 'Sem conexão com o servidor.' : falha instanceof Error ? falha.message : 'Falha ao atualizar.'});
  }

  const contar = (extra = 0): Partial<EstadoDaAtualizacao> => ({bytesAprox: anterior.bytesAprox + bytes + extra});

  if (!rota) {
    return registrar('semRota', contar(), true);
  }
  if (rota.motoristaId !== sessao.usuario.id) {
    return registrar('naoAplicavel');
  }

  const pacote = await d.pacotes.lerPacote(sessao.usuario.id).catch(() => null);
  if (!pacote) {
    return registrar('semPacote', contar(), true);
  }
  if (pacote.rota.id !== rota.id) {
    return registrar('novaRota', {...contar(), mudou: true, novaRota: {id: rota.id, nome: rota.nome}}, true);
  }

  const mudou = JSON.stringify(rota) !== JSON.stringify(pacote.rota);
  if (!mudou) {
    return registrar('atualizada', contar(), true);
  }

  // A programação mudou: guarda a rota nova; o trajeto só é refeito se as paradas (ou suas coordenadas) mudaram.
  let trajeto = pacote.trajeto;
  let trajetoDesatualizado = false;
  let extra = 0;
  if (assinaturaDasParadas(rota) !== assinaturaDasParadas(pacote.rota)) {
    try {
      trajeto = await d.api.comToken(sessao.token, () => d.api.obterTrajeto(rota!.id));
      extra = JSON.stringify(trajeto).length;
    } catch {
      trajetoDesatualizado = true;
    }
  }
  try {
    await d.pacotes.salvarPacote({...pacote, rota, trajeto});
  } catch {
    return registrar('falhou', {mensagem: 'Não foi possível guardar a programação neste aparelho.'});
  }
  return registrar('atualizada', {...contar(extra), mudou: true, trajetoDesatualizado}, true);
}
