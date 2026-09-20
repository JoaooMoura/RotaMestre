const http = require('node:http');
const path = require('node:path');
const {Buffer} = require('node:buffer');
const {URL} = require('node:url');
const {criarRepositorio} = require('./database');

const TIPOS_PARADA = new Set(['Coleta', 'Entrega']);
const STATUS_PARADA = new Set([
  'Pendente',
  'Em andamento',
  'Concluída',
  'Não realizada',
]);
const STATUS_ROTA = new Set([
  'Programada',
  'Em andamento',
  'Pausada',
  'Concluída',
]);

function textoValido(valor) {
  return typeof valor === 'string' && valor.trim().length > 0;
}

function validarRota(rota) {
  if (
    !rota ||
    !textoValido(rota.id) ||
    !textoValido(rota.nome) ||
    !textoValido(rota.data) ||
    !textoValido(rota.horario) ||
    !textoValido(rota.motoristaId) ||
    !STATUS_ROTA.has(rota.status) ||
    !Array.isArray(rota.paradas) ||
    rota.paradas.length < 2
  ) {
    return 'Informe a rota, o motorista e pelo menos duas paradas válidas.';
  }

  const ids = new Set();

  for (const parada of rota.paradas) {
    if (
      !textoValido(parada.id) ||
      ids.has(parada.id) ||
      !TIPOS_PARADA.has(parada.tipo) ||
      !textoValido(parada.destinatario) ||
      !textoValido(parada.endereco) ||
      !textoValido(parada.janela) ||
      typeof parada.observacao !== 'string' ||
      !STATUS_PARADA.has(parada.status)
    ) {
      return 'Existe uma parada inválida ou duplicada na rota.';
    }

    ids.add(parada.id);
  }

  return null;
}

function responder(resposta, status, corpo) {
  resposta.writeHead(status, {
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'GET, PUT, OPTIONS',
    'Access-Control-Allow-Origin': '*',
    'Content-Type': 'application/json; charset=utf-8',
  });
  resposta.end(JSON.stringify(corpo));
}

function lerJson(requisicao) {
  return new Promise((resolve, reject) => {
    let corpo = '';

    requisicao.on('data', parte => {
      corpo += parte;
      if (Buffer.byteLength(corpo) > 1024 * 1024) {
        reject(new Error('Corpo da requisição excede 1 MB.'));
        requisicao.destroy();
      }
    });

    requisicao.on('end', () => {
      try {
        resolve(JSON.parse(corpo));
      } catch {
        reject(new Error('JSON inválido.'));
      }
    });

    requisicao.on('error', reject);
  });
}

function criarServidor(caminhoBanco) {
  const repositorio = criarRepositorio(caminhoBanco);
  const servidor = http.createServer(async (requisicao, resposta) => {
    if (requisicao.method === 'OPTIONS') {
      responder(resposta, 204, {});
      return;
    }

    const url = new URL(requisicao.url, 'http://localhost');

    try {
      if (requisicao.method === 'GET' && url.pathname === '/api/health') {
        responder(resposta, 200, {status: 'ok'});
        return;
      }

      if (requisicao.method === 'GET' && url.pathname === '/api/motoristas') {
        responder(resposta, 200, repositorio.listarMotoristas());
        return;
      }

      if (requisicao.method === 'GET' && url.pathname === '/api/rotas/atual') {
        const rota = repositorio.buscarRotaAtual(
          url.searchParams.get('motoristaId') || undefined,
        );

        if (!rota) {
          responder(resposta, 404, {mensagem: 'Nenhuma rota encontrada.'});
          return;
        }

        responder(resposta, 200, rota);
        return;
      }

      const rotaEncontrada = url.pathname.match(/^\/api\/rotas\/([^/]+)$/);

      if (requisicao.method === 'PUT' && rotaEncontrada) {
        const rota = await lerJson(requisicao);
        rota.id = decodeURIComponent(rotaEncontrada[1]);
        const erroValidacao = validarRota(rota);

        if (erroValidacao) {
          responder(resposta, 400, {mensagem: erroValidacao});
          return;
        }

        const salva = repositorio.salvarRota(rota);
        responder(resposta, 200, salva);
        return;
      }

      responder(resposta, 404, {mensagem: 'Endpoint não encontrado.'});
    } catch (erro) {
      const mensagem =
        erro instanceof Error ? erro.message : 'Erro interno do servidor.';
      const status = mensagem.includes('FOREIGN KEY') ? 400 : 500;
      responder(resposta, status, {mensagem});
    }
  });

  return {
    servidor,
    fechar: () => repositorio.fechar(),
  };
}

if (require.main === module) {
  const porta = Number(process.env.PORT || 3000);
  const caminhoBanco =
    process.env.ROTAMESTRE_DB_PATH ||
    path.join(__dirname, '..', 'data', 'rotamestre.sqlite');
  const aplicacao = criarServidor(caminhoBanco);

  aplicacao.servidor.listen(porta, '0.0.0.0', () => {
    process.stdout.write(`API RotaMestre disponível na porta ${porta}\n`);
  });

  function encerrar() {
    aplicacao.servidor.close(() => {
      aplicacao.fechar();
      process.exit(0);
    });
  }

  process.on('SIGINT', encerrar);
  process.on('SIGTERM', encerrar);
}

module.exports = {criarServidor, validarRota};
