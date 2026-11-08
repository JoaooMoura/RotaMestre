const fs = require('node:fs');

// Limites de velocidade vindos de uma fonte validada (tag maxspeed explícita do OpenStreetMap, ver
// dev/mapas/extrair-limites.js). A velocidade estimada do OSRM NUNCA é usada como limite (US05.05).
const TAMANHO_DA_CELULA = 0.002; // graus (~220 m)
const DISTANCIA_MAXIMA_M = 15;
const ANGULO_MAXIMO_GRAUS = 25;
const METROS_POR_GRAU = 111320;

function rotuloDaCelula(coluna, linha) {
  return `${coluna}:${linha}`;
}

function paraMetros([longitude, latitude], latitudeBase) {
  return [longitude * METROS_POR_GRAU * Math.cos((latitudeBase * Math.PI) / 180), latitude * METROS_POR_GRAU];
}

/** Distância (m) do ponto ao segmento e o ângulo (0–180°) do segmento, em plano local. */
function compararComSegmento(ponto, a, b, latitudeBase) {
  const [px, py] = paraMetros(ponto, latitudeBase);
  const [ax, ay] = paraMetros(a, latitudeBase);
  const [bx, by] = paraMetros(b, latitudeBase);
  const dx = bx - ax;
  const dy = by - ay;
  const quadrado = dx * dx + dy * dy;
  const t = quadrado === 0 ? 0 : Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / quadrado));
  const distanciaM = Math.hypot(px - (ax + t * dx), py - (ay + t * dy));
  return {distanciaM, angulo: ((Math.atan2(dy, dx) * 180) / Math.PI + 180) % 180};
}

function diferencaDeAngulo(a, b) {
  const diferenca = Math.abs(a - b) % 180;
  return Math.min(diferenca, 180 - diferenca);
}

function criarIndiceDeLimites(vias) {
  const celulas = new Map();
  for (const {k, p} of vias) {
    for (let i = 0; i < p.length - 1; i++) {
      const segmento = {a: p[i], b: p[i + 1], k};
      const margem = 0.0003;
      const minX = Math.min(p[i][0], p[i + 1][0]) - margem;
      const maxX = Math.max(p[i][0], p[i + 1][0]) + margem;
      const minY = Math.min(p[i][1], p[i + 1][1]) - margem;
      const maxY = Math.max(p[i][1], p[i + 1][1]) + margem;
      for (let c = Math.floor(minX / TAMANHO_DA_CELULA); c <= Math.floor(maxX / TAMANHO_DA_CELULA); c++) {
        for (let l = Math.floor(minY / TAMANHO_DA_CELULA); l <= Math.floor(maxY / TAMANHO_DA_CELULA); l++) {
          const rotulo = rotuloDaCelula(c, l);
          if (!celulas.has(rotulo)) {
            celulas.set(rotulo, []);
          }
          celulas.get(rotulo).push(segmento);
        }
      }
    }
  }

  function limiteDoSegmento(a, b) {
    const meio = [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2];
    const candidatos = celulas.get(rotuloDaCelula(Math.floor(meio[0] / TAMANHO_DA_CELULA), Math.floor(meio[1] / TAMANHO_DA_CELULA)));
    if (!candidatos) {
      return null;
    }
    const anguloDaRota = compararComSegmento(meio, a, b, meio[1]).angulo;
    let melhor = null;
    for (const candidato of candidatos) {
      const { distanciaM, angulo } = compararComSegmento(meio, candidato.a, candidato.b, meio[1]);
      if (distanciaM <= DISTANCIA_MAXIMA_M && diferencaDeAngulo(angulo, anguloDaRota) <= ANGULO_MAXIMO_GRAUS) {
        if (!melhor || distanciaM < melhor.distanciaM) {
          melhor = {distanciaM, k: candidato.k};
        }
      }
    }
    return melhor ? melhor.k : null;
  }

  return {
    /**
     * Limite de cada trecho da geometria, em sequência de mudanças: `[{indice, kmh}]`, em que `indice` é o
     * ponto da geometria onde o limite passa a valer e `kmh` é nulo onde não há limite validado.
     */
    anotar(coordenadas) {
      const limites = [];
      let anterior;
      for (let i = 0; i < coordenadas.length - 1; i++) {
        const kmh = limiteDoSegmento(coordenadas[i], coordenadas[i + 1]);
        if (kmh !== anterior) {
          limites.push({indice: i, kmh});
          anterior = kmh;
        }
      }
      return limites;
    },
  };
}

/** Sem arquivo (ou arquivo inválido) nenhum limite é conhecido: o app mostra "indisponível". */
function carregarLimites(caminho) {
  if (!caminho || !fs.existsSync(caminho)) {
    return criarIndiceDeLimites([]);
  }
  try {
    const dados = JSON.parse(fs.readFileSync(caminho, 'utf8'));
    return criarIndiceDeLimites(Array.isArray(dados.vias) ? dados.vias : []);
  } catch {
    return criarIndiceDeLimites([]);
  }
}

module.exports = {carregarLimites, criarIndiceDeLimites};
