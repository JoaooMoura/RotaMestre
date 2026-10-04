const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const {after, before, test} = require('node:test');
const {criarServidor} = require('../src/server');
const {DatabaseSync} = require('node:sqlite');
const {criarRepositorio} = require('../src/database');

const pastaTemporaria = fs.mkdtempSync(path.join(os.tmpdir(), 'rotamestre-'));
const aplicacao = criarServidor(path.join(pastaTemporaria, 'teste.sqlite'));
let endereco;

before(async () => {
  await new Promise(resolve => aplicacao.servidor.listen(0, '127.0.0.1', resolve));
  const dados = aplicacao.servidor.address();
  endereco = `http://127.0.0.1:${dados.port}`;
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
    headers: {'Content-Type': 'application/json'},
    body: JSON.stringify(rota),
  });

  assert.equal(salvamento.status, 200);

  const consulta = await fetch(`${endereco}/api/rotas/atual?motoristaId=1`);
  assert.equal(consulta.status, 200);
  assert.deepEqual(await consulta.json(), rota);
});

test('recusa uma rota sem duas paradas', async () => {
  const resposta = await fetch(`${endereco}/api/rotas/RT-INVALIDA`, {
    method: 'PUT',
    headers: {'Content-Type': 'application/json'},
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
    headers: {'Content-Type': 'application/json'},
    body: JSON.stringify(rota),
  });
}

test('persiste o comprovante assinado sem reenviar a imagem nos salvamentos seguintes', async () => {
  await fetch(`${endereco}/api/motoristas`, {
    method: 'POST',
    headers: {'Content-Type': 'application/json'},
    body: JSON.stringify({
      id: 'M-ASS',
      nome: 'Motorista Assinatura',
      email: 'assinatura@teste.com',
      senha: '123',
      veiculo: 'Van',
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

  const consulta = await fetch(`${endereco}/api/rotas/atual?motoristaId=M-ASS`);
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
