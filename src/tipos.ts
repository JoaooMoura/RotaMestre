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
  /** Posição da parada na rota original, começando em 1 (ausente: vale a posição na lista). */
  numero?: number;
  /** Ponto de partida de um trajeto recalculado (a posição do veículo): não é uma parada de verdade. */
  origem?: boolean;
  tipo: TipoParada;
  destinatario: string;
  endereco: string;
  status: StatusParada;
  latitude: number;
  longitude: number;
};

export type Manobra = {
  /** Tipo do OSRM: depart, turn, end of road, on ramp, off ramp, merge, fork, new name, continue, roundabout, arrive... */
  tipo: string;
  modificador: string | null;
  saida: number | null;
  /** Via para a qual a manobra leva (nome ou referência da rodovia); vazia se não tem nome. */
  via: string;
  /** Posição da manobra na geometria do trajeto. */
  indice: number;
  distanciaM: number;
  duracaoS: number;
  /** Trecho entre paradas: 0 vai da parada 1 à 2, e assim por diante. */
  perna: number;
};

/** Limite de velocidade validado a partir do ponto `indice` da geometria; `kmh` nulo = sem limite conhecido. */
export type LimiteDoTrecho = {indice: number; kmh: number | null};

export type Trajeto = {
  rotaId: string;
  /** Calculado a partir da posição do veículo até as paradas que faltam (US05.04). */
  recalculado?: boolean;
  geometria: {type: 'LineString'; coordinates: Coordenada[]};
  distanciaM: number;
  duracaoS: number;
  calculadoEm: number;
  manobras: Manobra[];
  /** Ausente em trajetos baixados antes da US05.05: equivale a nenhum limite conhecido. */
  limites?: LimiteDoTrecho[];
  paradas: ParadaNoMapa[];
};

/** Um motorista com rota em andamento ou pausada, como o gestor o vê no mapa (US03.04). */
export type MotoristaNaFrota = {
  motoristaId: string;
  nome: string;
  veiculo: string;
  rota: {id: string; nome: string; status: 'Em andamento' | 'Pausada'};
  paradas: {total: number; encerradas: number; proxima: {id: string; destinatario: string; tipo: TipoParada} | null};
  /** Última posição recebida; nula se não há (ou se a rota está pausada). `idadeMs` é contada pelo servidor. */
  posicao: {latitude: number; longitude: number; precisaoM: number | null; registradaEm: number; idadeMs: number} | null;
};

export type Frota = {geradoEm: number; motoristas: MotoristaNaFrota[]};

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

