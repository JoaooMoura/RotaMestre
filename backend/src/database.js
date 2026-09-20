const fs = require('node:fs');
const path = require('node:path');
const {DatabaseSync} = require('node:sqlite');

const MOTORISTAS_INICIAIS = [
  {
    id: '1',
    nome: 'Carlos Mendes',
    veiculo: 'Mercedes-Benz Sprinter • ABC-1234',
    disponivel: true,
  },
  {
    id: '2',
    nome: 'Ana Paula Souza',
    veiculo: 'Fiat Ducato • XYZ-5678',
    disponivel: true,
  },
  {
    id: '3',
    nome: 'Ricardo Ferreira',
    veiculo: 'Ford Transit • DEF-9012',
    disponivel: true,
  },
];

const ROTA_INICIAL = {
  id: 'RT-001',
  nome: 'Entregas Vale do Paraíba',
  data: 'Hoje',
  horario: '08:00',
  motoristaId: '1',
  status: 'Programada',
  paradas: [
    {
      id: '1',
      tipo: 'Entrega',
      destinatario: 'Mercado Bom Preço',
      endereco: 'Rua Paraibuna, 88 - São José dos Campos',
      janela: '08:30 - 09:30',
      observacao: 'Entregar na doca lateral',
      status: 'Pendente',
    },
    {
      id: '2',
      tipo: 'Coleta',
      destinatario: 'Distribuidora Vale',
      endereco: 'Avenida Itália, 410 - Taubaté',
      janela: '10:00 - 11:00',
      observacao: 'Solicitar nota fiscal',
      status: 'Pendente',
    },
    {
      id: '3',
      tipo: 'Entrega',
      destinatario: 'Farmácia São Lucas',
      endereco: 'Rua das Flores, 25 - Caçapava',
      janela: '11:30 - 12:30',
      observacao: 'Carga frágil',
      status: 'Pendente',
    },
  ],
};

function criarRepositorio(caminhoBanco) {
  fs.mkdirSync(path.dirname(caminhoBanco), {recursive: true});
  const banco = new DatabaseSync(caminhoBanco);

  banco.exec('PRAGMA foreign_keys = ON');
  banco.exec(`
    CREATE TABLE IF NOT EXISTS motoristas (
      id TEXT PRIMARY KEY,
      nome TEXT NOT NULL,
      veiculo TEXT NOT NULL,
      disponivel INTEGER NOT NULL DEFAULT 1
    );

    CREATE TABLE IF NOT EXISTS rotas (
      id TEXT PRIMARY KEY,
      nome TEXT NOT NULL,
      data TEXT NOT NULL,
      horario TEXT NOT NULL,
      motorista_id TEXT NOT NULL,
      status TEXT NOT NULL,
      criado_em INTEGER NOT NULL,
      FOREIGN KEY (motorista_id) REFERENCES motoristas(id)
    );

    CREATE TABLE IF NOT EXISTS paradas (
      id TEXT NOT NULL,
      rota_id TEXT NOT NULL,
      ordem INTEGER NOT NULL,
      tipo TEXT NOT NULL,
      destinatario TEXT NOT NULL,
      endereco TEXT NOT NULL,
      janela TEXT NOT NULL,
      observacao TEXT NOT NULL,
      status TEXT NOT NULL,
      PRIMARY KEY (id, rota_id),
      FOREIGN KEY (rota_id) REFERENCES rotas(id) ON DELETE CASCADE
    );
  `);

  const inserirMotorista = banco.prepare(`
    INSERT OR IGNORE INTO motoristas (id, nome, veiculo, disponivel)
    VALUES (?, ?, ?, ?)
  `);

  for (const motorista of MOTORISTAS_INICIAIS) {
    inserirMotorista.run(
      motorista.id,
      motorista.nome,
      motorista.veiculo,
      motorista.disponivel ? 1 : 0,
    );
  }

  function listarMotoristas() {
    return banco
      .prepare('SELECT id, nome, veiculo, disponivel FROM motoristas ORDER BY nome')
      .all()
      .map(motorista => ({
        ...motorista,
        disponivel: Boolean(motorista.disponivel),
      }));
  }

  function buscarRotaAtual(motoristaId) {
    const rota = motoristaId
      ? banco
          .prepare(`
            SELECT id, nome, data, horario, motorista_id, status
            FROM rotas
            WHERE motorista_id = ?
            ORDER BY criado_em DESC
            LIMIT 1
          `)
          .get(motoristaId)
      : banco
          .prepare(`
            SELECT id, nome, data, horario, motorista_id, status
            FROM rotas
            ORDER BY criado_em DESC
            LIMIT 1
          `)
          .get();

    if (!rota) {
      return null;
    }

    const paradas = banco
      .prepare(`
        SELECT id, tipo, destinatario, endereco, janela, observacao, status
        FROM paradas
        WHERE rota_id = ?
        ORDER BY ordem
      `)
      .all(rota.id);

    return {
      id: rota.id,
      nome: rota.nome,
      data: rota.data,
      horario: rota.horario,
      motoristaId: rota.motorista_id,
      status: rota.status,
      paradas,
    };
  }

  function salvarRota(rota) {
    banco.exec('BEGIN IMMEDIATE');

    try {
      banco
        .prepare(`
          INSERT INTO rotas (id, nome, data, horario, motorista_id, status, criado_em)
          VALUES (?, ?, ?, ?, ?, ?, ?)
          ON CONFLICT(id) DO UPDATE SET
            nome = excluded.nome,
            data = excluded.data,
            horario = excluded.horario,
            motorista_id = excluded.motorista_id,
            status = excluded.status
        `)
        .run(
          rota.id,
          rota.nome,
          rota.data,
          rota.horario,
          rota.motoristaId,
          rota.status,
          Date.now(),
        );

      banco.prepare('DELETE FROM paradas WHERE rota_id = ?').run(rota.id);
      const inserirParada = banco.prepare(`
        INSERT INTO paradas (
          id, rota_id, ordem, tipo, destinatario, endereco, janela, observacao, status
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      `);

      rota.paradas.forEach((parada, ordem) => {
        inserirParada.run(
          parada.id,
          rota.id,
          ordem,
          parada.tipo,
          parada.destinatario,
          parada.endereco,
          parada.janela,
          parada.observacao,
          parada.status,
        );
      });

      banco.exec('COMMIT');
      return buscarRotaAtualPorId(rota.id);
    } catch (erro) {
      banco.exec('ROLLBACK');
      throw erro;
    }
  }

  function buscarRotaAtualPorId(id) {
    const rota = banco
      .prepare(`
        SELECT id, nome, data, horario, motorista_id, status
        FROM rotas
        WHERE id = ?
      `)
      .get(id);

    if (!rota) {
      return null;
    }

    const paradas = banco
      .prepare(`
        SELECT id, tipo, destinatario, endereco, janela, observacao, status
        FROM paradas
        WHERE rota_id = ?
        ORDER BY ordem
      `)
      .all(id);

    return {
      id: rota.id,
      nome: rota.nome,
      data: rota.data,
      horario: rota.horario,
      motoristaId: rota.motorista_id,
      status: rota.status,
      paradas,
    };
  }

  if (!buscarRotaAtual()) {
    salvarRota(ROTA_INICIAL);
  }

  return {
    buscarRotaAtual,
    listarMotoristas,
    salvarRota,
    fechar: () => banco.close(),
  };
}

module.exports = {criarRepositorio};
