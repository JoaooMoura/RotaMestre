const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

const ALGORITMO = 'HS256';

function validarSegredoJwt(segredo) {
  if (typeof segredo !== 'string' || segredo.length < 32) {
    throw new Error('JWT_SECRET precisa ter pelo menos 32 caracteres.');
  }
}

function validarValidadeToken(validade) {
  let dados;
  try {
    dados = jwt.decode(jwt.sign({}, 'validacao-da-configuracao', {expiresIn: validade}));
  } catch {
    dados = null;
  }
  if (!dados || dados.exp <= dados.iat) {
    throw new Error(`JWT_VALIDADE inválido: "${validade}". Use valores como 12h, 30m ou 1d.`);
  }
}

function criarServicoAutenticacao({repositorio, segredo, validade = '12h'}) {
  validarSegredoJwt(segredo);
  validarValidadeToken(validade);

  const hashSemUsuario = bcrypt.hashSync('usuario-inexistente', 10);

  async function entrar(email, senha) {
    const credenciais = repositorio.buscarCredenciais(email.trim().toLowerCase());
    const confere = await bcrypt.compare(senha, credenciais?.senha || hashSemUsuario);

    if (!credenciais?.senha || !confere) {
      return null;
    }

    const {senha: _hash, ...usuario} = credenciais;
    const token = jwt.sign({papel: usuario.papel}, segredo, {
      algorithm: ALGORITMO,
      subject: usuario.id,
      expiresIn: validade,
    });
    return {token, usuario};
  }

  function verificar(cabecalhoAuthorization) {
    const [tipo, token] = (cabecalhoAuthorization ?? '').split(' ');
    if (tipo !== 'Bearer' || !token) {
      return {erro: 'Autenticação necessária.'};
    }

    let dados;
    try {
      dados = jwt.verify(token, segredo, {algorithms: [ALGORITMO]});
    } catch (falha) {
      return {
        erro:
          falha instanceof jwt.TokenExpiredError
            ? 'Sessão expirada. Entre novamente.'
            : 'Autenticação inválida.',
      };
    }

    if (typeof dados.sub !== 'string' || !dados.sub) {
      return {erro: 'Autenticação inválida.'};
    }

    const usuario = repositorio.buscarUsuario(dados.sub);
    return usuario ? {usuario} : {erro: 'Autenticação inválida.'};
  }

  return {entrar, verificar};
}

module.exports = {criarServicoAutenticacao, validarSegredoJwt, validarValidadeToken};
