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
      latitude: -23.179,
      longitude: -45.886,
    },
    {
      id: '2',
      tipo: 'Coleta',
      destinatario: 'Distribuidora Vale',
      endereco: 'Avenida Itália, 410 - Taubaté',
      janela: '10:00 - 11:00',
      observacao: 'Solicitar nota fiscal',
      status: 'Pendente',
      latitude: -23.0265,
      longitude: -45.5558,
    },
    {
      id: '3',
      tipo: 'Entrega',
      destinatario: 'Farmácia São Lucas',
      endereco: 'Rua das Flores, 25 - Caçapava',
      janela: '11:30 - 12:30',
      observacao: 'Carga frágil',
      status: 'Pendente',
      latitude: -23.1005,
      longitude: -45.7068,
    },
  ],
};

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

const SQLITE_CONSTRAINT_UNIQUE = 2067;
const SQLITE_CONSTRAINT_PRIMARYKEY = 1555;

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

    -- Última posição conhecida de cada motorista com rota em andamento (US03.04). UMA linha por motorista,
    -- sempre sobrescrita: não há histórico no servidor. Só guarda o necessário para o gestor ver no mapa:
    -- coordenadas, precisão, hora da leitura, hora do recebimento e a rota. Velocidade, rumo e trajeto NÃO são guardados.
    CREATE TABLE IF NOT EXISTS posicoes_motoristas (
      motorista_id TEXT PRIMARY KEY,
      rota_id TEXT NOT NULL,
      latitude REAL NOT NULL,
      longitude REAL NOT NULL,
      precisao_m REAL,
      registrada_em INTEGER NOT NULL,
      recebida_em INTEGER NOT NULL,
      FOREIGN KEY (motorista_id) REFERENCES motoristas(id) ON DELETE CASCADE
    );

    -- Comprovantes coletados sem rede e enviados depois (US06.04). Cada envio tem um id gerado no
    -- aparelho: repetir o mesmo id devolve o mesmo resultado, sem criar outro comprovante.
    CREATE TABLE IF NOT EXISTS envios_comprovante (
      id_envio TEXT PRIMARY KEY,
      rota_id TEXT NOT NULL,
      parada_id TEXT NOT NULL,
      usuario_id TEXT NOT NULL,
      resultado TEXT NOT NULL CHECK (resultado IN ('aceito', 'rejeitado')),
      motivo TEXT,
      recebido_em INTEGER NOT NULL
    );

    -- Envios que a regra da entrega não aceitou (rota reatribuída, parada já concluída...): o conteúdo
    -- fica guardado, nunca é apagado nem aplicado à rota.
    CREATE TABLE IF NOT EXISTS comprovantes_rejeitados (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      id_envio TEXT NOT NULL,
      rota_id TEXT NOT NULL,
      parada_id TEXT NOT NULL,
      usuario_id TEXT NOT NULL,
      coletado_por TEXT,
      motivo TEXT NOT NULL,
      recebedor TEXT NOT NULL,
      assinatura TEXT NOT NULL,
      foto TEXT,
      coletado_em INTEGER,
      recebido_em INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS trajetos (
      rota_id TEXT PRIMARY KEY,
      hash TEXT NOT NULL,
      geometria TEXT NOT NULL,
      distancia_m INTEGER NOT NULL,
      duracao_s INTEGER NOT NULL,
      calculado_em INTEGER NOT NULL,
      FOREIGN KEY (rota_id) REFERENCES rotas(id) ON DELETE CASCADE
    );
  `);

  function adicionarColunaSeFaltar(tabela, coluna, tipo = 'TEXT') {
    if (!tabelaTemColuna(tabela, coluna)) {
      banco.exec(`ALTER TABLE ${tabela} ADD COLUMN ${coluna} ${tipo}`);
    }
  }

  adicionarColunaSeFaltar('comprovantes', 'foto');
  adicionarColunaSeFaltar('paradas', 'latitude', 'REAL');
  adicionarColunaSeFaltar('paradas', 'longitude', 'REAL');
  adicionarColunaSeFaltar('trajetos', 'manobras');
  ['telefone', 'cnh_numero', 'cnh_categoria', 'cnh_validade'].forEach(coluna =>
    adicionarColunaSeFaltar('motoristas', coluna),
  );

  // `comprovantes_rejeitados` nasceu com o id do envio como chave e sem `coletado_por`. Bancos que já têm
  // essa versão são reconstruídos (as linhas são preservadas): a chave nova permite guardar mais de uma
  // tentativa rejeitada do mesmo envio sem conflito.
  if (!tabelaTemColuna('comprovantes_rejeitados', 'coletado_por')) {
    banco.exec('BEGIN IMMEDIATE');
    try {
      banco.exec(`
        ALTER TABLE comprovantes_rejeitados RENAME TO comprovantes_rejeitados_antiga;
        CREATE TABLE comprovantes_rejeitados (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          id_envio TEXT NOT NULL,
          rota_id TEXT NOT NULL,
          parada_id TEXT NOT NULL,
          usuario_id TEXT NOT NULL,
          coletado_por TEXT,
          motivo TEXT NOT NULL,
          recebedor TEXT NOT NULL,
          assinatura TEXT NOT NULL,
          foto TEXT,
          coletado_em INTEGER,
          recebido_em INTEGER NOT NULL
        );
        INSERT INTO comprovantes_rejeitados
          (id_envio, rota_id, parada_id, usuario_id, coletado_por, motivo, recebedor, assinatura, foto, coletado_em, recebido_em)
          SELECT id_envio, rota_id, parada_id, usuario_id, usuario_id, motivo, recebedor, assinatura, foto, coletado_em, recebido_em
          FROM comprovantes_rejeitados_antiga;
        DROP TABLE comprovantes_rejeitados_antiga;
      `);
      banco.exec('COMMIT');
    } catch (erro) {
      banco.exec('ROLLBACK');
      throw erro;
    }
  }

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
               p.latitude, p.longitude, c.recebedor, c.registrado_em
        FROM paradas p
        LEFT JOIN comprovantes c ON c.rota_id = p.rota_id AND c.parada_id = p.id
        WHERE p.rota_id = ?
        ORDER BY p.ordem
      `)
      .all(rotaId)
      .map(({recebedor, registrado_em, latitude, longitude, ...parada}) => ({
        ...parada,
        ...(latitude !== null && longitude !== null ? {latitude, longitude} : {}),
        ...(recebedor ? {comprovante: {recebedor, registradoEm: registrado_em}} : {}),
      }));
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
      // Chave primária repetida tem código próprio no SQLite (1555), diferente do UNIQUE comum (2067).
      if ((erro.errcode === SQLITE_CONSTRAINT_UNIQUE || erro.errcode === SQLITE_CONSTRAINT_PRIMARYKEY) && erro.message.includes('usuarios.id')) {
        const duplicado = new Error('Este identificador já está em uso.');
        duplicado.codigo = 'ID_DUPLICADO';
        throw duplicado;
      }
      throw erro;
    }
  }

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
          id, rota_id, ordem, tipo, destinatario, endereco, janela, observacao, status,
          latitude, longitude
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
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
          parada.latitude ?? null,
          parada.longitude ?? null,
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

    const completarCoordenadas = banco.prepare(`
      UPDATE paradas SET latitude = ?, longitude = ?
      WHERE rota_id = ? AND id = ? AND latitude IS NULL AND longitude IS NULL
    `);
    ROTA_INICIAL.paradas.forEach(parada =>
      completarCoordenadas.run(parada.latitude, parada.longitude, ROTA_INICIAL.id, parada.id),
    );
  }

  function buscarTrajeto(rotaId) {
    const trajeto = banco
      .prepare(`
        SELECT hash, geometria, distancia_m, duracao_s, calculado_em, manobras
        FROM trajetos
        WHERE rota_id = ?
      `)
      .get(rotaId);

    return trajeto
      ? {
          hash: trajeto.hash,
          geometria: JSON.parse(trajeto.geometria),
          distanciaM: trajeto.distancia_m,
          duracaoS: trajeto.duracao_s,
          calculadoEm: trajeto.calculado_em,
          manobras: trajeto.manobras ? JSON.parse(trajeto.manobras) : null,
        }
      : null;
  }

  function salvarTrajeto(rotaId, trajeto) {
    banco
      .prepare(`
        INSERT INTO trajetos (rota_id, hash, geometria, distancia_m, duracao_s, calculado_em, manobras)
        VALUES (?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT(rota_id) DO UPDATE SET
          hash = excluded.hash,
          geometria = excluded.geometria,
          distancia_m = excluded.distancia_m,
          duracao_s = excluded.duracao_s,
          calculado_em = excluded.calculado_em,
          manobras = excluded.manobras
      `)
      .run(
        rotaId,
        trajeto.hash,
        JSON.stringify(trajeto.geometria),
        trajeto.distanciaM,
        trajeto.duracaoS,
        trajeto.calculadoEm,
        JSON.stringify(trajeto.manobras ?? []),
      );
  }

  if (seedDemo) {
    garantirDadosDemo();
  }

  const MOTIVOS_DE_REJEICAO = {
    ROTA_INEXISTENTE: 'A rota deste envio não existe mais.',
    REATRIBUIDA:
      'Esta rota não pertence a esta conta (foi reatribuída a outro motorista). A assinatura ficou guardada no servidor, sem ser aplicada.',
    COLETADO_POR_OUTRO_USUARIO:
      'Esta assinatura foi coletada em outra conta. Entre com a conta que a coletou para enviá-la; ela ficou guardada no servidor, sem ser aplicada.',
    PARADA_INEXISTENTE: 'A parada deste envio não existe mais na rota.',
    JA_CONCLUIDA: 'A parada já foi concluída por outro registro. A assinatura ficou guardada no servidor, sem ser aplicada.',
  };

  function dadosDoComprovante(rotaId, paradaId) {
    const comprovante = banco
      .prepare('SELECT recebedor, registrado_em FROM comprovantes WHERE rota_id = ? AND parada_id = ?')
      .get(rotaId, paradaId);
    const rota = banco.prepare('SELECT status FROM rotas WHERE id = ?').get(rotaId);
    return {
      comprovante: comprovante ? {recebedor: comprovante.recebedor, registradoEm: comprovante.registrado_em} : null,
      statusDaRota: rota?.status ?? null,
    };
  }

  /**
   * Registra um comprovante coletado sem rede. Devolve `aceito`, `duplicado` (mesmo envio repetido,
   * com o resultado que já tinha) ou `rejeitado` (conteúdo guardado à parte, motivo no resultado).
   */
  function registrarComprovanteEnviado(envio) {
    const {idEnvio, rotaId, paradaId, usuarioId, coletadoPor, recebedor, assinatura, foto, coletadoEm} = envio;
    banco.exec('BEGIN IMMEDIATE');
    try {
      // Só quem coletou a assinatura pode enviá-la. Outra conta logada no mesmo aparelho recebe a rejeição,
      // o conteúdo fica guardado à parte e NÃO se cria registro de envio: o dono ainda pode enviar depois.
      if (coletadoPor !== usuarioId) {
        const agora = Date.now();
        const repetido = banco
          .prepare('SELECT 1 AS ja FROM comprovantes_rejeitados WHERE id_envio = ? AND usuario_id = ? AND motivo = ?')
          .get(idEnvio, usuarioId, 'COLETADO_POR_OUTRO_USUARIO');
        if (!repetido) {
          banco
            .prepare(`INSERT INTO comprovantes_rejeitados
              (id_envio, rota_id, parada_id, usuario_id, coletado_por, motivo, recebedor, assinatura, foto, coletado_em, recebido_em)
              VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`)
            .run(idEnvio, rotaId, paradaId, usuarioId, coletadoPor, 'COLETADO_POR_OUTRO_USUARIO', recebedor, assinatura, foto ?? null, coletadoEm ?? null, agora);
        }
        banco.exec('COMMIT');
        return {resultado: 'rejeitado', motivo: 'COLETADO_POR_OUTRO_USUARIO', mensagem: MOTIVOS_DE_REJEICAO.COLETADO_POR_OUTRO_USUARIO};
      }

      const anterior = banco.prepare('SELECT * FROM envios_comprovante WHERE id_envio = ?').get(idEnvio);
      if (anterior) {
        banco.exec('COMMIT');
        if (anterior.usuario_id !== usuarioId) {
          // Mesmo id vindo de outro usuário: nunca devolve o resultado alheio.
          return {resultado: 'rejeitado', motivo: 'ENVIO_DE_OUTRO_USUARIO', mensagem: 'Identificador de envio já usado.'};
        }
        if (anterior.rota_id !== rotaId || anterior.parada_id !== paradaId) {
          return {resultado: 'rejeitado', motivo: 'ENVIO_CONFLITANTE', mensagem: 'Este identificador de envio já foi usado para outra parada.'};
        }
        return anterior.resultado === 'aceito'
          ? {resultado: 'duplicado', recebidoEm: anterior.recebido_em, ...dadosDoComprovante(rotaId, paradaId)}
          : {resultado: 'rejeitado', motivo: anterior.motivo, mensagem: MOTIVOS_DE_REJEICAO[anterior.motivo]};
      }

      const agora = Date.now();
      const rota = banco.prepare('SELECT id, motorista_id, status FROM rotas WHERE id = ?').get(rotaId);
      const parada = rota ? banco.prepare('SELECT status FROM paradas WHERE rota_id = ? AND id = ?').get(rotaId, paradaId) : null;
      const jaTem =
        rota && parada
          ? banco.prepare('SELECT 1 AS tem FROM comprovantes WHERE rota_id = ? AND parada_id = ?').get(rotaId, paradaId)
          : null;

      let motivo = null;
      if (!rota) {
        motivo = 'ROTA_INEXISTENTE';
      } else if (rota.motorista_id !== usuarioId) {
        motivo = 'REATRIBUIDA';
      } else if (!parada) {
        motivo = 'PARADA_INEXISTENTE';
      } else if (parada.status === 'Concluída' || jaTem) {
        motivo = 'JA_CONCLUIDA';
      }

      if (motivo) {
        banco
          .prepare(`INSERT INTO comprovantes_rejeitados
            (id_envio, rota_id, parada_id, usuario_id, coletado_por, motivo, recebedor, assinatura, foto, coletado_em, recebido_em)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`)
          .run(idEnvio, rotaId, paradaId, usuarioId, coletadoPor, motivo, recebedor, assinatura, foto ?? null, coletadoEm ?? null, agora);
        banco
          .prepare('INSERT INTO envios_comprovante (id_envio, rota_id, parada_id, usuario_id, resultado, motivo, recebido_em) VALUES (?, ?, ?, ?, ?, ?, ?)')
          .run(idEnvio, rotaId, paradaId, usuarioId, 'rejeitado', motivo, agora);
        banco.exec('COMMIT');
        return {resultado: 'rejeitado', motivo, mensagem: MOTIVOS_DE_REJEICAO[motivo]};
      }

      // A hora da coleta vale (é quando a assinatura foi feita), desde que não seja do futuro.
      const registradoEm = Number.isFinite(coletadoEm) && coletadoEm > 0 && coletadoEm <= agora + 60000 ? coletadoEm : agora;
      banco.prepare("UPDATE paradas SET status = 'Concluída' WHERE rota_id = ? AND id = ?").run(rotaId, paradaId);
      banco
        .prepare('INSERT INTO comprovantes (rota_id, parada_id, recebedor, assinatura, foto, registrado_em) VALUES (?, ?, ?, ?, ?, ?)')
        .run(rotaId, paradaId, recebedor, assinatura, foto ?? null, registradoEm);
      const restantes = banco
        .prepare("SELECT COUNT(*) AS n FROM paradas WHERE rota_id = ? AND status NOT IN ('Concluída', 'Não realizada')")
        .get(rotaId).n;
      if (restantes === 0) {
        banco.prepare("UPDATE rotas SET status = 'Concluída' WHERE id = ?").run(rotaId);
      }
      banco
        .prepare('INSERT INTO envios_comprovante (id_envio, rota_id, parada_id, usuario_id, resultado, motivo, recebido_em) VALUES (?, ?, ?, ?, ?, NULL, ?)')
        .run(idEnvio, rotaId, paradaId, usuarioId, 'aceito', agora);
      banco.exec('COMMIT');
      return {resultado: 'aceito', recebidoEm: agora, ...dadosDoComprovante(rotaId, paradaId)};
    } catch (erro) {
      banco.exec('ROLLBACK');
      throw erro;
    }
  }

  function registrarPosicao(motoristaId, posicao, retencaoMs) {
    // Quem parou de atualizar (ex.: saiu da conta) não fica guardado para sempre, nem sem o gestor consultar.
    if (retencaoMs !== undefined) {
      banco.prepare('DELETE FROM posicoes_motoristas WHERE recebida_em < ?').run(posicao.recebidaEm - retencaoMs);
    }
    banco
      .prepare(`
        INSERT INTO posicoes_motoristas (motorista_id, rota_id, latitude, longitude, precisao_m, registrada_em, recebida_em)
        VALUES (?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT(motorista_id) DO UPDATE SET
          rota_id = excluded.rota_id,
          latitude = excluded.latitude,
          longitude = excluded.longitude,
          precisao_m = excluded.precisao_m,
          registrada_em = excluded.registrada_em,
          recebida_em = excluded.recebida_em
      `)
      .run(
        motoristaId,
        posicao.rotaId,
        posicao.latitude,
        posicao.longitude,
        posicao.precisaoM ?? null,
        posicao.registradaEm,
        posicao.recebidaEm,
      );
  }

  function removerPosicao(motoristaId) {
    banco.prepare('DELETE FROM posicoes_motoristas WHERE motorista_id = ?').run(motoristaId);
  }

  /**
   * Frota para o gestor: cada motorista com rota em andamento ou pausada, o andamento das paradas e a última
   * posição (só de rota em andamento e da rota atual). Posições mais velhas que `retencaoMs` são apagadas.
   */
  function listarFrota(agora, retencaoMs) {
    banco.prepare('DELETE FROM posicoes_motoristas WHERE recebida_em < ?').run(agora - retencaoMs);
    const frota = [];
    for (const motorista of listarMotoristas()) {
      const rota = buscarRotaAtual(motorista.id);
      if (!rota || (rota.status !== 'Em andamento' && rota.status !== 'Pausada')) {
        continue;
      }
      const encerradas = rota.paradas.filter(p => p.status === 'Concluída' || p.status === 'Não realizada').length;
      const proxima = rota.paradas.find(p => p.status === 'Pendente' || p.status === 'Em andamento');
      const linha =
        rota.status === 'Em andamento'
          ? banco
              .prepare(
                'SELECT rota_id, latitude, longitude, precisao_m, registrada_em, recebida_em FROM posicoes_motoristas WHERE motorista_id = ?',
              )
              .get(motorista.id)
          : undefined;
      frota.push({
        motoristaId: motorista.id,
        nome: motorista.nome,
        veiculo: motorista.veiculo,
        rota: {id: rota.id, nome: rota.nome, status: rota.status},
        paradas: {
          total: rota.paradas.length,
          encerradas,
          proxima: proxima ? {id: proxima.id, destinatario: proxima.destinatario, tipo: proxima.tipo} : null,
        },
        posicao:
          linha && linha.rota_id === rota.id
            ? {
                latitude: linha.latitude,
                longitude: linha.longitude,
                precisaoM: linha.precisao_m,
                registradaEm: linha.registrada_em,
                idadeMs: Math.max(0, agora - linha.recebida_em),
              }
            : null,
      });
    }
    return frota;
  }

  function criarGestor(gestor) {
    inserirUsuario({...gestor, papel: 'gestor'});
  }

  return {
    buscarCredenciais,
    criarGestor,
    buscarRota: buscarRotaAtualPorId,
    buscarRotaAtual,
    buscarTrajeto,
    buscarUsuario,
    registrarComprovanteEnviado,
    registrarPosicao,
    removerPosicao,
    listarFrota,
    listarMotoristas,
    salvarMotorista,
    salvarRota,
    salvarTrajeto,
    fechar: () => banco.close(),
  };
}

module.exports = {criarRepositorio};
