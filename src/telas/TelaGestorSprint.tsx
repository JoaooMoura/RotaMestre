import React, {useState} from 'react';
import {Alert, Pressable, StatusBar, Text, View} from 'react-native';
import {MaterialDesignIcons} from '@react-native-vector-icons/material-design-icons';
import {TransicaoEntrada} from '../animacoes';
import {
  AvatarPequeno,
  Badge,
  BotaoContornado,
  BotaoPrincipal,
  Campo,
  CartaoRota,
  FaixaTitulo,
  ItemNavegacao,
  LayoutFaixa,
  LinhaParada,
  NavegacaoInferior,
  PerfilUsuario,
  ProgressoEtapas,
} from '../componentes';
import {cores, estilos} from '../estilos';
import {primeiroNome} from '../nomes';
import {Motorista, Parada, Rota, TipoParada, Usuario} from '../tipos';

type Aba = 'Início' | 'Rotas' | 'Motoristas' | 'Perfil';
type Fluxo = 'base' | 'criar' | 'organizar' | 'atribuir' | 'detalhe' | 'reatribuir';

const ITENS_NAVEGACAO: ItemNavegacao[] = [
  {nome: 'Início', icone: 'view-dashboard-outline', iconeAtivo: 'view-dashboard'},
  {nome: 'Rotas', icone: 'map-outline', iconeAtivo: 'map'},
  {nome: 'Motoristas', icone: 'account-group-outline', iconeAtivo: 'account-group'},
  {nome: 'Perfil', icone: 'account-circle-outline', iconeAtivo: 'account-circle'},
];

const FLUXOS_TELA_CHEIA: Fluxo[] = ['criar', 'organizar', 'atribuir', 'reatribuir'];
const TOTAL_ETAPAS_CRIACAO = 3;

function dataDeHoje() {
  const hoje = new Date();
  const doisDigitos = (valor: number) => String(valor).padStart(2, '0');
  return `${doisDigitos(hoje.getDate())}/${doisDigitos(hoje.getMonth() + 1)}/${hoje.getFullYear()}`;
}

type Props = {
  usuario: Usuario;
  rota: Rota;
  motoristas: Motorista[];
  onAtualizarRota: (rota: Rota) => Promise<boolean>;
  onSair: () => void;
};

export function TelaGestorSprint({
  usuario,
  rota,
  motoristas,
  onAtualizarRota,
  onSair,
}: Props) {
  const [aba, setAba] = useState<Aba>('Início');
  const [fluxo, setFluxo] = useState<Fluxo>('base');
  const [nome, setNome] = useState('');
  const [data, setData] = useState(dataDeHoje);
  const [horario, setHorario] = useState('08:00');
  const [tipo, setTipo] = useState<TipoParada>('Entrega');
  const [destinatario, setDestinatario] = useState('');
  const [endereco, setEndereco] = useState('');
  const [janela, setJanela] = useState('');
  const [observacao, setObservacao] = useState('');
  const [paradas, setParadas] = useState<Parada[]>([]);
  const [motoristaId, setMotoristaId] = useState(rota.motoristaId);

  const responsavel = motoristas.find(item => item.id === rota.motoristaId);

  function adicionarParada() {
    if (!destinatario.trim() || !endereco.trim()) {
      Alert.alert('Dados incompletos', 'Informe o destinatário e o endereço.');
      return;
    }
    setParadas(atuais => [
      ...atuais,
      {
        id: Date.now().toString(),
        tipo,
        destinatario: destinatario.trim(),
        endereco: endereco.trim(),
        janela: janela.trim() || 'Sem janela definida',
        observacao: observacao.trim(),
        status: 'Pendente',
      },
    ]);
    setDestinatario('');
    setEndereco('');
    setObservacao('');
  }

  function abrirCriacao() {
    setParadas([]);
    setMotoristaId('');
    setFluxo('criar');
  }

  async function salvarAtribuicao() {
    if (!motoristaId) {
      Alert.alert('Motorista obrigatório', 'Selecione um motorista disponível.');
      return;
    }
    const novaRota: Rota = {
      id: `RT-${String(Date.now()).slice(-6)}`,
      nome: nome.trim(),
      data,
      horario,
      motoristaId,
      paradas,
      status: 'Programada',
    };
    const salva = await onAtualizarRota(novaRota);

    if (!salva) {
      return;
    }

    setFluxo('detalhe');
    Alert.alert(
      'Rota atribuída',
      'A rota foi salva e já está disponível para o motorista.',
    );
  }

  async function confirmarReatribuicao() {
    const salva = await onAtualizarRota({...rota, motoristaId});

    if (!salva) {
      return;
    }

    setFluxo('detalhe');
    Alert.alert('Rota reatribuída', 'O motorista responsável foi atualizado.');
  }

  function trocarAba(item: string) {
    setAba(item as Aba);
    setFluxo('base');
  }

  function situacaoMotorista(motorista: Motorista) {
    if (motorista.id === rota.motoristaId) {
      return {icone: 'map-marker-path' as const, texto: 'Rota atual', estilo: estilos.etiquetaPrimaria, cor: cores.primaria};
    }
    return motorista.disponivel
      ? {icone: 'check-circle-outline' as const, texto: 'Disponível', estilo: estilos.etiquetaSucesso, cor: cores.sucesso}
      : {icone: 'minus-circle-outline' as const, texto: 'Indisponível', estilo: estilos.etiquetaNeutra, cor: cores.textoApoio};
  }

  function listaDeParadas(lista: Parada[], mostrarStatus = false) {
    return lista.map((parada, indice) => (
      <LinhaParada key={parada.id} parada={parada} indice={indice} mostrarStatus={mostrarStatus} />
    ));
  }

  function telaCriar() {
    return (
      <LayoutFaixa
        comVoltar
        faixa={
          <FaixaTitulo titulo="Nova rota" onVoltar={() => setFluxo('base')}>
            <ProgressoEtapas etapa={1} total={TOTAL_ETAPAS_CRIACAO} />
          </FaixaTitulo>
        }>
        <Text style={estilos.loginTitulo} accessibilityRole="header">
          Dados e paradas
        </Text>
        <Campo
          rotulo="Nome da rota"
          icone="map-marker-path"
          value={nome}
          onChangeText={setNome}
          placeholder="Ex.: Entregas Centro"
        />
        <Campo
          rotulo="Data"
          icone="calendar-outline"
          value={data}
          onChangeText={setData}
          placeholder="DD/MM/AAAA"
        />
        <Campo
          rotulo="Horário previsto"
          icone="clock-outline"
          value={horario}
          onChangeText={setHorario}
          placeholder="08:00"
        />

        <Text style={[estilos.secaoRotulo, estilos.secaoRotuloAfastado]}>Nova parada</Text>
        <View style={estilos.seletorTipo} accessibilityRole="radiogroup">
          {(['Coleta', 'Entrega'] as TipoParada[]).map(item => {
            const ativo = tipo === item;
            return (
              <Pressable
                key={item}
                accessibilityRole="radio"
                accessibilityState={{checked: ativo}}
                accessibilityLabel={item}
                onPress={() => setTipo(item)}
                style={[estilos.seletorOpcao, ativo && estilos.seletorOpcaoAtiva]}>
                <MaterialDesignIcons
                  name={item === 'Coleta' ? 'package-variant-closed' : 'truck-delivery-outline'}
                  size={20}
                  color={ativo ? cores.primariaPressionada : cores.textoApoio}
                />
                <Text style={estilos.seletorTexto}>{item}</Text>
              </Pressable>
            );
          })}
        </View>
        <Campo
          rotulo="Destinatário"
          icone="account-outline"
          value={destinatario}
          onChangeText={setDestinatario}
          placeholder="Cliente ou destinatário"
        />
        <Campo
          rotulo="Endereço"
          icone="map-marker-outline"
          value={endereco}
          onChangeText={setEndereco}
          placeholder="Endereço completo"
        />
        <Campo
          rotulo="Janela de atendimento"
          icone="clock-time-four-outline"
          value={janela}
          onChangeText={setJanela}
          placeholder="09:00 - 10:00"
        />
        <Campo
          rotulo="Observações"
          icone="note-text-outline"
          value={observacao}
          onChangeText={setObservacao}
          multiline
          estiloTexto={estilos.campoMultilinha}
        />
        <BotaoContornado titulo="Adicionar parada" icone="plus" onPress={adicionarParada} />

        <Text style={[estilos.secaoRotulo, estilos.secaoRotuloAfastado]}>
          Paradas adicionadas ({paradas.length})
        </Text>
        {paradas.length === 0 ? (
          <View style={estilos.vazio}>
            <MaterialDesignIcons name="information-outline" size={20} color={cores.textoApoio} />
            <Text style={[estilos.textoApoio, estilos.flex]}>Adicione pelo menos duas paradas.</Text>
          </View>
        ) : (
          listaDeParadas(paradas)
        )}
        <BotaoPrincipal
          titulo="Organizar paradas"
          desabilitado={paradas.length < 2 || !nome.trim()}
          onPress={() => setFluxo('organizar')}
        />
      </LayoutFaixa>
    );
  }

  function telaOrganizar() {
    return (
      <LayoutFaixa
        comVoltar
        faixa={
          <FaixaTitulo
            titulo="Organizar paradas"
            apoio="Revise a sequência antes de atribuir a rota."
            onVoltar={() => setFluxo('criar')}>
            <ProgressoEtapas etapa={2} total={TOTAL_ETAPAS_CRIACAO} />
          </FaixaTitulo>
        }>
        <Text style={estilos.secaoRotulo}>Sequência ({paradas.length} paradas)</Text>
        {listaDeParadas(paradas)}
        <BotaoContornado
          titulo="Otimizar ordem"
          icone="sort-variant"
          onPress={() => {
            setParadas(atuais =>
              [...atuais].sort((a, b) => a.endereco.localeCompare(b.endereco)),
            );
            Alert.alert('Ordem otimizada', 'As paradas foram reorganizadas para a demonstração.');
          }}
        />
        <BotaoPrincipal titulo="Escolher motorista" onPress={() => setFluxo('atribuir')} />
      </LayoutFaixa>
    );
  }

  function telaAtribuir() {
    const reatribuindo = fluxo === 'reatribuir';
    return (
      <LayoutFaixa
        comVoltar
        faixa={
          <FaixaTitulo
            titulo={reatribuindo ? 'Reatribuir motorista' : 'Atribuir motorista'}
            apoio={`${paradas.length || rota.paradas.length} paradas`}
            onVoltar={() => setFluxo(reatribuindo ? 'detalhe' : 'organizar')}>
            {reatribuindo ? null : <ProgressoEtapas etapa={3} total={TOTAL_ETAPAS_CRIACAO} />}
          </FaixaTitulo>
        }>
        <Text style={estilos.secaoRotulo}>Escolha o motorista</Text>
        <View accessibilityRole="radiogroup">
          {motoristas.map(motorista => {
            const selecionado = motoristaId === motorista.id;
            const situacao = situacaoMotorista(motorista);
            return (
              <Pressable
                key={motorista.id}
                accessibilityRole="radio"
                accessibilityState={{checked: selecionado}}
                accessibilityLabel={motorista.nome}
                onPress={() => setMotoristaId(motorista.id)}
                style={[estilos.opcaoLista, selecionado && estilos.opcaoListaSelecionada]}>
                <AvatarPequeno nome={motorista.nome} />
                <View style={estilos.flex}>
                  <Text style={estilos.linhaListaTitulo}>{motorista.nome}</Text>
                  <Text style={estilos.textoApoio}>{motorista.veiculo}</Text>
                  <View style={estilos.etiqueta}>
                    <MaterialDesignIcons name={situacao.icone} size={14} color={situacao.cor} />
                    <Text style={[estilos.etiquetaTexto, situacao.estilo]}>{situacao.texto}</Text>
                  </View>
                </View>
                <MaterialDesignIcons
                  name={selecionado ? 'radiobox-marked' : 'radiobox-blank'}
                  size={24}
                  color={selecionado ? cores.primaria : cores.contorno}
                />
              </Pressable>
            );
          })}
        </View>
        <BotaoPrincipal
          titulo={reatribuindo ? 'Confirmar reatribuição' : 'Confirmar atribuição'}
          onPress={() => (reatribuindo ? confirmarReatribuicao() : salvarAtribuicao())}
        />
      </LayoutFaixa>
    );
  }

  function telaDetalhe() {
    const concluidas = rota.paradas.filter(item => item.status === 'Concluída').length;
    const percentual = rota.paradas.length ? (concluidas / rota.paradas.length) * 100 : 0;
    const estiloLargura = {width: `${percentual}%` as const};
    return (
      <LayoutFaixa
        comVoltar
        faixa={
          <FaixaTitulo
            titulo={rota.nome}
            apoio={`${rota.id} · ${rota.data} às ${rota.horario}`}
            onVoltar={() => setFluxo('base')}
          />
        }>
        <View style={estilos.linhaEntre}>
          <Text style={estilos.textoApoioForte}>
            {concluidas} de {rota.paradas.length} paradas concluídas
          </Text>
          <Badge status={rota.status} />
        </View>
        <View style={estilos.progressoFundo}>
          <View style={[estilos.progresso, estiloLargura]} />
        </View>

        <Text style={[estilos.secaoRotulo, estilos.secaoRotuloAfastado]}>Motorista</Text>
        {responsavel ? (
          <View style={estilos.linhaLista}>
            <AvatarPequeno nome={responsavel.nome} />
            <View style={estilos.flex}>
              <Text style={estilos.linhaListaTitulo}>{responsavel.nome}</Text>
              <Text style={estilos.textoApoio}>{responsavel.veiculo}</Text>
            </View>
          </View>
        ) : (
          <View style={estilos.vazio}>
            <MaterialDesignIcons name="account-off-outline" size={20} color={cores.textoApoio} />
            <Text style={[estilos.textoApoio, estilos.flex]}>Não atribuído</Text>
          </View>
        )}

        <Text style={[estilos.secaoRotulo, estilos.secaoRotuloAfastado]}>Paradas</Text>
        {listaDeParadas(rota.paradas, true)}

        <BotaoContornado
          titulo="Reatribuir motorista"
          icone="account-switch-outline"
          onPress={() => {
            setMotoristaId(rota.motoristaId);
            setFluxo('reatribuir');
          }}
        />
      </LayoutFaixa>
    );
  }

  function conteudoInicio() {
    return (
      <LayoutFaixa
        faixa={
          <FaixaTitulo
            titulo={`Olá, ${primeiroNome(usuario.nome)}`}
            apoio="Acompanhe a operação de hoje."
          />
        }>
        <Text style={estilos.secaoRotulo}>Rota de hoje</Text>
        <CartaoRota
          rota={rota}
          responsavel={responsavel?.nome ?? 'Sem motorista atribuído'}
          onPress={() => setFluxo('detalhe')}
        />

        <Text style={[estilos.secaoRotulo, estilos.secaoRotuloAfastado]}>Equipe</Text>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Ver equipe de motoristas"
          onPress={() => trocarAba('Motoristas')}
          style={({pressed}) => [estilos.cartao, pressed && estilos.cartaoPressionado]}>
          <View style={estilos.linha}>
            <MaterialDesignIcons name="account-group-outline" size={24} color={cores.primaria} />
            <View style={[estilos.flex, estilos.margemEsquerda10]}>
              <Text style={estilos.linhaListaTitulo}>
                {motoristas.length} {motoristas.length === 1 ? 'motorista' : 'motoristas'}
              </Text>
              <Text style={estilos.textoApoio}>
                {motoristas.filter(item => item.disponivel).length} disponíveis para atribuição
              </Text>
            </View>
            <MaterialDesignIcons name="chevron-right" size={24} color={cores.textoApoio} />
          </View>
        </Pressable>

        <BotaoPrincipal titulo="Criar rota" onPress={abrirCriacao} />
      </LayoutFaixa>
    );
  }

  function conteudoRotas() {
    return (
      <LayoutFaixa faixa={<FaixaTitulo titulo="Rotas" apoio="Rota atual da operação." />}>
        <Text style={estilos.secaoRotulo}>Rota atual</Text>
        <CartaoRota
          rota={rota}
          responsavel={responsavel?.nome ?? 'Sem motorista atribuído'}
          onPress={() => setFluxo('detalhe')}
        />
        <BotaoPrincipal titulo="Nova rota" onPress={abrirCriacao} />
      </LayoutFaixa>
    );
  }

  function conteudoMotoristas() {
    return (
      <LayoutFaixa
        faixa={
          <FaixaTitulo
            titulo="Motoristas"
            apoio={`${motoristas.length} ${motoristas.length === 1 ? 'cadastrado' : 'cadastrados'}`}
          />
        }>
        <Text style={estilos.secaoRotulo}>Equipe</Text>
        {motoristas.map(motorista => {
          const situacao = situacaoMotorista(motorista);
          return (
            <View key={motorista.id} style={estilos.linhaLista}>
              <AvatarPequeno nome={motorista.nome} />
              <View style={estilos.flex}>
                <Text style={estilos.linhaListaTitulo}>{motorista.nome}</Text>
                <Text style={estilos.textoApoio}>{motorista.veiculo}</Text>
              </View>
              <View style={estilos.etiqueta}>
                <MaterialDesignIcons name={situacao.icone} size={14} color={situacao.cor} />
                <Text style={[estilos.etiquetaTexto, situacao.estilo]}>{situacao.texto}</Text>
              </View>
            </View>
          );
        })}
      </LayoutFaixa>
    );
  }

  function conteudoAba() {
    if (aba === 'Rotas') {
      return conteudoRotas();
    }
    if (aba === 'Motoristas') {
      return conteudoMotoristas();
    }
    if (aba === 'Perfil') {
      return <PerfilUsuario usuario={usuario} onSair={onSair} />;
    }
    return conteudoInicio();
  }

  if (FLUXOS_TELA_CHEIA.includes(fluxo)) {
    const tela =
      fluxo === 'criar' ? telaCriar() : fluxo === 'organizar' ? telaOrganizar() : telaAtribuir();
    return <TransicaoEntrada key={fluxo}>{tela}</TransicaoEntrada>;
  }

  const emDetalhe = fluxo === 'detalhe';

  return (
    <View style={estilos.telaComNavegacao}>
      <StatusBar barStyle="light-content" />
      <TransicaoEntrada key={emDetalhe ? 'detalhe' : aba}>
        {emDetalhe ? telaDetalhe() : conteudoAba()}
      </TransicaoEntrada>
      <NavegacaoInferior
        itens={ITENS_NAVEGACAO}
        ativa={emDetalhe ? 'Rotas' : aba}
        onPress={trocarAba}
      />
    </View>
  );
}
