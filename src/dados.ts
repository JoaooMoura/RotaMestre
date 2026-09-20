import {Motorista, Notificacao, Rota} from './tipos';

export const motoristas: Motorista[] = [
  {
    id: '1',
    nome: 'Carlos Mendes',
    veiculo: 'Mercedes-Benz Sprinter • ABC-1234',
    disponivel: true,
  },
  {
    id: '2',
    nome: 'Ana Paula Souza',
    veiculo: 'Fiat Ducato • XYZ-5678',
    disponivel: true,
  },
  {
    id: '3',
    nome: 'Ricardo Ferreira',
    veiculo: 'Ford Transit • DEF-9012',
    disponivel: true,
  },
];

export const rotaInicial: Rota = {
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

export const notificacoesIniciais: Notificacao[] = [
  {
    id: '1',
    titulo: 'Nova rota atribuída',
    descricao: 'A rota RT-001 foi atribuída a você.',
    lida: false,
  },
  {
    id: '2',
    titulo: 'Programação confirmada',
    descricao: 'Confira as paradas antes de iniciar a jornada.',
    lida: true,
  },
];
