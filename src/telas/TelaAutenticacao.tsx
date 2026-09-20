import React, {useEffect, useState} from 'react';
import {
  Alert,
  Pressable,
  ScrollView,
  StatusBar,
  Text,
  TextInput,
  View,
} from 'react-native';
import {Botao, Cabecalho} from '../componentes';
import {estilos} from '../estilos';
import {Perfil} from '../tipos';

type Etapa =
  | 'splash'
  | 'login'
  | 'codigo'
  | 'recuperar'
  | 'cadastro1'
  | 'cadastro2'
  | 'cadastro3'
  | 'concluido';

type Props = {
  onEntrar: (perfil: Perfil) => void;
};

export function TelaAutenticacao({onEntrar}: Props) {
  const [etapa, setEtapa] = useState<Etapa>('splash');
  const [perfil, setPerfil] = useState<Perfil>('motorista');
  const [email, setEmail] = useState('motorista@rotamestre.com');
  const [senha, setSenha] = useState('123456');
  const [codigo, setCodigo] = useState('');
  const [nome, setNome] = useState('');
  const [telefone, setTelefone] = useState('');
  const [cnh, setCnh] = useState('');
  const [categoria, setCategoria] = useState('');
  const [validade, setValidade] = useState('');
  const [placa, setPlaca] = useState('');
  const [modelo, setModelo] = useState('');
  const [ano, setAno] = useState('');

  useEffect(() => {
    const temporizador = setTimeout(() => setEtapa('login'), 900);
    return () => clearTimeout(temporizador);
  }, []);

  function continuarLogin() {
    if (!email.trim() || !senha.trim()) {
      Alert.alert('Dados obrigatórios', 'Informe o e-mail e a senha.');
      return;
    }
    setEtapa('codigo');
  }

  function confirmarCodigo() {
    if (codigo.length !== 6) {
      Alert.alert('Código inválido', 'Digite os seis números recebidos.');
      return;
    }
    onEntrar(perfil);
  }

  if (etapa === 'splash') {
    return (
      <View style={estilos.centro}>
        <StatusBar barStyle="dark-content" />
        <View style={estilos.logo}>
          <Text style={estilos.logoTexto}>RM</Text>
        </View>
        <Text style={estilos.marca}>
          <Text style={estilos.marcaAzul}>Rota</Text>Mestre
        </Text>
        <Text style={estilos.subtitulo}>Gestão inteligente de rotas e entregas</Text>
      </View>
    );
  }

  if (etapa === 'concluido') {
    return (
      <View style={estilos.centro}>
        <View style={estilos.sucessoIcone}>
          <Text style={estilos.sucessoIconeTexto}>✓</Text>
        </View>
        <Text style={estilos.titulo}>Cadastro realizado</Text>
        <Text style={[estilos.subtitulo, estilos.textoCentral]}>
          Seus dados foram registrados para a demonstração da Sprint 1.
        </Text>
        <View style={estilos.larguraTotalTopo18}>
          <Botao titulo="Ir para login" onPress={() => setEtapa('login')} />
        </View>
      </View>
    );
  }

  if (etapa === 'recuperar') {
    return (
      <View style={estilos.tela}>
        <Cabecalho titulo="Recuperar senha" onVoltar={() => setEtapa('login')} />
        <View style={estilos.conteudo}>
          <Text style={estilos.subtitulo}>
            Informe seu e-mail para receber as instruções de recuperação.
          </Text>
          <Text style={estilos.rotulo}>E-mail</Text>
          <TextInput
            style={estilos.input}
            value={email}
            onChangeText={setEmail}
            keyboardType="email-address"
            autoCapitalize="none"
          />
          <Botao
            titulo="Enviar recuperação"
            onPress={() =>
              Alert.alert(
                'Solicitação enviada',
                'Enviamos as instruções de recuperação para seu e-mail.',
                [{text: 'Voltar para login', onPress: () => setEtapa('login')}],
              )
            }
          />
        </View>
      </View>
    );
  }

  if (etapa === 'codigo') {
    return (
      <View style={estilos.tela}>
        <Cabecalho titulo="Verifique seu acesso" onVoltar={() => setEtapa('login')} />
        <View style={estilos.conteudo}>
          <Text style={estilos.subtitulo}>
            Um código de seis números foi enviado para {email}.
          </Text>
          <Text style={estilos.rotulo}>Código de confirmação</Text>
          <TextInput
            style={estilos.input}
            value={codigo}
            onChangeText={texto => setCodigo(texto.replace(/\D/g, '').slice(0, 6))}
            keyboardType="number-pad"
            placeholder="000000"
            placeholderTextColor="#94A3B8"
          />
          <Botao titulo="Confirmar acesso" onPress={confirmarCodigo} />
          <Pressable
            onPress={() => Alert.alert('Código reenviado', 'Confira novamente seu e-mail.')}>
            <Text style={estilos.link}>Reenviar código</Text>
          </Pressable>
        </View>
      </View>
    );
  }

  if (etapa === 'cadastro1') {
    return (
      <ScrollView style={estilos.tela}>
        <Cabecalho titulo="Dados pessoais" subtitulo="Etapa 1 de 3" onVoltar={() => setEtapa('login')} />
        <View style={estilos.conteudo}>
          <Text style={estilos.rotulo}>Nome completo</Text>
          <TextInput style={estilos.input} value={nome} onChangeText={setNome} />
          <Text style={estilos.rotulo}>E-mail</Text>
          <TextInput
            style={estilos.input}
            value={email}
            onChangeText={setEmail}
            autoCapitalize="none"
            keyboardType="email-address"
          />
          <Text style={estilos.rotulo}>Telefone</Text>
          <TextInput
            style={estilos.input}
            value={telefone}
            onChangeText={setTelefone}
            keyboardType="phone-pad"
          />
          <Text style={estilos.rotulo}>Senha</Text>
          <TextInput style={estilos.input} value={senha} onChangeText={setSenha} secureTextEntry />
          <Botao
            titulo="Continuar"
            onPress={() => {
              if (!nome || !email || !telefone || !senha) {
                Alert.alert('Campos obrigatórios', 'Preencha todos os campos.');
                return;
              }
              setEtapa('cadastro2');
            }}
          />
        </View>
      </ScrollView>
    );
  }

  if (etapa === 'cadastro2') {
    return (
      <ScrollView style={estilos.tela}>
        <Cabecalho titulo="Carteira de habilitação" subtitulo="Etapa 2 de 3" onVoltar={() => setEtapa('cadastro1')} />
        <View style={estilos.conteudo}>
          <Text style={estilos.rotulo}>Número da CNH</Text>
          <TextInput style={estilos.input} value={cnh} onChangeText={setCnh} keyboardType="number-pad" />
          <Text style={estilos.rotulo}>Categoria</Text>
          <TextInput style={estilos.input} value={categoria} onChangeText={setCategoria} placeholder="Ex.: B" placeholderTextColor="#94A3B8" />
          <Text style={estilos.rotulo}>Data de validade</Text>
          <TextInput style={estilos.input} value={validade} onChangeText={setValidade} placeholder="DD/MM/AAAA" placeholderTextColor="#94A3B8" />
          <Botao
            titulo="Continuar"
            onPress={() => {
              if (!cnh || !categoria || !validade) {
                Alert.alert('Campos obrigatórios', 'Preencha os dados da CNH.');
                return;
              }
              setEtapa('cadastro3');
            }}
          />
        </View>
      </ScrollView>
    );
  }

  if (etapa === 'cadastro3') {
    return (
      <ScrollView style={estilos.tela}>
        <Cabecalho titulo="Veículo" subtitulo="Etapa 3 de 3" onVoltar={() => setEtapa('cadastro2')} />
        <View style={estilos.conteudo}>
          <Text style={estilos.rotulo}>Placa</Text>
          <TextInput style={estilos.input} value={placa} onChangeText={setPlaca} autoCapitalize="characters" />
          <Text style={estilos.rotulo}>Marca e modelo</Text>
          <TextInput style={estilos.input} value={modelo} onChangeText={setModelo} />
          <Text style={estilos.rotulo}>Ano</Text>
          <TextInput style={estilos.input} value={ano} onChangeText={setAno} keyboardType="number-pad" />
          <Botao
            titulo="Finalizar cadastro"
            onPress={() => {
              if (!placa || !modelo || !ano) {
                Alert.alert('Campos obrigatórios', 'Preencha os dados do veículo.');
                return;
              }
              setEtapa('concluido');
            }}
          />
        </View>
      </ScrollView>
    );
  }

  return (
    <ScrollView style={estilos.tela} contentContainerStyle={estilos.conteudo}>
      <StatusBar barStyle="dark-content" />
      <View style={estilos.marcaContainer}>
        <View style={estilos.logo}>
          <Text style={estilos.logoTexto}>RM</Text>
        </View>
        <Text style={estilos.marca}>
          <Text style={estilos.marcaAzul}>Rota</Text>Mestre
        </Text>
      </View>
      <View style={estilos.card}>
        <Text style={estilos.titulo}>Acessar conta</Text>
        <Text style={estilos.rotulo}>Perfil da demonstração</Text>
        <View style={estilos.linha}>
          <Pressable
            style={[estilos.opcao, estilos.flex, perfil === 'motorista' && estilos.opcaoAtiva]}
            onPress={() => setPerfil('motorista')}>
            <Text style={estilos.opcaoTexto}>Motorista</Text>
          </Pressable>
          <View style={estilos.espacadorHorizontal} />
          <Pressable
            style={[estilos.opcao, estilos.flex, perfil === 'gestor' && estilos.opcaoAtiva]}
            onPress={() => setPerfil('gestor')}>
            <Text style={estilos.opcaoTexto}>Gestor</Text>
          </Pressable>
        </View>
        <Text style={estilos.rotulo}>E-mail</Text>
        <TextInput
          style={estilos.input}
          value={email}
          onChangeText={setEmail}
          keyboardType="email-address"
          autoCapitalize="none"
        />
        <Text style={estilos.rotulo}>Senha</Text>
        <TextInput style={estilos.input} value={senha} onChangeText={setSenha} secureTextEntry />
        <Botao titulo="Entrar" onPress={continuarLogin} />
        <Pressable onPress={() => setEtapa('recuperar')}>
          <Text style={estilos.link}>Esqueci minha senha</Text>
        </Pressable>
        <Botao titulo="Criar conta de motorista" secundario onPress={() => setEtapa('cadastro1')} />
      </View>
    </ScrollView>
  );
}
