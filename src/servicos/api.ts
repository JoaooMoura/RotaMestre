import {Motorista, NovoMotorista, Rota} from '../tipos';

const API_URL = 'http://127.0.0.1:3000/api';

export class ErroApi extends Error {
  constructor(mensagem: string, readonly status: number) {
    super(mensagem);
  }
}

async function requisicao<T>(caminho: string, opcoes?: RequestInit): Promise<T> {
  const resposta = await fetch(`${API_URL}${caminho}`, {
    ...opcoes,
    headers: {
      'Content-Type': 'application/json',
      ...opcoes?.headers,
    },
  });

  const corpo = await resposta.json();

  if (!resposta.ok) {
    throw new ErroApi(corpo.mensagem || 'Não foi possível acessar o servidor.', resposta.status);
  }

  return corpo as T;
}

export function buscarMotoristas() {
  return requisicao<Motorista[]>('/motoristas');
}

export function cadastrarMotorista(motorista: NovoMotorista) {
  return requisicao('/motoristas', {
    method: 'POST',
    body: JSON.stringify(motorista),
  });
}

// Sem motoristaId, devolve a rota atual de qualquer motorista (visão do gestor).
export async function buscarRotaAtual(motoristaId?: string): Promise<Rota | null> {
  const filtro = motoristaId ? `?motoristaId=${encodeURIComponent(motoristaId)}` : '';
  try {
    return await requisicao<Rota>(`/rotas/atual${filtro}`);
  } catch (falha) {
    if (falha instanceof ErroApi && falha.status === 404) {
      return null;
    }
    throw falha;
  }
}

export function salvarRota(rota: Rota) {
  return requisicao<Rota>(`/rotas/${encodeURIComponent(rota.id)}`, {
    method: 'PUT',
    body: JSON.stringify(rota),
  });
}
