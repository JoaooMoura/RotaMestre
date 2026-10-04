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

// Contas criadas apenas com a opção seedDemo (ROTAMESTRE_SEED_DEMO=1).
const SENHA_DEMO = '123';
const GESTOR_DEMO = {
  id: 'G-1',
  nome: 'Rodrigo Matos (Demo)',
  email: 'gestor@rotamestre.com',
  papel: 'gestor',
};
const MOTORISTA_DEMO = {
  id: '1',
  nome: 'Carlos Mendes (Demo)',
  email: 'motorista@rotamestre.com',
  veiculo: 'Mercedes-Benz Sprinter • ABC-1234',
  disponivel: true,
};

// Código do SQLite para violação de UNIQUE (SQLITE_CONSTRAINT_UNIQUE).
const SQLITE_CONSTRAINT_UNIQUE = 2067;

function ddlMotoristas(nomeTabela) {
  return `
    CREATE TABLE IF NOT EXISTS ${nomeTabela} (
      id TEXT PRIMARY KEY,
      veiculo TEXT NOT NULL,
      disponivel INTEGER NOT NULL DEFAULT 1,
      telefone TEXT,
      cnh_numero TEXT,
      cnh_categoria TEXT,
      cnh_validade TEXT,
      FOREIGN KEY (id) REFERENCES usuarios(id) ON DELETE CASCADE
    );
  `;
}

function criarRepositorio(caminhoBanco, {seedDemo = false} = {}) {
  fs.mkdirSync(path.dirname(caminhoBanco), {recursive: true});
  const banco = new DatabaseSync(caminhoBanco);

  function tabelaTemColuna(tabela, coluna) {
    return banco
      .prepare(`PRAGMA table_info(${tabela})`)
      .all()
      .some(item => item.name === coluna);
  }

  // Antes de usuarios, e-mail e senha ficavam em motoristas.
  const bancoLegado = tabelaTemColuna('motoristas', 'email');
  if (bancoLegado) {
    const backup = `${caminhoBanco}.antes-usuarios.bak`;
    if (!fs.existsSync(backup)) {
      banco.exec(`VACUUM INTO '${backup.replace(/'/g, "''")}'`);
    }
  }

  banco.exec('PRAGMA foreign_keys = ON');
  banco.exec(`
    CREATE TABLE IF NOT EXISTS usuarios (
      id TEXT PRIMARY KEY,
      nome TEXT NOT NULL,
      email TEXT NOT NULL UNIQUE,
      senha TEXT,
      papel TEXT NOT NULL CHECK (papel IN ('gestor', 'motorista'))
    );

    ${ddlMotoristas('motoristas')}

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
      foto TEXT,
      registrado_em INTEGER NOT NULL,
      PRIMARY KEY (rota_id, parada_id),
      FOREIGN KEY (rota_id) REFERENCES rotas(id) ON DELETE CASCADE
    );
  `);

  // Bancos criados antes de cada mudança de schema já têm as tabelas, mas sem as colunas novas.
  function adicionarColunaSeFaltar(tabela, coluna) {
    if (!tabelaTemColuna(tabela, coluna)) {
      banco.exec(`ALTER TABLE ${tabela} ADD COLUMN ${coluna} TEXT`);
    }
  }

  adicionarColunaSeFaltar('comprovantes', 'foto'); // US07.04
  ['telefone', 'cnh_numero', 'cnh_categoria', 'cnh_validade'].forEach(coluna =>
    adicionarColunaSeFaltar('motoristas', coluna), // US02.01
  );

  // Move e-mail e senha de motoristas para usuarios (papel 'motorista') e reconstrói motoristas
  // sem essas colunas. O SQLite não remove coluna UNIQUE com DROP COLUMN, por isso a reconstrução.
  function migrarParaUsuarios() {
    banco.exec('PRAGMA foreign_keys = OFF');
    banco.exec('BEGIN IMMEDIATE');
    try {
      banco.exec(`
        INSERT INTO usuarios (id, nome, email, senha, papel)
        SELECT id, nome,
               COALESCE(lower(trim(email)), 'sem-email+' || id || '@rotamestre.invalid'),
               senha, 'motorista'
        FROM motoristas;

        ${ddlMotoristas('motoristas_nova')}

        INSERT INTO motoristas_nova (
          id, veiculo, disponivel, telefone, cnh_numero, cnh_categoria, cnh_validade
        )
        SELECT id, veiculo, disponivel, telefone, cnh_numero, cnh_categoria, cnh_validade
        FROM motoristas;

        DROP TABLE motoristas;
        ALTER TABLE motoristas_nova RENAME TO motoristas;
      `);

      const violacoes = banco.prepare('PRAGMA foreign_key_check').all();
      if (violacoes.length > 0) {
        throw new Error(`Migração para usuarios deixaria ${violacoes.length} referência(s) inválida(s).`);
      }
      banco.exec('COMMIT');
    } catch (erro) {
      banco.exec('ROLLBACK');
      throw erro;
    } finally {
      banco.exec('PRAGMA foreign_keys = ON');
    }
  }

  if (bancoLegado) {
    migrarParaUsuarios();
  }

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

  function inserirUsuario(usuario) {
    try {
      banco
        .prepare('INSERT INTO usuarios (id, nome, email, senha, papel) VALUES (?, ?, ?, ?, ?)')
        .run(usuario.id, usuario.nome, usuario.email, usuario.senha, usuario.papel);
    } catch (erro) {
      if (erro.errcode === SQLITE_CONSTRAINT_UNIQUE && erro.message.includes('usuarios.email')) {
        const duplicado = new Error('Este e-mail já está cadastrado.');
        duplicado.codigo = 'EMAIL_DUPLICADO';
        throw duplicado;
      }
      throw erro;
    }
  }

  // Cria o usuário (papel sempre 'motorista') e o perfil de motorista na mesma transação.
  function salvarMotorista(motorista) {
    banco.exec('BEGIN IMMEDIATE');
    try {
      inserirUsuario({...motorista, papel: 'motorista'});
      banco
        .prepare(`
          INSERT INTO motoristas (
            id, veiculo, disponivel, telefone, cnh_numero, cnh_categoria, cnh_validade
          ) VALUES (?, ?, ?, ?, ?, ?, ?)
        `)
        .run(
          motorista.id,
          motorista.veiculo,
          motorista.disponivel ? 1 : 0,
          motorista.telefone ?? null,
          motorista.cnhNumero ?? null,
          motorista.cnhCategoria ?? null,
          motorista.cnhValidade ?? null,
        );
      banco.exec('COMMIT');
    } catch (erro) {
      banco.exec('ROLLBACK');
      throw erro;
    }

    // Campos explícitos: a senha (mesmo com hash) nunca sai do repositório.
    return {
      id: motorista.id,
      nome: motorista.nome,
      email: motorista.email,
      veiculo: motorista.veiculo,
      disponivel: Boolean(motorista.disponivel),
      telefone: motorista.telefone,
      cnhNumero: motorista.cnhNumero,
      cnhCategoria: motorista.cnhCategoria,
      cnhValidade: motorista.cnhValidade,
    };
  }

  function listarMotoristas() {
    return banco
      .prepare(`
        SELECT m.id, u.nome, u.email, m.veiculo, m.disponivel
        FROM motoristas m
        JOIN usuarios u ON u.id = m.id
        ORDER BY u.nome
      `)
      .all()
      .map(motorista => ({
        ...motorista,
        disponivel: Boolean(motorista.disponivel),
      }));
  }

  // Uso exclusivo da autenticação: é a única consulta que devolve o hash da senha.
  function buscarCredenciais(email) {
    const usuario = banco
      .prepare('SELECT id, nome, email, senha, papel FROM usuarios WHERE email = ?')
      .get(email);
    return usuario ? {...usuario} : null;
  }

  function buscarUsuario(id) {
    const usuario = banco
      .prepare('SELECT id, nome, email, papel FROM usuarios WHERE id = ?')
      .get(id);
    return usuario ? {...usuario} : null;
  }

  // Rota em execução tem prioridade sobre uma programada mais nova; concluídas ficam por último.
  const ORDEM_ROTA_ATUAL = `
    ORDER BY CASE status
      WHEN 'Em andamento' THEN 0
      WHEN 'Pausada' THEN 0
      WHEN 'Programada' THEN 1
      ELSE 2
    END, criado_em DESC
    LIMIT 1
  `;

  function buscarRotaAtual(motoristaId) {
    const rota = motoristaId
      ? banco
          .prepare(`
            SELECT id, nome, data, horario, motorista_id, status
            FROM rotas
            WHERE motorista_id = ?
            ${ORDEM_ROTA_ATUAL}
          `)
          .get(motoristaId)
      : banco
          .prepare(`
            SELECT id, nome, data, horario, motorista_id, status
            FROM rotas
            ${ORDEM_ROTA_ATUAL}
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
        INSERT INTO comprovantes (rota_id, parada_id, recebedor, assinatura, foto, registrado_em)
        VALUES (?, ?, ?, ?, ?, ?)
        ON CONFLICT(rota_id, parada_id) DO UPDATE SET
          recebedor = excluded.recebedor,
          assinatura = excluded.assinatura,
          foto = excluded.foto,
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
            parada.comprovante.foto ?? null,
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

  // Cada conta e a rota de exemplo são criadas só se ainda não existirem, inclusive em bancos migrados.
  function garantirDadosDemo() {
    const bcrypt = require('bcryptjs');
    let hashDemo;
    const senhaDemo = () => (hashDemo ??= bcrypt.hashSync(SENHA_DEMO, 10));

    if (!buscarCredenciais(GESTOR_DEMO.email)) {
      inserirUsuario({...GESTOR_DEMO, senha: senhaDemo()});
    }
    if (!buscarCredenciais(MOTORISTA_DEMO.email)) {
      salvarMotorista({...MOTORISTA_DEMO, senha: senhaDemo()});
    }
    if (!buscarRotaAtual()) {
      salvarRota(ROTA_INICIAL);
    }
  }

  if (seedDemo) {
    garantirDadosDemo();
  }

  return {
    buscarCredenciais,
    buscarRota: buscarRotaAtualPorId,
    buscarRotaAtual,
    buscarUsuario,
    listarMotoristas,
    salvarMotorista,
    salvarRota,
    fechar: () => banco.close(),
  };
}

module.exports = {criarRepositorio};
