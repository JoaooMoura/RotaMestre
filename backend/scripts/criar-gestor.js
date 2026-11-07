const bcrypt = require('bcryptjs');
const crypto = require('node:crypto');
const path = require('node:path');
const readline = require('node:readline');
const {criarRepositorio} = require('../src/database');

const TAMANHO_MINIMO_SENHA = 10;

function lerSenhaOculta(pergunta) {
  return new Promise(resolve => {
    const entrada = readline.createInterface({input: process.stdin, output: process.stdout, terminal: true});
    entrada._writeToOutput = trecho => {
      if (trecho.includes(pergunta)) {
        entrada.output.write(trecho);
      }
    };
    entrada.question(pergunta, resposta => {
      entrada.close();
      process.stdout.write('\n');
      resolve(resposta);
    });
  });
}

async function criarGestor({nome, email, senha, caminhoBanco}) {
  const emailNormalizado = String(email || '').trim().toLowerCase();
  if (!String(nome || '').trim() || !emailNormalizado.includes('@')) {
    throw new Error('Informe um nome e um e-mail válidos.');
  }
  if (!senha || senha.length < TAMANHO_MINIMO_SENHA) {
    throw new Error(`A senha precisa ter pelo menos ${TAMANHO_MINIMO_SENHA} caracteres.`);
  }

  const repositorio = criarRepositorio(caminhoBanco);
  try {
    repositorio.criarGestor({
      id: `G-${crypto.randomUUID()}`,
      nome: nome.trim(),
      email: emailNormalizado,
      senha: await bcrypt.hash(senha, 10),
    });
  } finally {
    repositorio.fechar();
  }
  return emailNormalizado;
}

async function principal() {
  const [nome, email] = process.argv.slice(2);
  if (!nome || !email) {
    process.stderr.write('Uso: node scripts/criar-gestor.js "Nome Completo" email@exemplo.com\n');
    process.exit(1);
  }

  const caminhoBanco =
    process.env.ROTAMESTRE_DB_PATH || path.join(__dirname, '..', 'data', 'rotamestre.sqlite');
  const senha = process.env.GESTOR_SENHA || (await lerSenhaOculta('Senha do gestor: '));

  try {
    const criado = await criarGestor({nome, email, senha, caminhoBanco});
    process.stdout.write(`Gestor ${criado} criado.\n`);
  } catch (falha) {
    process.stderr.write(`Não foi possível criar o gestor: ${falha.message}\n`);
    process.exit(1);
  }
}

if (require.main === module) {
  principal();
}

module.exports = {criarGestor};
