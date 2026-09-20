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
import {notificacoesIniciais} from '../dados';
import {cores, estilos} from '../estilos';
import {Parada, Rota, StatusParada, TipoParada} from '../tipos';

type Aba = 'Hoje' | 'Minha rota' | 'Notificações' | 'Perfil';
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

type Props = {
  rota: Rota;
  onAtualizarRota: (rota: Rota) => Promise<boolean>;
  onSair: () => void;
};

export function TelaMotorista({rota, onAtualizarRota, onSair}: Props) {
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
  const [assinatura, setAssinatura] = useState(false);
  const [foto, setFoto] = useState(false);

  const paradaSelecionada =
    rota.paradas.find(item => item.id === paradaId) ?? rota.paradas[0];
  const concluidas = rota.paradas.filter(item => item.status === 'Concluída').length;
  const progresso = rota.paradas.length ? (concluidas / rota.paradas.length) * 100 : 0;

  function atualizarStatusRota(status: Rota['status']) {
    return onAtualizarRota({...rota, status});
  }

  function atualizarParada(status: StatusParada) {
    const paradas = rota.paradas.map(item =>
      item.id === paradaSelecionada?.id ? {...item, status} : item,
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

  function trocarAba(item: string) {
    const novaAba = item as Aba;
    setAba(novaAba);
    setFluxo(novaAba === 'Minha rota' ? 'rota' : 'base');
  }

  function abrirParada(parada: Parada) {
    setParadaId(parada.id);
    setFluxo('detalhe');
  }

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
      <ScrollView style={estilos.tela}>
        <Cabecalho titulo="Assinatura do recebedor" onVoltar={() => setFluxo('status')} />
        <View style={estilos.conteudo}>
          <Text style={estilos.rotulo}>Nome do recebedor</Text>
          <TextInput style={estilos.input} value={nomeRecebedor} onChangeText={setNomeRecebedor} />
          <Pressable style={estilos.assinatura} onPress={() => setAssinatura(true)}>
            <Text style={assinatura ? estilos.assinaturaTexto : estilos.texto}>
              {assinatura ? nomeRecebedor || 'Assinatura' : 'Toque para simular a assinatura'}
            </Text>
          </Pressable>
          <Botao titulo="Limpar assinatura" secundario onPress={() => setAssinatura(false)} />
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
          <Pressable style={estilos.foto} onPress={() => setFoto(true)}>
            <Text style={estilos.fotoTexto}>
              {foto ? 'Comprovante anexado para demonstração' : 'Toque para simular uma foto'}
            </Text>
          </Pressable>
          {foto ? <Botao titulo="Remover foto" secundario perigo onPress={() => setFoto(false)} /> : null}
          <Botao
            titulo="Confirmar entrega"
            desabilitado={!foto}
            onPress={async () => {
              if (await atualizarParada('Concluída')) {
                setFluxo('concluida');
              }
            }}
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
              setAssinatura(false);
              setFoto(false);
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
        <Cabecalho titulo={ativa ? 'Rota em andamento' : 'Minha rota'} subtitulo={`${rota.id} - ${rota.nome}`} onVoltar={() => setFluxo('base')} />
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

    if (aba === 'Perfil') {
      return (
        <>
          <Text style={estilos.titulo}>Perfil</Text>
          <View style={estilos.card}>
            <Text style={estilos.valor}>Carlos Mendes</Text>
            <Text style={estilos.texto}>Motorista</Text>
            <View style={estilos.separador} />
            <Text style={estilos.rotulo}>Veículo</Text>
            <Text style={estilos.texto}>Mercedes-Benz Sprinter - ABC-1234</Text>
            <Text style={estilos.rotulo}>CNH</Text>
            <Text style={estilos.texto}>Categoria C - válida</Text>
          </View>
          <Botao titulo="Sair da conta" secundario perigo onPress={onSair} />
        </>
      );
    }

    if (aba === 'Minha rota') {
      return null;
    }

    return (
      <>
        <Text style={estilos.titulo}>Olá, Carlos</Text>
        <Text style={estilos.subtitulo}>Confira sua jornada programada.</Text>
        <View style={[estilos.grade, estilos.margemTopo18]}>
          <View style={estilos.metrica}>
            <Text style={estilos.metricaNumero}>{rota.paradas.length}</Text>
            <Text style={estilos.metricaTexto}>Paradas</Text>
          </View>
          <View style={estilos.metrica}>
            <Text style={estilos.metricaNumero}>{concluidas}</Text>
            <Text style={estilos.metricaTexto}>Concluídas</Text>
          </View>
          <View style={estilos.metrica}>
            <Text style={estilos.metricaNumero}>{rota.horario}</Text>
            <Text style={estilos.metricaTexto}>Início previsto</Text>
          </View>
          <View style={estilos.metrica}>
            <Text style={estilos.metricaNumero}>{rota.status === 'Concluída' ? '100%' : `${Math.round(progresso)}%`}</Text>
            <Text style={estilos.metricaTexto}>Progresso</Text>
          </View>
        </View>
        <Text style={estilos.tituloSecao}>Rota do dia</Text>
        <Pressable style={estilos.cardAzul} onPress={() => setFluxo('rota')}>
          <View style={estilos.linhaEntre}>
            <Text style={estilos.valor}>{rota.id}</Text>
            <Badge status={rota.status} />
          </View>
          <Text style={[estilos.valor, estilos.margemTopo10]}>{rota.nome}</Text>
          <Text style={estilos.texto}>{rota.paradas.length} paradas - início às {rota.horario}</Text>
        </Pressable>
        <Botao titulo="Ver minha rota" onPress={() => setFluxo('rota')} />
      </>
    );
  }

  return (
    <View style={estilos.tela}>
      <StatusBar barStyle="light-content" />
      <Cabecalho titulo="RotaMestre" subtitulo="Área do Motorista" />
      <ScrollView contentContainerStyle={estilos.conteudo}>
        {conteudoBase()}
      </ScrollView>
      <Abas
        itens={['Hoje', 'Minha rota', 'Notificações', 'Perfil']}
        ativa={aba}
        onPress={trocarAba}
      />
    </View>
  );
}
