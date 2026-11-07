import {limitesDasCoordenadas, LimitesDoMapa} from './mapa';
import type {RespostaDoEnvio} from './servicos/api';
import {Parada, Rota, Trajeto, Usuario} from './tipos';

/** Tudo o que o aparelho guarda para abrir a rota sem rede (US06.01). */
export type PacoteOffline = {
  versao: 1;
  usuario: Usuario;
  /** Rota como estava no servidor; fotos e assinaturas nunca vêm do servidor, então não estão aqui. */
  rota: Rota;
  trajeto: Trajeto;
  baixadoEm: number;
  mapa: {packId: string; limites: LimitesDoMapa; minZoom: number; maxZoom: number};
};

/** Resumo mostrado na tela de entrada, sem abrir a rota. */
export type ResumoDoPacote = {usuarioId: string; usuarioNome: string; rotaId: string; rotaNome: string; baixadoEm: number};

export type StatusDaPendencia = 'pendente' | 'enviando' | 'rejeitada';

/** Assinatura coletada sem rede, à espera de envio (US06.03/06.04). */
export type Pendencia = {
  /** Também é a chave de idempotência enviada ao servidor. */
  id: string;
  usuarioId: string;
  rotaId: string;
  paradaId: string;
  destinatario: string;
  recebedor: string;
  assinatura: string;
  foto?: string;
  coletadoEm: number;
  status: StatusDaPendencia;
  tentativas: number;
  ultimoErro?: string;
  /** Código do servidor quando rejeitou (REATRIBUIDA, JA_CONCLUIDA, ...). */
  motivoDaRejeicao?: string;
};

export const POLITICA_OFFLINE = {
  /** Folga ao redor da rota, para o mapa não acabar na borda do trajeto. */
  margemM: 1500,
  minZoom: 10,
  maxZoomDesejado: 16,
  maxZoomMinimo: 12,
  /** Limite de blocos de mapa por pacote (o MapLibre aceita 6000 por padrão). */
  limiteDeBlocos: 4000,
  intervaloDeEnvioMs: 15_000,
  intervaloMaximoDeEnvioMs: 120_000,
} as const;

const METROS_POR_GRAU_DE_LATITUDE = 111_320;

export function expandirLimites([oeste, sul, leste, norte]: LimitesDoMapa, margemM: number): LimitesDoMapa {
  const dLat = margemM / METROS_POR_GRAU_DE_LATITUDE;
  const latitudeCentral = ((sul + norte) / 2) * (Math.PI / 180);
  const dLon = margemM / (METROS_POR_GRAU_DE_LATITUDE * Math.max(0.1, Math.cos(latitudeCentral)));
  return [oeste - dLon, sul - dLat, leste + dLon, norte + dLat];
}

function xDoBloco(longitude: number, zoom: number) {
  return Math.floor(((longitude + 180) / 360) * 2 ** zoom);
}

function yDoBloco(latitude: number, zoom: number) {
  const rad = (Math.max(-85.0511, Math.min(85.0511, latitude)) * Math.PI) / 180;
  return Math.floor(((1 - Math.log(Math.tan(rad) + 1 / Math.cos(rad)) / Math.PI) / 2) * 2 ** zoom);
}

/** Quantidade de blocos de mapa que cobrem a região em um nível de zoom. */
export function contarBlocos([oeste, sul, leste, norte]: LimitesDoMapa, zoom: number) {
  const colunas = xDoBloco(leste, zoom) - xDoBloco(oeste, zoom) + 1;
  const linhas = yDoBloco(sul, zoom) - yDoBloco(norte, zoom) + 1;
  return Math.max(1, colunas) * Math.max(1, linhas);
}

export type RegiaoDoMapa = {limites: LimitesDoMapa; minZoom: number; maxZoom: number; blocos: number};

/**
 * Região a baixar: o trajeto e as paradas com folga. O zoom máximo é o maior (até 16) que cabe no
 * limite de blocos; se nem o zoom 12 couber, a região é grande demais e não é baixada.
 */
export function planejarRegiao(trajeto: Trajeto): RegiaoDoMapa | null {
  const pontos = [
    ...trajeto.geometria.coordinates,
    ...trajeto.paradas.map(p => [p.longitude, p.latitude] as [number, number]),
  ];
  const base = limitesDasCoordenadas(pontos);
  if (!base) {
    return null;
  }
  const limites = expandirLimites(base, POLITICA_OFFLINE.margemM);
  for (let maxZoom = POLITICA_OFFLINE.maxZoomDesejado; maxZoom >= POLITICA_OFFLINE.maxZoomMinimo; maxZoom--) {
    let blocos = 0;
    for (let zoom = POLITICA_OFFLINE.minZoom; zoom <= maxZoom; zoom++) {
      blocos += contarBlocos(limites, zoom);
    }
    if (blocos <= POLITICA_OFFLINE.limiteDeBlocos) {
      return {limites, minZoom: POLITICA_OFFLINE.minZoom, maxZoom, blocos};
    }
  }
  return null;
}

const ehTexto = (v: unknown): v is string => typeof v === 'string' && v.length > 0;

export function pacoteValido(dados: any): dados is PacoteOffline {
  return (
    dados?.versao === 1 &&
    ehTexto(dados.usuario?.id) &&
    ehTexto(dados.usuario?.nome) &&
    dados.usuario?.papel === 'motorista' &&
    ehTexto(dados.rota?.id) &&
    Array.isArray(dados.rota?.paradas) &&
    Array.isArray(dados.trajeto?.geometria?.coordinates) &&
    Array.isArray(dados.trajeto?.manobras) &&
    Array.isArray(dados.trajeto?.paradas) &&
    typeof dados.baixadoEm === 'number' &&
    ehTexto(dados.mapa?.packId) &&
    Array.isArray(dados.mapa?.limites) &&
    dados.mapa.limites.length === 4
  );
}

export function pendenciaValida(dados: any): dados is Pendencia {
  return (
    ehTexto(dados?.id) &&
    ehTexto(dados.usuarioId) &&
    ehTexto(dados.rotaId) &&
    ehTexto(dados.paradaId) &&
    typeof dados.recebedor === 'string' &&
    typeof dados.assinatura === 'string' &&
    dados.assinatura.startsWith('data:image/png;base64,') &&
    (dados.foto === undefined || typeof dados.foto === 'string') &&
    typeof dados.coletadoEm === 'number' &&
    ['pendente', 'enviando', 'rejeitada'].includes(dados.status) &&
    typeof dados.tentativas === 'number'
  );
}

export const resumoDe = (pacote: PacoteOffline): ResumoDoPacote => ({
  usuarioId: pacote.usuario.id,
  usuarioNome: pacote.usuario.nome,
  rotaId: pacote.rota.id,
  rotaNome: pacote.rota.nome,
  baixadoEm: pacote.baixadoEm,
});

/** Espera entre tentativas de envio: 15 s, 30 s, 60 s, até 2 min. */
export function esperaAteNovaTentativaMs(tentativas: number) {
  const {intervaloDeEnvioMs, intervaloMaximoDeEnvioMs} = POLITICA_OFFLINE;
  return Math.min(intervaloMaximoDeEnvioMs, intervaloDeEnvioMs * 2 ** Math.max(0, tentativas));
}

/** "07/11 18:40": dia, mês e hora local. */
export function formatarDataEHora(instante: number): string {
  const data = new Date(instante);
  const dois = (n: number) => String(n).padStart(2, '0');
  return `${dois(data.getDate())}/${dois(data.getMonth() + 1)} ${dois(data.getHours())}:${dois(data.getMinutes())}`;
}

export const LIMITE_DA_IMAGEM_BYTES = 512 * 1024;

/** O aparelho guarda a sessão (Manter conectado, mesmo vencida) deste mesmo motorista? Só então dá para coletar sem entrar. */
export function guardaSessaoDe(guardado: Usuario | null, usuarioId: string | null | undefined): boolean {
  return guardado !== null && typeof usuarioId === 'string' && guardado.id === usuarioId;
}

/** Consulta sem sessão guardada é só leitura: coletar assinatura exige estar (ou ter estado) logado neste aparelho. */
export const MENSAGEM_ENTRAR_PARA_COLETAR = 'Entre na conta para coletar assinaturas.';

export const MENSAGEM_SO_ASSINATURA =
  'Sem conexão: neste momento só é possível coletar assinaturas. Outras alterações na rota precisam de conexão.';

/**
 * Mostra, sobre a rota baixada, as entregas já coletadas sem rede: elas aparecem concluídas, mas a
 * tela as identifica como "aguardando envio" enquanto a pendência existir. Pendência rejeitada não conta.
 */
export function aplicarPendencias(rota: Rota, pendencias: Pendencia[]): Rota {
  const aplicaveis = pendencias.filter(p => p.rotaId === rota.id && p.status !== 'rejeitada');
  if (aplicaveis.length === 0) {
    return rota;
  }
  const paradas = rota.paradas.map(parada => {
    const pendencia = aplicaveis.find(p => p.paradaId === parada.id);
    return pendencia
      ? {...parada, status: 'Concluída' as const, comprovante: {recebedor: pendencia.recebedor, registradoEm: pendencia.coletadoEm}}
      : parada;
  });
  const todasConcluidas = paradas.every(p => p.status === 'Concluída' || p.status === 'Não realizada');
  return {...rota, paradas, status: todasConcluidas ? 'Concluída' : rota.status};
}

export type EntregaOffline = {ok: true; parada: Parada} | {ok: false; mensagem: string};

const MESMOS_DADOS: (keyof Parada)[] = ['id', 'tipo', 'destinatario', 'endereco', 'janela', 'observacao'];

/**
 * Sem rede só se aceita uma coisa: a entrega de UMA parada com assinatura (a foto é opcional).
 * Qualquer outra mudança na rota é recusada com a razão, em vez de ser guardada e perdida depois.
 */
export function detectarEntregaOffline(base: Rota, nova: Rota, pendencias: Pendencia[] = []): EntregaOffline {
  const recusa = (mensagem: string): EntregaOffline => ({ok: false, mensagem});
  if (
    base.id !== nova.id ||
    base.motoristaId !== nova.motoristaId ||
    base.nome !== nova.nome ||
    base.paradas.length !== nova.paradas.length ||
    (nova.status !== base.status && nova.status !== 'Concluída')
  ) {
    return recusa(MENSAGEM_SO_ASSINATURA);
  }
  const alteradas: Parada[] = [];
  for (let i = 0; i < base.paradas.length; i++) {
    const antes = base.paradas[i];
    const depois = nova.paradas[i];
    if (MESMOS_DADOS.some(campo => antes[campo] !== depois[campo])) {
      return recusa(MENSAGEM_SO_ASSINATURA);
    }
    if (antes.status !== depois.status || antes.comprovante?.recebedor !== depois.comprovante?.recebedor) {
      alteradas.push(depois);
    }
  }
  const [entregue] = alteradas;
  if (alteradas.length !== 1 || entregue.status !== 'Concluída' || !entregue.comprovante?.assinatura) {
    return recusa(MENSAGEM_SO_ASSINATURA);
  }
  const {assinatura, foto, recebedor} = entregue.comprovante;
  if (!recebedor.trim() || !assinatura.startsWith('data:image/png;base64,')) {
    return recusa('A assinatura ou o nome do recebedor está inválido. Colete a assinatura novamente.');
  }
  if (assinatura.length > LIMITE_DA_IMAGEM_BYTES || (foto !== undefined && foto.length > LIMITE_DA_IMAGEM_BYTES)) {
    return recusa('A imagem é grande demais para guardar. Colete a assinatura ou a foto novamente.');
  }
  if (pendencias.some(p => p.rotaId === base.id && p.paradaId === entregue.id && p.status !== 'rejeitada')) {
    return recusa('Já existe uma assinatura guardada para esta parada, aguardando envio.');
  }
  return {ok: true, parada: entregue};
}

export function criarPendencia(dados: {id: string; usuarioId: string; rotaId: string; parada: Parada; agora: number}): Pendencia {
  const {parada} = dados;
  const comprovante = parada.comprovante!;
  return {
    id: dados.id,
    usuarioId: dados.usuarioId,
    rotaId: dados.rotaId,
    paradaId: parada.id,
    destinatario: parada.destinatario,
    recebedor: comprovante.recebedor.trim(),
    assinatura: comprovante.assinatura!,
    ...(comprovante.foto ? {foto: comprovante.foto} : {}),
    coletadoEm: dados.agora,
    status: 'pendente',
    tentativas: 0,
  };
}

/** Identificador de envio (chave de idempotência): único o bastante para este aparelho. */
export function gerarIdDeEnvio(agora: number = Date.now()): string {
  const aleatorio = () => Math.random().toString(36).slice(2, 10);
  return `env-${agora.toString(36)}-${aleatorio()}${aleatorio()}`;
}

/** Reflete no pacote baixado uma entrega que o servidor confirmou (a imagem não é guardada no pacote). */
export function aplicarConfirmacaoNoPacote(pacote: PacoteOffline, pendencia: Pendencia, resposta: RespostaDoEnvio): PacoteOffline {
  const paradas = pacote.rota.paradas.map(parada =>
    parada.id === pendencia.paradaId
      ? {
          ...parada,
          status: 'Concluída' as const,
          comprovante: {
            recebedor: resposta.comprovante?.recebedor ?? pendencia.recebedor,
            registradoEm: resposta.comprovante?.registradoEm ?? pendencia.coletadoEm,
          },
        }
      : parada,
  );
  const todasConcluidas = paradas.every(p => p.status === 'Concluída' || p.status === 'Não realizada');
  return {...pacote, rota: {...pacote.rota, paradas, status: todasConcluidas ? 'Concluída' : pacote.rota.status}};
}
