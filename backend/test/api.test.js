const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const {after, before, test} = require('node:test');
const {criarServidor} = require('../src/server');
const {DatabaseSync} = require('node:sqlite');
const {criarRepositorio} = require('../src/database');

const pastaTemporaria = fs.mkdtempSync(path.join(os.tmpdir(), 'rotamestre-'));
const SEGREDO_TESTE = 'segredo-de-teste-com-pelo-menos-32-caracteres';
const aplicacao = criarServidor({
  caminhoBanco: path.join(pastaTemporaria, 'teste.sqlite'),
  segredoJwt: SEGREDO_TESTE,
  seedDemo: true,
});
let endereco;
let tokenGestor;
let tokenMotorista;

async function entrar(email, senha = '123') {
  return fetch(`${endereco}/api/auth/login`, {
    method: 'POST',
    headers: {'Content-Type': 'application/json'},
    body: JSON.stringify({email, senha}),
  });
}

function cabecalhos(token = tokenGestor) {
  return {'Content-Type': 'application/json', Authorization: `Bearer ${token}`};
}

const DADOS_CNH = {
  telefone: '(12) 99876-5432',
  cnhNumero: '12345678901',
  cnhCategoria: 'b',
  cnhValidade: '31/12/2030',
};

before(async () => {
  await new Promise(resolve => aplicacao.servidor.listen(0, '127.0.0.1', resolve));
  const dados = aplicacao.servidor.address();
  endereco = `http://127.0.0.1:${dados.port}`;
  tokenGestor = (await (await entrar('gestor@rotamestre.com')).json()).token;
  tokenMotorista = (await (await entrar('motorista@rotamestre.com')).json()).token;
});

after(async () => {
  await new Promise(resolve => aplicacao.servidor.close(resolve));
  aplicacao.fechar();
  fs.rmSync(pastaTemporaria, {recursive: true, force: true});
});

test('informa que a API está ativa', async () => {
  const resposta = await fetch(`${endereco}/api/health`);
  assert.equal(resposta.status, 200);
  assert.deepEqual(await resposta.json(), {status: 'ok'});
});

test('persiste uma rota atribuída com suas paradas', async () => {
  const rota = {
    id: 'RT-TESTE',
    nome: 'Rota de teste',
    data: '21/09/2026',
    horario: '09:00',
    motoristaId: '1',
    status: 'Programada',
    paradas: [
      {
        id: 'P-1',
        tipo: 'Coleta',
        destinatario: 'Cliente A',
        endereco: 'Rua A, 10',
        janela: '09:00 - 10:00',
        observacao: '',
        status: 'Pendente',
      },
      {
        id: 'P-2',
        tipo: 'Entrega',
        destinatario: 'Cliente B',
        endereco: 'Rua B, 20',
        janela: '10:00 - 11:00',
        observacao: 'Portaria lateral',
        status: 'Pendente',
      },
    ],
  };

  const salvamento = await fetch(`${endereco}/api/rotas/${rota.id}`, {
    method: 'PUT',
    headers: cabecalhos(),
    body: JSON.stringify(rota),
  });

  assert.equal(salvamento.status, 200);

  const consulta = await fetch(`${endereco}/api/rotas/atual?motoristaId=1`, {headers: cabecalhos()});
  assert.equal(consulta.status, 200);
  assert.deepEqual(await consulta.json(), rota);
});

test('recusa uma rota sem duas paradas', async () => {
  const resposta = await fetch(`${endereco}/api/rotas/RT-INVALIDA`, {
    method: 'PUT',
    headers: cabecalhos(),
    body: JSON.stringify({
      id: 'RT-INVALIDA',
      nome: 'Inválida',
      data: 'Hoje',
      horario: '08:00',
      motoristaId: '1',
      status: 'Programada',
      paradas: [],
    }),
  });

  assert.equal(resposta.status, 400);
});

function rotaComAssinatura(assinatura) {
  return {
    id: 'RT-ASS',
    nome: 'Assinatura',
    data: 'Hoje',
    horario: '08:00',
    motoristaId: 'M-ASS',
    status: 'Em andamento',
    paradas: [
      {
        id: 'P-1',
        tipo: 'Entrega',
        destinatario: 'Cliente A',
        endereco: 'Rua A, 10',
        janela: '08:00 - 09:00',
        observacao: '',
        status: 'Concluída',
        comprovante: {recebedor: 'Maria', assinatura},
      },
      {
        id: 'P-2',
        tipo: 'Entrega',
        destinatario: 'Cliente B',
        endereco: 'Rua B, 20',
        janela: '09:00 - 10:00',
        observacao: '',
        status: 'Pendente',
      },
    ],
  };
}

function salvarRotaTeste(rota) {
  return fetch(`${endereco}/api/rotas/${rota.id}`, {
    method: 'PUT',
    headers: cabecalhos(),
    body: JSON.stringify(rota),
  });
}

test('persiste o comprovante assinado sem reenviar a imagem nos salvamentos seguintes', async () => {
  await fetch(`${endereco}/api/motoristas`, {
    method: 'POST',
    headers: cabecalhos(),
    body: JSON.stringify({
      id: 'M-ASS',
      nome: 'Motorista Assinatura',
      email: 'assinatura@teste.com',
      senha: '123',
      veiculo: 'Van',
      ...DADOS_CNH,
    }),
  });

  const rota = rotaComAssinatura('data:image/png;base64,iVBORw0KGgo=');
  assert.equal((await salvarRotaTeste(rota)).status, 200);

  const semImagem = {
    ...rota,
    paradas: rota.paradas.map(({comprovante, ...parada}) => parada),
  };
  const resposta = await salvarRotaTeste(semImagem);
  assert.equal(resposta.status, 200);

  const salva = await resposta.json();
  assert.equal(salva.paradas[0].comprovante.recebedor, 'Maria');
  assert.equal(typeof salva.paradas[0].comprovante.registradoEm, 'number');
  assert.equal(salva.paradas[0].comprovante.assinatura, undefined);
  assert.equal(salva.paradas[1].comprovante, undefined);

  const consulta = await fetch(`${endereco}/api/rotas/atual?motoristaId=M-ASS`, {headers: cabecalhos()});
  const rotaConsultada = await consulta.json();
  assert.equal(rotaConsultada.paradas[0].comprovante.recebedor, 'Maria');
});

test('recusa assinatura em formato inválido', async () => {
  const resposta = await salvarRotaTeste(rotaComAssinatura('nao-e-imagem'));
  assert.equal(resposta.status, 400);
  assert.deepEqual(await resposta.json(), {mensagem: 'Comprovante de entrega inválido.'});
});

const FOTO_TESTE = 'data:image/jpeg;base64,/9j/4AAQSkZJRgABAQ==';

function rotaComFoto(foto) {
  const rota = rotaComAssinatura('data:image/png;base64,iVBORw0KGgo=');
  rota.id = 'RT-FOTO';
  rota.paradas[0].comprovante.foto = foto;
  return rota;
}

function lerFotoDoBanco(rotaId, paradaId) {
  const banco = new DatabaseSync(path.join(pastaTemporaria, 'teste.sqlite'));
  try {
    return banco
      .prepare('SELECT foto FROM comprovantes WHERE rota_id = ? AND parada_id = ?')
      .get(rotaId, paradaId)?.foto;
  } finally {
    banco.close();
  }
}

test('persiste a foto junto com a assinatura e a mantém em salvamentos seguintes', async () => {
  const rota = rotaComFoto(FOTO_TESTE);
  assert.equal((await salvarRotaTeste(rota)).status, 200);

  const semImagens = {
    ...rota,
    paradas: rota.paradas.map(({comprovante, ...parada}) => parada),
  };
  const resposta = await salvarRotaTeste(semImagens);
  assert.equal(resposta.status, 200);

  const salva = await resposta.json();
  assert.equal(salva.paradas[0].comprovante.recebedor, 'Maria');
  assert.equal(salva.paradas[0].comprovante.foto, undefined);
  assert.equal(lerFotoDoBanco('RT-FOTO', 'P-1'), FOTO_TESTE);
});

test('recusa foto em formato inválido ou maior que 512 KB', async () => {
  const formatoInvalido = await salvarRotaTeste(rotaComFoto('data:image/gif;base64,R0lGOD'));
  assert.equal(formatoInvalido.status, 400);

  const grande = `data:image/jpeg;base64,${'A'.repeat(512 * 1024)}`;
  const muitoGrande = await salvarRotaTeste(rotaComFoto(grande));
  assert.equal(muitoGrande.status, 400);
  assert.deepEqual(await muitoGrande.json(), {mensagem: 'Comprovante de entrega inválido.'});
});

test('recusa foto enviada sem assinatura', async () => {
  const rota = rotaComFoto(FOTO_TESTE);
  delete rota.paradas[0].comprovante.assinatura;
  assert.equal((await salvarRotaTeste(rota)).status, 400);
});

test('migra banco antigo sem a coluna foto', () => {
  const caminho = path.join(pastaTemporaria, 'antigo.sqlite');
  const antigo = new DatabaseSync(caminho);
  antigo.exec(`
    CREATE TABLE comprovantes (
      rota_id TEXT NOT NULL,
      parada_id TEXT NOT NULL,
      recebedor TEXT NOT NULL,
      assinatura TEXT NOT NULL,
      registrado_em INTEGER NOT NULL,
      PRIMARY KEY (rota_id, parada_id)
    );
  `);
  antigo.close();

  criarRepositorio(caminho).fechar();

  const migrado = new DatabaseSync(caminho);
  const colunas = migrado.prepare('PRAGMA table_info(comprovantes)').all().map(c => c.name);
  migrado.close();
  assert.ok(colunas.includes('foto'));
});

test('aceita foto exatamente no limite de 512 KB e recusa 1 byte acima', async () => {
  const prefixo = 'data:image/jpeg;base64,';
  const noLimite = prefixo + 'A'.repeat(512 * 1024 - prefixo.length);

  assert.equal((await salvarRotaTeste(rotaComFoto(noLimite))).status, 200);
  assert.equal((await salvarRotaTeste(rotaComFoto(noLimite + 'A'))).status, 400);
});

test('aceita foto PNG', async () => {
  const foto = 'data:image/png;base64,iVBORw0KGgo=';
  assert.equal((await salvarRotaTeste(rotaComFoto(foto))).status, 200);
  assert.equal(lerFotoDoBanco('RT-FOTO', 'P-1'), foto);
});

test('nova conclusão da mesma parada substitui a foto anterior', async () => {
  const primeira = 'data:image/jpeg;base64,PRIMEIRA';
  const segunda = 'data:image/jpeg;base64,SEGUNDA';

  assert.equal((await salvarRotaTeste(rotaComFoto(primeira))).status, 200);
  assert.equal((await salvarRotaTeste(rotaComFoto(segunda))).status, 200);
  assert.equal(lerFotoDoBanco('RT-FOTO', 'P-1'), segunda);
});

test('recusa assinatura e foto em parada que não está concluída', async () => {
  const rota = rotaComFoto(FOTO_TESTE);
  rota.paradas[0].status = 'Em andamento';
  assert.equal((await salvarRotaTeste(rota)).status, 400);
});

test('aceita o pior caso permitido: assinatura e foto no limite na mesma requisição (> 1 MB)', async () => {
  const assinatura = 'data:image/png;base64,' + 'A'.repeat(512 * 1024 - 22);
  const foto = 'data:image/jpeg;base64,' + 'A'.repeat(512 * 1024 - 23);
  const rota = rotaComFoto(foto);
  rota.paradas[0].comprovante.assinatura = assinatura;

  assert.ok(Buffer.byteLength(JSON.stringify(rota)) > 1024 * 1024);
  assert.equal((await salvarRotaTeste(rota)).status, 200);
});

test('responde 413 quando o corpo passa de 2 MB', async () => {
  const resposta = await salvarRotaTeste({id: 'RT-GRANDE', lixo: 'A'.repeat(2 * 1024 * 1024 + 1)});
  assert.equal(resposta.status, 413);
  assert.deepEqual(await resposta.json(), {mensagem: 'Corpo da requisição excede 2 MB.'});
});

test('preserva acentos em corpos grandes divididos em vários pedaços', async () => {
  const rota = rotaComFoto('data:image/jpeg;base64,' + 'A'.repeat(300 * 1024));
  rota.nome = 'Entregas Vale do Paraíba ' + 'ç'.repeat(70000);
  const salva = await (await salvarRotaTeste(rota)).json();
  assert.equal(salva.nome, rota.nome);
});

test('reabrir um banco já migrado não falha', () => {
  const caminho = path.join(pastaTemporaria, 'antigo.sqlite');
  assert.doesNotThrow(() => criarRepositorio(caminho).fechar());
});

test('nenhum endpoint de motoristas devolve a senha, nem com hash', async () => {
  const cadastro = await fetch(`${endereco}/api/motoristas`, {
    method: 'POST',
    headers: cabecalhos(),
    body: JSON.stringify({
      id: 'M-SENHA',
      nome: 'Motorista Senha',
      email: 'senha@teste.com',
      senha: 'segredo',
      veiculo: 'Van',
      ...DADOS_CNH,
    }),
  });
  assert.equal(cadastro.status, 201);
  assert.equal('senha' in (await cadastro.json()), false);

  const lista = await (await fetch(`${endereco}/api/motoristas`, {headers: cabecalhos()})).json();
  assert.ok(lista.length > 0);
  assert.ok(lista.every(motorista => !('senha' in motorista)));
});

async function cadastrarMotoristaTeste(id) {
  const resposta = await fetch(`${endereco}/api/motoristas`, {
    method: 'POST',
    headers: cabecalhos(),
    body: JSON.stringify({
      id,
      nome: `Motorista ${id}`,
      email: `${id.toLowerCase()}@teste.com`,
      senha: '123',
      veiculo: 'Van',
      ...DADOS_CNH,
    }),
  });
  assert.equal(resposta.status, 201);
}

function rotaSimples(id, motoristaId, status = 'Programada') {
  return {
    id,
    nome: `Rota ${id}`,
    data: 'Hoje',
    horario: '08:00',
    motoristaId,
    status,
    paradas: [
      {id: 'P-1', tipo: 'Coleta', destinatario: 'A', endereco: 'Rua A', janela: '08:00 - 09:00', observacao: '', status: 'Pendente'},
      {id: 'P-2', tipo: 'Entrega', destinatario: 'B', endereco: 'Rua B', janela: '09:00 - 10:00', observacao: '', status: 'Pendente'},
    ],
  };
}

async function rotaAtualDe(motoristaId) {
  return fetch(`${endereco}/api/rotas/atual?motoristaId=${motoristaId}`, {headers: cabecalhos()});
}

test('a rota atual é a do motorista pedido, não a mais recente de outro', async () => {
  await cadastrarMotoristaTeste('M-A');
  await cadastrarMotoristaTeste('M-B');
  assert.equal((await salvarRotaTeste(rotaSimples('RT-DE-A', 'M-A'))).status, 200);
  assert.equal((await salvarRotaTeste(rotaSimples('RT-DE-B', 'M-B'))).status, 200);

  assert.equal((await (await rotaAtualDe('M-A')).json()).id, 'RT-DE-A');
  assert.equal((await (await rotaAtualDe('M-B')).json()).id, 'RT-DE-B');
});

test('rota em andamento tem prioridade sobre uma programada mais nova do mesmo motorista', async () => {
  await cadastrarMotoristaTeste('M-C');
  assert.equal((await salvarRotaTeste(rotaSimples('RT-EXECUCAO', 'M-C', 'Em andamento'))).status, 200);
  assert.equal((await salvarRotaTeste(rotaSimples('RT-AMANHA', 'M-C', 'Programada'))).status, 200);

  assert.equal((await (await rotaAtualDe('M-C')).json()).id, 'RT-EXECUCAO');
});

test('motorista sem rota recebe 404', async () => {
  await cadastrarMotoristaTeste('M-SEM-ROTA');
  assert.equal((await rotaAtualDe('M-SEM-ROTA')).status, 404);
});

function cadastrarMotoristaCom(dados) {
  return fetch(`${endereco}/api/motoristas`, {
    method: 'POST',
    headers: cabecalhos(),
    body: JSON.stringify({
      nome: 'Motorista CNH',
      senha: '123',
      veiculo: 'Van',
      ...DADOS_CNH,
      ...dados,
    }),
  });
}

function lerMotoristaDoBanco(id) {
  const banco = new DatabaseSync(path.join(pastaTemporaria, 'teste.sqlite'));
  try {
    return banco
      .prepare('SELECT telefone, cnh_numero, cnh_categoria, cnh_validade FROM motoristas WHERE id = ?')
      .get(id);
  } finally {
    banco.close();
  }
}

test('cadastro grava CNH e telefone normalizados no banco', async () => {
  const resposta = await cadastrarMotoristaCom({id: 'M-CNH', email: 'cnh@teste.com'});
  assert.equal(resposta.status, 201);

  assert.deepEqual({...lerMotoristaDoBanco('M-CNH')}, {
    telefone: '12998765432',
    cnh_numero: '12345678901',
    cnh_categoria: 'B',
    cnh_validade: '2030-12-31',
  });
});

test('cadastro recusa CNH, categoria, validade ou telefone inválidos', async () => {
  const casos = [
    [{cnhNumero: '1234567890'}, 'Número da CNH deve ter 11 dígitos.'],
    [{cnhCategoria: 'Z'}, 'Categoria da CNH inválida.'],
    [{cnhValidade: '31/02/2030'}, 'Data de validade da CNH inválida.'],
    [{cnhValidade: '2030-12-31'}, 'Data de validade da CNH inválida.'],
    [{telefone: '9876-5432'}, 'Telefone inválido.'],
    [{nome: '   '}, 'Dados obrigatórios faltando.'],
  ];

  for (const [indice, [dados, mensagem]] of casos.entries()) {
    const resposta = await cadastrarMotoristaCom({
      id: `M-INVALIDO-${indice}`,
      email: `invalido${indice}@teste.com`,
      ...dados,
    });
    assert.equal(resposta.status, 400, JSON.stringify(dados));
    assert.deepEqual(await resposta.json(), {mensagem});
  }
});

test('a lista de motoristas não expõe CNH nem telefone', async () => {
  await cadastrarMotoristaCom({id: 'M-PRIVADO', email: 'privado@teste.com'});
  const lista = await (await fetch(`${endereco}/api/motoristas`, {headers: cabecalhos()})).json();

  for (const motorista of lista) {
    for (const campo of ['telefone', 'cnhNumero', 'cnh_numero', 'cnhCategoria', 'cnhValidade']) {
      assert.equal(campo in motorista, false, `${motorista.id} expõe ${campo}`);
    }
  }
});

test('banco antigo ganha as colunas de CNH e telefone', () => {
  const caminho = path.join(pastaTemporaria, 'motoristas-antigo.sqlite');
  const antigo = new DatabaseSync(caminho);
  antigo.exec(`
    CREATE TABLE motoristas (
      id TEXT PRIMARY KEY,
      nome TEXT NOT NULL,
      email TEXT UNIQUE,
      senha TEXT,
      veiculo TEXT NOT NULL,
      disponivel INTEGER NOT NULL DEFAULT 1
    );
  `);
  antigo.close();

  criarRepositorio(caminho).fechar();

  const migrado = new DatabaseSync(caminho);
  const colunas = migrado.prepare('PRAGMA table_info(motoristas)').all().map(c => c.name);
  migrado.close();
  for (const coluna of ['telefone', 'cnh_numero', 'cnh_categoria', 'cnh_validade']) {
    assert.ok(colunas.includes(coluna), coluna);
  }
});

test('e-mail duplicado responde 409 com mensagem clara', async () => {
  assert.equal((await cadastrarMotoristaCom({id: 'M-DUP-1', email: 'dup@teste.com'})).status, 201);

  const repetido = await cadastrarMotoristaCom({id: 'M-DUP-2', email: 'dup@teste.com'});
  assert.equal(repetido.status, 409);
  assert.deepEqual(await repetido.json(), {mensagem: 'Este e-mail já está cadastrado.'});
});

test('e-mail duplicado com maiúsculas e espaços também responde 409', async () => {
  const repetido = await cadastrarMotoristaCom({id: 'M-DUP-3', email: '  DUP@Teste.com '});
  assert.equal(repetido.status, 409);
});

test('o e-mail é gravado normalizado', async () => {
  const salvo = await (await cadastrarMotoristaCom({id: 'M-NORM', email: ' Norm@Teste.COM '})).json();
  assert.equal(salvo.email, 'norm@teste.com');
});

function enviarCorpoBruto(metodo, caminho, corpo) {
  return fetch(`${endereco}${caminho}`, {
    method: metodo,
    headers: cabecalhos(),
    body: corpo,
  });
}

test('JSON malformado responde 400', async () => {
  for (const [metodo, caminho] of [['PUT', '/api/rotas/RT-X'], ['POST', '/api/motoristas']]) {
    const resposta = await enviarCorpoBruto(metodo, caminho, '{malformado');
    assert.equal(resposta.status, 400, `${metodo} ${caminho}`);
    assert.deepEqual(await resposta.json(), {mensagem: 'JSON inválido.'});
  }
});

test('corpo vazio responde 400', async () => {
  assert.equal((await enviarCorpoBruto('PUT', '/api/rotas/RT-X', '')).status, 400);
});

test('JSON válido que não é objeto responde 400', async () => {
  for (const corpo of ['null', '"texto"', '42', '[]']) {
    const resposta = await enviarCorpoBruto('PUT', '/api/rotas/RT-X', corpo);
    assert.equal(resposta.status, 400, corpo);
    assert.deepEqual(await resposta.json(), {
      mensagem: 'O corpo da requisição deve ser um objeto JSON.',
    });
  }
});

const jwt = require('jsonwebtoken');

test('login do gestor devolve token e usuário com papel, sem senha', async () => {
  const resposta = await entrar('  GESTOR@rotamestre.com ');
  assert.equal(resposta.status, 200);

  const {token, usuario} = await resposta.json();
  assert.equal(typeof token, 'string');
  assert.deepEqual(usuario, {
    id: 'G-1',
    nome: 'Rodrigo Matos (Demo)',
    email: 'gestor@rotamestre.com',
    papel: 'gestor',
  });
  assert.equal(jwt.verify(token, SEGREDO_TESTE).sub, 'G-1');
});

test('senha errada e e-mail inexistente recebem a mesma resposta 401', async () => {
  const senhaErrada = await entrar('gestor@rotamestre.com', 'errada');
  const semConta = await entrar('ninguem@rotamestre.com', '123');

  for (const resposta of [senhaErrada, semConta]) {
    assert.equal(resposta.status, 401);
    assert.deepEqual(await resposta.json(), {mensagem: 'E-mail ou senha incorretos.'});
  }
});

test('login sem e-mail ou senha responde 400', async () => {
  const resposta = await entrar('gestor@rotamestre.com', '');
  assert.equal(resposta.status, 400);
});

test('endpoints protegidos exigem token válido', async () => {
  const semToken = await fetch(`${endereco}/api/rotas/atual`);
  assert.equal(semToken.status, 401);
  assert.deepEqual(await semToken.json(), {mensagem: 'Autenticação necessária.'});

  const tokenAlheio = jwt.sign({papel: 'gestor'}, 'outro-segredo-com-pelo-menos-32-caracteres', {
    subject: 'G-1',
  });
  const falsificado = await fetch(`${endereco}/api/motoristas`, {headers: cabecalhos(tokenAlheio)});
  assert.equal(falsificado.status, 401);

  const vencido = jwt.sign({papel: 'gestor'}, SEGREDO_TESTE, {subject: 'G-1', expiresIn: -10});
  const expirado = await fetch(`${endereco}/api/motoristas`, {headers: cabecalhos(vencido)});
  assert.equal(expirado.status, 401);
  assert.deepEqual(await expirado.json(), {mensagem: 'Sessão expirada. Entre novamente.'});

  const usuarioInexistente = jwt.sign({papel: 'gestor'}, SEGREDO_TESTE, {subject: 'NAO-EXISTE'});
  const fantasma = await fetch(`${endereco}/api/motoristas`, {headers: cabecalhos(usuarioInexistente)});
  assert.equal(fantasma.status, 401);
});

test('o papel vem do banco, não do token: motorista com papel "gestor" no token é barrado', async () => {
  const forjado = jwt.sign({papel: 'gestor'}, SEGREDO_TESTE, {subject: '1'});
  const resposta = await fetch(`${endereco}/api/motoristas`, {headers: cabecalhos(forjado)});
  assert.equal(resposta.status, 403);
});

test('motorista não acessa a lista de motoristas', async () => {
  const resposta = await fetch(`${endereco}/api/motoristas`, {headers: cabecalhos(tokenMotorista)});
  assert.equal(resposta.status, 403);
  assert.deepEqual(await resposta.json(), {mensagem: 'Acesso não permitido para este perfil.'});
});

test('motorista recebe a própria rota e o parâmetro motoristaId é ignorado', async () => {
  await cadastrarMotoristaTeste('M-OUTRO');
  assert.equal((await salvarRotaTeste(rotaSimples('RT-DO-OUTRO', 'M-OUTRO', 'Em andamento'))).status, 200);

  const resposta = await fetch(`${endereco}/api/rotas/atual?motoristaId=M-OUTRO`, {
    headers: cabecalhos(tokenMotorista),
  });
  assert.equal(resposta.status, 200);
  assert.equal((await resposta.json()).motoristaId, '1');
});

test('motorista só altera a própria rota, sem reatribuir nem criar rotas', async () => {
  const comoMotorista = rota =>
    fetch(`${endereco}/api/rotas/${rota.id}`, {
      method: 'PUT',
      headers: cabecalhos(tokenMotorista),
      body: JSON.stringify(rota),
    });

  const rotaAlheia = rotaSimples('RT-DO-OUTRO', 'M-OUTRO', 'Em andamento');
  assert.equal((await comoMotorista(rotaAlheia)).status, 403);

  const tomarRota = {...rotaAlheia, motoristaId: '1'};
  assert.equal((await comoMotorista(tomarRota)).status, 403);

  assert.equal((await comoMotorista(rotaSimples('RT-NOVA-DO-MOTORISTA', '1'))).status, 403);

  const propria = rotaSimples('RT-PROPRIA', '1');
  assert.equal((await salvarRotaTeste(propria)).status, 200);
  const reatribuir = await comoMotorista({...propria, motoristaId: 'M-OUTRO'});
  assert.equal(reatribuir.status, 403);
  assert.deepEqual(await reatribuir.json(), {mensagem: 'Motorista só pode alterar a própria rota.'});

  const iniciar = await comoMotorista({...propria, status: 'Em andamento'});
  assert.equal(iniciar.status, 200);
  assert.equal((await iniciar.json()).status, 'Em andamento');
});

test('cadastro público sempre cria motorista, mesmo enviando papel "gestor"', async () => {
  const cadastro = await cadastrarMotoristaCom({
    id: 'M-ESPERTO',
    email: 'esperto@teste.com',
    papel: 'gestor',
  });
  assert.equal(cadastro.status, 201);
  assert.equal('papel' in (await cadastro.json()), false);

  const {usuario} = await (await entrar('esperto@teste.com')).json();
  assert.equal(usuario.papel, 'motorista');
});

test('motorista recém-cadastrado consegue entrar com a própria senha', async () => {
  await cadastrarMotoristaCom({id: 'M-NOVO', email: 'novo@teste.com', senha: 'minha-senha'});

  assert.equal((await entrar('novo@teste.com', 'minha-senha')).status, 200);
  assert.equal((await entrar('novo@teste.com', '123')).status, 401);
});

test('servidor não sobe sem segredo JWT ou com segredo curto', () => {
  const caminhoBanco = path.join(pastaTemporaria, 'sem-segredo.sqlite');
  assert.throws(() => criarServidor({caminhoBanco}), /JWT_SECRET/);
  assert.throws(() => criarServidor({caminhoBanco, segredoJwt: 'curto'}), /JWT_SECRET/);
});

test('sem seedDemo nenhuma conta com senha conhecida é criada', () => {
  const caminho = path.join(pastaTemporaria, 'sem-demo.sqlite');
  criarRepositorio(caminho).fechar();

  const banco = new DatabaseSync(caminho);
  const total = banco.prepare('SELECT count(*) AS n FROM usuarios').get().n;
  banco.close();
  assert.equal(total, 0);
});

test('migra banco antigo: credenciais vão para usuarios, rotas continuam válidas e há backup', async () => {
  const bcrypt = require('bcryptjs');
  const caminho = path.join(pastaTemporaria, 'antes-de-usuarios.sqlite');
  const antigo = new DatabaseSync(caminho);
  antigo.exec(`
    CREATE TABLE motoristas (
      id TEXT PRIMARY KEY, nome TEXT NOT NULL, email TEXT UNIQUE, senha TEXT,
      veiculo TEXT NOT NULL, disponivel INTEGER NOT NULL DEFAULT 1
    );
    CREATE TABLE rotas (
      id TEXT PRIMARY KEY, nome TEXT NOT NULL, data TEXT NOT NULL, horario TEXT NOT NULL,
      motorista_id TEXT NOT NULL, status TEXT NOT NULL, criado_em INTEGER NOT NULL,
      FOREIGN KEY (motorista_id) REFERENCES motoristas(id)
    );
  `);
  antigo
    .prepare('INSERT INTO motoristas VALUES (?, ?, ?, ?, ?, 1)')
    .run('M-ANTIGO', 'Antigo', 'Antigo@Teste.com', bcrypt.hashSync('senha-antiga', 4), 'Van');
  antigo
    .prepare('INSERT INTO rotas VALUES (?, ?, ?, ?, ?, ?, ?)')
    .run('RT-ANTIGA', 'R', 'Hoje', '08:00', 'M-ANTIGO', 'Programada', 1);
  antigo.close();

  const repositorio = criarRepositorio(caminho);
  assert.deepEqual(repositorio.buscarUsuario('M-ANTIGO'), {
    id: 'M-ANTIGO',
    nome: 'Antigo',
    email: 'antigo@teste.com',
    papel: 'motorista',
  });
  assert.equal(repositorio.buscarRotaAtual('M-ANTIGO').id, 'RT-ANTIGA');
  assert.deepEqual(repositorio.listarMotoristas().map(m => m.id), ['M-ANTIGO']);

  const {criarServicoAutenticacao} = require('../src/autenticacao');
  const servico = criarServicoAutenticacao({repositorio, segredo: SEGREDO_TESTE});
  assert.ok(await servico.entrar('antigo@teste.com', 'senha-antiga'));
  repositorio.fechar();

  const migrado = new DatabaseSync(caminho);
  const colunas = migrado.prepare('PRAGMA table_info(motoristas)').all().map(c => c.name);
  const violacoes = migrado.prepare('PRAGMA foreign_key_check').all();
  migrado.close();
  assert.equal(colunas.includes('email'), false);
  assert.equal(colunas.includes('senha'), false);
  assert.deepEqual(violacoes, []);
  assert.ok(fs.existsSync(`${caminho}.antes-usuarios.bak`));
});

test('servidor não sobe com JWT_VALIDADE inválido, zero ou negativo', () => {
  const caminhoBanco = path.join(pastaTemporaria, 'validade-invalida.sqlite');
  for (const validadeToken of ['12 horas', 'abc', '0s', '-1h']) {
    assert.throws(
      () => criarServidor({caminhoBanco, segredoJwt: SEGREDO_TESTE, validadeToken}),
      /JWT_VALIDADE inválido/,
      validadeToken,
    );
  }
  assert.equal(fs.existsSync(caminhoBanco), false);
});

test('JWT_VALIDADE válido em texto ou em segundos é aceito', () => {
  const {validarValidadeToken} = require('../src/autenticacao');
  for (const validade of ['12h', '30m', '1d', 3600]) {
    assert.doesNotThrow(() => validarValidadeToken(validade), String(validade));
  }
});

test('token assinado sem sub responde 401, não 500', async () => {
  const semSub = jwt.sign({papel: 'gestor'}, SEGREDO_TESTE);
  const subNumerico = jwt.sign({sub: 1, papel: 'gestor'}, SEGREDO_TESTE);

  for (const token of [semSub, subNumerico]) {
    const resposta = await fetch(`${endereco}/api/motoristas`, {headers: cabecalhos(token)});
    assert.equal(resposta.status, 401);
    assert.deepEqual(await resposta.json(), {mensagem: 'Autenticação inválida.'});
  }
});
