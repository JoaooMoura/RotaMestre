// Regras de formato dos campos de texto. Espelham src/validacao.ts do app; o backend é quem decide.
// Cada função devolve a mensagem de erro (em português) ou null quando o valor é válido.

const {Buffer} = require('node:buffer');

const CATEGORIAS_CNH = new Set(['A', 'B', 'C', 'D', 'E', 'AB', 'AC', 'AD', 'AE']);

// Valores antigos gravados antes das regras de formato continuam válidos, mas só exatamente assim.
const JANELAS_ESPECIAIS = new Set(['Parada imprevista', 'Sem janela definida']);

const LIMITES = {
  nomeRota: {min: 3, max: 60},
  destinatario: {min: 2, max: 80},
  endereco: {min: 5, max: 200},
  recebedor: {min: 2, max: 80},
  observacao: {max: 300},
  nomePessoa: {max: 80},
  modelo: {min: 2, max: 60},
};

const SENHA_MIN = 8;
// O bcrypt só considera os primeiros 72 bytes; acima disso senhas diferentes seriam equivalentes.
const SENHA_MAX_BYTES = 72;

function textoSemEspacos(valor) {
  return typeof valor === 'string' ? valor.trim() : '';
}

function validarTamanho(valor, {min = 1, max}, rotulo) {
  const texto = textoSemEspacos(valor);
  if (texto.length < min) {
    return min <= 1 ? `Informe ${rotulo}.` : `${capitalizar(rotulo)} deve ter pelo menos ${min} caracteres.`;
  }
  if (texto.length > max) {
    return `${capitalizar(rotulo)} deve ter no máximo ${max} caracteres.`;
  }
  return null;
}

function capitalizar(texto) {
  return texto.charAt(0).toUpperCase() + texto.slice(1);
}

function emailValido(valor) {
  const email = textoSemEspacos(valor);
  return email.length <= 254 && /^[^\s@]+@[^\s@.]+(\.[^\s@.]+)+$/.test(email);
}

function validarEmail(valor) {
  return emailValido(valor) ? null : 'Informe um e-mail válido, como nome@exemplo.com.';
}

function validarSenhaDeCadastro(valor) {
  if (typeof valor !== 'string' || valor.length < SENHA_MIN) {
    return `A senha deve ter pelo menos ${SENHA_MIN} caracteres.`;
  }
  if (Buffer.byteLength(valor, 'utf8') > SENHA_MAX_BYTES) {
    return `A senha deve ter no máximo ${SENHA_MAX_BYTES} caracteres.`;
  }
  return null;
}

function validarNomeCompleto(valor) {
  const nome = textoSemEspacos(valor);
  if (nome.split(/\s+/).filter(Boolean).length < 2) {
    return 'Informe o nome completo (nome e sobrenome).';
  }
  if (nome.length > LIMITES.nomePessoa.max) {
    return `O nome deve ter no máximo ${LIMITES.nomePessoa.max} caracteres.`;
  }
  return null;
}

function validarHorario(valor) {
  const partes = typeof valor === 'string' && valor.match(/^(\d{2}):(\d{2})$/);
  if (!partes || Number(partes[1]) > 23 || Number(partes[2]) > 59) {
    return 'Informe um horário válido no formato HH:MM (00:00 a 23:59).';
  }
  return null;
}

function minutosDoDia(horario) {
  const [hora, minuto] = horario.split(':').map(Number);
  return hora * 60 + minuto;
}

/** Janela de atendimento nova: "HH:MM - HH:MM" com início menor que o fim. Vazia é permitida (vira "Sem janela definida"). */
function validarJanela(valor, {aceitarEspeciais = true} = {}) {
  if (typeof valor !== 'string') {
    return 'Informe a janela de atendimento no formato HH:MM - HH:MM.';
  }
  if (aceitarEspeciais && JANELAS_ESPECIAIS.has(valor)) {
    return null;
  }
  const texto = valor.trim();
  if (texto === '') {
    return null;
  }
  const partes = texto.match(/^(\d{2}:\d{2}) - (\d{2}:\d{2})$/);
  if (!partes || validarHorario(partes[1]) || validarHorario(partes[2])) {
    return 'Informe a janela de atendimento no formato HH:MM - HH:MM, com horários válidos.';
  }
  if (minutosDoDia(partes[1]) >= minutosDoDia(partes[2])) {
    return 'Na janela de atendimento, o horário inicial deve ser anterior ao final.';
  }
  return null;
}

/** Converte DD/MM/AAAA numa data real; devolve {ano, mes, dia} ou null (rejeita 31/02). */
function lerData(valor) {
  const partes = typeof valor === 'string' && valor.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  if (!partes) {
    return null;
  }
  const [, dia, mes, ano] = partes.map(Number);
  const data = new Date(Date.UTC(ano, mes - 1, dia));
  const existe = data.getUTCFullYear() === ano && data.getUTCMonth() === mes - 1 && data.getUTCDate() === dia;
  return existe ? {ano, mes, dia} : null;
}

function chaveDaData({ano, mes, dia}) {
  return ano * 10000 + mes * 100 + dia;
}

function chaveDeHoje(agora = new Date()) {
  return agora.getFullYear() * 10000 + (agora.getMonth() + 1) * 100 + agora.getDate();
}

/** Data de rota: a palavra "Hoje" (rota de demonstração) ou uma data real. Na criação, não pode ser anterior a hoje. */
function validarDataDaRota(valor, {criacao = false, agora = new Date()} = {}) {
  if (valor === 'Hoje') {
    return null;
  }
  const data = lerData(valor);
  if (!data) {
    return 'Informe uma data válida no formato DD/MM/AAAA.';
  }
  if (criacao && chaveDaData(data) < chaveDeHoje(agora)) {
    return 'A data da rota não pode ser anterior a hoje.';
  }
  return null;
}

/** Validade da CNH: data real e não vencida (vale até o fim do dia indicado). */
function validarValidadeCnh(valor, agora = new Date()) {
  const data = lerData(valor);
  if (!data) {
    return 'Data de validade da CNH inválida.';
  }
  if (chaveDaData(data) < chaveDeHoje(agora)) {
    return 'A CNH está vencida.';
  }
  return null;
}

function validarCategoriaCnh(valor) {
  const categoria = typeof valor === 'string' ? valor.trim().toUpperCase() : '';
  return CATEGORIAS_CNH.has(categoria) ? null : 'Categoria da CNH inválida. Use A, B, C, D, E, AB, AC, AD ou AE.';
}

const PADRAO_PLACA = /^[A-Z]{3}-?(\d{4}|\d[A-Z]\d{2})$/i;

function placaValida(valor) {
  return typeof valor === 'string' && PADRAO_PLACA.test(valor.trim());
}

function anoDoVeiculoValido(valor, agora = new Date()) {
  const ano = typeof valor === 'string' ? valor.trim() : String(valor);
  return /^\d{4}$/.test(ano) && Number(ano) >= 1980 && Number(ano) <= agora.getFullYear() + 1;
}

/** O app grava o veículo como "Modelo • PLACA". */
function validarVeiculo(valor) {
  const texto = textoSemEspacos(valor);
  const separador = texto.lastIndexOf('•');
  if (separador < 0) {
    return 'Informe o veículo como "Marca e modelo • Placa".';
  }
  const modelo = texto.slice(0, separador).trim();
  const placa = texto.slice(separador + 1).trim();
  if (modelo.length < LIMITES.modelo.min) {
    return `Marca e modelo devem ter pelo menos ${LIMITES.modelo.min} caracteres.`;
  }
  if (modelo.length > LIMITES.modelo.max) {
    return `Marca e modelo devem ter no máximo ${LIMITES.modelo.max} caracteres.`;
  }
  if (!placaValida(placa)) {
    return 'Placa inválida. Use o formato ABC-1234 ou ABC-1A23.';
  }
  return null;
}

module.exports = {
  CATEGORIAS_CNH,
  JANELAS_ESPECIAIS,
  LIMITES,
  anoDoVeiculoValido,
  emailValido,
  lerData,
  placaValida,
  textoSemEspacos,
  validarCategoriaCnh,
  validarDataDaRota,
  validarEmail,
  validarHorario,
  validarJanela,
  validarNomeCompleto,
  validarSenhaDeCadastro,
  validarTamanho,
  validarValidadeCnh,
  validarVeiculo,
};
