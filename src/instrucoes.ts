import {Manobra} from './tipos';

export type NomeDeIcone =
  | 'arrow-up'
  | 'arrow-top-left'
  | 'arrow-top-right'
  | 'arrow-left-top'
  | 'arrow-right-top'
  | 'arrow-bottom-left'
  | 'arrow-bottom-right'
  | 'arrow-u-left-top'
  | 'directions-fork'
  | 'rotate-right'
  | 'flag-checkered';

export type ContextoDaManobra = {
  /** Número (a partir de 1) da parada a que o trecho leva; usado nas chegadas. */
  numeroDaParada?: number;
  /** A chegada é ao destino final da rota (e não a uma parada intermediária). */
  destinoFinal?: boolean;
};

type Genero = 'f' | 'm' | 'n';

const VIAS_MASCULINAS = new Set([
  'viaduto', 'largo', 'beco', 'parque', 'jardim', 'anel', 'trevo', 'acesso', 'contorno', 'corredor',
  'complexo', 'eixo', 'túnel', 'tunel', 'rodoanel', 'caminho',
]);
const VIAS_FEMININAS = new Set([
  'rua', 'avenida', 'alameda', 'travessa', 'praça', 'praca', 'estrada', 'rodovia', 'ladeira', 'via', 'marginal',
  'passarela', 'ponte', 'vila', 'rotatória', 'rotatoria', 'passagem', 'servidão', 'servidao', 'ciclovia',
]);
const REFERENCIA_DE_RODOVIA = /^[A-Z]{2,3}[ -]?\d{1,4}/;

export function generoDaVia(via: string): Genero {
  const primeira = via.trim().split(/\s+/)[0]?.toLowerCase() ?? '';
  if (VIAS_MASCULINAS.has(primeira)) {
    return 'm';
  }
  if (VIAS_FEMININAS.has(primeira) || REFERENCIA_DE_RODOVIA.test(via.trim())) {
    return 'f';
  }
  return 'n';
}

const ARTIGOS = {
  em: {f: 'na', m: 'no', n: 'em'},
  por: {f: 'pela', m: 'pelo', n: 'por'},
  para: {f: 'para a', m: 'para o', n: 'para'},
} as const;

/** "na Rua X", "no Viaduto Y", "em Nome Sem Tipo"; vazio se a via não tem nome. */
function comVia(preposicao: keyof typeof ARTIGOS, via: string) {
  const nome = via.trim();
  return nome ? ` ${ARTIGOS[preposicao][generoDaVia(nome)]} ${nome}` : '';
}

const LADO: Record<string, 'esquerda' | 'direita' | null> = {
  left: 'esquerda',
  'slight left': 'esquerda',
  'sharp left': 'esquerda',
  right: 'direita',
  'slight right': 'direita',
  'sharp right': 'direita',
  straight: null,
  uturn: null,
};

const ladoDe = (m: Manobra) => (m.modificador ? LADO[m.modificador] ?? null : null);

function acaoDeVirar(m: Manobra) {
  switch (m.modificador) {
    case 'left':
      return 'Vire à esquerda';
    case 'right':
      return 'Vire à direita';
    case 'slight left':
      return 'Vire levemente à esquerda';
    case 'slight right':
      return 'Vire levemente à direita';
    case 'sharp left':
      return 'Faça uma curva fechada à esquerda';
    case 'sharp right':
      return 'Faça uma curva fechada à direita';
    case 'uturn':
      return 'Faça o retorno';
    default:
      return 'Siga em frente';
  }
}

const ORDINAIS = ['primeira', 'segunda', 'terceira', 'quarta', 'quinta', 'sexta', 'sétima', 'oitava', 'nona', 'décima'];

const minuscula = (texto: string) => texto.charAt(0).toLowerCase() + texto.slice(1);

/** Instrução completa e imperativa da manobra, em português. */
export function textoDaManobra(m: Manobra, contexto: ContextoDaManobra = {}): string {
  const lado = ladoDe(m);
  switch (m.tipo) {
    case 'depart':
      return m.via ? `Siga${comVia('por', m.via)}` : 'Siga em frente';
    case 'turn':
    case 'roundabout turn':
      return `${acaoDeVirar(m)}${comVia('em', m.via)}`;
    case 'end of road':
      return `No fim da via, ${minuscula(acaoDeVirar(m))}${comVia('em', m.via)}`;
    case 'on ramp':
      return `Pegue a entrada${lado ? ` à ${lado === 'esquerda' ? 'esquerda' : 'direita'}` : ''}${comVia('para', m.via)}`;
    case 'off ramp':
      return `Pegue a saída${lado ? ` à ${lado === 'esquerda' ? 'esquerda' : 'direita'}` : ''}${comVia('para', m.via)}`;
    case 'merge':
      return m.via ? `Entre${comVia('em', m.via)}` : 'Faça a junção com a via';
    case 'fork':
      return `Na bifurcação, mantenha-se à ${lado === 'esquerda' ? 'esquerda' : 'direita'}${comVia('em', m.via)}`;
    case 'new name': {
      const desvio = m.modificador === 'slight left' ? ' levemente à esquerda' : m.modificador === 'slight right' ? ' levemente à direita' : '';
      return `Continue${desvio}${comVia('por', m.via)}`;
    }
    case 'continue':
      return `Continue em frente${comVia('por', m.via)}`;
    case 'roundabout':
    case 'rotary': {
      const ordinal = m.saida ? ORDINAIS[m.saida - 1] ?? `${m.saida}ª` : null;
      return ordinal ? `Na rotatória, pegue a ${ordinal} saída${comVia('para', m.via)}` : `Entre na rotatória${comVia('para', m.via)}`;
    }
    case 'exit roundabout':
    case 'exit rotary':
      return `Saia da rotatória${comVia('para', m.via)}`;
    case 'arrive': {
      const destino = contexto.destinoFinal === false && contexto.numeroDaParada ? `à parada ${contexto.numeroDaParada}` : 'ao seu destino';
      const lugar = lado ? `. O local fica à ${lado}` : '';
      return `Você chegou ${destino}${lugar}`;
    }
    default:
      return `Siga em frente${comVia('por', m.via)}`;
  }
}

/** Distância dita em voz alta: arredonda para não falar "287 metros". */
export function falarDistancia(metros: number): string {
  if (metros >= 950) {
    const km = Math.round(metros / 100) / 10;
    const texto = String(km).replace('.', ',');
    return km === 1 ? '1 quilômetro' : `${texto} quilômetros`;
  }
  const passo = metros < 100 ? 10 : 50;
  const arredondada = Math.max(passo, Math.round(metros / passo) * passo);
  return `${arredondada} metros`;
}

/** Aviso antecipado: "Em 300 metros, vire à direita na Rua X". */
export function textoDeAviso(m: Manobra, distanciaM: number, contexto: ContextoDaManobra = {}): string {
  if (m.tipo === 'arrive') {
    const destino = contexto.destinoFinal === false && contexto.numeroDaParada ? `à parada ${contexto.numeroDaParada}` : 'ao seu destino';
    return `Em ${falarDistancia(distanciaM)}, você chegará ${destino}`;
  }
  return `Em ${falarDistancia(distanciaM)}, ${minuscula(textoDaManobra(m, contexto))}`;
}

export function iconeDaManobra(m: Manobra): NomeDeIcone {
  if (m.tipo === 'arrive') {
    return 'flag-checkered';
  }
  if (m.tipo === 'roundabout' || m.tipo === 'rotary' || m.tipo === 'exit roundabout' || m.tipo === 'exit rotary') {
    return 'rotate-right';
  }
  if (m.tipo === 'fork') {
    return 'directions-fork';
  }
  switch (m.modificador) {
    case 'left':
      return 'arrow-left-top';
    case 'right':
      return 'arrow-right-top';
    case 'slight left':
      return 'arrow-top-left';
    case 'slight right':
      return 'arrow-top-right';
    case 'sharp left':
      return 'arrow-bottom-left';
    case 'sharp right':
      return 'arrow-bottom-right';
    case 'uturn':
      return 'arrow-u-left-top';
    default:
      return 'arrow-up';
  }
}
