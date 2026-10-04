const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

const ALGORITMO = 'HS256';

function validarSegredoJwt(segredo) {
  if (typeof segredo !== 'string' || segredo.length < 32) {
    throw new Error('JWT_SECRET precisa ter pelo menos 32 caracteres.');
  }
}

// Assina um token de teste: pega formatos que o jsonwebtoken não entende ("12 horas") e
// validades zero ou negativas, que ele aceita mas gerariam tokens já vencidos.
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

  // Comparado quando o e-mail não existe, para a resposta levar o mesmo tempo nos dois casos
  // e não revelar quais e-mails estão cadastrados.
  const hashSemUsuario = bcrypt.hashSync('usuario-inexistente', 10);

  // Devolve {token, usuario} ou null para credenciais inválidas (sem dizer qual campo errou).
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

  // Devolve {usuario} ou {erro}. O papel vem do banco, não do token, para refletir mudanças.
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

    // Só este servidor assina tokens e sempre inclui o sub; sem ele o token não identifica ninguém.
    if (typeof dados.sub !== 'string' || !dados.sub) {
      return {erro: 'Autenticação inválida.'};
    }

    const usuario = repositorio.buscarUsuario(dados.sub);
    return usuario ? {usuario} : {erro: 'Autenticação inválida.'};
  }

  return {entrar, verificar};
}

module.exports = {criarServicoAutenticacao, validarSegredoJwt, validarValidadeToken};
