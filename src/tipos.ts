export type Perfil = 'gestor' | 'motorista';

export type TipoParada = 'Coleta' | 'Entrega';

export type StatusParada =
  | 'Pendente'
  | 'Em andamento'
  | 'Concluída'
  | 'Não realizada';

export type StatusRota =
  | 'Programada'
  | 'Em andamento'
  | 'Pausada'
  | 'Concluída';

export type Motorista = {
  id: string;
  nome: string;
  veiculo: string;
  disponivel: boolean;
};

export type Parada = {
  id: string;
  tipo: TipoParada;
  destinatario: string;
  endereco: string;
  janela: string;
  observacao: string;
  status: StatusParada;
};

export type Rota = {
  id: string;
  nome: string;
  data: string;
  horario: string;
  motoristaId: string;
  paradas: Parada[];
  status: StatusRota;
};

export type Notificacao = {
  id: string;
  titulo: string;
  descricao: string;
  lida: boolean;
};

