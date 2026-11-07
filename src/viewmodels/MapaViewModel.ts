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
  | {tipo: 'pronto'; trajeto: Trajeto};

export type MapaViewModel = {
  estado: EstadoMapa;
  recarregar: () => Promise<void>;
};

export function useMapaViewModel(
  rotaId: string,
  servico: ServicoTrajeto = servicoTrajetoApi,
): MapaViewModel {
  const [estado, setEstado] = useState<EstadoMapa>({tipo: 'carregando'});
  const cargaAtual = useRef(0);

  const recarregar = useCallback(async () => {
    const carga = ++cargaAtual.current;
    setEstado({tipo: 'carregando'});

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
      const mensagem =
        falha instanceof Error ? falha.message : 'Não foi possível carregar o trajeto.';
      const semTrajeto = falha instanceof api.ErroApi && falha.status === STATUS_SEM_TRAJETO;
      setEstado({tipo: semTrajeto ? 'semTrajeto' : 'erro', mensagem});
    }
  }, [rotaId, servico]);

  useEffect(() => {
    recarregar();
  }, [recarregar]);

  return useMemo(() => ({estado, recarregar}), [estado, recarregar]);
}
