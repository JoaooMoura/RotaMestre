const http = require('node:http');
const path = require('node:path');
const {Buffer} = require('node:buffer');
const {URL} = require('node:url');
const bcrypt = require('bcryptjs');
const {
  criarServicoAutenticacao,
  validarSegredoJwt,
  validarValidadeToken,
} = require('./autenticacao');
const {criarRepositorio} = require('./database');
const V = require('./validacao');
const {criarServicoRoteamento, hashDosPontos} = require('./roteamento');
const {carregarLimites, criarIndiceDeLimites} = require('./limites');

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

const CATEGORIAS_CNH = new Set(['A', 'B', 'C', 'D', 'E', 'AB', 'AC', 'AD', 'AE']);

function somenteDigitos(valor) {
  return typeof valor === 'string' ? valor.replace(/\D/g, '') : '';
}

function dataIsoValida(valor) {
  const partes = typeof valor === 'string' && valor.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  if (!partes) {
    return null;
  }
  const [, dia, mes, ano] = partes;
  const data = new Date(Date.UTC(Number(ano), Number(mes) - 1, Number(dia)));
  const existe =
    data.getUTCFullYear() === Number(ano) &&
    data.getUTCMonth() === Number(mes) - 1 &&
    data.getUTCDate() === Number(dia);
  return existe ? `${ano}-${mes}-${dia}` : null;
}

function validarCadastroMotorista(dados) {
  if (!dados || ![dados.id, dados.nome, dados.email, dados.senha, dados.veiculo].every(textoValido)) {
    return {erro: 'Dados obrigatórios faltando.'};
  }
  const erroCampo =
    V.validarEmail(dados.email) ||
    V.validarSenhaDeCadastro(dados.senha) ||
    V.validarNomeCompleto(dados.nome) ||
    V.validarVeiculo(dados.veiculo);
  if (erroCampo) {
    return {erro: erroCampo};
  }
  const telefone = somenteDigitos(dados.telefone);
  if (telefone.length < 10 || telefone.length > 11) {
    return {erro: 'Telefone inválido.'};
  }
  const cnhNumero = somenteDigitos(dados.cnhNumero);
  if (cnhNumero.length !== 11) {
    return {erro: 'Número da CNH deve ter 11 dígitos.'};
  }
  const cnhCategoria = typeof dados.cnhCategoria === 'string' ? dados.cnhCategoria.trim().toUpperCase() : '';
  if (!CATEGORIAS_CNH.has(cnhCategoria)) {
    return {erro: 'Categoria da CNH inválida.'};
  }
  const cnhValidade = dataIsoValida(dados.cnhValidade);
  if (!cnhValidade) {
    return {erro: 'Data de validade da CNH inválida.'};
  }
  const erroValidade = V.validarValidadeCnh(dados.cnhValidade);
  if (erroValidade) {
    return {erro: erroValidade};
  }
  const email = dados.email.trim().toLowerCase();
  const nome = dados.nome.trim().replace(/\s+/g, ' ');
  const veiculo = dados.veiculo.trim();
  return {motorista: {...dados, nome, email, veiculo, telefone, cnhNumero, cnhCategoria, cnhValidade}};
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
  // Comprovante novo (com assinatura): o nome do recebedor segue a regra de tamanho.
  if (V.validarTamanho(comprovante.recebedor, V.LIMITES.recebedor, 'o nome do recebedor')) {
    return false;
  }
  comprovante.recebedor = comprovante.recebedor.trim();
  return (
    status === 'Concluída' &&
    typeof comprovante.assinatura === 'string' &&
    comprovante.assinatura.startsWith('data:image/png;base64,') &&
    comprovante.assinatura.length <= ASSINATURA_MAX_BYTES &&
    (comprovante.foto === undefined || fotoValida(comprovante.foto))
  );
}

const ID_DE_ENVIO = /^[A-Za-z0-9_-]{8,80}$/;

/** Corpo do envio de um comprovante coletado sem rede (POST .../paradas/:id/comprovante). */
function validarEnvioDeComprovante(corpo) {
  if (!corpo || typeof corpo !== 'object') {
    return 'Envio inválido.';
  }
  if (typeof corpo.idEnvio !== 'string' || !ID_DE_ENVIO.test(corpo.idEnvio)) {
    return 'Identificador de envio inválido.';
  }
  if (typeof corpo.coletadoPor !== 'string' || corpo.coletadoPor.length === 0 || corpo.coletadoPor.length > 80) {
    return 'Informe a conta que coletou a assinatura.';
  }
  const erroRecebedor = V.validarTamanho(corpo.recebedor, V.LIMITES.recebedor, 'o nome do recebedor');
  if (erroRecebedor) {
    return erroRecebedor;
  }
  corpo.recebedor = corpo.recebedor.trim();
  if (
    typeof corpo.assinatura !== 'string' ||
    !corpo.assinatura.startsWith('data:image/png;base64,') ||
    corpo.assinatura.length > ASSINATURA_MAX_BYTES
  ) {
    return 'Assinatura inválida: use PNG de até 512 KB.';
  }
  if (corpo.foto !== undefined && !fotoValida(corpo.foto)) {
    return 'Foto inválida: use JPEG ou PNG de até 512 KB.';
  }
  if (corpo.coletadoEm !== undefined && !Number.isFinite(corpo.coletadoEm)) {
    return 'Hora da coleta inválida.';
  }
  return null;
}

function coordenadasValidas({latitude, longitude}) {
  if (latitude === undefined && longitude === undefined) {
    return true;
  }
  return (
    Number.isFinite(latitude) &&
    Number.isFinite(longitude) &&
    Math.abs(latitude) <= 90 &&
    Math.abs(longitude) <= 180
  );
}

function posicaoValida(corpo) {
  return (
    corpo !== null &&
    typeof corpo === 'object' &&
    Number.isFinite(corpo.latitude) &&
    Number.isFinite(corpo.longitude) &&
    Math.abs(corpo.latitude) <= 90 &&
    Math.abs(corpo.longitude) <= 180
  );
}

// Paradas que ainda faltam: o recálculo nunca passa por uma parada concluída ou não realizada.
const STATUS_PARADA_ENCERRADA = new Set(['Concluída', 'Não realizada']);

// Posição do motorista (US03.04): só a última é guardada. Leituras de mais de 10 min atrás não valem.
const IDADE_MAXIMA_DA_LEITURA_MS = 10 * 60 * 1000;
const TOLERANCIA_DE_RELOGIO_MS = 2 * 60 * 1000;
// Posição que ninguém atualiza some depois de 12 h.
const RETENCAO_DA_POSICAO_MS = 12 * 60 * 60 * 1000;

function validarPosicaoCompartilhada(corpo, agora) {
  if (!posicaoValida(corpo)) {
    return {erro: 'Informe a posição atual (latitude e longitude válidas).'};
  }
  const {precisaoM} = corpo;
  if (precisaoM !== undefined && precisaoM !== null && !(Number.isFinite(precisaoM) && precisaoM >= 0 && precisaoM <= 100000)) {
    return {erro: 'Precisão inválida.'};
  }
  let registradaEm = agora;
  if (corpo.registradaEm !== undefined) {
    if (!Number.isFinite(corpo.registradaEm)) {
      return {erro: 'Hora da leitura inválida.'};
    }
    if (corpo.registradaEm < agora - IDADE_MAXIMA_DA_LEITURA_MS) {
      return {erro: 'Leitura antiga demais para ser mostrada como posição atual.'};
    }
    registradaEm = Math.min(corpo.registradaEm, agora + TOLERANCIA_DE_RELOGIO_MS);
  }
  return {
    posicao: {latitude: corpo.latitude, longitude: corpo.longitude, precisaoM: precisaoM ?? null, registradaEm},
  };
}

function temLocalizacao(parada) {
  return parada.latitude !== undefined && parada.longitude !== undefined;
}

/**
 * Valida a rota recebida. `existente` é a rota já salva (ou null na criação). As regras de formato valem para o
 * que é novo ou mudou: valores antigos já gravados (ex.: data "Hoje", janela "Parada imprevista") continuam
 * podendo ser salvos sem alteração, porque o app reenvia a rota inteira a cada atualização.
 */
function validarRota(rota, existente = null) {
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

  const mudou = (campo, antigo) => !existente || antigo === undefined || rota[campo] !== antigo;
  if (mudou('nome', existente?.nome)) {
    const erro = V.validarTamanho(rota.nome, V.LIMITES.nomeRota, 'o nome da rota');
    if (erro) {
      return erro;
    }
    rota.nome = rota.nome.trim();
  }
  if (mudou('data', existente?.data)) {
    const erro = V.validarDataDaRota(rota.data, {criacao: !existente});
    if (erro) {
      return erro;
    }
  }
  if (mudou('horario', existente?.horario)) {
    const erro = V.validarHorario(rota.horario);
    if (erro) {
      return erro;
    }
  }

  const ids = new Set();
  const paradasSalvas = new Map((existente?.paradas ?? []).map(parada => [parada.id, parada]));

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

    const salva = paradasSalvas.get(parada.id);
    const campoNovo = (campo) => !salva || salva[campo] !== parada[campo];
    if (campoNovo('destinatario')) {
      const erro = V.validarTamanho(parada.destinatario, V.LIMITES.destinatario, 'o destinatário');
      if (erro) {
        return erro;
      }
      parada.destinatario = parada.destinatario.trim();
    }
    if (campoNovo('endereco')) {
      const erro = V.validarTamanho(parada.endereco, V.LIMITES.endereco, 'o endereço');
      if (erro) {
        return erro;
      }
      parada.endereco = parada.endereco.trim();
    }
    if (campoNovo('janela')) {
      const erro = V.validarJanela(parada.janela);
      if (erro) {
        return erro;
      }
      parada.janela = parada.janela.trim() || 'Sem janela definida';
    }
    if (campoNovo('observacao')) {
      if (parada.observacao.trim().length > V.LIMITES.observacao.max) {
        return `A observação deve ter no máximo ${V.LIMITES.observacao.max} caracteres.`;
      }
      parada.observacao = parada.observacao.trim();
    }

    if (!coordenadasValidas(parada)) {
      return 'Coordenadas da parada inválidas.';
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

/**
 * Quando o gestor salva uma rota que já existe, o andamento pertence ao motorista: o status da rota, o status e o
 * comprovante de cada parada existente vêm do banco, mesmo que a tela do gestor esteja desatualizada. O gestor muda
 * motorista, nome, data, horário e dados das paradas, e pode acrescentar paradas (entram Pendente).
 * Devolve uma mensagem de erro quando tenta remover uma parada já concluída.
 */
function preservarProgressoDoMotorista(rota, existente) {
  const noBanco = new Map(existente.paradas.map(parada => [parada.id, parada]));
  const enviadas = new Set(rota.paradas.map(parada => parada.id));
  const removida = existente.paradas.find(parada => parada.status === 'Concluída' && !enviadas.has(parada.id));
  if (removida) {
    return `A parada "${removida.destinatario}" já foi concluída pelo motorista e não pode ser removida da rota.`;
  }
  rota.status = existente.status;
  for (const parada of rota.paradas) {
    delete parada.comprovante;
    parada.status = noBanco.get(parada.id)?.status ?? 'Pendente';
  }
  return null;
}

function responder(resposta, status, corpo) {
  resposta.writeHead(status, {
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
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
      let corpo;
      try {
        corpo = JSON.parse(Buffer.concat(partes).toString('utf8'));
      } catch {
        reject(erroHttp(400, 'JSON inválido.'));
        return;
      }
      if (corpo === null || typeof corpo !== 'object' || Array.isArray(corpo)) {
        reject(erroHttp(400, 'O corpo da requisição deve ser um objeto JSON.'));
        return;
      }
      resolve(corpo);
    });

    requisicao.on('error', reject);
  });
}

function criarServidor({
  caminhoBanco,
  segredoJwt,
  validadeToken = '12h',
  seedDemo = false,
  urlOsrm = 'http://127.0.0.1:5000',
  servicoRoteamento = criarServicoRoteamento({urlOsrm}),
  servicoLimites = criarIndiceDeLimites([]),
  agora = Date.now,
}) {
  validarSegredoJwt(segredoJwt);
  validarValidadeToken(validadeToken);
  const repositorio = criarRepositorio(caminhoBanco, {seedDemo});
  const autenticacao = criarServicoAutenticacao({
    repositorio,
    segredo: segredoJwt,
    validade: validadeToken,
  });

  function exigirUsuario(requisicao, papeisPermitidos) {
    const {usuario, erro} = autenticacao.verificar(requisicao.headers.authorization);
    if (erro) {
      throw erroHttp(401, erro);
    }
    if (papeisPermitidos && !papeisPermitidos.includes(usuario.papel)) {
      throw erroHttp(403, 'Acesso não permitido para este perfil.');
    }
    return usuario;
  }

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

      if (requisicao.method === 'POST' && url.pathname === '/api/auth/login') {
        const {email, senha} = await lerJson(requisicao);
        if (!textoValido(email) || !textoValido(senha)) {
          responder(resposta, 400, {mensagem: 'Informe e-mail e senha.'});
          return;
        }
        const sessao = await autenticacao.entrar(email, senha);
        if (!sessao) {
          responder(resposta, 401, {mensagem: 'E-mail ou senha incorretos.'});
          return;
        }
        responder(resposta, 200, sessao);
        return;
      }

      if (requisicao.method === 'POST' && url.pathname === '/api/motoristas') {
        const {erro: erroCadastro, motorista} = validarCadastroMotorista(await lerJson(requisicao));
        if (erroCadastro) {
          responder(resposta, 400, {mensagem: erroCadastro});
          return;
        }
        motorista.senha = await bcrypt.hash(motorista.senha, 10);
        try {
          responder(resposta, 201, repositorio.salvarMotorista(motorista));
        } catch (erro) {
          if (erro.codigo === 'EMAIL_DUPLICADO') {
            responder(resposta, 409, {mensagem: erro.message});
            return;
          }
          throw erro;
        }
        return;
      }

      if (requisicao.method === 'GET' && url.pathname === '/api/motoristas') {
        exigirUsuario(requisicao, ['gestor']);
        responder(resposta, 200, repositorio.listarMotoristas());
        return;
      }

      if (requisicao.method === 'GET' && url.pathname === '/api/rotas/atual') {
        const usuario = exigirUsuario(requisicao);
        const motoristaId =
          usuario.papel === 'motorista'
            ? usuario.id
            : url.searchParams.get('motoristaId') || undefined;
        const rota = repositorio.buscarRotaAtual(motoristaId);

        if (!rota) {
          responder(resposta, 404, {mensagem: 'Nenhuma rota encontrada.'});
          return;
        }

        responder(resposta, 200, rota);
        return;
      }

      const trajetoEncontrado = url.pathname.match(/^\/api\/rotas\/([^/]+)\/trajeto$/);

      if (requisicao.method === 'GET' && trajetoEncontrado) {
        const usuario = exigirUsuario(requisicao);
        const rota = repositorio.buscarRota(decodeURIComponent(trajetoEncontrado[1]));

        if (!rota) {
          throw erroHttp(404, 'Rota não encontrada.');
        }
        if (usuario.papel === 'motorista' && rota.motoristaId !== usuario.id) {
          throw erroHttp(403, 'Motorista só pode consultar a própria rota.');
        }

        const semLocalizacao = rota.paradas.filter(parada => !temLocalizacao(parada));
        if (semLocalizacao.length > 0) {
          const nomes = semLocalizacao.map(parada => `"${parada.destinatario}"`).join(', ');
          responder(resposta, 422, {
            mensagem: `Paradas sem localização no mapa: ${nomes}.`,
            paradasSemLocalizacao: semLocalizacao.map(parada => parada.id),
          });
          return;
        }

        const pontos = rota.paradas.map(parada => ({
          latitude: parada.latitude,
          longitude: parada.longitude,
          rotulo: parada.destinatario,
        }));
        const hash = hashDosPontos(pontos);

        let trajeto = repositorio.buscarTrajeto(rota.id);
        // Trajetos guardados antes das manobras existirem (manobras nulas) são recalculados.
        if (trajeto?.hash !== hash || trajeto.manobras === null) {
          trajeto = {
            ...(await servicoRoteamento.calcularTrajeto(pontos)),
            hash,
            calculadoEm: Date.now(),
          };
          repositorio.salvarTrajeto(rota.id, trajeto);
        }

        responder(resposta, 200, {
          rotaId: rota.id,
          geometria: trajeto.geometria,
          distanciaM: trajeto.distanciaM,
          duracaoS: trajeto.duracaoS,
          calculadoEm: trajeto.calculadoEm,
          manobras: trajeto.manobras ?? [],
          // Limites validados (maxspeed explícito); onde não há, kmh é nulo. Calculado na resposta, fora do cache.
          limites: servicoLimites.anotar(trajeto.geometria.coordinates),
          paradas: rota.paradas.map(({id, tipo, destinatario, endereco, status, latitude, longitude}) => ({
            id,
            tipo,
            destinatario,
            endereco,
            status,
            latitude,
            longitude,
          })),
        });
        return;
      }

      // US03.04 — o motorista compartilha a posição enquanto a rota está em andamento. Guarda só a última leitura.
      if (url.pathname === '/api/localizacao' && requisicao.method === 'PUT') {
        const usuario = exigirUsuario(requisicao, ['motorista']);
        const {erro: erroPosicao, posicao} = validarPosicaoCompartilhada(await lerJson(requisicao), agora());
        if (erroPosicao) {
          throw erroHttp(400, erroPosicao);
        }
        const rotaAtual = repositorio.buscarRotaAtual(usuario.id);
        if (!rotaAtual || rotaAtual.status !== 'Em andamento') {
          throw erroHttp(409, 'Não há rota em andamento: a posição não é compartilhada.');
        }
        repositorio.registrarPosicao(
          usuario.id,
          {...posicao, rotaId: rotaAtual.id, recebidaEm: agora()},
          RETENCAO_DA_POSICAO_MS,
        );
        responder(resposta, 204, {});
        return;
      }

      if (url.pathname === '/api/localizacao' && requisicao.method === 'DELETE') {
        const usuario = exigirUsuario(requisicao, ['motorista']);
        repositorio.removerPosicao(usuario.id);
        responder(resposta, 204, {});
        return;
      }

      // Só o gestor vê a frota (posição e andamento das tarefas dos motoristas).
      if (url.pathname === '/api/frota' && requisicao.method === 'GET') {
        exigirUsuario(requisicao, ['gestor']);
        const geradoEm = agora();
        responder(resposta, 200, {
          geradoEm,
          motoristas: repositorio.listarFrota(geradoEm, RETENCAO_DA_POSICAO_MS),
        });
        return;
      }

      const recalculoEncontrado = url.pathname.match(/^\/api\/rotas\/([^/]+)\/recalcular$/);

      // US05.04: novo trajeto a partir da posição atual do motorista até as paradas que faltam.
      // A posição vem só no corpo desta chamada, é usada apenas como ponto de partida do cálculo e
      // NÃO é guardada nem registrada. O resultado também não vai para o cache de trajetos (depende da posição).
      if (requisicao.method === 'POST' && recalculoEncontrado) {
        const usuario = exigirUsuario(requisicao, ['motorista']);
        const rota = repositorio.buscarRota(decodeURIComponent(recalculoEncontrado[1]));
        if (!rota) {
          throw erroHttp(404, 'Rota não encontrada.');
        }
        if (rota.motoristaId !== usuario.id) {
          throw erroHttp(403, 'Motorista só pode recalcular a própria rota.');
        }
        const corpo = await lerJson(requisicao);
        if (!posicaoValida(corpo)) {
          throw erroHttp(400, 'Informe a posição atual (latitude e longitude válidas).');
        }

        const restantes = rota.paradas.filter(parada => !STATUS_PARADA_ENCERRADA.has(parada.status));
        if (restantes.length === 0) {
          throw erroHttp(409, 'Não há paradas restantes para recalcular.');
        }
        const semLocalizacao = restantes.filter(parada => !temLocalizacao(parada));
        if (semLocalizacao.length > 0) {
          const nomes = semLocalizacao.map(parada => `"${parada.destinatario}"`).join(', ');
          throw erroHttp(422, `Paradas sem localização no mapa: ${nomes}.`);
        }

        const origem = {latitude: corpo.latitude, longitude: corpo.longitude, rotulo: 'Sua posição'};
        const pontos = [
          origem,
          ...restantes.map(parada => ({
            latitude: parada.latitude,
            longitude: parada.longitude,
            rotulo: parada.destinatario,
          })),
        ];
        const trajeto = await servicoRoteamento.calcularTrajeto(pontos);
        const numeroOriginal = new Map(rota.paradas.map((parada, indice) => [parada.id, indice + 1]));

        responder(resposta, 200, {
          rotaId: rota.id,
          recalculado: true,
          geometria: trajeto.geometria,
          distanciaM: trajeto.distanciaM,
          duracaoS: trajeto.duracaoS,
          calculadoEm: Date.now(),
          manobras: trajeto.manobras ?? [],
          limites: servicoLimites.anotar(trajeto.geometria.coordinates),
          // A primeira "parada" é a posição de partida (já concluída para a previsão); as demais mantêm o número da rota.
          paradas: [
            {
              id: 'origem-recalculo',
              tipo: 'Coleta',
              destinatario: 'Sua posição',
              endereco: '',
              status: 'Concluída',
              latitude: origem.latitude,
              longitude: origem.longitude,
              origem: true,
              numero: 0,
            },
            ...restantes.map(({id, tipo, destinatario, endereco, status, latitude, longitude}) => ({
              id,
              tipo,
              destinatario,
              endereco,
              status,
              latitude,
              longitude,
              numero: numeroOriginal.get(id),
            })),
          ],
        });
        return;
      }

      const comprovanteEncontrado = url.pathname.match(/^\/api\/rotas\/([^/]+)\/paradas\/([^/]+)\/comprovante$/);

      if (requisicao.method === 'POST' && comprovanteEncontrado) {
        const usuario = exigirUsuario(requisicao, ['motorista']);
        const corpo = await lerJson(requisicao);
        const erroEnvio = validarEnvioDeComprovante(corpo);
        if (erroEnvio) {
          responder(resposta, 400, {mensagem: erroEnvio});
          return;
        }
        const resultado = repositorio.registrarComprovanteEnviado({
          idEnvio: corpo.idEnvio,
          rotaId: decodeURIComponent(comprovanteEncontrado[1]),
          paradaId: decodeURIComponent(comprovanteEncontrado[2]),
          usuarioId: usuario.id,
          coletadoPor: corpo.coletadoPor,
          recebedor: corpo.recebedor.trim(),
          assinatura: corpo.assinatura,
          foto: corpo.foto,
          coletadoEm: corpo.coletadoEm,
        });
        if (resultado.resultado === 'rejeitado') {
          responder(resposta, 409, {codigo: resultado.motivo, mensagem: resultado.mensagem});
          return;
        }
        responder(resposta, 200, {
          duplicado: resultado.resultado === 'duplicado',
          recebidoEm: resultado.recebidoEm,
          comprovante: resultado.comprovante,
          statusDaRota: resultado.statusDaRota,
        });
        return;
      }

      const rotaEncontrada = url.pathname.match(/^\/api\/rotas\/([^/]+)$/);

      if (requisicao.method === 'PUT' && rotaEncontrada) {
        const usuario = exigirUsuario(requisicao);
        const rota = await lerJson(requisicao);
        rota.id = decodeURIComponent(rotaEncontrada[1]);
        const erroValidacao = validarRota(rota, repositorio.buscarRota(rota.id) ?? null);

        if (erroValidacao) {
          responder(resposta, 400, {mensagem: erroValidacao});
          return;
        }

        if (usuario.papel === 'motorista') {
          const existente = repositorio.buscarRota(rota.id);
          if (
            existente?.motoristaId !== usuario.id ||
            rota.motoristaId !== usuario.id
          ) {
            throw erroHttp(403, 'Motorista só pode alterar a própria rota.');
          }
        } else {
          const existente = repositorio.buscarRota(rota.id);
          const erroProgresso = existente ? preservarProgressoDoMotorista(rota, existente) : null;
          if (erroProgresso) {
            responder(resposta, 409, {mensagem: erroProgresso});
            return;
          }
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
  const host = process.env.HOST || '0.0.0.0';
  const caminhoBanco =
    process.env.ROTAMESTRE_DB_PATH ||
    path.join(__dirname, '..', 'data', 'rotamestre.sqlite');

  if (!process.env.JWT_SECRET) {
    process.stderr.write(
      'JWT_SECRET não definido. Copie backend/.env.example para backend/.env e preencha.\n',
    );
    process.exit(1);
  }

  let aplicacao;
  try {
    aplicacao = criarServidor({
      caminhoBanco,
      segredoJwt: process.env.JWT_SECRET,
      validadeToken: process.env.JWT_VALIDADE || '12h',
      seedDemo: process.env.ROTAMESTRE_SEED_DEMO === '1',
      urlOsrm: process.env.OSRM_URL || 'http://127.0.0.1:5000',
      servicoLimites: carregarLimites(
        process.env.LIMITES_VIA ||
          path.join(__dirname, '..', '..', 'dev', 'mapas', 'dados', 'limites', 'limites.json'),
      ),
    });
  } catch (falha) {
    process.stderr.write(`Não foi possível iniciar a API: ${falha.message}\n`);
    process.exit(1);
  }

  aplicacao.servidor.listen(porta, host, () => {
    process.stdout.write(`API RotaMestre disponível em ${host}:${porta}\n`);
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

module.exports = {criarServidor, validarRota, validarCadastroMotorista};
