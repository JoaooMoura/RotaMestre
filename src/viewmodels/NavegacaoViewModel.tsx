import React, {createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, useSyncExternalStore} from 'react';
import {GuiaDeNavegacao, criarPlano} from '../navegacao';
import * as api from '../servicos/api';
import {ServicoAlerta, servicoAlertaNulo} from '../servicos/alertaTipos';
import {ServicoTela, servicoTelaNulo} from '../servicos/telaTipos';
import {ServicoVoz, servicoVozNulo} from '../servicos/vozTipos';
import {Trajeto} from '../tipos';
import {EstadoDaVoz, estadoInicialDaVoz, Guia, iniciarGuia} from './guiaDeNavegacao';
import {criarStore, Store} from './rastreamentoLocalizacao';
import {useLocalizacao, useStoreDaPosicao} from './LocalizacaoViewModel';

/** Estado de grão grosso: só muda quando a navegação muda de fase. A cada leitura muda apenas o guia. */
export type EstadoDaNavegacao = {tipo: 'inativa' | 'aguardandoPosicao' | 'navegando' | 'chegou'};

/** Pede um novo trajeto da posição atual até as paradas que faltam (US05.04). */
export type ServicoRecalculo = {
  recalcular: (rotaId: string, posicao: {latitude: number; longitude: number}) => Promise<Trajeto>;
};

export const servicoRecalculoApi: ServicoRecalculo = {recalcular: api.recalcularTrajeto};

export type EstadoDoRecalculo =
  | {tipo: 'ocioso'}
  | {tipo: 'calculando'}
  /** O novo trajeto já está em uso (aviso passageiro). */
  | {tipo: 'recalculado'}
  /** Sem recálculo confirmado: a rota anterior continua valendo; tenta de novo enquanto estiver fora da rota. */
  | {tipo: 'falhou'; semConexao: boolean; mensagem: string}
  /** Sem sessão neste aparelho não há como pedir ao servidor. */
  | {tipo: 'indisponivel'};

export const MENSAGEM_RECALCULO_SEM_CONEXAO =
  'Sem conexão: não foi possível recalcular. A rota baixada continua disponível; volte ao trajeto azul.';
export const INTERVALO_DE_NOVA_TENTATIVA_MS = 30_000;
export const TEMPO_LIMITE_DO_RECALCULO_MS = 15_000;
const DURACAO_DO_AVISO_MS = 8_000;

export type OpcoesDaNavegacao = {
  /** Há sessão para falar com o servidor (falso na consulta sem entrar na conta). */
  recalculoDisponivel?: boolean;
};

export type NavegacaoViewModel = {
  estado: EstadoDaNavegacao;
  /** Trajeto em uso: o original ou, depois de um recálculo, o novo (volta ao original ao encerrar). */
  trajeto: Trajeto;
  recalculo: EstadoDoRecalculo;
  /** Orientação atual (muda a cada leitura de GPS); leia com `useGuiaDeNavegacao`. */
  guiaStore: Store<GuiaDeNavegacao | null>;
  voz: EstadoDaVoz;
  /** A localização está perdida ou desatualizada: a orientação fica pausada e avisa. */
  semLocalizacao: boolean;
  /** Dá para iniciar: a localização está ativa e a posição está atual. */
  podeIniciar: boolean;
  motivoDeNaoPoderIniciar: string | null;
  iniciar: () => void;
  encerrar: () => void;
  alternarVoz: () => void;
  instalarVozes: () => void;
};

type DependenciasNavegacao = {voz: ServicoVoz; tela?: ServicoTela; alerta?: ServicoAlerta; recalculo?: ServicoRecalculo};

const NavegacaoContexto = createContext<DependenciasNavegacao>({
  voz: servicoVozNulo,
  tela: servicoTelaNulo,
  alerta: servicoAlertaNulo,
  recalculo: servicoRecalculoApi,
});

export function NavegacaoProvider({
  voz,
  tela,
  alerta,
  recalculo,
  children,
}: {
  voz: ServicoVoz;
  tela?: ServicoTela;
  alerta?: ServicoAlerta;
  recalculo?: ServicoRecalculo;
  children: React.ReactNode;
}) {
  const valor = useMemo(() => ({voz, tela, alerta, recalculo}), [voz, tela, alerta, recalculo]);
  return <NavegacaoContexto.Provider value={valor}>{children}</NavegacaoContexto.Provider>;
}

export function useNavegacaoViewModel(
  trajetoOriginal: Trajeto,
  dependencias?: DependenciasNavegacao,
  opcoes: OpcoesDaNavegacao = {},
): NavegacaoViewModel {
  const recalculoDisponivel = opcoes.recalculoDisponivel !== false;
  const contexto = useContext(NavegacaoContexto);
  const {voz, tela = servicoTelaNulo, alerta = servicoAlertaNulo, recalculo = servicoRecalculoApi} = dependencias ?? contexto;
  const localizacao = useLocalizacao();
  const posicaoStore = useStoreDaPosicao();

  const [estado, setEstado] = useState<EstadoDaNavegacao>({tipo: 'inativa'});
  const [estadoDaVoz, setEstadoDaVoz] = useState<EstadoDaVoz>(estadoInicialDaVoz);
  const guiaRef = useRef<Guia | null>(null);
  const guiaStore = useRef(criarStore<GuiaDeNavegacao | null>(null)).current;
  const ligadaRef = useRef(true);
  const [trajetoRecalculado, setTrajetoRecalculado] = useState<Trajeto | null>(null);
  const [estadoDoRecalculo, setEstadoDoRecalculo] = useState<EstadoDoRecalculo>({tipo: 'ocioso'});
  const trajeto = trajetoRecalculado ?? trajetoOriginal;
  const foraDaRota = useRef(false);
  const recalculando = useRef(false);
  const geracaoDoRecalculo = useRef(0);
  const temporizadores = useRef<ReturnType<typeof setTimeout>[]>([]);
  const tentarRecalcularRef = useRef<() => void>(() => {});
  const ultimoRecalculoEm = useRef<number | null>(null);
  const trajetoOriginalRef = useRef(trajetoOriginal);

  const localizacaoPronta = localizacao.estado.tipo === 'ativa' && !localizacao.estado.desatualizada;
  const localizacaoPerdida = localizacao.estado.tipo !== 'aguardandoPosicao' && !localizacaoPronta;
  const navegando = estado.tipo !== 'inativa';

  const limparRecalculo = useCallback(() => {
    geracaoDoRecalculo.current++;
    recalculando.current = false;
    foraDaRota.current = false;
    temporizadores.current.forEach(clearTimeout);
    temporizadores.current = [];
  }, []);

  const agendar = useCallback((acao: () => void, ms: number) => {
    temporizadores.current.push(setTimeout(acao, ms));
  }, []);

  tentarRecalcularRef.current = async () => {
    if (!foraDaRota.current || recalculando.current || !guiaRef.current) {
      return;
    }
    if (!recalculoDisponivel) {
      setEstadoDoRecalculo({tipo: 'indisponivel'});
      return;
    }
    // Depois de um recálculo, espera o intervalo mínimo antes de outro (evita um laço quando a posição está longe de qualquer via).
    const espera = ultimoRecalculoEm.current === null ? 0 : ultimoRecalculoEm.current + INTERVALO_DE_NOVA_TENTATIVA_MS - Date.now();
    if (espera > 0) {
      agendar(() => tentarRecalcularRef.current(), espera);
      return;
    }
    const posicao = posicaoStore.obter();
    if (!posicao) {
      return;
    }
    const minha = ++geracaoDoRecalculo.current;
    recalculando.current = true;
    setEstadoDoRecalculo({tipo: 'calculando'});
    try {
      const limite = new Promise<never>((_, rejeitar) =>
        agendar(() => rejeitar(new api.ErroApi('O servidor demorou a responder.', api.SEM_CONEXAO)), TEMPO_LIMITE_DO_RECALCULO_MS),
      );
      const novo = await Promise.race([
        recalculo.recalcular(trajetoOriginalRef.current.rotaId, {latitude: posicao.latitude, longitude: posicao.longitude}),
        limite,
      ]);
      if (minha !== geracaoDoRecalculo.current) {
        return;
      }
      recalculando.current = false;
      if (!foraDaRota.current || !guiaRef.current) {
        setEstadoDoRecalculo({tipo: 'ocioso'});
        return;
      }
      foraDaRota.current = false;
      ultimoRecalculoEm.current = Date.now();
      setTrajetoRecalculado(novo);
      guiaRef.current.trocarPlano(criarPlano(novo));
      setEstadoDoRecalculo({tipo: 'recalculado'});
      agendar(() => setEstadoDoRecalculo(atual => (atual.tipo === 'recalculado' ? {tipo: 'ocioso'} : atual)), DURACAO_DO_AVISO_MS);
    } catch (falha) {
      if (minha !== geracaoDoRecalculo.current) {
        return;
      }
      recalculando.current = false;
      if (falha instanceof api.ErroApi && falha.status === 401) {
        return;
      }
      const semConexao = falha instanceof api.ErroApi && falha.status === api.SEM_CONEXAO;
      setEstadoDoRecalculo({
        tipo: 'falhou',
        semConexao,
        mensagem: semConexao ? MENSAGEM_RECALCULO_SEM_CONEXAO : falha instanceof Error ? falha.message : 'Não foi possível recalcular a rota.',
      });
      // Continua fora da rota: tenta de novo mais tarde (a rota anterior segue valendo enquanto isso).
      agendar(() => tentarRecalcularRef.current(), INTERVALO_DE_NOVA_TENTATIVA_MS);
    }
  };

  const encerrar = useCallback(() => {
    limparRecalculo();
    ultimoRecalculoEm.current = null;
    setTrajetoRecalculado(null);
    setEstadoDoRecalculo({tipo: 'ocioso'});
    guiaRef.current?.parar();
    guiaRef.current = null;
    guiaStore.definir(null);
    setEstado({tipo: 'inativa'});
  }, [guiaStore, limparRecalculo]);

  const iniciar = useCallback(() => {
    guiaRef.current?.parar();
    limparRecalculo();
    ultimoRecalculoEm.current = null;
    setTrajetoRecalculado(null);
    setEstadoDoRecalculo({tipo: 'ocioso'});
    setEstadoDaVoz({...estadoInicialDaVoz, ligada: ligadaRef.current});
    setEstado({tipo: 'aguardandoPosicao'});
    const guia = iniciarGuia({
      plano: criarPlano(trajetoOriginal),
      posicaoStore,
      voz,
      alerta,
      aoDesvio: () => {
        foraDaRota.current = true;
        tentarRecalcularRef.current();
      },
      aoRetorno: () => {
        // Voltou ao trajeto: o recálculo em andamento (se houver) deixa de valer.
        limparRecalculo();
        setEstadoDoRecalculo({tipo: 'ocioso'});
      },
      aoGuia: g => {
        guiaStore.definir(g);
        const tipo = g.chegou ? 'chegou' : 'navegando';
        setEstado(atual => (atual.tipo === tipo ? atual : {tipo}));
      },
      aoEstadoDaVoz: setEstadoDaVoz,
    });
    guia.definirVozLigada(ligadaRef.current);
    guiaRef.current = guia;
  }, [trajetoOriginal, posicaoStore, voz, alerta, guiaStore, limparRecalculo]);

  // A localização acabou (rota pausada ou encerrada): a navegação termina junto, liberando a voz.
  useEffect(() => {
    if (navegando && localizacao.estado.tipo === 'inativa') {
      encerrar();
    }
  }, [navegando, localizacao.estado.tipo, encerrar]);

  useEffect(() => {
    if (navegando) {
      guiaRef.current?.definirLocalizacaoConfiavel(!localizacaoPerdida);
    }
  }, [navegando, localizacaoPerdida]);

  useEffect(() => {
    trajetoOriginalRef.current = trajetoOriginal;
  }, [trajetoOriginal]);

  useEffect(
    () => () => {
      guiaRef.current?.parar();
      limparRecalculo();
    },
    [limparRecalculo],
  );

  // A tela fica acesa só enquanto a navegação está ativa; ao encerrar ou sair da tela, é liberada.
  useEffect(() => {
    if (!navegando) {
      return undefined;
    }
    tela.manterAcesa();
    return () => tela.liberar();
  }, [navegando, tela]);

  const alternarVoz = useCallback(() => {
    ligadaRef.current = !ligadaRef.current;
    guiaRef.current?.definirVozLigada(ligadaRef.current);
    setEstadoDaVoz(atual => ({...atual, ligada: ligadaRef.current}));
  }, []);

  const instalarVozes = useCallback(() => {
    guiaRef.current?.instalarVozes();
  }, []);

  return useMemo(
    () => ({
      estado,
      trajeto,
      recalculo: estadoDoRecalculo,
      guiaStore,
      voz: estadoDaVoz,
      semLocalizacao: navegando && localizacaoPerdida,
      podeIniciar: localizacaoPronta,
      motivoDeNaoPoderIniciar: localizacaoPronta ? null : 'Aguarde o sinal de GPS para iniciar a navegação.',
      iniciar,
      encerrar,
      alternarVoz,
      instalarVozes,
    }),
    [estado, trajeto, estadoDoRecalculo, guiaStore, estadoDaVoz, navegando, localizacaoPerdida, localizacaoPronta, iniciar, encerrar, alternarVoz, instalarVozes],
  );
}

/** A orientação atual; só quem a usa renderiza a cada leitura de GPS. */
export function useGuiaDeNavegacao(navegacao: NavegacaoViewModel) {
  return useSyncExternalStore(navegacao.guiaStore.assinar, navegacao.guiaStore.obter);
}
