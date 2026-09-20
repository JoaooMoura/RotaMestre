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
import {motoristas} from '../dados';
import {Parada, Rota, TipoParada} from '../tipos';
import {styles} from './TelaGestor.styles';

type TelaGestorProps = {
  onVoltar: () => void;
  onRotaAtribuida: (rota: Rota) => void;
};

export function TelaGestor({
  onVoltar,
  onRotaAtribuida,
}: TelaGestorProps) {
  const [nomeRota, setNomeRota] = useState('');
  const [tipoParada, setTipoParada] =
    useState<TipoParada>('Entrega');
  const [destinatario, setDestinatario] = useState('');
  const [endereco, setEndereco] = useState('');
  const [paradas, setParadas] = useState<Parada[]>([]);
  const [motoristaSelecionado, setMotoristaSelecionado] =
    useState('');

  function adicionarParada() {
    if (!destinatario.trim() || !endereco.trim()) {
      Alert.alert(
        'Dados incompletos',
        'Informe o destinatário e o endereço da parada.',
      );
      return;
    }

    const novaParada: Parada = {
      id: Date.now().toString(),
      tipo: tipoParada,
      destinatario: destinatario.trim(),
      endereco: endereco.trim(),
      janela: 'Sem janela definida',
      observacao: '',
      status: 'Pendente',
    };

    setParadas(paradasAtuais => [...paradasAtuais, novaParada]);
    setDestinatario('');
    setEndereco('');
  }

  function removerParada(id: string) {
    setParadas(paradasAtuais =>
      paradasAtuais.filter(parada => parada.id !== id),
    );
  }

  function atribuirRota() {
    if (!nomeRota.trim()) {
      Alert.alert('Nome obrigatório', 'Informe o nome da rota.');
      return;
    }

    if (paradas.length < 2) {
      Alert.alert(
        'Paradas insuficientes',
        'Cadastre pelo menos duas paradas.',
      );
      return;
    }

    if (!motoristaSelecionado) {
      Alert.alert(
        'Motorista obrigatório',
        'Selecione o motorista responsável.',
      );
      return;
    }

    const rota: Rota = {
      id: 'RT-001',
      nome: nomeRota.trim(),
      data: 'Hoje',
      horario: '08:00',
      motoristaId: motoristaSelecionado,
      paradas,
      status: 'Programada',
    };

    onRotaAtribuida(rota);
  }

  return (
    <ScrollView
      style={styles.tela}
      contentContainerStyle={styles.conteudo}
      keyboardShouldPersistTaps="handled">
      <StatusBar
        barStyle="light-content"
      />

      <View style={styles.cabecalho}>
        <Text style={styles.cabecalhoTitulo}>Nova rota</Text>
        <Text style={styles.cabecalhoSubtitulo}>Perfil Gestor</Text>
      </View>

      <View style={styles.card}>
        <Text style={styles.rotuloCampo}>Nome da rota</Text>

        <TextInput
          style={styles.input}
          value={nomeRota}
          onChangeText={setNomeRota}
          placeholder="Ex.: Entregas Vale do Paraíba"
          placeholderTextColor="#94A3B8"
        />

        <Text style={styles.tituloFormulario}>
          Adicionar parada
        </Text>

        <Text style={styles.rotuloCampo}>Tipo</Text>

        <View style={styles.linhaTipos}>
          <Pressable
            style={[
              styles.botaoTipo,
              tipoParada === 'Coleta' &&
                styles.botaoTipoSelecionado,
            ]}
            onPress={() => setTipoParada('Coleta')}>
            <Text
              style={[
                styles.textoTipo,
                tipoParada === 'Coleta' &&
                  styles.textoTipoSelecionado,
              ]}>
              Coleta
            </Text>
          </Pressable>

          <Pressable
            style={[
              styles.botaoTipo,
              tipoParada === 'Entrega' &&
                styles.botaoTipoSelecionado,
            ]}
            onPress={() => setTipoParada('Entrega')}>
            <Text
              style={[
                styles.textoTipo,
                tipoParada === 'Entrega' &&
                  styles.textoTipoSelecionado,
              ]}>
              Entrega
            </Text>
          </Pressable>
        </View>

        <Text style={styles.rotuloCampo}>
          Cliente ou destinatário
        </Text>

        <TextInput
          style={styles.input}
          value={destinatario}
          onChangeText={setDestinatario}
          placeholder="Nome do destinatário"
          placeholderTextColor="#94A3B8"
        />

        <Text style={styles.rotuloCampo}>Endereço</Text>

        <TextInput
          style={styles.input}
          value={endereco}
          onChangeText={setEndereco}
          placeholder="Endereço completo"
          placeholderTextColor="#94A3B8"
        />

        <Pressable
          style={styles.botaoAdicionar}
          onPress={adicionarParada}>
          <Text style={styles.textoBotaoPrimario}>
            Adicionar parada
          </Text>
        </Pressable>
      </View>

      <Text style={styles.tituloSecao}>
        Paradas cadastradas
      </Text>

      {paradas.length === 0 ? (
        <View style={styles.card}>
          <Text style={styles.estadoVazio}>
            Nenhuma parada cadastrada.
          </Text>
        </View>
      ) : (
        paradas.map((parada, index) => (
          <View key={parada.id} style={styles.cardParada}>
            <View style={styles.numeroParada}>
              <Text style={styles.numeroParadaTexto}>
                {index + 1}
              </Text>
            </View>

            <View style={styles.dadosParada}>
              <Text style={styles.tipoParada}>
                {parada.tipo}
              </Text>

              <Text style={styles.destinatario}>
                {parada.destinatario}
              </Text>

              <Text style={styles.endereco}>
                {parada.endereco}
              </Text>

              <Pressable
                onPress={() => removerParada(parada.id)}>
                <Text style={styles.remover}>Remover</Text>
              </Pressable>
            </View>
          </View>
        ))
      )}

      <Text style={styles.tituloSecao}>
        Atribuir motorista
      </Text>

      {motoristas.map(motorista => {
        const selecionado =
          motoristaSelecionado === motorista.id;

        return (
          <Pressable
            key={motorista.id}
            style={[
              styles.cardMotorista,
              selecionado &&
                styles.cardMotoristaSelecionado,
            ]}
            onPress={() =>
              setMotoristaSelecionado(motorista.id)
            }>
            <View style={styles.avatar}>
              <Text style={styles.avatarTexto}>
                {motorista.nome
                  .split(' ')
                  .slice(0, 2)
                  .map(nome => nome[0])
                  .join('')}
              </Text>
            </View>

            <View style={styles.dadosMotorista}>
              <Text style={styles.nomeMotorista}>
                {motorista.nome}
              </Text>

              <Text style={styles.veiculo}>
                {motorista.veiculo}
              </Text>

              <Text style={styles.disponivel}>
                Disponível
              </Text>
            </View>

            <View
              style={[
                styles.radio,
                selecionado && styles.radioSelecionado,
              ]}
            />
          </Pressable>
        );
      })}

      <Pressable
        style={styles.botaoPrimario}
        onPress={atribuirRota}>
        <Text style={styles.textoBotaoPrimario}>
          Criar e atribuir rota
        </Text>
      </Pressable>

      <Pressable
        style={styles.botaoSecundario}
        onPress={onVoltar}>
        <Text style={styles.textoBotaoSecundario}>
          Trocar perfil
        </Text>
      </Pressable>
    </ScrollView>
  );
}
