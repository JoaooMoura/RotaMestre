import React from 'react';
import {Alert} from 'react-native';
import {fireEvent, render, screen} from '@testing-library/react-native';
import {TelaGestorSprint} from '../src/telas/TelaGestorSprint';
import {Motorista, Rota, Usuario} from '../src/tipos';

jest.setTimeout(20000);

const usuario: Usuario = {
  id: 'G-1',
  nome: 'Ana Gestora',
  email: 'ana@rotamestre.com',
  papel: 'gestor',
};

const motoristas: Motorista[] = [
  {id: '1', nome: 'Carlos Mendes', email: 'carlos@rotamestre.com', veiculo: 'Sprinter • ABC-1234', disponivel: true},
  {id: '2', nome: 'Bruna Lima', email: 'bruna@rotamestre.com', veiculo: 'Fiorino • XYZ-9876', disponivel: true},
];

const rota: Rota = {
  id: 'RT-001',
  nome: 'Entregas Vale',
  data: 'Hoje',
  horario: '08:00',
  motoristaId: '1',
  status: 'Programada',
  paradas: [
    {id: 'p1', tipo: 'Entrega', destinatario: 'Mercado Bom Preço', endereco: 'Rua A, 10', janela: '08:30 - 09:30', observacao: '', status: 'Concluída'},
    {id: 'p2', tipo: 'Coleta', destinatario: 'Distribuidora Vale', endereco: 'Rua B, 20', janela: '10:00 - 11:00', observacao: '', status: 'Pendente'},
  ],
};

let alerta: jest.SpyInstance;

beforeEach(() => {
  alerta = jest.spyOn(Alert, 'alert').mockImplementation(() => {});
});

afterEach(() => {
  alerta.mockRestore();
});

async function renderizar(onAtualizarRota = jest.fn().mockResolvedValue(true), onSair = jest.fn()) {
  await render(
    <TelaGestorSprint
      usuario={usuario}
      rota={rota}
      motoristas={motoristas}
      onAtualizarRota={onAtualizarRota}
      onSair={onSair}
    />,
  );
  return {onAtualizarRota, onSair};
}

function botao(nome: string) {
  return screen.getByRole('button', {name: nome});
}

async function preencher(rotulo: string, valor: string) {
  await fireEvent.changeText(screen.getByLabelText(rotulo), valor);
}

describe('TelaGestorSprint', () => {
  test('início usa o nome real do gestor e dados da rota, sem textos fixos', async () => {
    await renderizar();

    expect(screen.getByText('Olá, Ana')).toBeOnTheScreen();
    expect(screen.getByText('Entregas Vale')).toBeOnTheScreen();
    expect(screen.getByText('Carlos Mendes')).toBeOnTheScreen();
    expect(screen.getByText('1 de 2 paradas concluídas')).toBeOnTheScreen();
    expect(screen.queryByText('Rodrigo Matos')).toBeNull();
    expect(screen.queryByText('Rotas programadas')).toBeNull();
  });

  test('perfil mostra os dados do usuário logado e sai da conta', async () => {
    const {onSair} = await renderizar();

    await fireEvent.press(screen.getByRole('tab', {name: 'Perfil'}));

    expect(screen.getByText('Ana Gestora')).toBeOnTheScreen();
    expect(screen.getByText('ana@rotamestre.com')).toBeOnTheScreen();
    expect(screen.getAllByText('Gestor').length).toBeGreaterThan(0);
    expect(screen.queryByText('RotaMestre Logística')).toBeNull();

    await fireEvent.press(botao('Sair da conta'));
    expect(onSair).toHaveBeenCalledTimes(1);
  });

  test('aba Motoristas mostra a situação de cada um', async () => {
    await renderizar();

    await fireEvent.press(screen.getByRole('tab', {name: 'Motoristas'}));

    expect(screen.getByText('Rota atual')).toBeOnTheScreen();
    expect(screen.getByText('Disponível')).toBeOnTheScreen();
  });

  test('criar e atribuir rota envia as paradas e o motorista escolhido', async () => {
    const {onAtualizarRota} = await renderizar();

    await fireEvent.press(botao('Criar rota'));
    expect(botao('Organizar paradas')).toBeDisabled();

    await preencher('Nome da rota', 'Entregas Centro');
    await preencher('Destinatário', 'Padaria Sol');
    await preencher('Endereço', 'Rua C, 30');
    await fireEvent.press(botao('Adicionar parada'));
    await fireEvent.press(screen.getByRole('radio', {name: 'Coleta'}));
    await preencher('Destinatário', 'Depósito Norte');
    await preencher('Endereço', 'Rua D, 40');
    await preencher('Janela de atendimento', '14:00 - 15:00');
    await fireEvent.press(botao('Adicionar parada'));

    await fireEvent.press(botao('Organizar paradas'));
    await fireEvent.press(botao('Escolher motorista'));
    await fireEvent.press(screen.getByRole('radio', {name: 'Bruna Lima'}));
    await fireEvent.press(botao('Confirmar atribuição'));

    expect(onAtualizarRota).toHaveBeenCalledTimes(1);
    const enviada: Rota = onAtualizarRota.mock.calls[0][0];
    expect(enviada).toMatchObject({nome: 'Entregas Centro', horario: '08:00', motoristaId: '2', status: 'Programada'});
    expect(enviada.paradas).toEqual([
      expect.objectContaining({tipo: 'Entrega', destinatario: 'Padaria Sol', endereco: 'Rua C, 30', janela: 'Sem janela definida', status: 'Pendente'}),
      expect.objectContaining({tipo: 'Coleta', destinatario: 'Depósito Norte', endereco: 'Rua D, 40', janela: '14:00 - 15:00', status: 'Pendente'}),
    ]);
    expect(enviada.data).toMatch(/^\d{2}\/\d{2}\/\d{4}$/);
    expect(alerta).toHaveBeenCalledWith('Rota atribuída', expect.any(String));
  });

  test('atribuir sem escolher motorista avisa e não salva', async () => {
    const {onAtualizarRota} = await renderizar();

    await fireEvent.press(botao('Criar rota'));
    await preencher('Nome da rota', 'Entregas Centro');
    for (const destino of ['Padaria Sol', 'Depósito Norte']) {
      await preencher('Destinatário', destino);
      await preencher('Endereço', 'Rua X, 1');
      await fireEvent.press(botao('Adicionar parada'));
    }
    await fireEvent.press(botao('Organizar paradas'));
    await fireEvent.press(botao('Escolher motorista'));
    await fireEvent.press(botao('Confirmar atribuição'));

    expect(onAtualizarRota).not.toHaveBeenCalled();
    expect(alerta).toHaveBeenCalledWith('Motorista obrigatório', expect.any(String));
  });

  test('parada sem destinatário ou endereço não é adicionada', async () => {
    await renderizar();

    await fireEvent.press(botao('Criar rota'));
    await preencher('Destinatário', 'Padaria Sol');
    await fireEvent.press(botao('Adicionar parada'));

    expect(alerta).toHaveBeenCalledWith('Dados incompletos', expect.any(String));
    expect(screen.getByText('Paradas adicionadas (0)')).toBeOnTheScreen();
  });

  test('reatribuir envia a mesma rota com o novo motorista', async () => {
    const {onAtualizarRota} = await renderizar();

    await fireEvent.press(screen.getByRole('button', {name: 'Rota Entregas Vale'}));
    await fireEvent.press(botao('Reatribuir motorista'));
    await fireEvent.press(screen.getByRole('radio', {name: 'Bruna Lima'}));
    await fireEvent.press(botao('Confirmar reatribuição'));

    expect(onAtualizarRota).toHaveBeenCalledWith({...rota, motoristaId: '2'});
    expect(alerta).toHaveBeenCalledWith('Rota reatribuída', expect.any(String));
  });
});
