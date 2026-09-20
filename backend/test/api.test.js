const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const {after, before, test} = require('node:test');
const {criarServidor} = require('../src/server');

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
