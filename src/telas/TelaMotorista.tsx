import React, {useState} from 'react';
import {
  Alert,
  Image,
  Pressable,
  ScrollView,
  StatusBar,
  Text,
  TextInput,
  View,
} from 'react-native';
import {MaterialDesignIcons} from '@react-native-vector-icons/material-design-icons';
import {TransicaoEntrada} from '../animacoes';
import {
  Badge,
  Botao,
  BotaoContornado,
  BotaoPrincipal,
  Cabecalho,
  CardParada,
  CartaoRota,
  ItemNavegacao,
  LayoutFaixa,
  NavegacaoInferior,
  PerfilUsuario,
} from '../componentes';
import {notificacoesIniciais} from '../dados';
import {cores, estilos} from '../estilos';
import {primeiroNome} from '../nomes';
import {Comprovante, Parada, Rota, StatusParada, TipoParada, Usuario} from '../tipos';
import SignatureScreen, {SignatureViewRef} from 'react-native-signature-canvas';
import {
  CameraOptions,
  ImageLibraryOptions,
  ImagePickerResponse,
  launchCamera,
  launchImageLibrary,
} from 'react-native-image-picker';

const FOTO_MAX_BYTES = 512 * 1024;
const TIPOS_FOTO_ACEITOS = ['image/jpeg', 'image/png'];
const OPCOES_FOTO: CameraOptions = {
  mediaType: 'photo',
  includeBase64: true,
  maxWidth: 1024,
  maxHeight: 1024,
  quality: 0.5,
};
const OPCOES_GALERIA: ImageLibraryOptions = {
  ...OPCOES_FOTO,
  restrictMimeTypes: TIPOS_FOTO_ACEITOS,
};

type Aba = 'Hoje' | 'Minha rota' | 'Notificações' | 'Perfil';

const ITENS_NAVEGACAO: ItemNavegacao[] = [
  {nome: 'Hoje', icone: 'home-outline', iconeAtivo: 'home'},
  {nome: 'Minha rota', icone: 'map-outline', iconeAtivo: 'map'},
  {nome: 'Notificações', icone: 'bell-outline', iconeAtivo: 'bell'},
  {nome: 'Perfil', icone: 'account-circle-outline', iconeAtivo: 'account-circle'},
];

type Fluxo =
  | 'base'
  | 'rota'
  | 'ativa'
  | 'pausada'
  | 'adicionar'
  | 'detalhe'
  | 'verificar'
  | 'status'
  | 'assinatura'
  | 'foto'
  | 'concluida';

const FLUXOS_TELA_CHEIA: Fluxo[] = ['adicionar', 'verificar', 'status', 'assinatura', 'foto', 'concluida'];

type Props = {
  usuario: Usuario;
  rota: Rota;
  onAtualizarRota: (rota: Rota) => Promise<boolean>;
  onSair: () => void;
};

export function TelaMotorista({usuario, rota, onAtualizarRota, onSair}: Props) {
  const [aba, setAba] = useState<Aba>('Hoje');
  const [fluxo, setFluxo] = useState<Fluxo>('base');
  const [paradaId, setParadaId] = useState(rota.paradas[0]?.id ?? '');
  const [tipo, setTipo] = useState<TipoParada>('Entrega');
  const [destinatario, setDestinatario] = useState('');
  const [endereco, setEndereco] = useState('');
  const [observacao, setObservacao] = useState('');
  const [statusEscolhido, setStatusEscolhido] = useState<StatusParada>('Em andamento');
  const [motivo, setMotivo] = useState('');
  const [nomeRecebedor, setNomeRecebedor] = useState('');
  const [assinatura, setAssinatura] = useState('');
  const [foto, setFoto] = useState('');
  const [enviandoEntrega, setEnviandoEntrega] = useState(false);
  const envioEmAndamento = React.useRef(false);
  const [rolagemAtiva, setRolagemAtiva] = useState(true);
  const signatureRef = React.useRef<SignatureViewRef>(null);

  const paradaSelecionada =
    rota.paradas.find(item => item.id === paradaId) ?? rota.paradas[0];
  const concluidas = rota.paradas.filter(item => item.status === 'Concluída').length;
  const progresso = rota.paradas.length ? (concluidas / rota.paradas.length) * 100 : 0;

  function atualizarStatusRota(status: Rota['status']) {
    return onAtualizarRota({...rota, status});
  }

  function atualizarParada(status: StatusParada, comprovante?: Comprovante) {
    const paradas = rota.paradas.map(item =>
      item.id === paradaSelecionada?.id
        ? comprovante
          ? {...item, status, comprovante}
          : {...item, status}
        : item,
    );
    const todasConcluidas = paradas.every(
      item => item.status === 'Concluída' || item.status === 'Não realizada',
    );
    return onAtualizarRota({
      ...rota,
      paradas,
      status: todasConcluidas ? 'Concluída' : rota.status,
    });
  }

  async function anexarFoto(origem: 'camera' | 'galeria') {
    const resultado: ImagePickerResponse =
      origem === 'camera'
        ? await launchCamera(OPCOES_FOTO)
        : await launchImageLibrary(OPCOES_GALERIA);

    if (resultado.didCancel) {
      return;
    }
    if (resultado.errorCode) {
      Alert.alert('Foto', resultado.errorMessage ?? 'Não foi possível obter a foto.');
      return;
    }

    const imagem = resultado.assets?.[0];
    if (!imagem?.base64) {
      return;
    }

    const tipo = imagem.type ?? 'image/jpeg';
    if (!TIPOS_FOTO_ACEITOS.includes(tipo)) {
      Alert.alert('Formato não suportado', 'Escolha uma foto em JPEG ou PNG, ou use a câmera.');
      return;
    }

    const dataUri = `data:${tipo};base64,${imagem.base64}`;
    if (dataUri.length > FOTO_MAX_BYTES) {
      Alert.alert('Foto muito grande', 'Tire outra foto mais próxima do comprovante.');
      return;
    }
    setFoto(dataUri);
  }

  async function confirmarEntrega() {
    if (envioEmAndamento.current) {
      return;
    }
    envioEmAndamento.current = true;
    setEnviandoEntrega(true);

    try {
      const comprovante = {recebedor: nomeRecebedor.trim(), assinatura, foto};
      if (await atualizarParada('Concluída', comprovante)) {
        setFluxo('concluida');
      }
    } finally {
      envioEmAndamento.current = false;
      setEnviandoEntrega(false);
    }
  }

  function trocarAba(item: string) {
    const novaAba = item as Aba;
    setAba(novaAba);
    setFluxo(novaAba === 'Minha rota' ? 'rota' : 'base');
  }

  function voltarParaHoje() {
    setAba('Hoje');
    setFluxo('base');
  }

  function abrirParada(parada: Parada) {
    setParadaId(parada.id);
    setFluxo('detalhe');
  }

  function telaDoFluxo() {
    if (fluxo === 'adicionar') {
      return (
        <ScrollView style={estilos.tela} keyboardShouldPersistTaps="handled">
          <Cabecalho titulo="Adicionar parada" onVoltar={() => setFluxo('pausada')} />
          <View style={estilos.conteudo}>
            <Text style={estilos.rotulo}>Tipo</Text>
            <View style={estilos.linha}>
              {(['Coleta', 'Entrega'] as TipoParada[]).map(item => (
                <Pressable
                  key={item}
                  style={[
                    estilos.opcao,
                    estilos.flex,
                    tipo === item && estilos.opcaoAtiva,
                    item === 'Entrega' && estilos.margemEsquerda10,
                  ]}
                  onPress={() => setTipo(item)}>
                  <Text style={estilos.opcaoTexto}>{item}</Text>
                </Pressable>
              ))}
            </View>
            <Text style={estilos.rotulo}>Cliente ou destinatário</Text>
            <TextInput style={estilos.input} value={destinatario} onChangeText={setDestinatario} />
            <Text style={estilos.rotulo}>Endereço</Text>
            <TextInput style={estilos.input} value={endereco} onChangeText={setEndereco} />
            <Text style={estilos.rotulo}>Observação</Text>
            <TextInput
              style={[estilos.input, estilos.inputMultilinha]}
              value={observacao}
              onChangeText={setObservacao}
              multiline
            />
            <Botao
              titulo="Adicionar parada"
              onPress={async () => {
                if (!destinatario.trim() || !endereco.trim()) {
                  Alert.alert('Dados incompletos', 'Informe destinatário e endereço.');
                  return;
                }
                const nova: Parada = {
                  id: Date.now().toString(),
                  tipo,
                  destinatario,
                  endereco,
                  janela: 'Parada imprevista',
                  observacao,
                  status: 'Pendente',
                };
                const salva = await onAtualizarRota({
                  ...rota,
                  paradas: [...rota.paradas, nova],
                });

                if (!salva) {
                  return;
                }

                setDestinatario('');
                setEndereco('');
                setObservacao('');
                setFluxo('pausada');
                Alert.alert('Parada adicionada', 'A programação foi atualizada.');
              }}
            />
          </View>
        </ScrollView>
      );
    }

    if (fluxo === 'pausada') {
      const removivel = [...rota.paradas].reverse().find(item => item.status === 'Pendente');
      return (
        <ScrollView style={estilos.tela}>
          <Cabecalho titulo="Rota pausada" subtitulo="Alterações permitidas durante a pausa" />
          <View style={estilos.conteudo}>
            <View style={[estilos.card, {backgroundColor: cores.roxoFundo}]}>
              <Text style={[estilos.titulo, {color: cores.roxo}]}>Pausa ativa</Text>
              <Text style={estilos.texto}>O progresso já concluído foi preservado.</Text>
            </View>
            <Botao titulo="Adicionar parada" secundario onPress={() => setFluxo('adicionar')} />
            <Botao
              titulo="Remover última parada futura"
              secundario
              perigo
              desabilitado={!removivel}
              onPress={() =>
                removivel &&
                Alert.alert(
                  'Remover parada',
                  `Deseja remover ${removivel.destinatario}?`,
                  [
                    {text: 'Cancelar'},
                    {
                      text: 'Remover',
                      onPress: async () => {
                        await onAtualizarRota({
                          ...rota,
                          paradas: rota.paradas.filter(item => item.id !== removivel.id),
                        });
                      },
                    },
                  ],
                )
              }
            />
            <Botao
              titulo="Retomar rota"
              onPress={async () => {
                if (await atualizarStatusRota('Em andamento')) {
                  setFluxo('ativa');
                }
              }}
            />
          </View>
        </ScrollView>
      );
    }

    if (fluxo === 'detalhe' && paradaSelecionada) {
      return (
        <ScrollView style={estilos.tela}>
          <Cabecalho titulo="Detalhes da parada" onVoltar={() => setFluxo(rota.status === 'Em andamento' ? 'ativa' : 'rota')} />
          <View style={estilos.conteudo}>
            <View style={estilos.card}>
              <View style={estilos.linhaEntre}>
                <Text style={estilos.titulo}>{paradaSelecionada.tipo}</Text>
                <Badge status={paradaSelecionada.status} />
              </View>
              <Text style={estilos.rotulo}>Cliente ou destinatário</Text>
              <Text style={estilos.valor}>{paradaSelecionada.destinatario}</Text>
              <Text style={estilos.rotulo}>Endereço</Text>
              <Text style={estilos.texto}>{paradaSelecionada.endereco}</Text>
              <Text style={estilos.rotulo}>Janela de atendimento</Text>
              <Text style={estilos.texto}>{paradaSelecionada.janela}</Text>
              <Text style={estilos.rotulo}>Observações</Text>
              <Text style={estilos.texto}>{paradaSelecionada.observacao || 'Sem observações'}</Text>
            </View>
            <Botao
              titulo="Confirmar chegada"
              desabilitado={paradaSelecionada.status === 'Concluída'}
              onPress={() => setFluxo('verificar')}
            />
          </View>
        </ScrollView>
      );
    }

    if (fluxo === 'verificar') {
      return (
        <View style={estilos.tela}>
          <Cabecalho titulo="Verificar presença" onVoltar={() => setFluxo('detalhe')} />
          <View style={estilos.centro}>
            <View style={estilos.sucessoIcone}>
              <Text style={estilos.sucessoIconeTexto}>✓</Text>
            </View>
            <Text style={[estilos.titulo, estilos.textoCentral]}>Localização confirmada</Text>
            <Text style={[estilos.subtitulo, estilos.textoCentral]}>
              Demonstração visual. A integração com GPS real será feita na etapa de hardware.
            </Text>
            <View style={estilos.larguraTotalTopo18}>
              <Botao titulo="Atualizar status" onPress={() => setFluxo('status')} />
            </View>
          </View>
        </View>
      );
    }

    if (fluxo === 'status') {
      return (
        <ScrollView style={estilos.tela}>
          <Cabecalho titulo="Atualizar entrega" onVoltar={() => setFluxo('detalhe')} />
          <View style={estilos.conteudo}>
            {(['Em andamento', 'Concluída', 'Não realizada'] as StatusParada[]).map(item => (
              <Pressable
                key={item}
                style={[estilos.opcao, statusEscolhido === item && estilos.opcaoAtiva]}
                onPress={() => setStatusEscolhido(item)}>
                <Text style={estilos.opcaoTexto}>{item === 'Concluída' ? 'Entregue' : item}</Text>
              </Pressable>
            ))}
            {statusEscolhido === 'Não realizada' ? (
              <TextInput
                style={[estilos.input, estilos.inputMultilinha]}
                value={motivo}
                onChangeText={setMotivo}
                multiline
                placeholder="Motivo da não realização"
                placeholderTextColor="#94A3B8"
              />
            ) : null}
            <Botao
              titulo="Confirmar status"
              onPress={async () => {
                if (statusEscolhido === 'Concluída') {
                  setFluxo('assinatura');
                  return;
                }
                if (await atualizarParada(statusEscolhido)) {
                  setFluxo('ativa');
                }
              }}
            />
          </View>
        </ScrollView>
      );
    }

    if (fluxo === 'assinatura') {
      return (
        <ScrollView style={estilos.tela} scrollEnabled={rolagemAtiva}>
          <Cabecalho titulo="Assinatura do recebedor" onVoltar={() => setFluxo('status')} />
          <View style={estilos.conteudo}>
            <Text style={estilos.rotulo}>Nome do recebedor</Text>
            <TextInput style={estilos.input} value={nomeRecebedor} onChangeText={setNomeRecebedor} />
            {assinatura ? (
              <View style={estilos.assinaturaCanvas}>
                <Image source={{uri: assinatura}} style={estilos.assinaturaPreview} />
              </View>
            ) : (
              <View style={estilos.assinaturaCanvas}>
                <SignatureScreen
                  ref={signatureRef}
                  onOK={(sig) => setAssinatura(sig)}
                  onEmpty={() => Alert.alert('Aviso', 'Por favor, assine antes de confirmar.')}
                  onBegin={() => setRolagemAtiva(false)}
                  onEnd={() => setRolagemAtiva(true)}
                  descriptionText="Assine aqui"
                  clearText="Limpar"
                  confirmText="Salvar"
                  webStyle=".m-signature-pad--footer {display: none; margin: 0px;}"
                />
              </View>
            )}
            <Botao
              titulo={assinatura ? "Refazer assinatura" : "Confirmar traço"}
              secundario
              onPress={() => {
                if (assinatura) {
                  setAssinatura('');
                } else {
                  signatureRef.current?.readSignature();
                }
              }}
            />
            <Botao
              titulo="Confirmar assinatura"
              desabilitado={!assinatura || !nomeRecebedor.trim()}
              onPress={() => setFluxo('foto')}
            />
          </View>
        </ScrollView>
      );
    }

    if (fluxo === 'foto') {
      return (
        <ScrollView style={estilos.tela}>
          <Cabecalho titulo="Foto do comprovante" onVoltar={() => setFluxo('assinatura')} />
          <View style={estilos.conteudo}>
            <Pressable style={estilos.foto} onPress={() => anexarFoto('camera')}>
              {foto ? (
                <Image source={{uri: foto}} style={estilos.fotoPreview} />
              ) : (
                <Text style={estilos.fotoTexto}>Toque para fotografar o comprovante</Text>
              )}
            </Pressable>
            {foto ? (
              <Botao titulo="Remover foto" secundario perigo onPress={() => setFoto('')} />
            ) : (
              <Botao titulo="Escolher da galeria" secundario onPress={() => anexarFoto('galeria')} />
            )}
            <Botao
              titulo={enviandoEntrega ? 'Enviando...' : 'Confirmar entrega'}
              desabilitado={!foto || enviandoEntrega}
              onPress={confirmarEntrega}
            />
          </View>
        </ScrollView>
      );
    }

    if (fluxo === 'concluida') {
      return (
        <View style={estilos.centro}>
          <View style={estilos.sucessoIcone}>
            <Text style={estilos.sucessoIconeTexto}>✓</Text>
          </View>
          <Text style={[estilos.titulo, estilos.textoCentral]}>Entrega registrada</Text>
          <Text style={[estilos.subtitulo, estilos.textoCentral]}>
            {paradaSelecionada?.destinatario} foi marcada como concluída.
          </Text>
          <View style={estilos.larguraTotalTopo18}>
            <Botao
              titulo="Ir para próxima parada"
              onPress={() => {
                setAssinatura('');
                setFoto('');
                setNomeRecebedor('');
                setFluxo('ativa');
              }}
            />
          </View>
        </View>
      );
    }

    if (fluxo === 'rota' || fluxo === 'ativa') {
      const ativa = fluxo === 'ativa' || rota.status === 'Em andamento';
      return (
        <View style={estilos.tela}>
          <Cabecalho titulo={ativa ? 'Rota em andamento' : 'Minha rota'} subtitulo={`${rota.id} - ${rota.nome}`} onVoltar={voltarParaHoje} />
          <ScrollView contentContainerStyle={estilos.conteudo}>
            <View style={estilos.cardAzul}>
              <View style={estilos.linhaEntre}>
                <Text style={estilos.valor}>{rota.paradas.length} paradas</Text>
                <Badge status={rota.status} />
              </View>
              <Text style={estilos.rotulo}>Progresso</Text>
              <Text style={estilos.texto}>{concluidas} concluídas e {rota.paradas.length - concluidas} restantes</Text>
              <View style={estilos.progressoFundo}>
                <View style={[estilos.progresso, {width: `${progresso}%`}]} />
              </View>
            </View>
            {rota.paradas.map((parada, indice) => (
              <CardParada key={parada.id} parada={parada} indice={indice} onPress={() => abrirParada(parada)} />
            ))}
            {ativa ? (
              <Botao
                titulo="Pausar rota"
                secundario
                onPress={async () => {
                  if (await atualizarStatusRota('Pausada')) {
                    setFluxo('pausada');
                  }
                }}
              />
            ) : (
              <Botao
                titulo="Iniciar rota"
                onPress={async () => {
                  if (await atualizarStatusRota('Em andamento')) {
                    setFluxo('ativa');
                  }
                }}
              />
            )}
          </ScrollView>
        </View>
      );
    }
    return null;
  }

  function conteudoBase() {
    if (aba === 'Notificações') {
      return (
        <>
          <Text style={estilos.titulo}>Notificações</Text>
          <Text style={estilos.subtitulo}>Atualizações da sua programação.</Text>
          <Text style={estilos.tituloSecao}>Recentes</Text>
          {notificacoesIniciais.map(item => (
            <Pressable key={item.id} style={[estilos.card, !item.lida && estilos.cardAzul]} onPress={() => setFluxo('rota')}>
              <Text style={estilos.valor}>{item.titulo}</Text>
              <Text style={estilos.texto}>{item.descricao}</Text>
            </Pressable>
          ))}
        </>
      );
    }

    return null;
  }

  function conteudoHoje() {
    const proximaParada = rota.paradas.find(
      item => item.status !== 'Concluída' && item.status !== 'Não realizada',
    );

    return (
      <LayoutFaixa
        faixa={
          <>
            <Text style={estilos.loginMarca} accessibilityRole="header">
              Olá, {primeiroNome(usuario.nome)}
            </Text>
            <Text style={estilos.loginSlogan}>Confira sua jornada de hoje.</Text>
          </>
        }>
        <Text style={estilos.secaoRotulo}>Rota do dia</Text>
        <CartaoRota rota={rota} onPress={() => setFluxo('rota')} />

        <Text style={[estilos.secaoRotulo, estilos.secaoRotuloAfastado]}>Próxima parada</Text>
        {proximaParada ? (
          <View style={estilos.cartaoParada}>
            <Text style={estilos.paradaContexto}>
              Parada {rota.paradas.indexOf(proximaParada) + 1} de {rota.paradas.length} ·{' '}
              {proximaParada.tipo}
            </Text>
            <Text style={estilos.paradaDestinatario}>{proximaParada.destinatario}</Text>
            <Text style={estilos.paradaEndereco}>{proximaParada.endereco}</Text>
            <View style={estilos.paradaJanela}>
              <MaterialDesignIcons name="clock-outline" size={18} color={cores.textoApoio} />
              <Text style={estilos.textoApoio}>Janela {proximaParada.janela}</Text>
            </View>
            <BotaoPrincipal
              titulo="Abrir parada"
              onPress={() => abrirParada(proximaParada)}
            />
          </View>
        ) : (
          <View style={estilos.cartaoParada}>
            <View style={estilos.linhaIcone}>
              <MaterialDesignIcons name="flag-checkered" size={20} color={cores.sucesso} />
              <Text style={estilos.textoApoioForte}>Todas as paradas foram finalizadas.</Text>
            </View>
          </View>
        )}

        <BotaoContornado titulo="Ver minha rota" onPress={() => setFluxo('rota')} />
      </LayoutFaixa>
    );
  }

  function conteudoAba() {
    if (aba === 'Perfil') {
      return <PerfilUsuario usuario={usuario} onSair={onSair} />;
    }
    if (aba === 'Notificações') {
      return (
        <>
          <Cabecalho titulo="RotaMestre" subtitulo="Área do Motorista" />
          <ScrollView contentContainerStyle={estilos.conteudo}>{conteudoBase()}</ScrollView>
        </>
      );
    }
    return conteudoHoje();
  }

  const tela = telaDoFluxo();
  if (tela && FLUXOS_TELA_CHEIA.includes(fluxo)) {
    return <TransicaoEntrada key={fluxo}>{tela}</TransicaoEntrada>;
  }

  const abaDestacada: Aba = tela ? 'Minha rota' : aba;
  const chaveTela = tela ? (fluxo === 'ativa' ? 'rota' : fluxo) : aba;

  return (
    <View style={estilos.telaComNavegacao}>
      <StatusBar barStyle="light-content" />
      <TransicaoEntrada key={chaveTela}>{tela ?? conteudoAba()}</TransicaoEntrada>
      <NavegacaoInferior itens={ITENS_NAVEGACAO} ativa={abaDestacada} onPress={trocarAba} />
    </View>
  );
}
