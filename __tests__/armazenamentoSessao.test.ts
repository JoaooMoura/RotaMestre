import EncryptedStorage from 'react-native-encrypted-storage';
import {armazenamentoSessaoSeguro} from '../src/servicos/armazenamentoSessao';
import {Sessao} from '../src/tipos';

const CHAVE = 'rotamestre.sessao.v1';

const SESSAO: Sessao = {
  token: 'token-motorista',
  usuario: {id: '1', nome: 'Carlos', email: 'motorista@rotamestre.com', papel: 'motorista'},
  expiraEm: 1893456000000,
};

beforeEach(async () => {
  await armazenamentoSessaoSeguro.limpar();
});

test('o que foi salvo volta igual na leitura', async () => {
  await armazenamentoSessaoSeguro.salvar(SESSAO);

  await expect(armazenamentoSessaoSeguro.ler()).resolves.toEqual(SESSAO);
});

test('sem nada salvo, ler devolve null', async () => {
  await expect(armazenamentoSessaoSeguro.ler()).resolves.toBeNull();
});

test('limpar remove a sessão', async () => {
  await armazenamentoSessaoSeguro.salvar(SESSAO);
  await armazenamentoSessaoSeguro.limpar();

  await expect(armazenamentoSessaoSeguro.ler()).resolves.toBeNull();
});

test('conteúdo que não é JSON ou não tem o formato esperado vira null', async () => {
  const invalidos = ['{quebrado', '"texto"', '{"token":"x"}', JSON.stringify({...SESSAO, expiraEm: '2030'})];

  for (const bruto of invalidos) {
    await EncryptedStorage.setItem(CHAVE, bruto);

    await expect(armazenamentoSessaoSeguro.ler()).resolves.toBeNull();
  }
});

test('papel desconhecido é recusado', async () => {
  const papelInvalido = {...SESSAO, usuario: {...SESSAO.usuario, papel: 'admin'}};
  await EncryptedStorage.setItem(CHAVE, JSON.stringify(papelInvalido));

  await expect(armazenamentoSessaoSeguro.ler()).resolves.toBeNull();
});
