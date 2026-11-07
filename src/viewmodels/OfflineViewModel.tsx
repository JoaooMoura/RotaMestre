import React, {createContext, useCallback, useContext, useEffect, useMemo, useRef, useState} from 'react';
import {AppState} from 'react-native';
import {aplicarConfirmacaoNoPacote, esperaAteNovaTentativaMs, Pendencia, PacoteOffline, planejarRegiao} from '../offline';
import {MotivoDaParada, ResumoDaSincronizacao, sincronizarPendencias} from '../sincronizacao';
import * as api from '../servicos/api';
import {ArmazenamentoOffline, armazenamentoOfflineSeguro} from '../servicos/armazenamentoOffline';
import {ServicoMapaOffline, servicoMapaOfflineNativo} from '../servicos/servicoMapaOffline';
import {Rota, Trajeto, Usuario} from '../tipos';

export type DependenciasOffline = {
  armazenamento: ArmazenamentoOffline;
  mapa: ServicoMapaOffline;
  rotas: {
    buscarRotaAtual: () => Promise<Rota | null>;
    obterTrajeto: (rotaId: string) => Promise<Trajeto>;
  };
  agora: () => number;
  enviar: typeof api.enviarComprovante;
  /** Avisa quando o app volta para a tela (true) ou sai dela (false). */
  observarAppState: (aoMudar: (naTela: boolean) => void) => () => void;
};

export const dependenciasOfflinePadrao: DependenciasOffline = {
  armazenamento: armazenamentoOfflineSeguro,
  mapa: servicoMapaOfflineNativo,
  rotas: {buscarRotaAtual: () => api.buscarRotaAtual(), obterTrajeto: api.obterTrajeto},
  agora: Date.now,
  enviar: api.enviarComprovante,
  observarAppState: aoMudar => {
    const assinatura = AppState.addEventListener('change', estado => aoMudar(estado === 'active'));
    return () => assinatura.remove();
  },
};

/**
 * - `nenhum`: nada baixado.
 * - `completo`: rota e mapa guardados e conferidos agora.
 * - `incompleto`: há dados da rota, mas o pacote de mapa não está mais no aparelho (por exemplo, o sistema limpou).
 */
export type SituacaoDoPacote = 'verificando' | 'nenhum' | 'completo' | 'incompleto';

export type EstadoDoDownload =
  | {tipo: 'ocioso'}
  | {tipo: 'baixando'; etapa: 'rota' | 'mapa'; percentual: number}
  | {tipo: 'interrompido'; mensagem: string};

export type EstadoDoEnvio =
  | {tipo: 'ocioso'}
  | {tipo: 'enviando'}
  /** Há o que enviar, mas a última tentativa não passou; `parou` diz por quê. */
  | {tipo: 'aguardando'; parou: Exclude<MotivoDaParada, 'concluida' | 'cancelada'>};

/** Assinatura que o servidor acabou de confirmar (mostrada até o motorista dispensar). */
export type Confirmacao = {id: string; destinatario: string; confirmadaEm: number};

export type OfflineViewModel = {
  /** O app está mostrando a rota baixada porque não há conexão com o servidor (definido por quem monta o provedor). */
  semConexao: boolean;
  /** A rota baixada foi aberta sem entrar na conta (nada vai ao servidor até entrar). */
  semSessao: boolean;
  /** Sem sessão guardada neste aparelho: só ver rota, mapa e navegar (não coleta assinatura). */
  somenteLeitura: boolean;
  situacao: SituacaoDoPacote;
  pacote: PacoteOffline | null;
  download: EstadoDoDownload;
  baixar: () => Promise<void>;
  cancelar: () => void;
  /** Assinaturas coletadas sem rede deste usuário, ainda não aceitas pelo servidor. */
  pendencias: Pendencia[];
  /** Guarda a pendência no armazenamento cifrado e só então a mostra; falha se não conseguiu guardar. */
  registrarPendencia: (pendencia: Pendencia) => Promise<void>;
  envio: EstadoDoEnvio;
  confirmacoes: Confirmacao[];
  /** Quantas pendências já tiveram um desfecho do servidor (confirmada ou rejeitada) nesta sessão. */
  desfechos: number;
  enviarAgora: () => Promise<ResumoDaSincronizacao | null>;
  /** Descarta uma assinatura REJEITADA (decisão explícita do motorista); nunca descarta as pendentes. */
  descartarPendencia: (id: string) => Promise<void>;
  dispensarConfirmacao: (id: string) => void;
};

export type OpcoesDoOffline = {
  /** Há login válido: só então dá para enviar ao servidor. */
  sessaoAtiva?: boolean;
};

const MENSAGEM_REGIAO_GRANDE = 'A região desta rota é grande demais para baixar o mapa. Fale com o gestor.';

export function useOfflineViewModel(
  usuario: Usuario | null,
  dependencias: DependenciasOffline = dependenciasOfflinePadrao,
  opcoes: OpcoesDoOffline = {},
): OfflineViewModel {
  const {armazenamento, mapa, rotas, agora, enviar, observarAppState} = dependencias;
  const sessaoAtiva = opcoes.sessaoAtiva ?? true;
  const [pacote, setPacote] = useState<PacoteOffline | null>(null);
  const [situacao, setSituacao] = useState<SituacaoDoPacote>('verificando');
  const [download, setDownload] = useState<EstadoDoDownload>({tipo: 'ocioso'});
  const [pendencias, setPendencias] = useState<Pendencia[]>([]);
  const [envio, setEnvio] = useState<EstadoDoEnvio>({tipo: 'ocioso'});
  const [confirmacoes, setConfirmacoes] = useState<Confirmacao[]>([]);
  const [desfechos, setDesfechos] = useState(0);
  const enviandoAgora = useRef(false);
  const falhasSeguidas = useRef(0);
  const geracao = useRef(0);
  const sinal = useRef<{cancelado: boolean} | null>(null);
  const baixandoAgora = useRef(false);
  const motorista = usuario?.papel === 'motorista' ? usuario : null;
  const motoristaId = motorista?.id ?? null;

  // Ao entrar (e ao trocar de usuário): confere o que há no aparelho. "Completo" exige o mapa de fato presente.
  useEffect(() => {
    const minha = ++geracao.current;
    sinal.current = {cancelado: true};
    baixandoAgora.current = false;
    enviandoAgora.current = false;
    setDownload({tipo: 'ocioso'});
    setPacote(null);
    setPendencias([]);
    if (!motoristaId) {
      setSituacao('nenhum');
      return;
    }
    setSituacao('verificando');
    armazenamento
      .listarPendencias()
      .then(async todas => {
        const minhas = todas.filter(p => p.usuarioId === motoristaId);
        // Um envio que o app deixou "enviando" (fechou no meio) volta a pendente; o servidor reconhece o id e não duplica.
        const normalizadas = await Promise.all(
          minhas.map(async p => {
            if (p.status !== 'enviando') {
              return p;
            }
            const volta: Pendencia = {...p, status: 'pendente'};
            await armazenamento.salvarPendencia(volta).catch(() => {});
            return volta;
          }),
        );
        if (minha === geracao.current) {
          setPendencias(normalizadas);
          setConfirmacoes([]);
          setEnvio({tipo: 'ocioso'});
          setDesfechos(0);
          falhasSeguidas.current = 0;
        }
      })
      .catch(() => {});
    (async () => {
      const guardado = await armazenamento.lerPacote(motoristaId).catch(() => null);
      if (minha !== geracao.current) {
        return;
      }
      // Restos de um download que o sistema interrompeu (app fechado no meio) não ficam ocupando espaço.
      mapa.limparOrfaos(guardado ? [guardado.mapa.packId] : []).catch(() => {});
      if (!guardado) {
        setSituacao('nenhum');
        return;
      }
      const mapaPresente = await mapa.disponivel(guardado.mapa.packId);
      if (minha !== geracao.current) {
        return;
      }
      setPacote(guardado);
      setSituacao(mapaPresente ? 'completo' : 'incompleto');
    })();
  }, [motoristaId, armazenamento, mapa]);

  const baixar = useCallback(async () => {
    // O toque duplo não pode iniciar dois downloads: a guarda é uma referência, não o estado (que atrasa).
    if (!motorista || sinal.current === null || baixandoAgora.current) {
      return;
    }
    baixandoAgora.current = true;
    const minha = geracao.current;
    const meuSinal = {cancelado: false};
    sinal.current = meuSinal;
    const aindaValido = () => minha === geracao.current && !meuSinal.cancelado;
    let novoPackId: string | null = null;

    try {
      setDownload({tipo: 'baixando', etapa: 'rota', percentual: 0});
      const rota = await rotas.buscarRotaAtual();
      if (!rota) {
        throw new Error('Você não tem uma rota atribuída para baixar.');
      }
      const trajeto = await rotas.obterTrajeto(rota.id);
      const regiao = planejarRegiao(trajeto);
      if (!regiao) {
        throw new Error(MENSAGEM_REGIAO_GRANDE);
      }
      if (!aindaValido()) {
        return;
      }

      setDownload({tipo: 'baixando', etapa: 'mapa', percentual: 0});
      novoPackId = await mapa.baixar(
        {rotaId: rota.id, limites: regiao.limites, minZoom: regiao.minZoom, maxZoom: regiao.maxZoom},
        percentual => aindaValido() && setDownload({tipo: 'baixando', etapa: 'mapa', percentual}),
        meuSinal,
      );
      if (!aindaValido()) {
        await mapa.remover(novoPackId);
        return;
      }

      // Só agora, com o mapa inteiro no aparelho, a versão nova substitui a anterior.
      const anterior = await armazenamento.lerPacote(motorista.id).catch(() => null);
      const novo: PacoteOffline = {
        versao: 1,
        usuario: motorista,
        rota,
        trajeto,
        baixadoEm: agora(),
        mapa: {packId: novoPackId, limites: regiao.limites, minZoom: regiao.minZoom, maxZoom: regiao.maxZoom},
      };
      await armazenamento.salvarPacote(novo);
      if (anterior && anterior.mapa.packId !== novoPackId) {
        await mapa.remover(anterior.mapa.packId);
      }
      if (minha === geracao.current) {
        setPacote(novo);
        setSituacao('completo');
        setDownload({tipo: 'ocioso'});
      }
    } catch (falha) {
      if (novoPackId) {
        // O mapa novo chegou, mas guardar falhou: não deixa o pacote órfão ocupando espaço.
        await mapa.remover(novoPackId);
      }
      if (minha === geracao.current && !meuSinal.cancelado) {
        setDownload({tipo: 'interrompido', mensagem: mensagemDaFalha(falha)});
      } else if (minha === geracao.current) {
        setDownload({tipo: 'ocioso'});
      }
    } finally {
      if (minha === geracao.current) {
        baixandoAgora.current = false;
      }
    }
  }, [motorista, rotas, mapa, armazenamento, agora]);

  const cancelar = useCallback(() => {
    if (sinal.current) {
      sinal.current.cancelado = true;
    }
  }, []);

  const guardarEmEstado = useCallback((pendencia: Pendencia) => {
    setPendencias(atual => [...atual.filter(p => p.id !== pendencia.id), pendencia].sort((a, b) => a.coletadoEm - b.coletadoEm));
  }, []);

  /** Envia o que está pendente; seguro de repetir (o servidor reconhece o id do envio). */
  const enviarAgora = useCallback(async (): Promise<ResumoDaSincronizacao | null> => {
    if (!motoristaId || !sessaoAtiva || enviandoAgora.current) {
      return null;
    }
    const minha = geracao.current;
    enviandoAgora.current = true;
    setEnvio({tipo: 'enviando'});
    try {
      const todas = (await armazenamento.listarPendencias()).filter(p => p.usuarioId === motoristaId);
      const resumo = await sincronizarPendencias(todas, {
        enviar,
        cancelado: () => minha !== geracao.current,
        salvar: async pendencia => {
          await armazenamento.salvarPendencia(pendencia);
          if (minha === geracao.current) {
            guardarEmEstado(pendencia);
          }
        },
        remover: async id => {
          await armazenamento.removerPendencia(id);
          if (minha === geracao.current) {
            setPendencias(atual => atual.filter(p => p.id !== id));
          }
        },
        aoConfirmar: async (pendencia, resposta) => {
          if (minha !== geracao.current) {
            return;
          }
          setConfirmacoes(atual => [{id: pendencia.id, destinatario: pendencia.destinatario, confirmadaEm: agora()}, ...atual].slice(0, 3));
          setDesfechos(n => n + 1);
          // O pacote baixado passa a refletir a entrega confirmada (senão reabriria "pendente" sem rede).
          const guardado = await armazenamento.lerPacote(motoristaId);
          if (guardado && guardado.rota.id === pendencia.rotaId) {
            const atualizado = aplicarConfirmacaoNoPacote(guardado, pendencia, resposta);
            await armazenamento.salvarPacote(atualizado);
            setPacote(atualizado);
          }
        },
        aoRejeitar: () => {
          if (minha === geracao.current) {
            setDesfechos(n => n + 1);
          }
        },
      });
      if (minha === geracao.current) {
        if (resumo.parou === 'concluida' || resumo.parou === 'cancelada') {
          falhasSeguidas.current = 0;
          setEnvio({tipo: 'ocioso'});
        } else {
          falhasSeguidas.current += resumo.parou === 'precisaLogin' ? 0 : 1;
          setEnvio({tipo: 'aguardando', parou: resumo.parou});
        }
      }
      return resumo;
    } catch {
      if (minha === geracao.current) {
        falhasSeguidas.current += 1;
        setEnvio({tipo: 'aguardando', parou: 'falhou'});
      }
      return null;
    } finally {
      enviandoAgora.current = false;
    }
  }, [motoristaId, sessaoAtiva, armazenamento, enviar, agora, guardarEmEstado]);

  const haPendentes = pendencias.some(p => p.status === 'pendente');

  // Enquanto houver assinatura pendente e login válido: tenta já e repete com espera crescente.
  useEffect(() => {
    if (!motoristaId || !sessaoAtiva || !haPendentes) {
      return undefined;
    }
    let cancelado = false;
    let temporizador: ReturnType<typeof setTimeout> | null = null;
    const agendar = (espera: number) => {
      temporizador = setTimeout(async () => {
        const resumo = await enviarAgora();
        if (cancelado) {
          return;
        }
        // Sem login não adianta insistir: o laço volta quando o login voltar (este efeito reinicia).
        const insistir = resumo === null || (resumo.parou !== 'concluida' && resumo.parou !== 'precisaLogin' && resumo.parou !== 'cancelada');
        if (insistir) {
          agendar(esperaAteNovaTentativaMs(Math.max(0, falhasSeguidas.current - 1)));
        }
      }, espera);
    };
    agendar(0);
    const deixarDeObservar = observarAppState(naTela => {
      if (naTela) {
        enviarAgora();
      }
    });
    return () => {
      cancelado = true;
      if (temporizador) {
        clearTimeout(temporizador);
      }
      deixarDeObservar();
    };
  }, [motoristaId, sessaoAtiva, haPendentes, enviarAgora, observarAppState]);

  const descartarPendencia = useCallback(
    async (id: string) => {
      const alvo = pendencias.find(p => p.id === id);
      if (!alvo || alvo.status !== 'rejeitada') {
        return;
      }
      await armazenamento.removerPendencia(id);
      setPendencias(atual => atual.filter(p => p.id !== id));
    },
    [pendencias, armazenamento],
  );

  const dispensarConfirmacao = useCallback((id: string) => setConfirmacoes(atual => atual.filter(c => c.id !== id)), []);

  const registrarPendencia = useCallback(
    async (pendencia: Pendencia) => {
      await armazenamento.salvarPendencia(pendencia);
      guardarEmEstado(pendencia);
    },
    [armazenamento, guardarEmEstado],
  );

  return useMemo(
    () => ({
      semConexao: false,
      semSessao: false,
      somenteLeitura: false,
      situacao,
      pacote,
      download,
      baixar,
      cancelar,
      pendencias,
      registrarPendencia,
      envio,
      confirmacoes,
      desfechos,
      enviarAgora,
      descartarPendencia,
      dispensarConfirmacao,
    }),
    [situacao, pacote, download, baixar, cancelar, pendencias, registrarPendencia, envio, confirmacoes, desfechos, enviarAgora, descartarPendencia, dispensarConfirmacao],
  );
}

function mensagemDaFalha(falha: unknown) {
  if (falha instanceof api.ErroApi && falha.status === api.SEM_CONEXAO) {
    return 'Sem conexão com o servidor. O download foi interrompido; a versão anterior (se houver) foi mantida.';
  }
  return falha instanceof Error ? falha.message : 'Não foi possível baixar a rota.';
}

const OfflineContexto = createContext<OfflineViewModel>({
  semConexao: false,
  semSessao: false,
  somenteLeitura: false,
  situacao: 'nenhum',
  pacote: null,
  download: {tipo: 'ocioso'},
  baixar: async () => {},
  cancelar: () => {},
  pendencias: [],
  registrarPendencia: async () => {},
  envio: {tipo: 'ocioso'},
  confirmacoes: [],
  desfechos: 0,
  enviarAgora: async () => null,
  descartarPendencia: async () => {},
  dispensarConfirmacao: () => {},
});

export function OfflineProvider({valor, children}: {valor: OfflineViewModel; children: React.ReactNode}) {
  return <OfflineContexto.Provider value={valor}>{children}</OfflineContexto.Provider>;
}

export function useOffline() {
  return useContext(OfflineContexto);
}
