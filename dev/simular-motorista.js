#!/usr/bin/env node
/*
 * Simulador de motorista para demonstrar a frota do gestor com um celular só.
 *
 * Entra como um motorista, põe a rota em andamento e envia a posição (PUT /api/localizacao) andando ao longo do
 * trajeto da rota, uma posição a cada 3 s, a ~40 km/h. Node puro, sem dependências. Ctrl+C apaga a posição.
 *
 * Uso (na raiz do projeto, com o backend e o OSRM no ar):
 *   node dev/simular-motorista.js
 *   node dev/simular-motorista.js --api http://localhost:3000 --email motorista@rotamestre.com --senha 123 --rota RT-DEMO-CENTRO
 *   node dev/simular-motorista.js --parar        # para ao fim do percurso (o padrão é recomeçar)
 *
 * Opções (ou variáveis de ambiente): --api / API_URL, --email / SIM_EMAIL, --senha / SIM_SENHA, --rota / SIM_ROTA,
 * --velocidade km/h (40), --intervalo ms (3000), --precisao m (10), --parar, --parar-apos segundos (para testes).
 */

const RAIO_DA_TERRA_M = 6_371_000;
const PADROES = {
  api: 'http://localhost:3000',
  email: 'motorista@rotamestre.com',
  senha: '123',
  velocidadeKmh: 40,
  intervaloMs: 3000,
  precisaoM: 10,
};

// ---------------------------------------------------------------- partes puras (testadas em backend/test)

const paraRad = graus => (graus * Math.PI) / 180;
const paraGraus = rad => (rad * 180) / Math.PI;

/** Distância em metros entre dois pontos {latitude, longitude} (haversine). */
function distanciaMetros(a, b) {
  const dLat = paraRad(b.latitude - a.latitude);
  const dLng = paraRad(b.longitude - a.longitude);
  const h =
    Math.sin(dLat / 2) ** 2 + Math.cos(paraRad(a.latitude)) * Math.cos(paraRad(b.latitude)) * Math.sin(dLng / 2) ** 2;
  return 2 * RAIO_DA_TERRA_M * Math.asin(Math.min(1, Math.sqrt(h)));
}

/** Rumo (0 a 360, norte = 0, leste = 90) de a para b. */
function rumoGraus(a, b) {
  const lat1 = paraRad(a.latitude);
  const lat2 = paraRad(b.latitude);
  const dLng = paraRad(b.longitude - a.longitude);
  const y = Math.sin(dLng) * Math.cos(lat2);
  const x = Math.cos(lat1) * Math.sin(lat2) - Math.sin(lat1) * Math.cos(lat2) * Math.cos(dLng);
  return (paraGraus(Math.atan2(y, x)) + 360) % 360;
}

/**
 * Prepara a geometria GeoJSON ([[lng, lat], ...]) para andar sobre ela: pontos sem repetição consecutiva, com a
 * distância acumulada de cada um e o comprimento total.
 */
function prepararPercurso(coordenadas) {
  const pontos = [];
  for (const [longitude, latitude] of coordenadas) {
    const anterior = pontos[pontos.length - 1];
    if (!anterior || anterior.latitude !== latitude || anterior.longitude !== longitude) {
      pontos.push({latitude, longitude});
    }
  }
  const acumulada = [0];
  for (let i = 1; i < pontos.length; i += 1) {
    acumulada.push(acumulada[i - 1] + distanciaMetros(pontos[i - 1], pontos[i]));
  }
  return {pontos, acumulada, totalM: acumulada[acumulada.length - 1] ?? 0};
}

/** Posição e rumo a `distanciaM` metros do início do percurso (limitada ao fim). */
function posicaoEm(percurso, distanciaM) {
  const {pontos, acumulada, totalM} = percurso;
  if (pontos.length === 0) {
    throw new Error('O percurso não tem pontos.');
  }
  if (pontos.length === 1) {
    return {...pontos[0], rumoGraus: 0};
  }
  const alvo = Math.min(Math.max(distanciaM, 0), totalM);
  let i = 1;
  while (i < pontos.length - 1 && acumulada[i] < alvo) {
    i += 1;
  }
  const inicio = pontos[i - 1];
  const fim = pontos[i];
  const trecho = acumulada[i] - acumulada[i - 1];
  const fracao = trecho === 0 ? 0 : (alvo - acumulada[i - 1]) / trecho;
  return {
    latitude: inicio.latitude + (fim.latitude - inicio.latitude) * fracao,
    longitude: inicio.longitude + (fim.longitude - inicio.longitude) * fracao,
    rumoGraus: rumoGraus(inicio, fim),
  };
}

/** Quantas posições o percurso gera: uma no início, uma a cada passo e uma exatamente no fim. */
function totalDePosicoes(percurso, passoM) {
  return Math.max(1, Math.ceil(percurso.totalM / passoM) + 1);
}

/** Lê as opções da linha de comando e do ambiente. */
function lerOpcoes(argv, ambiente = {}) {
  const opcoes = {
    api: ambiente.API_URL ?? PADROES.api,
    email: ambiente.SIM_EMAIL ?? PADROES.email,
    senha: ambiente.SIM_SENHA ?? PADROES.senha,
    rota: ambiente.SIM_ROTA ?? null,
    velocidadeKmh: PADROES.velocidadeKmh,
    intervaloMs: PADROES.intervaloMs,
    precisaoM: PADROES.precisaoM,
    parar: false,
    pararApos: null,
    ajuda: false,
  };
  const numero = (valor, nome) => {
    const n = Number(valor);
    if (!Number.isFinite(n) || n <= 0) {
      throw new Error(`Valor inválido para --${nome}: "${valor}".`);
    }
    return n;
  };
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    const proximo = () => {
      if (i + 1 >= argv.length) {
        throw new Error(`Falta o valor de ${arg}.`);
      }
      i += 1;
      return argv[i];
    };
    switch (arg) {
      case '--api':
        opcoes.api = proximo();
        break;
      case '--email':
        opcoes.email = proximo();
        break;
      case '--senha':
        opcoes.senha = proximo();
        break;
      case '--rota':
        opcoes.rota = proximo();
        break;
      case '--velocidade':
        opcoes.velocidadeKmh = numero(proximo(), 'velocidade');
        break;
      case '--intervalo':
        opcoes.intervaloMs = numero(proximo(), 'intervalo');
        break;
      case '--precisao':
        opcoes.precisaoM = numero(proximo(), 'precisao');
        break;
      case '--parar':
        opcoes.parar = true;
        break;
      case '--parar-apos':
        opcoes.pararApos = numero(proximo(), 'parar-apos');
        break;
      case '--ajuda':
      case '-h':
        opcoes.ajuda = true;
        break;
      default:
        throw new Error(`Opção desconhecida: ${arg}. Use --ajuda.`);
    }
  }
  opcoes.api = opcoes.api.replace(/\/+$/, '');
  return opcoes;
}

// ---------------------------------------------------------------- laço do simulador (cliente e relógio injetáveis)

class ErroDaApi extends Error {
  constructor(mensagem, status) {
    super(mensagem);
    this.status = status;
  }
}

/** Cliente HTTP real, com o `fetch` nativo do Node. */
function criarCliente(urlBase, fetchImpl = fetch) {
  let token = null;
  async function chamar(metodo, caminho, corpo) {
    let resposta;
    try {
      resposta = await fetchImpl(`${urlBase}/api${caminho}`, {
        method: metodo,
        headers: {'Content-Type': 'application/json', ...(token ? {Authorization: `Bearer ${token}`} : {})},
        body: corpo === undefined ? undefined : JSON.stringify(corpo),
      });
    } catch (erro) {
      throw new ErroDaApi(`Sem conexão com ${urlBase} (${erro.cause?.code ?? erro.message}).`, 0);
    }
    const texto = await resposta.text();
    let json = null;
    try {
      json = texto ? JSON.parse(texto) : null;
    } catch {
      json = null;
    }
    if (!resposta.ok) {
      throw new ErroDaApi(json?.mensagem ?? `Erro ${resposta.status}.`, resposta.status);
    }
    return json;
  }
  return {
    async entrar(email, senha) {
      const sessao = await chamar('POST', '/auth/login', {email, senha});
      token = sessao.token;
      return sessao.usuario;
    },
    rotaAtual: () => chamar('GET', '/rotas/atual'),
    salvarRota: rota => chamar('PUT', `/rotas/${encodeURIComponent(rota.id)}`, rota),
    trajeto: id => chamar('GET', `/rotas/${encodeURIComponent(id)}/trajeto`),
    enviarPosicao: posicao => chamar('PUT', '/localizacao', posicao),
    apagarPosicao: () => chamar('DELETE', '/localizacao'),
  };
}

/**
 * Roda o simulador. `deveParar()` é consultado a cada passo (Ctrl+C); `dormir(ms)` e `agora()` são injetáveis.
 * Devolve um resumo: {enviadas, voltas, motivo}.
 */
async function executar({cliente, opcoes, log = () => {}, dormir, agora = Date.now, deveParar = () => false}) {
  const usuario = await cliente.entrar(opcoes.email, opcoes.senha);
  log(`Entrou como ${usuario.nome} (${usuario.email}).`);

  let rota = opcoes.rota ? {id: opcoes.rota} : await cliente.rotaAtual();
  if (opcoes.rota) {
    // Precisa dos dados completos da rota para colocá-la em andamento (o app também envia a rota inteira).
    const atual = await cliente.rotaAtual().catch(() => null);
    rota = atual && atual.id === opcoes.rota ? atual : null;
    if (!rota) {
      throw new Error(`A rota ${opcoes.rota} não é a rota atual deste motorista. Deixe --rota de fora ou use outra conta.`);
    }
  }
  if (rota.status === 'Concluída') {
    throw new Error(`A rota ${rota.id} (${rota.nome}) já está concluída. Crie ou atribua uma rota nova a este motorista.`);
  }
  if (rota.status !== 'Em andamento') {
    rota = await cliente.salvarRota({...rota, status: 'Em andamento'});
    log(`Rota ${rota.id} (${rota.nome}) colocada em andamento.`);
  } else {
    log(`Rota ${rota.id} (${rota.nome}) já estava em andamento.`);
  }

  const trajeto = await cliente.trajeto(rota.id);
  const percurso = prepararPercurso(trajeto.geometria.coordinates);
  if (percurso.pontos.length < 2) {
    throw new Error('O trajeto devolvido não tem pontos suficientes para andar.');
  }
  const velocidadeMs = (opcoes.velocidadeKmh * 1000) / 3600;
  const passoM = velocidadeMs * (opcoes.intervaloMs / 1000);
  const total = totalDePosicoes(percurso, passoM);
  log(
    `Percurso de ${(percurso.totalM / 1000).toFixed(1)} km: ${total} posições, uma a cada ${opcoes.intervaloMs / 1000} s ` +
      `a ${opcoes.velocidadeKmh} km/h. Ctrl+C para parar.`,
  );

  const inicio = agora();
  let enviadas = 0;
  let volta = 1;
  let motivo = 'interrompido';
  laco: for (;;) {
    for (let n = 0; n < total; n += 1) {
      if (deveParar() || (opcoes.pararApos !== null && agora() - inicio >= opcoes.pararApos * 1000)) {
        break laco;
      }
      const posicao = posicaoEm(percurso, n * passoM);
      const ultima = n === total - 1;
      try {
        await cliente.enviarPosicao({
          latitude: posicao.latitude,
          longitude: posicao.longitude,
          precisaoM: opcoes.precisaoM,
          registradaEm: agora(),
          // O servidor guarda só posição e precisão; rumo e velocidade vão junto para quem quiser ver no registro.
          rumoGraus: Math.round(posicao.rumoGraus),
          velocidadeMs: Number(velocidadeMs.toFixed(2)),
        });
        enviadas += 1;
        log(
          `Enviando posição ${n + 1} de ${total}: ${posicao.latitude.toFixed(5)}, ${posicao.longitude.toFixed(5)} ` +
            `• ${opcoes.velocidadeKmh} km/h • rumo ${Math.round(posicao.rumoGraus)}°` +
            (opcoes.parar || volta === 1 ? '' : ` (volta ${volta})`),
        );
      } catch (erro) {
        if (erro.status === 409) {
          motivo = 'rota-nao-esta-em-andamento';
          log(`O servidor recusou a posição (409): ${erro.message}`);
          break laco;
        }
        if (erro.status === 401 || erro.status === 403) {
          motivo = 'sem-permissao';
          log(`O servidor recusou o acesso (${erro.status}): ${erro.message}`);
          break laco;
        }
        // Rede fora ou erro do servidor: avisa e tenta de novo no próximo passo.
        log(`Não foi possível enviar a posição ${n + 1}: ${erro.message} Tentando de novo.`);
      }
      if (ultima && opcoes.parar) {
        motivo = 'fim-do-percurso';
        break laco;
      }
      await dormir(opcoes.intervaloMs);
    }
    volta += 1;
    log(`Fim do percurso. Recomeçando do início (volta ${volta}).`);
  }
  return {enviadas, voltas: volta, motivo, rotaId: rota.id};
}

// ---------------------------------------------------------------- programa

async function principal() {
  let opcoes;
  try {
    opcoes = lerOpcoes(process.argv.slice(2), process.env);
  } catch (erro) {
    console.error(erro.message);
    process.exit(2);
  }
  if (opcoes.ajuda) {
    console.log(
      'Uso: node dev/simular-motorista.js [--api URL] [--email E] [--senha S] [--rota ID] [--velocidade KMH]\n' +
        '       [--intervalo MS] [--precisao M] [--parar] [--parar-apos SEGUNDOS]\n' +
        'Padrão: motorista demo, rota atual, 40 km/h, uma posição a cada 3 s, recomeça ao fim. Ctrl+C apaga a posição.',
    );
    return;
  }

  const cliente = criarCliente(opcoes.api);
  const log = mensagem => console.log(`[${new Date().toLocaleTimeString('pt-BR')}] ${mensagem}`);
  let interromper = false;
  let acordar = () => {};
  const aoInterromper = sinal => {
    if (interromper) {
      process.exit(130);
    }
    interromper = true;
    log(`${sinal === 'SIGINT' ? 'Ctrl+C' : sinal} recebido: parando e apagando a posição...`);
    acordar();
  };
  process.on('SIGINT', aoInterromper);
  process.on('SIGTERM', aoInterromper);

  // O sono é interrompido pelo Ctrl+C para a saída ser imediata.
  const dormir = ms =>
    new Promise(resolve => {
      const temporizador = setTimeout(resolve, ms);
      acordar = () => {
        clearTimeout(temporizador);
        resolve();
      };
    });

  let codigo = 0;
  try {
    const resumo = await executar({cliente, opcoes, log, dormir, deveParar: () => interromper});
    log(`Terminou: ${resumo.enviadas} posições enviadas (${resumo.motivo}).`);
  } catch (erro) {
    codigo = 1;
    log(`Erro: ${erro.message}`);
  }
  try {
    await cliente.apagarPosicao();
    log('Posição apagada: o motorista deixou de aparecer na frota.');
  } catch (erro) {
    log(`Não foi possível apagar a posição (${erro.message}). Ela some sozinha depois de alguns minutos.`);
  }
  process.exit(codigo);
}

module.exports = {
  PADROES,
  criarCliente,
  distanciaMetros,
  executar,
  lerOpcoes,
  posicaoEm,
  prepararPercurso,
  rumoGraus,
  totalDePosicoes,
};

if (require.main === module) {
  principal();
}
