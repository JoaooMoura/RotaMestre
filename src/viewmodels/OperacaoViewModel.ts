import {useCallback, useEffect, useMemo, useRef, useState} from 'react';
import * as api from '../servicos/api';
import {
  aplicarPendencias,
  criarPendencia,
  MENSAGEM_ENTRAR_PARA_COLETAR,
  detectarEntregaOffline,
  gerarIdDeEnvio,
  Pendencia,
  PacoteOffline,
} from '../offline';
import {Motorista, Rota, Usuario} from '../tipos';

export type ServicoOperacao = {
  buscarRotaAtual: () => Promise<Rota | null>;
  buscarMotoristas: () => Promise<Motorista[]>;
  salvarRota: (rota: Rota) => Promise<Rota>;
};

export const servicoOperacaoApi: ServicoOperacao = {
  buscarRotaAtual: () => api.buscarRotaAtual(),
  buscarMotoristas: api.buscarMotoristas,
  salvarRota: api.salvarRota,
};

/** O que a operação precisa do armazenamento offline (injetado; faltando, o app só funciona online). */
export type ServicoOfflineDaOperacao = {
  lerPacote: (usuarioId: string) => Promise<PacoteOffline | null>;
  listarPendencias: () => Promise<Pendencia[]>;
  /** Guarda a assinatura coletada sem rede; rejeita se não conseguiu guardar. */
  registrarPendencia: (pendencia: Pendencia) => Promise<void>;
  /** Mantém a rota do pacote baixado igual à do servidor (melhor esforço; o mapa e o trajeto não mudam). */
  atualizarRotaDoPacote?: (usuarioId: string, rota: Rota) => Promise<void>;
  agora?: () => number;
  novoId?: () => string;
};

export type EstadoOperacao =
  | {tipo: 'carregando'}
  | {tipo: 'erro'; mensagem: string}
  | {tipo: 'semRota'}
  | {
      tipo: 'pronto';
      rota: Rota;
      motoristas: Motorista[];
      /** Presente quando a rota vem do pacote baixado, sem falar com o servidor (US06.02). */
      offline?: {baixadoEm: number};
    };

/** `aceitarSemRota`: se o servidor já não tem rota para este usuário (ex.: reatribuída), mostra "sem rota" em vez de manter a antiga. */
export type OpcoesDaAtualizacaoSilenciosa = {aceitarSemRota?: boolean};

export type ResultadoSalvar = {ok: true} | {ok: false; mensagem?: string};

export type OpcoesDaOperacao = {
  /** Não fala com o servidor: usa só a rota baixada (modo sem sessão, PV05). */
  somenteLocal?: boolean;
  /** Consulta sem sessão guardada: ver rota, mapa e navegar; nada de coletar assinatura. */
  somenteLeitura?: boolean;
};

export const MENSAGEM_SEM_PACOTE =
  'Sem conexão e nenhuma rota baixada neste aparelho. Conecte-se e baixe a rota em "Minha rota" antes de sair.';

export type OperacaoViewModel = {
  estado: EstadoOperacao;
  recarregar: () => Promise<void>;
  /** Tenta voltar ao servidor sem piscar a tela; devolve se conseguiu. */
  tentarReconectar: () => Promise<boolean>;
  /**
   * Relê a rota e os motoristas sem trocar a tela por "carregando" e sem avisar de falhas: só troca o estado
   * se algo mudou. Serve para a tela do gestor se manter em dia (o que o motorista faz não chega sozinho).
   */
  atualizarSilenciosa: (opcoes?: OpcoesDaAtualizacaoSilenciosa) => Promise<void>;
  atualizarRota: (rota: Rota) => Promise<ResultadoSalvar>;
};

function sessaoExpirou(falha: unknown) {
  return falha instanceof api.ErroApi && falha.status === 401;
}

function mensagemDe(falha: unknown, padrao: string) {
  return falha instanceof Error ? falha.message : padrao;
}

export function useOperacaoViewModel(
  usuario: Usuario | null,
  servico: ServicoOperacao = servicoOperacaoApi,
  offline?: ServicoOfflineDaOperacao,
  opcoes: OpcoesDaOperacao = {},
): OperacaoViewModel {
  const somenteLocal = opcoes.somenteLocal === true;
  const somenteLeitura = opcoes.somenteLeitura === true;
  const [estado, setEstado] = useState<EstadoOperacao>({tipo: 'carregando'});
  const cargaAtual = useRef(0);
  const usuarioAtual = useRef(0);

  const recarregar = useCallback(async () => {
    const carga = ++cargaAtual.current;
    setEstado({tipo: 'carregando'});
    if (!usuario) {
      return;
    }

    const doPacote = async (): Promise<EstadoOperacao | null> => {
      if (usuario.papel !== 'motorista' || !offline) {
        return null;
      }
      const pacote = await offline.lerPacote(usuario.id).catch(() => null);
      if (!pacote) {
        return null;
      }
      const pendencias = await offline.listarPendencias().catch(() => []);
      const rota = aplicarPendencias(pacote.rota, pendencias.filter(p => p.usuarioId === usuario.id));
      return {tipo: 'pronto', rota, motoristas: [], offline: {baixadoEm: pacote.baixadoEm}};
    };

    if (somenteLocal) {
      const local = await doPacote();
      if (carga === cargaAtual.current) {
        setEstado(local ?? {tipo: 'erro', mensagem: 'Nenhuma rota baixada neste aparelho.'});
      }
      return;
    }

    try {
      const [rota, motoristas] = await Promise.all([
        servico.buscarRotaAtual(),
        usuario.papel === 'gestor' ? servico.buscarMotoristas() : Promise.resolve([]),
      ]);
      if (carga !== cargaAtual.current) {
        return;
      }
      setEstado(rota ? {tipo: 'pronto', rota, motoristas} : {tipo: 'semRota'});
      if (rota && usuario.papel === 'motorista') {
        offline?.atualizarRotaDoPacote?.(usuario.id, rota).catch(() => {});
      }
    } catch (falha) {
      if (carga !== cargaAtual.current || sessaoExpirou(falha)) {
        return;
      }
      if (falha instanceof api.ErroApi && falha.status === api.SEM_CONEXAO) {
        // Sem servidor: se há rota baixada, ela abre em modo somente consulta; se não, explica o que fazer.
        const local = await doPacote();
        if (carga === cargaAtual.current) {
          setEstado(
            local ?? {
              tipo: 'erro',
              mensagem: usuario.papel === 'motorista' && offline ? MENSAGEM_SEM_PACOTE : mensagemDe(falha, 'Não foi possível carregar os dados.'),
            },
          );
        }
        return;
      }
      setEstado({tipo: 'erro', mensagem: mensagemDe(falha, 'Não foi possível carregar os dados.')});
    }
  }, [usuario, servico, offline, somenteLocal]);

  const estadoAtual = useRef(estado);
  estadoAtual.current = estado;

  const tentarReconectar = useCallback(async () => {
    if (!usuario || somenteLocal || estadoAtual.current.tipo !== 'pronto' || !estadoAtual.current.offline) {
      return false;
    }
    const carga = ++cargaAtual.current;
    try {
      const rota = await servico.buscarRotaAtual();
      if (carga !== cargaAtual.current) {
        return false;
      }
      setEstado(rota ? {tipo: 'pronto', rota, motoristas: []} : {tipo: 'semRota'});
      return true;
    } catch {
      return false;
    }
  }, [usuario, servico, somenteLocal]);

  // Muda a cada recarga completa e a cada salvamento: uma leitura silenciosa iniciada antes é descartada.
  const versaoDosDados = useRef(0);
  useEffect(() => {
    versaoDosDados.current++;
  }, [estado]);

  const atualizarSilenciosa = useCallback(async (opcoesDaLeitura: OpcoesDaAtualizacaoSilenciosa = {}) => {
    const atual = estadoAtual.current;
    if (!usuario || somenteLocal || atual.tipo !== 'pronto' || atual.offline) {
      return;
    }
    const versao = versaoDosDados.current;
    const doUsuario = usuarioAtual.current;
    try {
      const [rota, motoristas] = await Promise.all([
        servico.buscarRotaAtual(),
        usuario.papel === 'gestor' ? servico.buscarMotoristas() : Promise.resolve(atual.motoristas),
      ]);
      const agora = estadoAtual.current;
      if (agora.tipo !== 'pronto' || versao !== versaoDosDados.current || doUsuario !== usuarioAtual.current) {
        return;
      }
      if (!rota) {
        if (opcoesDaLeitura.aceitarSemRota) {
          setEstado({tipo: 'semRota'});
        }
        return;
      }
      if (JSON.stringify(agora.rota) === JSON.stringify(rota) && JSON.stringify(agora.motoristas) === JSON.stringify(motoristas)) {
        return;
      }
      setEstado({tipo: 'pronto', rota, motoristas});
    } catch {
      // Silencioso de propósito: sem servidor, a tela segue com o que tem (o 401 já é tratado por quem cuida da sessão).
    }
  }, [usuario, servico, somenteLocal]);

  useEffect(() => {
    usuarioAtual.current++;
    recarregar();
  }, [recarregar]);

  const atualizarRota = useCallback(
    async (rota: Rota): Promise<ResultadoSalvar> => {
      const doUsuario = usuarioAtual.current;
      const atual = estadoAtual.current;
      if (somenteLeitura) {
        return {ok: false, mensagem: MENSAGEM_ENTRAR_PARA_COLETAR};
      }

      // Sem rede só dá para guardar a assinatura de uma entrega, para enviar depois (US06.03).
      const guardarSemRede = async (): Promise<ResultadoSalvar> => {
        if (!usuario || !offline || atual.tipo !== 'pronto') {
          return {ok: false, mensagem: 'Sem conexão com o servidor. Verifique a internet e tente novamente.'};
        }
        const pendenciasAtuais = await offline.listarPendencias().catch(() => []);
        const entrega = detectarEntregaOffline(atual.rota, rota, pendenciasAtuais);
        if (!entrega.ok) {
          return {ok: false, mensagem: entrega.mensagem};
        }
        const agora = offline.agora?.() ?? Date.now();
        const pendencia = criarPendencia({
          id: offline.novoId?.() ?? gerarIdDeEnvio(agora),
          usuarioId: usuario.id,
          rotaId: atual.rota.id,
          parada: entrega.parada,
          agora,
        });
        try {
          await offline.registrarPendencia(pendencia);
        } catch {
          return {ok: false, mensagem: 'Não foi possível guardar a assinatura neste aparelho. Verifique o espaço livre e tente novamente.'};
        }
        if (doUsuario === usuarioAtual.current) {
          const pacote = await offline.lerPacote(usuario.id).catch(() => null);
          // Sem pacote baixado a tela continua como estava (não é "rota baixada"); a assinatura fica guardada do mesmo jeito.
          const modoOffline = atual.offline ?? (pacote ? {baixadoEm: pacote.baixadoEm} : undefined);
          setEstado({
            tipo: 'pronto',
            rota: aplicarPendencias(atual.rota, [pendencia]),
            motoristas: atual.motoristas,
            ...(modoOffline ? {offline: modoOffline} : {}),
          });
        }
        return {ok: true};
      };

      if (atual.tipo === 'pronto' && atual.offline) {
        return guardarSemRede();
      }

      try {
        const salva = await servico.salvarRota(rota);
        if (usuario?.papel === 'motorista') {
          offline?.atualizarRotaDoPacote?.(usuario.id, salva).catch(() => {});
        }
        if (doUsuario === usuarioAtual.current) {
          setEstado(atual => ({
            tipo: 'pronto',
            rota: salva,
            motoristas: atual.tipo === 'pronto' ? atual.motoristas : [],
          }));
        }
        return {ok: true};
      } catch (falha) {
        if (sessaoExpirou(falha)) {
          return {ok: false};
        }
        if (falha instanceof api.ErroApi && falha.status === api.SEM_CONEXAO && usuario?.papel === 'motorista') {
          // A conexão caiu no meio do uso: a entrega com assinatura não se perde, fica guardada.
          return guardarSemRede();
        }
        return {ok: false, mensagem: mensagemDe(falha, 'Não foi possível salvar a rota.')};
      }
    },
    [servico, usuario, offline, somenteLeitura],
  );

  return useMemo(
    () => ({estado, recarregar, tentarReconectar, atualizarSilenciosa, atualizarRota}),
    [estado, recarregar, tentarReconectar, atualizarSilenciosa, atualizarRota],
  );
}
