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
import {MaterialDesignIcons} from '@react-native-vector-icons/material-design-icons';
import MaskInput, {Masks} from 'react-native-mask-input';
import {Botao, Cabecalho} from '../componentes';
import {cores, estilos} from '../estilos';
import {cadastrarMotorista} from '../servicos/api';
import {useSessao} from '../viewmodels/SessaoViewModel';

type Etapa =
  | 'splash'
  | 'login'
  | 'codigo'
  | 'recuperar'
  | 'cadastro1'
  | 'cadastro2'
  | 'cadastro3'
  | 'concluido';

export function TelaAutenticacao() {
  const sessao = useSessao();
  const [etapa, setEtapa] = useState<Etapa>('splash');
  const [email, setEmail] = useState('');
  const [senha, setSenha] = useState('');
  const [codigo, setCodigo] = useState('');
  const [nome, setNome] = useState('');
  const [telefone, setTelefone] = useState('');
  const [cnh, setCnh] = useState('');
  const [categoria, setCategoria] = useState('');
  const [validade, setValidade] = useState('');
  const [placa, setPlaca] = useState('');
  const [modelo, setModelo] = useState('');
  const [ano, setAno] = useState('');
  const [senhaVisivel, setSenhaVisivel] = useState(false);
  const [campoEmFoco, setCampoEmFoco] = useState<'email' | 'senha' | null>(null);

  useEffect(() => {
    const temporizador = setTimeout(() => setEtapa('login'), 900);
    return () => clearTimeout(temporizador);
  }, []);

  async function continuarLogin() {
    if (await sessao.verificarCredenciais(email, senha)) {
      setCodigo('');
      setEtapa('codigo');
    }
  }

  function confirmarCodigo() {
    if (!sessao.confirmarCodigo(codigo)) {
      Alert.alert('Código inválido', 'Digite os seis números recebidos.');
    }
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
      <ScrollView key="cadastro1" style={estilos.tela}>
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
          <MaskInput
            style={estilos.input}
            value={telefone}
            onChangeText={setTelefone}
            keyboardType="phone-pad"
            mask={Masks.BRL_PHONE}
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
      <ScrollView key="cadastro2" style={estilos.tela}>
        <Cabecalho titulo="Carteira de habilitação" subtitulo="Etapa 2 de 3" onVoltar={() => setEtapa('cadastro1')} />
        <View style={estilos.conteudo}>
          <Text style={estilos.rotulo}>Número da CNH</Text>
          <MaskInput style={estilos.input} value={cnh} onChangeText={setCnh} keyboardType="number-pad" mask={[/\d/, /\d/, /\d/, /\d/, /\d/, /\d/, /\d/, /\d/, /\d/, /\d/, /\d/]} />
          <Text style={estilos.rotulo}>Categoria</Text>
          <TextInput style={estilos.input} value={categoria} onChangeText={setCategoria} placeholder="Ex.: B" placeholderTextColor="#94A3B8" autoCapitalize="characters" maxLength={2} />
          <Text style={estilos.rotulo}>Data de validade</Text>
          <MaskInput style={estilos.input} value={validade} onChangeText={setValidade} placeholder="DD/MM/AAAA" placeholderTextColor="#94A3B8" mask={Masks.DATE_DDMMYYYY} keyboardType="number-pad" />
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
      <ScrollView key="cadastro3" style={estilos.tela}>
        <Cabecalho titulo="Veículo" subtitulo="Etapa 3 de 3" onVoltar={() => setEtapa('cadastro2')} />
        <View style={estilos.conteudo}>
          <Text style={estilos.rotulo}>Placa</Text>
          <MaskInput style={estilos.input} value={placa} onChangeText={setPlaca} autoCapitalize="characters" mask={[/[a-zA-Z]/, /[a-zA-Z]/, /[a-zA-Z]/, '-', /\d/, /[a-zA-Z0-9]/, /\d/, /\d/]} placeholder="ABC-1A23 ou ABC-1234" placeholderTextColor="#94A3B8" />
          <Text style={estilos.rotulo}>Marca e modelo</Text>
          <TextInput style={estilos.input} value={modelo} onChangeText={setModelo} />
          <Text style={estilos.rotulo}>Ano</Text>
          <TextInput style={estilos.input} value={ano} onChangeText={setAno} keyboardType="number-pad" />
          <Botao
            titulo="Finalizar cadastro"
            onPress={async () => {
              if (!placa || !modelo || !ano) {
                Alert.alert('Campos obrigatórios', 'Preencha os dados do veículo.');
                return;
              }
              try {
                await cadastrarMotorista({
                  id: Date.now().toString(),
                  nome,
                  email,
                  senha,
                  veiculo: `${modelo} • ${placa}`,
                  disponivel: true,
                  telefone,
                  cnhNumero: cnh,
                  cnhCategoria: categoria,
                  cnhValidade: validade,
                });
                setEtapa('concluido');
              } catch (e: any) {
                Alert.alert('Erro no cadastro', e.message);
              }
            }}
          />
        </View>
      </ScrollView>
    );
  }

  return (
    <ScrollView
      style={estilos.loginRolagem}
      contentContainerStyle={estilos.loginRolagemConteudo}
      keyboardShouldPersistTaps="handled">
      <StatusBar barStyle="light-content" />
      <View style={estilos.loginFaixa}>
        <View style={estilos.loginMarcaLinha}>
          <MaterialDesignIcons name="map-marker-path" size={32} color="#FFFFFF" />
          <Text style={estilos.loginMarca} accessibilityRole="header">
            RotaMestre
          </Text>
        </View>
        <Text style={estilos.loginSlogan}>Sua rota do dia, entrega a entrega.</Text>
      </View>

      <View style={estilos.loginFolha}>
        <Text style={estilos.loginTitulo} accessibilityRole="header">
          Entrar
        </Text>
        <Text style={estilos.loginApoio}>Use o e-mail e a senha da sua conta.</Text>

        <Text style={estilos.loginRotulo}>E-mail</Text>
        <View style={[estilos.loginCampo, campoEmFoco === 'email' && estilos.loginCampoFocado]}>
          <MaterialDesignIcons
            name="email-outline"
            size={24}
            color={campoEmFoco === 'email' ? cores.primaria : cores.textoApoio}
          />
          <TextInput
            style={[estilos.loginCampoTexto, estilos.loginCampoTextoSemAcao]}
            value={email}
            onChangeText={setEmail}
            onFocus={() => setCampoEmFoco('email')}
            onBlur={() => setCampoEmFoco(null)}
            keyboardType="email-address"
            autoCapitalize="none"
            autoComplete="email"
            accessibilityLabel="E-mail"
          />
        </View>

        <Text style={estilos.loginRotulo}>Senha</Text>
        <View style={[estilos.loginCampo, campoEmFoco === 'senha' && estilos.loginCampoFocado]}>
          <MaterialDesignIcons
            name="lock-outline"
            size={24}
            color={campoEmFoco === 'senha' ? cores.primaria : cores.textoApoio}
          />
          <TextInput
            style={estilos.loginCampoTexto}
            value={senha}
            onChangeText={setSenha}
            onFocus={() => setCampoEmFoco('senha')}
            onBlur={() => setCampoEmFoco(null)}
            secureTextEntry={!senhaVisivel}
            autoCapitalize="none"
            autoComplete="password"
            accessibilityLabel="Senha"
          />
          <Pressable
            style={estilos.loginAcaoCampo}
            onPress={() => setSenhaVisivel(visivel => !visivel)}
            accessibilityRole="button"
            accessibilityLabel={senhaVisivel ? 'Ocultar senha' : 'Mostrar senha'}>
            <MaterialDesignIcons
              name={senhaVisivel ? 'eye-off-outline' : 'eye-outline'}
              size={24}
              color={cores.textoApoio}
            />
          </Pressable>
        </View>

        {sessao.erro ? (
          <View style={estilos.loginErro} accessibilityLiveRegion="polite">
            <MaterialDesignIcons name="alert-circle-outline" size={20} color={cores.erro} />
            <Text style={estilos.loginErroTexto}>{sessao.erro}</Text>
          </View>
        ) : null}

        <Pressable
          accessibilityRole="button"
          disabled={sessao.verificando}
          onPress={continuarLogin}
          style={({pressed}) => [
            estilos.loginBotao,
            pressed && estilos.loginBotaoPressionado,
            sessao.verificando && estilos.botaoDesabilitado,
          ]}>
          <Text style={estilos.loginBotaoTexto}>
            {sessao.verificando ? 'Entrando...' : 'Entrar'}
          </Text>
        </Pressable>
        <Pressable
          style={estilos.loginLink}
          onPress={() => setEtapa('recuperar')}
          accessibilityRole="button">
          <Text style={estilos.loginLinkTexto}>Esqueci minha senha</Text>
        </Pressable>

        <View style={estilos.loginEspacador} />

        <View style={estilos.loginDivisor}>
          <View style={estilos.loginDivisorLinha} />
          <Text style={estilos.loginDivisorTexto}>Novo por aqui?</Text>
          <View style={estilos.loginDivisorLinha} />
        </View>
        <Pressable
          accessibilityRole="button"
          onPress={() => setEtapa('cadastro1')}
          style={({pressed}) => [
            estilos.loginBotaoContornado,
            pressed && estilos.loginBotaoContornadoPressionado,
          ]}>
          <Text style={estilos.loginBotaoContornadoTexto}>Criar conta de motorista</Text>
        </Pressable>
      </View>
    </ScrollView>
  );
}
