const http = require('node:http');
const path = require('node:path');
const {Buffer} = require('node:buffer');
const {URL} = require('node:url');
const bcrypt = require('bcryptjs');
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

const ASSINATURA_MAX_BYTES = 512 * 1024;
const FOTO_MAX_BYTES = 512 * 1024;
const CORPO_MAX_BYTES = 2 * 1024 * 1024;

function fotoValida(foto) {
  return (
    typeof foto === 'string' &&
    /^data:image\/(jpeg|png);base64,/.test(foto) &&
    foto.length <= FOTO_MAX_BYTES
  );
}

function comprovanteValido(comprovante, status) {
  if (!comprovante || !textoValido(comprovante.recebedor)) {
    return false;
  }
  if (comprovante.assinatura === undefined) {
    return comprovante.foto === undefined;
  }
  return (
    status === 'Concluída' &&
    typeof comprovante.assinatura === 'string' &&
    comprovante.assinatura.startsWith('data:image/png;base64,') &&
    comprovante.assinatura.length <= ASSINATURA_MAX_BYTES &&
    (comprovante.foto === undefined || fotoValida(comprovante.foto))
  );
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

    if (
      parada.comprovante !== undefined &&
      !comprovanteValido(parada.comprovante, parada.status)
    ) {
      return 'Comprovante de entrega inválido.';
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

function erroHttp(status, mensagem) {
  const erro = new Error(mensagem);
  erro.status = status;
  return erro;
}

function lerJson(requisicao) {
  return new Promise((resolve, reject) => {
    const partes = [];
    let tamanho = 0;
    let excedeu = false;

    requisicao.on('data', parte => {
      tamanho += parte.length;
      if (tamanho > CORPO_MAX_BYTES) {
        // Continua lendo sem guardar: destruir a conexão impede o cliente de receber o 413.
        excedeu = true;
        partes.length = 0;
        return;
      }
      partes.push(parte);
    });

    requisicao.on('end', () => {
      if (excedeu) {
        reject(erroHttp(413, 'Corpo da requisição excede 2 MB.'));
        return;
      }
      try {
        resolve(JSON.parse(Buffer.concat(partes).toString('utf8')));
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

      if (requisicao.method === 'POST' && url.pathname === '/api/motoristas') {
        const motorista = await lerJson(requisicao);
        if (!motorista.id || !motorista.nome || !motorista.email || !motorista.senha || !motorista.veiculo) {
          responder(resposta, 400, {mensagem: 'Dados obrigatórios faltando.'});
          return;
        }
        motorista.senha = await bcrypt.hash(motorista.senha, 10);
        const salvo = repositorio.salvarMotorista(motorista);
        responder(resposta, 201, salvo);
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
      const status = erro.status ?? (mensagem.includes('FOREIGN KEY') ? 400 : 500);
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
