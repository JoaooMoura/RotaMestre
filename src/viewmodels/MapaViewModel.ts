import {useCallback, useEffect, useMemo, useRef, useState} from 'react';
import * as api from '../servicos/api';
import {Trajeto} from '../tipos';

const STATUS_SEM_TRAJETO = 422;

export type ServicoTrajeto = {
  obterTrajeto: (rotaId: string) => Promise<Trajeto>;
};

export const servicoTrajetoApi: ServicoTrajeto = {
  obterTrajeto: api.obterTrajeto,
};

export type EstadoMapa =
  | {tipo: 'carregando'}
  | {tipo: 'erro'; mensagem: string}
  | {tipo: 'semTrajeto'; mensagem: string}
  | {tipo: 'pronto'; trajeto: Trajeto; /** Veio do pacote baixado, não do servidor. */ baixado?: boolean};

export type MapaViewModel = {
  estado: EstadoMapa;
  recarregar: () => Promise<void>;
};

export type OpcoesDoMapa = {
  /** Trajeto do pacote baixado desta rota, para quando não há conexão. */
  baixado?: Trajeto | null;
  /** Já se sabe que não há conexão (modo offline): nem tenta o servidor. */
  somenteBaixado?: boolean;
};

export function useMapaViewModel(
  rotaId: string,
  servico: ServicoTrajeto = servicoTrajetoApi,
  opcoes: OpcoesDoMapa = {},
): MapaViewModel {
  const {baixado = null, somenteBaixado = false} = opcoes;
  const [estado, setEstado] = useState<EstadoMapa>({tipo: 'carregando'});
  const cargaAtual = useRef(0);

  const recarregar = useCallback(async () => {
    const carga = ++cargaAtual.current;
    setEstado({tipo: 'carregando'});

    if (somenteBaixado) {
      setEstado(
        baixado
          ? {tipo: 'pronto', trajeto: baixado, baixado: true}
          : {tipo: 'erro', mensagem: 'Sem conexão e este trajeto não foi baixado neste aparelho.'},
      );
      return;
    }

    try {
      const trajeto = await servico.obterTrajeto(rotaId);
      if (carga === cargaAtual.current) {
        setEstado({tipo: 'pronto', trajeto});
      }
    } catch (falha) {
      if (carga !== cargaAtual.current) {
        return;
      }
      if (falha instanceof api.ErroApi && falha.status === 401) {
        return;
      }
      if (falha instanceof api.ErroApi && falha.status === api.SEM_CONEXAO && baixado) {
        setEstado({tipo: 'pronto', trajeto: baixado, baixado: true});
        return;
      }
      const mensagem =
        falha instanceof Error ? falha.message : 'Não foi possível carregar o trajeto.';
      const semTrajeto = falha instanceof api.ErroApi && falha.status === STATUS_SEM_TRAJETO;
      setEstado({tipo: semTrajeto ? 'semTrajeto' : 'erro', mensagem});
    }
  }, [rotaId, servico, baixado, somenteBaixado]);

  useEffect(() => {
    recarregar();
  }, [recarregar]);

  return useMemo(() => ({estado, recarregar}), [estado, recarregar]);
}
