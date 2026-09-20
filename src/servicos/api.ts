import {Motorista, Rota} from '../tipos';

const API_URL = 'http://127.0.0.1:3000/api';

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
    throw new Error(corpo.mensagem || 'Não foi possível acessar o servidor.');
  }

  return corpo as T;
}

export function buscarMotoristas() {
  return requisicao<Motorista[]>('/motoristas');
}

export function buscarRotaAtual() {
  return requisicao<Rota>('/rotas/atual');
}

export function salvarRota(rota: Rota) {
  return requisicao<Rota>(`/rotas/${encodeURIComponent(rota.id)}`, {
    method: 'PUT',
    body: JSON.stringify(rota),
  });
}
