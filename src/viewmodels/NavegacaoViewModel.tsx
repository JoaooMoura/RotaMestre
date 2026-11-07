import React, {createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, useSyncExternalStore} from 'react';
import {GuiaDeNavegacao, criarPlano} from '../navegacao';
import {ServicoVoz, servicoVozNulo} from '../servicos/vozTipos';
import {Trajeto} from '../tipos';
import {EstadoDaVoz, estadoInicialDaVoz, Guia, iniciarGuia} from './guiaDeNavegacao';
import {criarStore, Store} from './rastreamentoLocalizacao';
import {useLocalizacao, useStoreDaPosicao} from './LocalizacaoViewModel';

/** Estado de grão grosso: só muda quando a navegação muda de fase. A cada leitura muda apenas o guia. */
export type EstadoDaNavegacao = {tipo: 'inativa' | 'aguardandoPosicao' | 'navegando' | 'chegou'};

export type NavegacaoViewModel = {
  estado: EstadoDaNavegacao;
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

type DependenciasNavegacao = {voz: ServicoVoz};

const NavegacaoContexto = createContext<DependenciasNavegacao>({voz: servicoVozNulo});

export function NavegacaoProvider({voz, children}: {voz: ServicoVoz; children: React.ReactNode}) {
  const valor = useMemo(() => ({voz}), [voz]);
  return <NavegacaoContexto.Provider value={valor}>{children}</NavegacaoContexto.Provider>;
}

export function useNavegacaoViewModel(trajeto: Trajeto, dependencias?: DependenciasNavegacao): NavegacaoViewModel {
  const contexto = useContext(NavegacaoContexto);
  const {voz} = dependencias ?? contexto;
  const localizacao = useLocalizacao();
  const posicaoStore = useStoreDaPosicao();

  const [estado, setEstado] = useState<EstadoDaNavegacao>({tipo: 'inativa'});
  const [estadoDaVoz, setEstadoDaVoz] = useState<EstadoDaVoz>(estadoInicialDaVoz);
  const guiaRef = useRef<Guia | null>(null);
  const guiaStore = useRef(criarStore<GuiaDeNavegacao | null>(null)).current;
  const ligadaRef = useRef(true);

  const localizacaoPronta = localizacao.estado.tipo === 'ativa' && !localizacao.estado.desatualizada;
  const localizacaoPerdida = localizacao.estado.tipo !== 'aguardandoPosicao' && !localizacaoPronta;
  const navegando = estado.tipo !== 'inativa';

  const encerrar = useCallback(() => {
    guiaRef.current?.parar();
    guiaRef.current = null;
    guiaStore.definir(null);
    setEstado({tipo: 'inativa'});
  }, [guiaStore]);

  const iniciar = useCallback(() => {
    guiaRef.current?.parar();
    setEstadoDaVoz({...estadoInicialDaVoz, ligada: ligadaRef.current});
    setEstado({tipo: 'aguardandoPosicao'});
    const guia = iniciarGuia({
      plano: criarPlano(trajeto),
      posicaoStore,
      voz,
      aoGuia: g => {
        guiaStore.definir(g);
        const tipo = g.chegou ? 'chegou' : 'navegando';
        setEstado(atual => (atual.tipo === tipo ? atual : {tipo}));
      },
      aoEstadoDaVoz: setEstadoDaVoz,
    });
    guia.definirVozLigada(ligadaRef.current);
    guiaRef.current = guia;
  }, [trajeto, posicaoStore, voz, guiaStore]);

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

  useEffect(() => () => guiaRef.current?.parar(), []);

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
    [estado, guiaStore, estadoDaVoz, navegando, localizacaoPerdida, localizacaoPronta, iniciar, encerrar, alternarVoz, instalarVozes],
  );
}

/** A orientação atual; só quem a usa renderiza a cada leitura de GPS. */
export function useGuiaDeNavegacao(navegacao: NavegacaoViewModel) {
  return useSyncExternalStore(navegacao.guiaStore.assinar, navegacao.guiaStore.obter);
}
