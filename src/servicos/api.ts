import {Motorista, NovoMotorista, Rota, Sessao} from '../tipos';

const API_URL = 'http://127.0.0.1:3000/api';

// Status usado quando a requisição nem chegou ao servidor (sem rede, servidor fora do ar).
export const SEM_CONEXAO = 0;

export class ErroApi extends Error {
  constructor(mensagem: string, readonly status: number) {
    super(mensagem);
  }
}

// O token fica só em memória: fechar o app encerra a sessão (persistência fica para a Sprint 2).
let tokenAtual: string | null = null;
let aoExpirar: (() => void) | null = null;

export function definirToken(token: string | null) {
  tokenAtual = token;
}

// Registra quem deve ser avisado quando uma requisição autenticada receber 401.
export function aoExpirarSessao(callback: () => void) {
  aoExpirar = callback;
  return () => {
    if (aoExpirar === callback) {
      aoExpirar = null;
    }
  };
}

async function requisicao<T>(caminho: string, opcoes?: RequestInit): Promise<T> {
  const tokenEnviado = tokenAtual;
  let resposta: Response;

  try {
    resposta = await fetch(`${API_URL}${caminho}`, {
      ...opcoes,
      headers: {
        'Content-Type': 'application/json',
        ...(tokenEnviado ? {Authorization: `Bearer ${tokenEnviado}`} : {}),
        ...opcoes?.headers,
      },
    });
  } catch {
    throw new ErroApi('Sem conexão com o servidor. Verifique a internet e tente novamente.', SEM_CONEXAO);
  }

  // Respostas de erro fora do padrão (ex.: HTML de um proxy) não podem virar "JSON Parse error".
  const corpo = await resposta.json().catch(() => ({}));

  if (!resposta.ok) {
    // Só uma requisição que levou token pode significar sessão expirada; o 401 do login é senha errada.
    if (resposta.status === 401 && tokenEnviado) {
      aoExpirar?.();
    }
    throw new ErroApi(corpo.mensagem || 'Não foi possível acessar o servidor.', resposta.status);
  }

  return corpo as T;
}

export function entrar(email: string, senha: string) {
  return requisicao<Sessao>('/auth/login', {
    method: 'POST',
    body: JSON.stringify({email, senha}),
  });
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

// Para o motorista, o backend usa o id do token e ignora o filtro; o gestor pode filtrar.
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
