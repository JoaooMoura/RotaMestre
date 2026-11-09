import {useCallback, useEffect, useMemo, useRef, useState} from 'react';
import {guardaSessaoDe, Pendencia, PacoteOffline, ResumoDoPacote} from '../offline';
import {ArmazenamentoOffline, armazenamentoOfflineSeguro} from '../servicos/armazenamentoOffline';
import {Rota, Usuario} from '../tipos';
import {OfflineViewModel, useOfflineViewModel} from './OfflineViewModel';
import {
  EstadoOperacao,
  ResultadoSalvar,
  ServicoOfflineDaOperacao,
  ServicoOperacao,
  useOperacaoViewModel,
} from './OperacaoViewModel';
import {servicoCompartilhamentoApi} from './CompartilhamentoViewModel';
import {SessaoViewModel} from './SessaoViewModel';

/** O que a tela raiz precisa de fora (injetado; nos testes entram falsos). */
export type DependenciasDoApp = {
  armazenamento: Pick<ArmazenamentoOffline, 'lerPacote' | 'salvarPacote' | 'listarPendencias' | 'lerResumo'>;
  /** Serviço de rotas da operação; omitido, a operação usa a API real. */
  operacao?: ServicoOperacao;
  /** Dependências do ViewModel offline; omitidas, ele usa as reais. */
  offline?: Parameters<typeof useOfflineViewModel>[1];
  /** Avisa o servidor que a posição deixou de ser compartilhada (ao sair da conta); omitido, nada é avisado. */
  compartilhamento?: {parar: () => Promise<void>};
};

export const dependenciasDoAppPadrao: DependenciasDoApp = {
  armazenamento: armazenamentoOfflineSeguro,
  compartilhamento: servicoCompartilhamentoApi,
};

export type AppViewModel = {
  restaurando: boolean;
  usuario: Usuario | null;
  estado: EstadoOperacao;
  /** Contexto do modo offline para as telas (inclui `semConexao`, `semSessao` e `somenteLeitura`). */
  offline: OfflineViewModel;
  /** Resumo da rota baixada neste aparelho, mostrado na entrada quando não há sessão. */
  resumoBaixado: ResumoDoPacote | null;
  podeColetarSemEntrar: boolean;
  rotaEmAndamento: boolean;
  /** Motorista logado, com rota em andamento e falando com o servidor: a posição é compartilhada com o gestor. */
  compartilharPosicao: boolean;
  /** Dados da viagem a gravar no aparelho (motorista com rota em andamento, com ou sem internet); nulo fora disso. */
  viagemParaGravar: {usuarioId: string; rotaId: string; rotaNome: string} | null;
  /** Motorista com sessão: a programação é atualizada em segundo plano (US06.05). */
  atualizarEmSegundoPlano: boolean;
  recarregar: () => Promise<void>;
  /** Relê rota e motoristas do gestor sem trocar de tela nem avisar de falhas. */
  atualizarSilenciosa: (opcoes?: {aceitarSemRota?: boolean}) => Promise<void>;
  atualizarRota: (rota: Rota) => Promise<ResultadoSalvar>;
  abrirRotaBaixada: () => Promise<void>;
  sair: () => void;
};

/** Mantém o pacote baixado igual à rota do servidor, só se for a mesma rota (melhor esforço). */
export function criarServicoOfflineDaOperacao(
  armazenamento: DependenciasDoApp['armazenamento'],
  registrarPendencia: (pendencia: Pendencia) => Promise<void>,
): ServicoOfflineDaOperacao {
  return {
    lerPacote: armazenamento.lerPacote,
    listarPendencias: armazenamento.listarPendencias,
    registrarPendencia,
    atualizarRotaDoPacote: async (usuarioId: string, rota: Rota) => {
      const pacote: PacoteOffline | null = await armazenamento.lerPacote(usuarioId);
      // Só acompanha a mesma rota; o pacote de outra rota continua valendo para o que foi baixado.
      if (pacote && pacote.rota.id === rota.id) {
        await armazenamento.salvarPacote({...pacote, rota});
      }
    },
  };
}

const INTERVALO_RECONEXAO_MS = 15000;

/**
 * Lógica da tela raiz: operação (rota atual), modo offline e abertura da rota baixada sem sessão (PV05).
 * Recebe a sessão já pronta e as dependências por parâmetro (RNF08).
 */
export function useAppViewModel(
  sessao: Pick<SessaoViewModel, 'usuario' | 'usuarioGuardado' | 'restaurando' | 'sair'>,
  dependencias: DependenciasDoApp = dependenciasDoAppPadrao,
): AppViewModel {
  const {usuario: usuarioDaSessao, usuarioGuardado, restaurando, sair: sairDaSessao} = sessao;
  const {armazenamento} = dependencias;
  // Sem sessão válida (ex.: expirou), o motorista pode abrir a rota já baixada neste aparelho (PV05).
  const [usuarioLocal, setUsuarioLocal] = useState<Usuario | null>(null);
  const [resumoBaixado, setResumoBaixado] = useState<ResumoDoPacote | null>(null);
  const usuario = usuarioDaSessao ?? usuarioLocal;
  const semSessao = usuarioDaSessao === null && usuarioLocal !== null;
  // Sem login: coletar assinatura só se o aparelho guarda a sessão DESTE motorista (Manter conectado); senão, só leitura.
  const podeColetarSemEntrar = guardaSessaoDe(usuarioGuardado, resumoBaixado?.usuarioId);
  const somenteLeitura = semSessao && !guardaSessaoDe(usuarioGuardado, usuarioLocal?.id);
  const offlineBase = useOfflineViewModel(usuario, dependencias.offline, {sessaoAtiva: usuarioDaSessao !== null});
  const servicoOffline = useMemo(
    () => criarServicoOfflineDaOperacao(armazenamento, offlineBase.registrarPendencia),
    [armazenamento, offlineBase.registrarPendencia],
  );
  const {estado, recarregar, atualizarSilenciosa, atualizarRota, tentarReconectar} = useOperacaoViewModel(
    usuario,
    dependencias.operacao,
    servicoOffline,
    {somenteLocal: semSessao, somenteLeitura},
  );
  const semConexao = estado.tipo === 'pronto' && estado.offline !== undefined;
  const offline = useMemo(
    () => ({...offlineBase, semConexao, semSessao, somenteLeitura}),
    [offlineBase, semConexao, semSessao, somenteLeitura],
  );

  useEffect(() => {
    if (usuarioDaSessao) {
      setUsuarioLocal(null);
    }
  }, [usuarioDaSessao]);

  // Voltou ao servidor? Primeiro sai o que foi coletado sem rede (laço do OfflineViewModel); com tudo
  // enviado, a tela troca a rota baixada pela do servidor. Quando uma assinatura tem desfecho (aceita
  // ou rejeitada), a rota é recarregada para refletir o que o servidor decidiu.
  const pendentesParaEnviar = offline.pendencias.some(p => p.status === 'pendente');
  const desfechos = offline.desfechos;
  const desfechosVistos = useRef(0);
  useEffect(() => {
    if (desfechos === desfechosVistos.current) {
      return;
    }
    desfechosVistos.current = desfechos;
    if (estado.tipo === 'pronto' && estado.offline) {
      tentarReconectar();
    } else if (usuarioDaSessao) {
      recarregar();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [desfechos]);
  useEffect(() => {
    if (!usuarioDaSessao || pendentesParaEnviar || !(estado.tipo === 'pronto' && estado.offline)) {
      return undefined;
    }
    const id = setInterval(() => {
      tentarReconectar();
    }, INTERVALO_RECONEXAO_MS);
    return () => clearInterval(id);
  }, [usuarioDaSessao, pendentesParaEnviar, estado, tentarReconectar]);

  useEffect(() => {
    if (usuarioDaSessao || restaurando) {
      return;
    }
    armazenamento.lerResumo().then(setResumoBaixado, () => setResumoBaixado(null));
  }, [usuarioDaSessao, restaurando, usuarioLocal, armazenamento]);

  const abrirRotaBaixada = useCallback(async () => {
    if (!resumoBaixado) {
      return;
    }
    const pacote = await armazenamento.lerPacote(resumoBaixado.usuarioId).catch(() => null);
    if (pacote) {
      setUsuarioLocal(pacote.usuario);
    }
  }, [resumoBaixado, armazenamento]);

  const rotaEmAndamento =
    usuario?.papel === 'motorista' && estado.tipo === 'pronto' && estado.rota.status === 'Em andamento';

  const compartilharPosicao = rotaEmAndamento && usuarioDaSessao !== null && !semConexao;

  const viagemParaGravar = useMemo(
    () =>
      rotaEmAndamento && usuario && estado.tipo === 'pronto'
        ? {usuarioId: usuario.id, rotaId: estado.rota.id, rotaNome: estado.rota.nome}
        : null,
    [rotaEmAndamento, usuario, estado],
  );

  const sair = useCallback(() => {
    if (usuarioDaSessao) {
      // Antes de a sessão acabar (e o token sumir): o gestor deixa de ver a posição.
      if (compartilharPosicao) {
        dependencias.compartilhamento?.parar().catch(() => {});
      }
      sairDaSessao();
    } else {
      setUsuarioLocal(null);
    }
  }, [usuarioDaSessao, sairDaSessao, compartilharPosicao, dependencias.compartilhamento]);


  return {
    restaurando,
    usuario,
    estado,
    offline,
    resumoBaixado,
    podeColetarSemEntrar,
    rotaEmAndamento,
    compartilharPosicao,
    viagemParaGravar,
    atualizarEmSegundoPlano: usuarioDaSessao?.papel === 'motorista',
    recarregar,
    atualizarSilenciosa,
    atualizarRota,
    abrirRotaBaixada,
    sair,
  };
}
