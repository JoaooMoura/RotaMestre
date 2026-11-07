import React, {createContext, useContext, useEffect, useMemo, useRef, useState, useSyncExternalStore} from 'react';
import {Posicao} from '../localizacao';
import {ServicoLocalizacao} from '../servicos/servicoLocalizacao';
import {CenarioSimulado, SimuladorGps} from '../servicos/servicoLocalizacaoSimulado';
import {ServicoPrimeiroPlano} from '../servicos/primeiroPlano';
import {
  criarStore,
  Diagnostico,
  diagnosticoInicial,
  EstadoLocalizacao,
  iniciarRastreamento,
  ObservadorDeAppState,
  Relogio,
  Store,
} from './rastreamentoLocalizacao';

export type DependenciasLocalizacao = {
  servico: ServicoLocalizacao;
  primeiroPlano: ServicoPrimeiroPlano;
  relogio: Relogio;
  observarAppState: ObservadorDeAppState;
  /** Só em desenvolvimento: GPS simulado, para testar com o aparelho parado sobre a mesa. */
  simulador?: SimuladorGps;
};

export type LocalizacaoViewModel = {
  estado: EstadoLocalizacao;
  /** O serviço em primeiro plano não subiu: a coleta só funciona com o app aberto. */
  somentePrimeiroPlano: boolean;
  fonteSimulada: boolean;
  simuladorDisponivel: boolean;
  cenarioSimulado: CenarioSimulado | null;
  tentarNovamente: () => void;
  abrirConfiguracoes: (qual: 'aplicativo' | 'localizacao') => void;
  usarSimulador: (usar: boolean) => void;
  definirCenarioSimulado: (cenario: CenarioSimulado) => void;
  definirVelocidadeSimulada: (velocidadeKmh: number) => void;
  definirRotaSimulada: (rota: {latitude: number; longitude: number}[]) => void;
};

type ValorDoContexto = {
  viewModel: LocalizacaoViewModel;
  posicaoStore: Store<Posicao | null>;
  diagnosticoStore: Store<Diagnostico>;
};

export function useLocalizacaoViewModel(ativo: boolean, dependencias: DependenciasLocalizacao): ValorDoContexto {
  const {servico, primeiroPlano, relogio, observarAppState, simulador} = dependencias;
  const [estado, setEstado] = useState<EstadoLocalizacao>({tipo: 'inativa'});
  const [somentePrimeiroPlano, setSomentePrimeiroPlano] = useState(false);
  const [simulada, setSimulada] = useState(false);
  const [tentativa, setTentativa] = useState(0);
  const [cenarioSimulado, setCenarioSimulado] = useState<CenarioSimulado | null>(null);
  const posicaoStore = useRef(criarStore<Posicao | null>(null)).current;
  const diagnosticoStore = useRef(criarStore<Diagnostico>(diagnosticoInicial())).current;

  const usandoSimulador = simulada && simulador !== undefined;
  const servicoEmUso = usandoSimulador ? simulador.servico : servico;

  useEffect(() => {
    if (!ativo) {
      return undefined;
    }
    const rastreamento = iniciarRastreamento({
      servico: servicoEmUso,
      primeiroPlano,
      relogio,
      observarAppState,
      posicaoStore,
      diagnosticoStore,
      aoEstado: setEstado,
      aoPrimeiroPlano: funcionando => setSomentePrimeiroPlano(!funcionando),
    });
    return () => {
      rastreamento.parar();
      setEstado({tipo: 'inativa'});
      setSomentePrimeiroPlano(false);
    };
  }, [ativo, servicoEmUso, primeiroPlano, relogio, observarAppState, posicaoStore, diagnosticoStore, tentativa]);

  const viewModel = useMemo<LocalizacaoViewModel>(
    () => ({
      estado,
      somentePrimeiroPlano,
      fonteSimulada: usandoSimulador,
      simuladorDisponivel: simulador !== undefined,
      cenarioSimulado,
      tentarNovamente: () => setTentativa(valor => valor + 1),
      abrirConfiguracoes: qual => {
        servico.abrirConfiguracoes(qual).catch(() => {});
      },
      usarSimulador: usar => {
        if (simulador) {
          simulador.reiniciar();
          setCenarioSimulado(usar ? 'movimento' : null);
          setSimulada(usar);
        }
      },
      definirCenarioSimulado: cenario => {
        simulador?.definirCenario(cenario);
        setCenarioSimulado(cenario);
      },
      definirVelocidadeSimulada: velocidade => simulador?.definirVelocidadeKmh(velocidade),
      definirRotaSimulada: rota => simulador?.definirRota(rota),
    }),
    [estado, somentePrimeiroPlano, usandoSimulador, simulador, cenarioSimulado, servico],
  );

  return useMemo(() => ({viewModel, posicaoStore, diagnosticoStore}), [viewModel, posicaoStore, diagnosticoStore]);
}

const VIEW_MODEL_INERTE: LocalizacaoViewModel = {
  estado: {tipo: 'inativa'},
  somentePrimeiroPlano: false,
  fonteSimulada: false,
  simuladorDisponivel: false,
  cenarioSimulado: null,
  tentarNovamente: () => {},
  abrirConfiguracoes: () => {},
  usarSimulador: () => {},
  definirCenarioSimulado: () => {},
  definirVelocidadeSimulada: () => {},
  definirRotaSimulada: () => {},
};

// Sem Provider (telas isoladas, testes), a localização aparece como inativa em vez de falhar.
const ContextoPadrao: ValorDoContexto = {
  viewModel: VIEW_MODEL_INERTE,
  posicaoStore: criarStore<Posicao | null>(null),
  diagnosticoStore: criarStore<Diagnostico>(diagnosticoInicial()),
};

const LocalizacaoContexto = createContext<ValorDoContexto>(ContextoPadrao);

type ProviderProps = {
  ativo: boolean;
  dependencias: DependenciasLocalizacao;
  children: React.ReactNode;
};

export function LocalizacaoProvider({ativo, dependencias, children}: ProviderProps) {
  const valor = useLocalizacaoViewModel(ativo, dependencias);
  return <LocalizacaoContexto.Provider value={valor}>{children}</LocalizacaoContexto.Provider>;
}

/** Estado de grão grosso: muda só quando a situação da localização muda, não a cada leitura. */
export function useLocalizacao() {
  return useContext(LocalizacaoContexto).viewModel;
}

/**
 * Digitação restrita porque o veículo está em movimento (US05.06). Sem localização atual (GPS
 * desligado, perdido ou desatualizado) não dá para saber: a digitação fica liberada.
 */
export function useRestricaoPorMovimento() {
  const {estado} = useLocalizacao();
  return estado.tipo === 'ativa' && !estado.desatualizada && estado.restritoPorMovimento;
}

/** Posição atual: renderiza só quem a usa, a cada leitura. */
export function usePosicaoAtual() {
  const {posicaoStore} = useContext(LocalizacaoContexto);
  return useSyncExternalStore(posicaoStore.assinar, posicaoStore.obter);
}

export function useDiagnosticoLocalizacao() {
  const {diagnosticoStore} = useContext(LocalizacaoContexto);
  return useSyncExternalStore(diagnosticoStore.assinar, diagnosticoStore.obter);
}

export function useStoreDaPosicao() {
  return useContext(LocalizacaoContexto).posicaoStore;
}
