const crypto = require('node:crypto');

const DISTANCIA_MAXIMA_ENCAIXE_M = 300;
const TEMPO_LIMITE_MS = 10000;

function erroServico(status, mensagem) {
  const erro = new Error(mensagem);
  erro.status = status;
  return erro;
}

function hashDosPontos(pontos) {
  const normalizados = pontos.map(({latitude, longitude}) => [
    Number(latitude.toFixed(6)),
    Number(longitude.toFixed(6)),
  ]);
  return crypto.createHash('sha256').update(JSON.stringify(normalizados)).digest('hex');
}

const TOLERANCIA_DE_COORDENADA = 1e-6;

function localizarIndice(coordenadas, [longitude, latitude], desde) {
  let melhor = desde;
  let menorDistancia = Infinity;
  for (let i = desde; i < coordenadas.length; i++) {
    const dx = coordenadas[i][0] - longitude;
    const dy = coordenadas[i][1] - latitude;
    if (Math.abs(dx) < TOLERANCIA_DE_COORDENADA && Math.abs(dy) < TOLERANCIA_DE_COORDENADA) {
      return i;
    }
    const distancia = dx * dx + dy * dy;
    if (distancia < menorDistancia) {
      menorDistancia = distancia;
      melhor = i;
    }
  }
  return melhor;
}

/**
 * Converte os passos do OSRM em manobras ordenadas ao longo da geometria. O campo indice aponta o ponto
 * da geometria onde a manobra acontece; a busca só anda para a frente, então rotas que se cruzam não confundem.
 */
function extrairManobras(corpo, coordenadas) {
  const pernas = corpo.routes[0].legs;
  if (pernas === undefined) {
    return [];
  }
  if (!Array.isArray(pernas) || pernas.some(perna => !Array.isArray(perna.steps))) {
    throw erroServico(502, 'O serviço de rotas devolveu uma resposta inesperada.');
  }

  const manobras = [];
  let busca = 0;
  pernas.forEach((perna, indicePerna) => {
    perna.steps.forEach(passo => {
      const tipo = passo.maneuver?.type;
      const localizacao = passo.maneuver?.location;
      if (!tipo || !Array.isArray(localizacao)) {
        throw erroServico(502, 'O serviço de rotas devolveu uma resposta inesperada.');
      }
      // A saída de uma parada intermediária é a chegada anterior vista do outro lado: não vira manobra.
      if (tipo === 'depart' && indicePerna > 0) {
        return;
      }
      busca = localizarIndice(coordenadas, localizacao, busca);
      manobras.push({
        tipo,
        modificador: passo.maneuver.modifier ?? null,
        saida: passo.maneuver.exit ?? null,
        via: passo.name || passo.ref || '',
        indice: busca,
        distanciaM: Math.round(passo.distance ?? 0),
        duracaoS: Math.round(passo.duration ?? 0),
        perna: indicePerna,
      });
    });
  });
  return manobras;
}

function criarServicoRoteamento({
  urlOsrm,
  buscar = fetch,
  tempoLimiteMs = TEMPO_LIMITE_MS,
  distanciaMaximaEncaixeM = DISTANCIA_MAXIMA_ENCAIXE_M,
}) {
  const base = urlOsrm.replace(/\/+$/, '');

  async function consultarOsrm(pontos) {
    const coordenadas = pontos.map(({latitude, longitude}) => `${longitude},${latitude}`).join(';');
    const url = `${base}/route/v1/driving/${coordenadas}?overview=full&geometries=geojson&steps=true`;

    let resposta;
    try {
      resposta = await buscar(url, {signal: AbortSignal.timeout(tempoLimiteMs)});
    } catch {
      throw erroServico(503, 'Serviço de rotas indisponível. Tente novamente em instantes.');
    }

    const corpo = await resposta.json().catch(() => null);
    if (corpo?.code === 'NoRoute') {
      throw erroServico(422, 'Não há caminho entre as paradas informadas.');
    }
    if (corpo?.code === 'NoSegment') {
      throw erroServico(422, 'Alguma parada está longe de qualquer via mapeada.');
    }
    const respostaCompleta =
      resposta.ok &&
      corpo?.code === 'Ok' &&
      corpo.routes?.[0] &&
      Array.isArray(corpo.waypoints) &&
      corpo.waypoints.length === pontos.length;
    if (!respostaCompleta) {
      throw erroServico(502, 'O serviço de rotas devolveu uma resposta inesperada.');
    }
    return corpo;
  }

  async function calcularTrajeto(pontos) {
    const corpo = await consultarOsrm(pontos);

    const distantes = corpo.waypoints
      .map((ponto, indice) => ({indice, distancia: ponto.distance}))
      .filter(({distancia}) => distancia > distanciaMaximaEncaixeM);
    if (distantes.length > 0) {
      const nomes = distantes.map(({indice}) => `"${pontos[indice].rotulo ?? indice + 1}"`).join(', ');
      throw erroServico(
        422,
        `Parada fora da cobertura (a mais de ${distanciaMaximaEncaixeM} m de uma via mapeada): ${nomes}.`,
      );
    }

    const rota = corpo.routes[0];
    return {
      geometria: rota.geometry,
      distanciaM: Math.round(rota.distance),
      duracaoS: Math.round(rota.duration),
      manobras: extrairManobras(corpo, rota.geometry.coordinates),
    };
  }

  return {calcularTrajeto};
}

module.exports = {criarServicoRoteamento, extrairManobras, hashDosPontos, DISTANCIA_MAXIMA_ENCAIXE_M};
