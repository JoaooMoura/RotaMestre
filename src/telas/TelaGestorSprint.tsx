import React, {useState} from 'react';
import {
  Alert,
  Pressable,
  ScrollView,
  StatusBar,
  Text,
  TextInput,
  View,
} from 'react-native';
import {Abas, Badge, Botao, Cabecalho, CardParada} from '../componentes';
import {cores, estilos} from '../estilos';
import {Motorista, Parada, Rota, TipoParada} from '../tipos';

type Aba = 'Início' | 'Rotas' | 'Motoristas' | 'Perfil';
type Fluxo = 'base' | 'criar' | 'organizar' | 'atribuir' | 'detalhe' | 'reatribuir';

type Props = {
  rota: Rota;
  motoristas: Motorista[];
  onAtualizarRota: (rota: Rota) => Promise<boolean>;
  onSair: () => void;
};

export function TelaGestorSprint({
  rota,
  motoristas,
  onAtualizarRota,
  onSair,
}: Props) {
  const [aba, setAba] = useState<Aba>('Início');
  const [fluxo, setFluxo] = useState<Fluxo>('base');
  const [nome, setNome] = useState('Rota Vale da Manhã');
  const [data, setData] = useState('20/09/2026');
  const [horario, setHorario] = useState('08:00');
  const [tipo, setTipo] = useState<TipoParada>('Entrega');
  const [destinatario, setDestinatario] = useState('');
  const [endereco, setEndereco] = useState('');
  const [janela, setJanela] = useState('09:00 - 10:00');
  const [observacao, setObservacao] = useState('');
  const [paradas, setParadas] = useState<Parada[]>([]);
  const [motoristaId, setMotoristaId] = useState(rota.motoristaId);

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

  function trocarAba(item: string) {
    setAba(item as Aba);
    setFluxo('base');
  }

  if (fluxo === 'criar') {
    return (
      <ScrollView style={estilos.tela} keyboardShouldPersistTaps="handled">
        <Cabecalho titulo="Criar nova rota" onVoltar={() => setFluxo('base')} />
        <View style={estilos.conteudo}>
          <Text style={estilos.rotulo}>Nome da rota</Text>
          <TextInput style={estilos.input} value={nome} onChangeText={setNome} />
          <Text style={estilos.rotulo}>Data</Text>
          <TextInput style={estilos.input} value={data} onChangeText={setData} />
          <Text style={estilos.rotulo}>Horário previsto</Text>
          <TextInput style={estilos.input} value={horario} onChangeText={setHorario} />
          <Text style={estilos.tituloSecao}>Nova parada</Text>
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
          <TextInput
            style={estilos.input}
            value={destinatario}
            onChangeText={setDestinatario}
            placeholder="Cliente ou destinatário"
            placeholderTextColor="#94A3B8"
          />
          <TextInput
            style={estilos.input}
            value={endereco}
            onChangeText={setEndereco}
            placeholder="Endereço completo"
            placeholderTextColor="#94A3B8"
          />
          <TextInput
            style={estilos.input}
            value={janela}
            onChangeText={setJanela}
            placeholder="Janela de atendimento"
            placeholderTextColor="#94A3B8"
          />
          <TextInput
            style={[estilos.input, estilos.inputMultilinha]}
            value={observacao}
            onChangeText={setObservacao}
            multiline
            placeholder="Observações"
            placeholderTextColor="#94A3B8"
          />
          <Botao titulo="Adicionar parada" secundario onPress={adicionarParada} />
          <Text style={estilos.tituloSecao}>Paradas adicionadas</Text>
          {paradas.length === 0 ? (
            <View style={estilos.card}>
              <Text style={estilos.texto}>Adicione pelo menos duas paradas.</Text>
            </View>
          ) : (
            paradas.map((parada, indice) => (
              <CardParada key={parada.id} parada={parada} indice={indice} />
            ))
          )}
          <Botao
            titulo="Organizar paradas"
            desabilitado={paradas.length < 2 || !nome.trim()}
            onPress={() => setFluxo('organizar')}
          />
        </View>
      </ScrollView>
    );
  }

  if (fluxo === 'organizar') {
    return (
      <ScrollView style={estilos.tela}>
        <Cabecalho titulo="Organizar paradas" onVoltar={() => setFluxo('criar')} />
        <View style={estilos.conteudo}>
          <Text style={estilos.subtitulo}>
            Revise a sequência antes de atribuir a rota.
          </Text>
          {paradas.map((parada, indice) => (
            <CardParada key={parada.id} parada={parada} indice={indice} />
          ))}
          <Botao
            titulo="Otimizar ordem"
            secundario
            onPress={() => {
              setParadas(atuais =>
                [...atuais].sort((a, b) => a.endereco.localeCompare(b.endereco)),
              );
              Alert.alert('Ordem otimizada', 'As paradas foram reorganizadas para a demonstração.');
            }}
          />
          <Botao titulo="Escolher motorista" onPress={() => setFluxo('atribuir')} />
        </View>
      </ScrollView>
    );
  }

  if (fluxo === 'atribuir' || fluxo === 'reatribuir') {
    const reatribuindo = fluxo === 'reatribuir';
    return (
      <ScrollView style={estilos.tela}>
        <Cabecalho
          titulo={reatribuindo ? 'Reatribuir motorista' : 'Atribuir motorista'}
          subtitulo={`${paradas.length || rota.paradas.length} paradas`}
          onVoltar={() => setFluxo(reatribuindo ? 'detalhe' : 'organizar')}
        />
        <View style={estilos.conteudo}>
          {motoristas.map(motorista => (
            <Pressable
              key={motorista.id}
              style={[
                estilos.opcao,
                motoristaId === motorista.id && estilos.opcaoAtiva,
              ]}
              onPress={() => setMotoristaId(motorista.id)}>
              <Text style={estilos.valor}>{motorista.nome}</Text>
              <Text style={estilos.texto}>{motorista.veiculo}</Text>
              <Text style={[estilos.texto, {color: cores.sucesso}, estilos.margemTopo4]}>
                Disponível
              </Text>
            </Pressable>
          ))}
          <Botao
            titulo={reatribuindo ? 'Confirmar reatribuição' : 'Confirmar atribuição'}
            onPress={async () => {
              if (reatribuindo) {
                const salva = await onAtualizarRota({...rota, motoristaId});

                if (!salva) {
                  return;
                }

                setFluxo('detalhe');
                Alert.alert('Rota reatribuída', 'O motorista responsável foi atualizado.');
                return;
              }
              salvarAtribuicao();
            }}
          />
        </View>
      </ScrollView>
    );
  }

  if (fluxo === 'detalhe') {
    const motorista = motoristas.find(item => item.id === rota.motoristaId);
    const concluidas = rota.paradas.filter(item => item.status === 'Concluída').length;
    return (
      <ScrollView style={estilos.tela}>
        <Cabecalho titulo={rota.id} subtitulo={rota.nome} onVoltar={() => setFluxo('base')} />
        <View style={estilos.conteudo}>
          <View style={estilos.cardAzul}>
            <View style={estilos.linhaEntre}>
              <Text style={estilos.valor}>{rota.data} às {rota.horario}</Text>
              <Badge status={rota.status} />
            </View>
            <Text style={estilos.rotulo}>Motorista</Text>
            <Text style={estilos.valor}>{motorista?.nome ?? 'Não atribuído'}</Text>
            <Text style={estilos.texto}>{motorista?.veiculo}</Text>
            <Text style={estilos.rotulo}>Progresso</Text>
            <Text style={estilos.texto}>{concluidas} de {rota.paradas.length} paradas concluídas</Text>
            <View style={estilos.progressoFundo}>
              <View style={[estilos.progresso, {width: `${rota.paradas.length ? (concluidas / rota.paradas.length) * 100 : 0}%`}]} />
            </View>
          </View>
          {rota.paradas.map((parada, indice) => (
            <CardParada key={parada.id} parada={parada} indice={indice} />
          ))}
          <Botao titulo="Reatribuir motorista" secundario onPress={() => {
            setMotoristaId(rota.motoristaId);
            setFluxo('reatribuir');
          }} />
        </View>
      </ScrollView>
    );
  }

  function conteudoBase() {
    if (aba === 'Rotas') {
      return (
        <>
          <View style={estilos.linhaEntre}>
            <Text style={estilos.titulo}>Rotas</Text>
          </View>
          <Pressable style={estilos.card} onPress={() => setFluxo('detalhe')}>
            <View style={estilos.linhaEntre}>
              <Text style={estilos.valor}>{rota.id}</Text>
              <Badge status={rota.status} />
            </View>
            <Text style={[estilos.valor, estilos.margemTopo10]}>{rota.nome}</Text>
            <Text style={estilos.texto}>{rota.paradas.length} paradas - {rota.data} às {rota.horario}</Text>
          </Pressable>
          <Botao titulo="Nova rota" onPress={abrirCriacao} />
        </>
      );
    }

    if (aba === 'Motoristas') {
      return (
        <>
          <Text style={estilos.titulo}>Motoristas</Text>
          <Text style={estilos.subtitulo}>Equipe disponível para atribuições.</Text>
          <Text style={estilos.tituloSecao}>Equipe</Text>
          {motoristas.map(motorista => (
            <View key={motorista.id} style={estilos.card}>
              <Text style={estilos.valor}>{motorista.nome}</Text>
              <Text style={estilos.texto}>{motorista.veiculo}</Text>
              <Badge status="Programada" />
            </View>
          ))}
        </>
      );
    }

    if (aba === 'Perfil') {
      return (
        <>
          <Text style={estilos.titulo}>Perfil do gestor</Text>
          <View style={estilos.card}>
            <Text style={estilos.valor}>Rodrigo Matos</Text>
            <Text style={estilos.texto}>Gestor de operações</Text>
            <View style={estilos.separador} />
            <Text style={estilos.rotulo}>Empresa</Text>
            <Text style={estilos.texto}>RotaMestre Logística</Text>
            <Text style={estilos.rotulo}>Base</Text>
            <Text style={estilos.texto}>São José dos Campos</Text>
          </View>
          <Botao titulo="Sair da conta" secundario perigo onPress={onSair} />
        </>
      );
    }

    return (
      <>
        <Text style={estilos.titulo}>Visão da operação</Text>
        <Text style={estilos.subtitulo}>Acompanhe a programação de hoje.</Text>
        <View style={[estilos.grade, estilos.margemTopo18]}>
          <View style={estilos.metrica}>
            <Text style={estilos.metricaNumero}>1</Text>
            <Text style={estilos.metricaTexto}>Rotas programadas</Text>
          </View>
          <View style={estilos.metrica}>
            <Text style={estilos.metricaNumero}>{rota.paradas.length}</Text>
            <Text style={estilos.metricaTexto}>Entregas previstas</Text>
          </View>
          <View style={estilos.metrica}>
            <Text style={estilos.metricaNumero}>
              {rota.paradas.filter(item => item.status === 'Concluída').length}
            </Text>
            <Text style={estilos.metricaTexto}>Concluídas</Text>
          </View>
          <View style={estilos.metrica}>
            <Text style={estilos.metricaNumero}>{motoristas.length}</Text>
            <Text style={estilos.metricaTexto}>Motoristas</Text>
          </View>
        </View>
        <Text style={estilos.tituloSecao}>Rota de hoje</Text>
        <Pressable style={estilos.card} onPress={() => setFluxo('detalhe')}>
          <View style={estilos.linhaEntre}>
            <Text style={estilos.valor}>{rota.id}</Text>
            <Badge status={rota.status} />
          </View>
          <Text style={[estilos.valor, estilos.margemTopo10]}>{rota.nome}</Text>
          <Text style={estilos.texto}>{rota.paradas.length} paradas</Text>
        </Pressable>
        <Botao titulo="Criar rota" onPress={abrirCriacao} />
      </>
    );
  }

  return (
    <View style={estilos.tela}>
      <StatusBar barStyle="light-content" />
      <Cabecalho titulo="RotaMestre" subtitulo="Área do Gestor" />
      <ScrollView contentContainerStyle={estilos.conteudo}>
        {conteudoBase()}
      </ScrollView>
      <Abas
        itens={['Início', 'Rotas', 'Motoristas', 'Perfil']}
        ativa={aba}
        onPress={trocarAba}
      />
    </View>
  );
}
