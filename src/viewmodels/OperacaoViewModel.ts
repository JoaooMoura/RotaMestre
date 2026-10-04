import {useCallback, useEffect, useMemo, useRef, useState} from 'react';
import * as api from '../servicos/api';
import {Motorista, Rota, Usuario} from '../tipos';

// Dependência injetada: hoje a API; na Sprint 2, um repositório com cache SQLite no mesmo formato.
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

// Um estado só, sem combinações impossíveis como "carregando e com erro".
export type EstadoOperacao =
  | {tipo: 'carregando'}
  | {tipo: 'erro'; mensagem: string}
  | {tipo: 'semRota'}
  | {tipo: 'pronto'; rota: Rota; motoristas: Motorista[]};

// Sem mensagem quando a sessão expirou: o SessaoViewModel já leva o usuário ao login.
export type ResultadoSalvar = {ok: true} | {ok: false; mensagem?: string};

export type OperacaoViewModel = {
  estado: EstadoOperacao;
  recarregar: () => Promise<void>;
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
): OperacaoViewModel {
  const [estado, setEstado] = useState<EstadoOperacao>({tipo: 'carregando'});
  // Respostas de uma carga mais antiga são descartadas (outra carga começou depois).
  const cargaAtual = useRef(0);
  // Respostas de um usuário anterior são descartadas (logout ou troca de conta no meio da requisição).
  const usuarioAtual = useRef(0);

  const recarregar = useCallback(async () => {
    const carga = ++cargaAtual.current;
    setEstado({tipo: 'carregando'});
    if (!usuario) {
      return;
    }

    try {
      // O backend decide qual rota cada papel vê; só o gestor precisa da lista de motoristas.
      const [rota, motoristas] = await Promise.all([
        servico.buscarRotaAtual(),
        usuario.papel === 'gestor' ? servico.buscarMotoristas() : Promise.resolve([]),
      ]);
      if (carga !== cargaAtual.current) {
        return;
      }
      setEstado(rota ? {tipo: 'pronto', rota, motoristas} : {tipo: 'semRota'});
    } catch (falha) {
      if (carga !== cargaAtual.current || sessaoExpirou(falha)) {
        return;
      }
      setEstado({tipo: 'erro', mensagem: mensagemDe(falha, 'Não foi possível carregar os dados.')});
    }
  }, [usuario, servico]);

  useEffect(() => {
    usuarioAtual.current++;
    recarregar();
  }, [recarregar]);

  const atualizarRota = useCallback(
    async (rota: Rota): Promise<ResultadoSalvar> => {
      const doUsuario = usuarioAtual.current;
      try {
        const salva = await servico.salvarRota(rota);
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
        return {ok: false, mensagem: mensagemDe(falha, 'Não foi possível salvar a rota.')};
      }
    },
    [servico],
  );

  return useMemo(
    () => ({estado, recarregar, atualizarRota}),
    [estado, recarregar, atualizarRota],
  );
}
