export type Papel = 'gestor' | 'motorista';

export type Usuario = {
  id: string;
  nome: string;
  email: string;
  papel: Papel;
};

export type Sessao = {
  token: string;
  usuario: Usuario;
  expiraEm: number;
};

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
  email: string;
  veiculo: string;
  disponivel: boolean;
};

export type NovoMotorista = Motorista & {
  senha: string;
  telefone: string;
  cnhNumero: string;
  cnhCategoria: string;
  cnhValidade: string;
};

export type Comprovante = {
  recebedor: string;
  assinatura?: string;
  foto?: string;
  registradoEm?: number;
};

export type Parada = {
  id: string;
  tipo: TipoParada;
  destinatario: string;
  endereco: string;
  janela: string;
  observacao: string;
  status: StatusParada;
  comprovante?: Comprovante;
  latitude?: number;
  longitude?: number;
};

export type Coordenada = [longitude: number, latitude: number];

export type ParadaNoMapa = {
  id: string;
  tipo: TipoParada;
  destinatario: string;
  endereco: string;
  status: StatusParada;
  latitude: number;
  longitude: number;
};

export type Trajeto = {
  rotaId: string;
  geometria: {type: 'LineString'; coordinates: Coordenada[]};
  distanciaM: number;
  duracaoS: number;
  calculadoEm: number;
  paradas: ParadaNoMapa[];
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

