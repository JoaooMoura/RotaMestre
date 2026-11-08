import React, {createContext, useCallback, useContext, useEffect, useMemo, useRef, useState} from 'react';
import {AppState} from 'react-native';
import {deveRecuperar, EstadoDaAtualizacao} from '../atualizacao';
import {AgendadorDeAtualizacao, agendadorNulo} from '../servicos/agendadorTipos';
import {ArmazenamentoDeAtualizacao, armazenamentoDeAtualizacaoSeguro} from '../servicos/armazenamentoAtualizacao';
import {atualizarProgramacao} from '../servicos/atualizadorDeRotas';

export type AtualizacaoViewModel = {
  estado: EstadoDaAtualizacao | null;
  atualizando: boolean;
  /** Atualiza já (com o app aberto). */
  atualizarAgora: () => Promise<void>;
};

const Contexto = createContext<AtualizacaoViewModel>({estado: null, atualizando: false, atualizarAgora: async () => {}});

export type DependenciasDaAtualizacao = {
  agendador: AgendadorDeAtualizacao;
  armazenamento: ArmazenamentoDeAtualizacao;
  atualizar: () => Promise<EstadoDaAtualizacao>;
  agora: () => number;
  observarAppState: (aoMudar: (naTela: boolean) => void) => () => void;
};

export const dependenciasDaAtualizacaoPadrao: DependenciasDaAtualizacao = {
  agendador: agendadorNulo,
  armazenamento: armazenamentoDeAtualizacaoSeguro,
  atualizar: () => atualizarProgramacao(),
  agora: Date.now,
  observarAppState: aoMudar => {
    const assinatura = AppState.addEventListener('change', estado => aoMudar(estado === 'active'));
    return () => assinatura.remove();
  },
};

type Props = {
  /** Motorista com sessão: só então a programação é atualizada em segundo plano. */
  ativo: boolean;
  dependencias?: DependenciasDaAtualizacao;
  children: React.ReactNode;
};

/**
 * Liga o agendamento periódico e RECUPERA a atualização que não aconteceu (ao abrir o app e ao voltar a ele,
 * se faz tempo que não houve sucesso ou a última tentativa falhou).
 */
export function AtualizacaoProvider({ativo, dependencias = dependenciasDaAtualizacaoPadrao, children}: Props) {
  const {agendador, armazenamento, atualizar, agora, observarAppState} = dependencias;
  const [estado, setEstado] = useState<EstadoDaAtualizacao | null>(null);
  const [atualizando, setAtualizando] = useState(false);
  const vivo = useRef(true);
  const estadoAtual = useRef<EstadoDaAtualizacao | null>(null);
  estadoAtual.current = estado;

  const atualizarAgora = useCallback(async () => {
    setAtualizando(true);
    try {
      const novo = await atualizar();
      if (vivo.current) {
        setEstado(novo);
      }
    } catch {
      // Falha inesperada: o estado salvo continua valendo.
    } finally {
      if (vivo.current) {
        setAtualizando(false);
      }
    }
  }, [atualizar]);

  useEffect(() => {
    vivo.current = true;
    if (!ativo) {
      setEstado(null);
      return undefined;
    }
    let cancelado = false;
    const recuperarSePreciso = async () => {
      const salvo = await armazenamento.ler().catch(() => null);
      if (cancelado) {
        return;
      }
      setEstado(salvo);
      if (deveRecuperar(salvo, agora())) {
        await atualizarAgora();
      }
    };
    recuperarSePreciso();
    // O sistema chama a atualização periódica; aqui só se liga o agendamento (e, no disparo, atualiza o estado).
    agendador.iniciar(async () => {
      const novo = await atualizar();
      if (!cancelado) {
        setEstado(novo);
      }
    });
    const deixarDeObservar = observarAppState(naTela => {
      if (naTela) {
        recuperarSePreciso();
      }
    });
    return () => {
      cancelado = true;
      vivo.current = false;
      deixarDeObservar();
      agendador.parar();
    };
  }, [ativo, agendador, armazenamento, atualizar, agora, observarAppState, atualizarAgora]);

  const valor = useMemo(() => ({estado, atualizando, atualizarAgora}), [estado, atualizando, atualizarAgora]);
  return <Contexto.Provider value={valor}>{children}</Contexto.Provider>;
}

export function useAtualizacao(): AtualizacaoViewModel {
  return useContext(Contexto);
}
