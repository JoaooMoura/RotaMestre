import {API_URL} from '../configuracao';
import {Frota, Motorista, NovoMotorista, Rota, Sessao, Trajeto} from '../tipos';

export const SEM_CONEXAO = 0;

export class ErroApi extends Error {
  constructor(
    mensagem: string,
    readonly status: number,
    /** Código de negócio informado pelo servidor (ex.: REATRIBUIDA), quando há. */
    readonly codigo?: string,
  ) {
    super(mensagem);
  }
}

let tokenAtual: string | null = null;
let aoExpirar: (() => void) | null = null;

export function definirToken(token: string | null) {
  tokenAtual = token;
}

export function tokenEmUso() {
  return tokenAtual;
}

/**
 * Executa com o token dado (tarefa em segundo plano, sem tela). Se já há uma sessão aberta no app, ela é mantida e
 * usada: o token da tarefa nunca substitui o da tela, e só é removido se foi a tarefa quem o colocou.
 */
export async function comToken<T>(token: string, tarefa: () => Promise<T>): Promise<T> {
  if (tokenAtual !== null) {
    return tarefa();
  }
  tokenAtual = token;
  try {
    return await tarefa();
  } finally {
    if (tokenAtual === token) {
      tokenAtual = null;
    }
  }
}

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

  const corpo = await resposta.json().catch(() => ({}));

  if (!resposta.ok) {
    if (resposta.status === 401 && tokenEnviado) {
      aoExpirar?.();
    }
    throw new ErroApi(
      corpo.mensagem || 'Não foi possível acessar o servidor.',
      resposta.status,
      typeof corpo.codigo === 'string' ? corpo.codigo : undefined,
    );
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

export function obterTrajeto(rotaId: string) {
  return requisicao<Trajeto>(`/rotas/${encodeURIComponent(rotaId)}/trajeto`);
}

/** Compartilha a posição atual com o gestor (o servidor guarda só a última). */
export function compartilharPosicao(posicao: {latitude: number; longitude: number; precisaoM: number | null; registradaEm: number}) {
  return requisicao<void>('/localizacao', {
    method: 'PUT',
    body: JSON.stringify({
      latitude: posicao.latitude,
      longitude: posicao.longitude,
      precisaoM: posicao.precisaoM,
      registradaEm: posicao.registradaEm,
    }),
  });
}

/** Deixa de compartilhar: o servidor apaga a última posição. */
export function pararDeCompartilharPosicao() {
  return requisicao<void>('/localizacao', {method: 'DELETE'});
}

/** Só o gestor: motoristas com rota em andamento, posição e andamento das paradas. */
export function buscarFrota() {
  return requisicao<Frota>('/frota');
}

/** Pede um novo trajeto da posição atual até as paradas que faltam. A posição só vai nesta chamada. */
export function recalcularTrajeto(rotaId: string, posicao: {latitude: number; longitude: number}) {
  return requisicao<Trajeto>(`/rotas/${encodeURIComponent(rotaId)}/recalcular`, {
    method: 'POST',
    body: JSON.stringify({latitude: posicao.latitude, longitude: posicao.longitude}),
  });
}

export function salvarRota(rota: Rota) {
  return requisicao<Rota>(`/rotas/${encodeURIComponent(rota.id)}`, {
    method: 'PUT',
    body: JSON.stringify(rota),
  });
}

/** O servidor responde? Usado para saber se já dá para sincronizar (a rede do aparelho pode estar ligada sem o servidor). */
export async function verificarSaude(): Promise<boolean> {
  try {
    await requisicao<{status: string}>('/health');
    return true;
  } catch {
    return false;
  }
}

export type EnvioDeComprovante = {
  idEnvio: string;
  recebedor: string;
  assinatura: string;
  foto?: string;
  coletadoEm: number;
  /** Conta que coletou a assinatura: só ela pode enviá-la (o servidor confere com o login). */
  coletadoPor: string;
};

export type RespostaDoEnvio = {
  duplicado: boolean;
  recebidoEm: number;
  comprovante: {recebedor: string; registradoEm: number};
  statusDaRota: string;
};

/** Envia um comprovante coletado sem rede. Repetir o mesmo `idEnvio` não cria outro comprovante. */
export function enviarComprovante(rotaId: string, paradaId: string, envio: EnvioDeComprovante) {
  return requisicao<RespostaDoEnvio>(
    `/rotas/${encodeURIComponent(rotaId)}/paradas/${encodeURIComponent(paradaId)}/comprovante`,
    {method: 'POST', body: JSON.stringify(envio)},
  );
}
