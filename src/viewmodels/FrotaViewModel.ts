import {useCallback, useEffect, useMemo, useRef, useState} from 'react';
import {AppState} from 'react-native';
import {POLITICA_FROTA} from '../frota';
import * as api from '../servicos/api';
import {Frota} from '../tipos';

export type ServicoFrota = {buscarFrota: () => Promise<Frota>};
export const servicoFrotaApi: ServicoFrota = {buscarFrota: api.buscarFrota};

export type EstadoDaFrota =
  | {tipo: 'carregando'}
  /** Nunca chegou nada: sem dados para mostrar. */
  | {tipo: 'erro'; mensagem: string}
  /**
   * `atualizadoEm` é o instante (relógio do app) da última resposta. `falhaRecente` é preenchida quando a
   * consulta mais nova falhou: os dados mostrados envelhecem e a tela os trata como desatualizados.
   */
  | {tipo: 'pronto'; frota: Frota; atualizadoEm: number; falhaRecente: string | null};

export type FrotaViewModel = {
  estado: EstadoDaFrota;
  atualizar: () => Promise<void>;
};

export type DependenciasDaFrota = {
  servico: ServicoFrota;
  agora: () => number;
  /** Avisa se o app está em primeiro plano; a consulta periódica só roda assim. */
  observarAppState: (aoMudar: (naTela: boolean) => void) => () => void;
  intervaloMs: number;
};

export const dependenciasDaFrotaPadrao: DependenciasDaFrota = {
  servico: servicoFrotaApi,
  agora: Date.now,
  observarAppState: aoMudar => {
    const assinatura = AppState.addEventListener('change', estado => aoMudar(estado === 'active'));
    return () => assinatura.remove();
  },
  intervaloMs: POLITICA_FROTA.consultaMs,
};

/** Consulta a frota ao abrir e a cada 15 s enquanto a tela está aberta e o app, em primeiro plano. */
export function useFrotaViewModel(dependencias: DependenciasDaFrota = dependenciasDaFrotaPadrao): FrotaViewModel {
  const {servico, agora, observarAppState, intervaloMs} = dependencias;
  const [estado, setEstado] = useState<EstadoDaFrota>({tipo: 'carregando'});
  const consulta = useRef(0);
  const vivo = useRef(true);

  const atualizar = useCallback(async () => {
    const minha = ++consulta.current;
    try {
      const frota = await servico.buscarFrota();
      if (vivo.current && minha === consulta.current) {
        setEstado({tipo: 'pronto', frota, atualizadoEm: agora(), falhaRecente: null});
      }
    } catch (falha) {
      if (!vivo.current || minha !== consulta.current) {
        return;
      }
      // 401: a sessão expirou e quem trata é a SessaoViewModel (a tela some).
      if (falha instanceof api.ErroApi && falha.status === 401) {
        return;
      }
      const mensagem = falha instanceof Error ? falha.message : 'Não foi possível atualizar a frota.';
      setEstado(atual => (atual.tipo === 'pronto' ? {...atual, falhaRecente: mensagem} : {tipo: 'erro', mensagem}));
    }
  }, [servico, agora]);

  useEffect(() => {
    vivo.current = true;
    let naTela = true;
    let temporizador: ReturnType<typeof setInterval> | null = null;
    const ligar = () => {
      if (temporizador === null) {
        temporizador = setInterval(atualizar, intervaloMs);
      }
    };
    const desligar = () => {
      if (temporizador !== null) {
        clearInterval(temporizador);
        temporizador = null;
      }
    };
    atualizar();
    ligar();
    const deixarDeObservar = observarAppState(ativo => {
      if (ativo === naTela) {
        return;
      }
      naTela = ativo;
      if (ativo) {
        atualizar();
        ligar();
      } else {
        desligar();
      }
    });
    return () => {
      vivo.current = false;
      desligar();
      deixarDeObservar();
    };
  }, [atualizar, intervaloMs, observarAppState]);

  return useMemo(() => ({estado, atualizar}), [estado, atualizar]);
}
