import React, {createContext, useContext, useEffect, useRef, useState} from 'react';
import * as api from '../servicos/api';
import {
  EstadoDoCompartilhamento,
  iniciarCompartilhamento,
  ServicoCompartilhamento,
} from './compartilhamentoDePosicao';
import {useStoreDaPosicao} from './LocalizacaoViewModel';

export const servicoCompartilhamentoApi: ServicoCompartilhamento = {
  enviar: async posicao => {
    await api.compartilharPosicao(posicao);
  },
  parar: async () => {
    await api.pararDeCompartilharPosicao();
  },
};

const Contexto = createContext<EstadoDoCompartilhamento>('inativo');

type Props = {
  /** Motorista com sessão e rota em andamento. Fora disso nada é enviado. */
  ativo: boolean;
  servico?: ServicoCompartilhamento;
  /** O servidor recusou a posição porque a rota mudou por fora (reatribuída ou encerrada): recarregue a rota. */
  aoRotaMudar?: () => void;
  children: React.ReactNode;
};

/** Compartilha a posição com o gestor enquanto `ativo`; dentro do `LocalizacaoProvider`. */
export function CompartilhamentoProvider({ativo, servico = servicoCompartilhamentoApi, aoRotaMudar, children}: Props) {
  const posicaoStore = useStoreDaPosicao();
  const [estado, setEstado] = useState<EstadoDoCompartilhamento>('inativo');
  const aoRotaMudarRef = useRef(aoRotaMudar);
  aoRotaMudarRef.current = aoRotaMudar;

  useEffect(() => {
    if (!ativo) {
      setEstado('inativo');
      return undefined;
    }
    const compartilhamento = iniciarCompartilhamento({
      posicaoStore,
      servico,
      relogio: {agora: Date.now},
      aoEstado: setEstado,
      aoRotaMudar: () => aoRotaMudarRef.current?.(),
    });
    return () => compartilhamento.parar();
  }, [ativo, posicaoStore, servico]);

  return <Contexto.Provider value={estado}>{children}</Contexto.Provider>;
}

export function useCompartilhamento(): EstadoDoCompartilhamento {
  return useContext(Contexto);
}
