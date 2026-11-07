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

function criarServicoRoteamento({
  urlOsrm,
  buscar = fetch,
  tempoLimiteMs = TEMPO_LIMITE_MS,
  distanciaMaximaEncaixeM = DISTANCIA_MAXIMA_ENCAIXE_M,
}) {
  const base = urlOsrm.replace(/\/+$/, '');

  async function consultarOsrm(pontos) {
    const coordenadas = pontos.map(({latitude, longitude}) => `${longitude},${latitude}`).join(';');
    const url = `${base}/route/v1/driving/${coordenadas}?overview=full&geometries=geojson&steps=false`;

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
    };
  }

  return {calcularTrajeto};
}

module.exports = {criarServicoRoteamento, hashDosPontos, DISTANCIA_MAXIMA_ENCAIXE_M};
