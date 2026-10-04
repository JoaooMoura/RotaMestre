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
  email: string;
  veiculo: string;
  disponivel: boolean;
};

// Dados enviados no cadastro; a senha nunca volta da API e CNH/telefone não aparecem na listagem.
export type NovoMotorista = Motorista & {
  senha: string;
  telefone: string;
  cnhNumero: string;
  cnhCategoria: string;
  cnhValidade: string;
};

export type Comprovante = {
  recebedor: string;
  // Data URI PNG, enviado apenas no salvamento que conclui a entrega.
  assinatura?: string;
  // Data URI JPEG/PNG comprimido; enviado junto com a assinatura.
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

