const fs = require('node:fs');
const path = require('node:path');
const {DatabaseSync} = require('node:sqlite');



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
      email TEXT UNIQUE,
      senha TEXT,
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

    CREATE TABLE IF NOT EXISTS comprovantes (
      rota_id TEXT NOT NULL,
      parada_id TEXT NOT NULL,
      recebedor TEXT NOT NULL,
      assinatura TEXT NOT NULL,
      registrado_em INTEGER NOT NULL,
      PRIMARY KEY (rota_id, parada_id),
      FOREIGN KEY (rota_id) REFERENCES rotas(id) ON DELETE CASCADE
    );
  `);

  function listarParadas(rotaId) {
    return banco
      .prepare(`
        SELECT p.id, p.tipo, p.destinatario, p.endereco, p.janela, p.observacao, p.status,
               c.recebedor, c.registrado_em
        FROM paradas p
        LEFT JOIN comprovantes c ON c.rota_id = p.rota_id AND c.parada_id = p.id
        WHERE p.rota_id = ?
        ORDER BY p.ordem
      `)
      .all(rotaId)
      .map(({recebedor, registrado_em, ...parada}) =>
        recebedor
          ? {...parada, comprovante: {recebedor, registradoEm: registrado_em}}
          : parada,
      );
  }

  function salvarMotorista(motorista) {
    banco
      .prepare(`
        INSERT INTO motoristas (id, nome, email, senha, veiculo, disponivel)
        VALUES (?, ?, ?, ?, ?, ?)
      `)
      .run(
        motorista.id,
        motorista.nome,
        motorista.email,
        motorista.senha,
        motorista.veiculo,
        motorista.disponivel ? 1 : 0,
      );
    return motorista;
  }

  function listarMotoristas() {
    return banco
      .prepare('SELECT id, nome, email, senha, veiculo, disponivel FROM motoristas ORDER BY nome')
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

    const paradas = listarParadas(rota.id);

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
      const salvarComprovante = banco.prepare(`
        INSERT INTO comprovantes (rota_id, parada_id, recebedor, assinatura, registrado_em)
        VALUES (?, ?, ?, ?, ?)
        ON CONFLICT(rota_id, parada_id) DO UPDATE SET
          recebedor = excluded.recebedor,
          assinatura = excluded.assinatura,
          registrado_em = excluded.registrado_em
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

        if (parada.comprovante?.assinatura) {
          salvarComprovante.run(
            rota.id,
            parada.id,
            parada.comprovante.recebedor.trim(),
            parada.comprovante.assinatura,
            Date.now(),
          );
        }
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

    const paradas = listarParadas(id);

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
    const bcrypt = require('bcryptjs');
    salvarMotorista({
      id: '1',
      nome: 'Carlos Mendes (Demo)',
      email: 'motorista@rotamestre.com',
      senha: bcrypt.hashSync('123', 10),
      veiculo: 'Mercedes-Benz Sprinter • ABC-1234',
      disponivel: true,
    });
    salvarRota(ROTA_INICIAL);
  }

  return {
    buscarRotaAtual,
    listarMotoristas,
    salvarMotorista,
    salvarRota,
    fechar: () => banco.close(),
  };
}

module.exports = {criarRepositorio};
