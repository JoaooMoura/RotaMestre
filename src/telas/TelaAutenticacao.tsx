import React, {useEffect, useState} from 'react';
import {
  Alert,
  Pressable,
  ScrollView,
  StatusBar,
  Text,
  TextInput,
  TextInputProps,
  View,
} from 'react-native';
import {MaterialDesignIcons} from '@react-native-vector-icons/material-design-icons';
import MaskInput, {Mask, Masks} from 'react-native-mask-input';
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

type NomeIcone = React.ComponentProps<typeof MaterialDesignIcons>['name'];

const TOTAL_ETAPAS_CADASTRO = 3;

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
      Alert.alert('Código inválido', 'Digite um código com seis números.');
    }
  }

  const botaoVerSenha = (
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
  );

  if (etapa === 'splash') {
    return (
      <View style={estilos.loginRolagem}>
        <StatusBar barStyle="light-content" />
        <FaixaMarca />
      </View>
    );
  }

  if (etapa === 'concluido') {
    return (
      <LayoutAutenticacao>
        <View style={estilos.sucessoIcone}>
          <MaterialDesignIcons name="check" size={40} color={cores.sucesso} />
        </View>
        <Text style={estilos.loginTitulo} accessibilityRole="header">
          Cadastro realizado
        </Text>
        <Text style={estilos.loginApoio}>
          Seus dados foram registrados para a demonstração da Sprint 1.
        </Text>
        <BotaoPrincipal titulo="Ir para login" onPress={() => setEtapa('login')} />
      </LayoutAutenticacao>
    );
  }

  if (etapa === 'recuperar') {
    return (
      <LayoutAutenticacao
        titulo="Recuperar senha"
        apoio="Informe o e-mail da sua conta para receber as instruções."
        onVoltar={() => setEtapa('login')}>
        <Campo
          rotulo="E-mail"
          icone="email-outline"
          value={email}
          onChangeText={setEmail}
          keyboardType="email-address"
          autoCapitalize="none"
          autoComplete="email"
        />
        <BotaoPrincipal
          titulo="Enviar recuperação"
          onPress={() =>
            Alert.alert(
              'Recuperação de demonstração',
              'Nenhum e-mail é enviado nesta versão. Use a senha cadastrada para entrar.',
              [{text: 'Voltar para login', onPress: () => setEtapa('login')}],
            )
          }
        />
      </LayoutAutenticacao>
    );
  }

  if (etapa === 'codigo') {
    return (
      <LayoutAutenticacao
        titulo="Verifique seu acesso"
        apoio={`Conta: ${email}`}
        onVoltar={() => setEtapa('login')}>
        <View style={[estilos.loginErro, estilos.loginAviso]}>
          <MaterialDesignIcons
            name="information-outline"
            size={20}
            color={cores.primariaPressionada}
          />
          <Text style={[estilos.loginErroTexto, estilos.loginAvisoTexto]}>
            Versão de demonstração: nenhum código é enviado por e-mail. Digite
            quaisquer seis números para continuar.
          </Text>
        </View>
        <Campo
          rotulo="Código de confirmação"
          icone="shield-key-outline"
          estiloTexto={estilos.loginCampoCodigo}
          value={codigo}
          onChangeText={texto => setCodigo(texto.replace(/\D/g, '').slice(0, 6))}
          keyboardType="number-pad"
          placeholder="000000"
        />
        <BotaoPrincipal titulo="Confirmar acesso" onPress={confirmarCodigo} />
        <BotaoTexto
          titulo="Reenviar código"
          onPress={() =>
            Alert.alert(
              'Código de demonstração',
              'Nenhum e-mail é enviado nesta versão. Digite seis números quaisquer.',
            )
          }
        />
      </LayoutAutenticacao>
    );
  }

  if (etapa === 'cadastro1') {
    return (
      <LayoutAutenticacao
        key="cadastro1"
        titulo="Criar conta"
        etapaCadastro={1}
        onVoltar={() => setEtapa('login')}>
        <Text style={estilos.loginTitulo} accessibilityRole="header">
          Dados pessoais
        </Text>
        <Campo rotulo="Nome completo" icone="account-outline" value={nome} onChangeText={setNome} />
        <Campo
          rotulo="E-mail"
          icone="email-outline"
          value={email}
          onChangeText={setEmail}
          autoCapitalize="none"
          keyboardType="email-address"
        />
        <Campo
          rotulo="Telefone"
          icone="phone-outline"
          value={telefone}
          onChangeText={setTelefone}
          keyboardType="phone-pad"
          mascara={Masks.BRL_PHONE}
        />
        <Campo
          rotulo="Senha"
          icone="lock-outline"
          value={senha}
          onChangeText={setSenha}
          secureTextEntry={!senhaVisivel}
          autoCapitalize="none"
          acao={botaoVerSenha}
        />
        <BotaoPrincipal
          titulo="Continuar"
          onPress={() => {
            if (!nome || !email || !telefone || !senha) {
              Alert.alert('Campos obrigatórios', 'Preencha todos os campos.');
              return;
            }
            setEtapa('cadastro2');
          }}
        />
      </LayoutAutenticacao>
    );
  }

  if (etapa === 'cadastro2') {
    return (
      <LayoutAutenticacao
        key="cadastro2"
        titulo="Criar conta"
        etapaCadastro={2}
        onVoltar={() => setEtapa('cadastro1')}>
        <Text style={estilos.loginTitulo} accessibilityRole="header">
          Carteira de habilitação
        </Text>
        <Campo
          rotulo="Número da CNH"
          icone="card-account-details-outline"
          value={cnh}
          onChangeText={setCnh}
          keyboardType="number-pad"
          mascara={[/\d/, /\d/, /\d/, /\d/, /\d/, /\d/, /\d/, /\d/, /\d/, /\d/, /\d/]}
        />
        <Campo
          rotulo="Categoria"
          icone="certificate-outline"
          value={categoria}
          onChangeText={setCategoria}
          placeholder="Ex.: B"
          autoCapitalize="characters"
          maxLength={2}
        />
        <Campo
          rotulo="Data de validade"
          icone="calendar-outline"
          value={validade}
          onChangeText={setValidade}
          placeholder="DD/MM/AAAA"
          mascara={Masks.DATE_DDMMYYYY}
          keyboardType="number-pad"
        />
        <BotaoPrincipal
          titulo="Continuar"
          onPress={() => {
            if (!cnh || !categoria || !validade) {
              Alert.alert('Campos obrigatórios', 'Preencha os dados da CNH.');
              return;
            }
            setEtapa('cadastro3');
          }}
        />
      </LayoutAutenticacao>
    );
  }

  if (etapa === 'cadastro3') {
    return (
      <LayoutAutenticacao
        key="cadastro3"
        titulo="Criar conta"
        etapaCadastro={3}
        onVoltar={() => setEtapa('cadastro2')}>
        <Text style={estilos.loginTitulo} accessibilityRole="header">
          Veículo
        </Text>
        <Campo
          rotulo="Placa"
          icone="car-info"
          value={placa}
          onChangeText={setPlaca}
          autoCapitalize="characters"
          mascara={[/[a-zA-Z]/, /[a-zA-Z]/, /[a-zA-Z]/, '-', /\d/, /[a-zA-Z0-9]/, /\d/, /\d/]}
          placeholder="ABC-1A23 ou ABC-1234"
        />
        <Campo rotulo="Marca e modelo" icone="car-outline" value={modelo} onChangeText={setModelo} />
        <Campo
          rotulo="Ano"
          icone="calendar-blank-outline"
          value={ano}
          onChangeText={setAno}
          keyboardType="number-pad"
        />
        <BotaoPrincipal
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
      </LayoutAutenticacao>
    );
  }

  return (
    <LayoutAutenticacao>
      <Text style={estilos.loginTitulo} accessibilityRole="header">
        Entrar
      </Text>
      <Text style={estilos.loginApoio}>Use o e-mail e a senha da sua conta.</Text>

      <Campo
        rotulo="E-mail"
        icone="email-outline"
        value={email}
        onChangeText={setEmail}
        keyboardType="email-address"
        autoCapitalize="none"
        autoComplete="email"
      />
      <Campo
        rotulo="Senha"
        icone="lock-outline"
        value={senha}
        onChangeText={setSenha}
        secureTextEntry={!senhaVisivel}
        autoCapitalize="none"
        autoComplete="password"
        acao={botaoVerSenha}
      />

      {sessao.erro ? (
        <View style={estilos.loginErro} accessibilityLiveRegion="polite">
          <MaterialDesignIcons name="alert-circle-outline" size={20} color={cores.erro} />
          <Text style={estilos.loginErroTexto}>{sessao.erro}</Text>
        </View>
      ) : null}

      <BotaoPrincipal
        titulo={sessao.verificando ? 'Entrando...' : 'Entrar'}
        desabilitado={sessao.verificando}
        onPress={continuarLogin}
      />
      <BotaoTexto titulo="Esqueci minha senha" onPress={() => setEtapa('recuperar')} />

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
    </LayoutAutenticacao>
  );
}

// Componentes visuais do fluxo de autenticação: só aparência, sem regra de negócio.

function FaixaMarca() {
  return (
    <View style={estilos.loginFaixa}>
      <View style={estilos.loginMarcaLinha}>
        <MaterialDesignIcons name="map-marker-path" size={32} color="#FFFFFF" />
        <Text style={estilos.loginMarca} accessibilityRole="header">
          RotaMestre
        </Text>
      </View>
      <Text style={estilos.loginSlogan}>Sua rota do dia, entrega a entrega.</Text>
    </View>
  );
}

type LayoutAutenticacaoProps = {
  // Sem título, a faixa mostra a marca (login, splash e sucesso).
  titulo?: string;
  apoio?: string;
  onVoltar?: () => void;
  etapaCadastro?: number;
  children: React.ReactNode;
};

function LayoutAutenticacao({
  titulo,
  apoio,
  onVoltar,
  etapaCadastro,
  children,
}: LayoutAutenticacaoProps) {
  return (
    <ScrollView
      style={estilos.loginRolagem}
      contentContainerStyle={estilos.loginRolagemConteudo}
      keyboardShouldPersistTaps="handled">
      <StatusBar barStyle="light-content" />
      {titulo ? (
        <View style={[estilos.loginFaixa, onVoltar && estilos.loginFaixaComVoltar]}>
          {onVoltar ? (
            <Pressable
              onPress={onVoltar}
              accessibilityRole="button"
              accessibilityLabel="Voltar"
              style={({pressed}) => [
                estilos.loginVoltar,
                pressed && estilos.loginVoltarPressionado,
              ]}>
              <MaterialDesignIcons name="arrow-left" size={24} color="#FFFFFF" />
            </Pressable>
          ) : null}
          <Text style={estilos.loginMarca} accessibilityRole="header">
            {titulo}
          </Text>
          {apoio ? <Text style={estilos.loginSlogan}>{apoio}</Text> : null}
          {etapaCadastro ? <ProgressoCadastro etapa={etapaCadastro} /> : null}
        </View>
      ) : (
        <FaixaMarca />
      )}
      <View style={estilos.loginFolha}>{children}</View>
    </ScrollView>
  );
}

function ProgressoCadastro({etapa}: {etapa: number}) {
  const etapas = Array.from({length: TOTAL_ETAPAS_CADASTRO}, (_, indice) => indice + 1);
  return (
    <View
      accessibilityRole="progressbar"
      accessibilityLabel={`Etapa ${etapa} de ${TOTAL_ETAPAS_CADASTRO}`}
      accessibilityValue={{min: 1, max: TOTAL_ETAPAS_CADASTRO, now: etapa}}>
      <View style={estilos.loginProgresso}>
        {etapas.map(numero => (
          <View
            key={numero}
            style={[
              estilos.loginProgressoSegmento,
              numero <= etapa && estilos.loginProgressoSegmentoAtivo,
            ]}
          />
        ))}
      </View>
      <Text style={estilos.loginProgressoTexto}>
        Etapa {etapa} de {TOTAL_ETAPAS_CADASTRO}
      </Text>
    </View>
  );
}

type CampoProps = TextInputProps & {
  rotulo: string;
  icone: NomeIcone;
  mascara?: Mask;
  acao?: React.ReactNode;
  estiloTexto?: TextInputProps['style'];
};

function Campo({rotulo, icone, mascara, acao, estiloTexto, onFocus, onBlur, ...props}: CampoProps) {
  const [focado, setFocado] = useState(false);
  const propsEntrada: TextInputProps = {
    ...props,
    style: [estilos.loginCampoTexto, !acao && estilos.loginCampoTextoSemAcao, estiloTexto],
    placeholderTextColor: cores.contorno,
    accessibilityLabel: rotulo,
    onFocus: evento => {
      setFocado(true);
      onFocus?.(evento);
    },
    onBlur: evento => {
      setFocado(false);
      onBlur?.(evento);
    },
  };
  return (
    <>
      <Text style={estilos.loginRotulo}>{rotulo}</Text>
      <View style={[estilos.loginCampo, focado && estilos.loginCampoFocado]}>
        <MaterialDesignIcons
          name={icone}
          size={24}
          color={focado ? cores.primaria : cores.textoApoio}
        />
        {mascara ? (
          <MaskInput {...propsEntrada} mask={mascara} />
        ) : (
          <TextInput {...propsEntrada} />
        )}
        {acao}
      </View>
    </>
  );
}

type BotaoAutenticacaoProps = {
  titulo: string;
  onPress: () => void;
  desabilitado?: boolean;
};

function BotaoPrincipal({titulo, onPress, desabilitado}: BotaoAutenticacaoProps) {
  return (
    <Pressable
      accessibilityRole="button"
      disabled={desabilitado}
      onPress={onPress}
      style={({pressed}) => [
        estilos.loginBotao,
        pressed && estilos.loginBotaoPressionado,
        desabilitado && estilos.botaoDesabilitado,
      ]}>
      <Text style={estilos.loginBotaoTexto}>{titulo}</Text>
    </Pressable>
  );
}

function BotaoTexto({titulo, onPress}: BotaoAutenticacaoProps) {
  return (
    <Pressable style={estilos.loginLink} onPress={onPress} accessibilityRole="button">
      <Text style={estilos.loginLinkTexto}>{titulo}</Text>
    </Pressable>
  );
}
