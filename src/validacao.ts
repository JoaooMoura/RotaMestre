// Validação e máscara dos campos de texto. As mesmas regras valem no backend (backend/src/validacao.js),
// que é quem decide; aqui elas servem para avisar cedo e desabilitar os botões. Cada validador devolve a
// mensagem de erro em português, ou null quando o valor é válido.

export const CATEGORIAS_CNH = ['A', 'B', 'C', 'D', 'E', 'AB', 'AC', 'AD', 'AE'];

export const LIMITES = {
  nomeRota: {min: 3, max: 60},
  destinatario: {min: 2, max: 80},
  endereco: {min: 5, max: 200},
  recebedor: {min: 2, max: 80},
  motivo: {min: 5, max: 200},
  observacao: {max: 300},
  nomePessoa: {max: 80},
  modelo: {min: 2, max: 60},
};

const SENHA_MIN = 8;

type Limite = {min?: number; max: number};

export function validarTexto(valor: string, limite: Limite, rotulo: string): string | null {
  const texto = valor.trim();
  const min = limite.min ?? 1;
  if (texto.length < min) {
    return min <= 1 ? `Informe ${rotulo}.` : `${rotulo.charAt(0).toUpperCase()}${rotulo.slice(1)} deve ter pelo menos ${min} caracteres.`;
  }
  if (texto.length > limite.max) {
    return `${rotulo.charAt(0).toUpperCase()}${rotulo.slice(1)} deve ter no máximo ${limite.max} caracteres.`;
  }
  return null;
}

/** Campo opcional: vazio vale; só o tamanho máximo é conferido. */
export function validarObservacao(valor: string): string | null {
  return valor.trim().length > LIMITES.observacao.max
    ? `A observação deve ter no máximo ${LIMITES.observacao.max} caracteres.`
    : null;
}

export const validarNomeDaRota = (v: string) => validarTexto(v, LIMITES.nomeRota, 'o nome da rota');
export const validarDestinatario = (v: string) => validarTexto(v, LIMITES.destinatario, 'o destinatário');
export const validarEndereco = (v: string) => validarTexto(v, LIMITES.endereco, 'o endereço');
export const validarRecebedor = (v: string) => validarTexto(v, LIMITES.recebedor, 'o nome do recebedor');
export const validarMotivo = (v: string) => validarTexto(v, LIMITES.motivo, 'o motivo');

export function emailValido(valor: string): boolean {
  const email = valor.trim();
  return email.length <= 254 && /^[^\s@]+@[^\s@.]+(\.[^\s@.]+)+$/.test(email);
}

export function validarEmail(valor: string): string | null {
  return emailValido(valor) ? null : 'Informe um e-mail válido, como nome@exemplo.com.';
}

/** Só no cadastro. O login nunca aplica esta regra (contas antigas e de demonstração têm senha curta). */
export function validarSenhaDeCadastro(valor: string): string | null {
  return valor.length >= SENHA_MIN ? null : `A senha deve ter pelo menos ${SENHA_MIN} caracteres.`;
}

export function validarNomeCompleto(valor: string): string | null {
  const nome = valor.trim();
  if (nome.split(/\s+/).filter(Boolean).length < 2) {
    return 'Informe o nome completo (nome e sobrenome).';
  }
  return nome.length > LIMITES.nomePessoa.max ? `O nome deve ter no máximo ${LIMITES.nomePessoa.max} caracteres.` : null;
}

export function validarTelefone(valor: string): string | null {
  const digitos = valor.replace(/\D/g, '');
  return digitos.length === 10 || digitos.length === 11 ? null : 'Informe o telefone com DDD, ex.: (12) 99876-5432.';
}

export function validarNumeroCnh(valor: string): string | null {
  return valor.replace(/\D/g, '').length === 11 ? null : 'O número da CNH deve ter 11 dígitos.';
}

export function normalizarCategoria(valor: string): string {
  return valor.replace(/[^a-zA-Z]/g, '').toUpperCase().slice(0, 2);
}

export function validarCategoriaCnh(valor: string): string | null {
  return CATEGORIAS_CNH.includes(valor.trim().toUpperCase())
    ? null
    : 'Categoria inválida. Use A, B, C, D, E, AB, AC, AD ou AE.';
}

// ---- Horário, janela e data ----

/** Máscara HH:MM: só dígitos, até quatro, com ":" depois da hora. */
export function mascararHorario(texto: string): string {
  const digitos = texto.replace(/\D/g, '').slice(0, 4);
  return digitos.length <= 2 ? digitos : `${digitos.slice(0, 2)}:${digitos.slice(2)}`;
}

export function validarHorario(valor: string): string | null {
  const partes = valor.match(/^(\d{2}):(\d{2})$/);
  if (!partes) {
    return 'Informe o horário completo no formato HH:MM.';
  }
  if (Number(partes[1]) > 23) {
    return 'A hora deve estar entre 00 e 23.';
  }
  if (Number(partes[2]) > 59) {
    return 'Os minutos devem estar entre 00 e 59.';
  }
  return null;
}

/** Máscara "HH:MM - HH:MM" (até oito dígitos). */
export function mascararJanela(texto: string): string {
  const digitos = texto.replace(/\D/g, '').slice(0, 8);
  if (digitos.length <= 4) {
    return mascararHorario(digitos);
  }
  return `${mascararHorario(digitos.slice(0, 4))} - ${mascararHorario(digitos.slice(4))}`;
}

const minutosDoDia = (horario: string) => Number(horario.slice(0, 2)) * 60 + Number(horario.slice(3, 5));

/** Vazia é permitida (a parada fica "Sem janela definida"). */
export function validarJanela(valor: string): string | null {
  if (valor.trim() === '') {
    return null;
  }
  const partes = valor.match(/^(\d{2}:\d{2}) - (\d{2}:\d{2})$/);
  if (!partes) {
    return 'Informe a janela completa no formato HH:MM - HH:MM, ou deixe em branco.';
  }
  const erro = validarHorario(partes[1]) ?? validarHorario(partes[2]);
  if (erro) {
    return erro;
  }
  return minutosDoDia(partes[1]) < minutosDoDia(partes[2])
    ? null
    : 'O horário inicial da janela deve ser anterior ao final.';
}

/** Máscara DD/MM/AAAA. */
export function mascararData(texto: string): string {
  const digitos = texto.replace(/\D/g, '').slice(0, 8);
  if (digitos.length <= 2) {
    return digitos;
  }
  if (digitos.length <= 4) {
    return `${digitos.slice(0, 2)}/${digitos.slice(2)}`;
  }
  return `${digitos.slice(0, 2)}/${digitos.slice(2, 4)}/${digitos.slice(4)}`;
}

type DataSimples = {ano: number; mes: number; dia: number};

/** Data real em DD/MM/AAAA (rejeita 31/02); null se não existir. */
export function lerData(valor: string): DataSimples | null {
  const partes = valor.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  if (!partes) {
    return null;
  }
  const [dia, mes, ano] = [Number(partes[1]), Number(partes[2]), Number(partes[3])];
  const data = new Date(Date.UTC(ano, mes - 1, dia));
  const existe = data.getUTCFullYear() === ano && data.getUTCMonth() === mes - 1 && data.getUTCDate() === dia;
  return existe ? {ano, mes, dia} : null;
}

const chaveDaData = (d: DataSimples) => d.ano * 10000 + d.mes * 100 + d.dia;
const chaveDeHoje = (agora: Date) => agora.getFullYear() * 10000 + (agora.getMonth() + 1) * 100 + agora.getDate();

/** Data da rota nova: real e não anterior a hoje. */
export function validarDataDaRota(valor: string, agora: Date = new Date()): string | null {
  const data = lerData(valor);
  if (!data) {
    return 'Informe uma data válida no formato DD/MM/AAAA.';
  }
  return chaveDaData(data) < chaveDeHoje(agora) ? 'A data da rota não pode ser anterior a hoje.' : null;
}

export function validarValidadeCnh(valor: string, agora: Date = new Date()): string | null {
  const data = lerData(valor);
  if (!data) {
    return 'Informe uma data de validade válida no formato DD/MM/AAAA.';
  }
  return chaveDaData(data) < chaveDeHoje(agora) ? 'A CNH está vencida.' : null;
}

// ---- Veículo ----

const PADRAO_PLACA = /^[A-Z]{3}-?(\d{4}|\d[A-Z]\d{2})$/i;

export function validarPlaca(valor: string): string | null {
  return PADRAO_PLACA.test(valor.trim()) ? null : 'Placa inválida. Use o formato ABC-1234 ou ABC-1A23.';
}

export function validarModelo(valor: string): string | null {
  return validarTexto(valor, LIMITES.modelo, 'marca e modelo');
}

export function validarAnoDoVeiculo(valor: string, agora: Date = new Date()): string | null {
  const maximo = agora.getFullYear() + 1;
  const ano = Number(valor);
  return /^\d{4}$/.test(valor) && ano >= 1980 && ano <= maximo
    ? null
    : `Informe o ano com 4 dígitos, entre 1980 e ${maximo}.`;
}
