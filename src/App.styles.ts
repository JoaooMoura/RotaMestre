import {StatusBar, StyleSheet} from 'react-native';

export const styles = StyleSheet.create({
  tela: {
    flex: 1,
    backgroundColor: '#F8FAFC',
  },
  cabecalho: {
    backgroundColor: '#1D4ED8',
    paddingTop: (StatusBar.currentHeight ?? 0) + 20,
    paddingHorizontal: 20,
    paddingBottom: 24,
  },
  cabecalhoTitulo: {
    color: '#FFFFFF',
    fontSize: 26,
    fontWeight: '800',
  },
  cabecalhoSubtitulo: {
    color: '#BFDBFE',
    fontSize: 14,
    marginTop: 4,
  },
  conteudo: {
    flex: 1,
    padding: 20,
  },
  titulo: {
    color: '#1E293B',
    fontSize: 24,
    fontWeight: '800',
  },
  texto: {
    color: '#64748B',
    fontSize: 15,
    lineHeight: 22,
    marginTop: 8,
  },
  selecao: {
    flex: 1,
    backgroundColor: '#F8FAFC',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  logo: {
    width: 80,
    height: 80,
    borderRadius: 24,
    backgroundColor: '#1D4ED8',
    alignItems: 'center',
    justifyContent: 'center',
  },
  logoTexto: {
    color: '#FFFFFF',
    fontSize: 28,
    fontWeight: '800',
  },
  nome: {
    color: '#1E293B',
    fontSize: 36,
    fontWeight: '800',
    marginTop: 16,
  },
  nomeAzul: {
    color: '#1D4ED8',
  },
  descricao: {
    color: '#64748B',
    fontSize: 15,
    textAlign: 'center',
    marginTop: 8,
  },
  card: {
    width: '100%',
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    padding: 20,
    marginTop: 36,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  tituloCard: {
    color: '#1E293B',
    fontSize: 18,
    fontWeight: '700',
    marginBottom: 16,
  },
  botaoPrimario: {
    minHeight: 52,
    backgroundColor: '#1D4ED8',
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 18,
  },
  botaoSecundario: {
    minHeight: 52,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#1D4ED8',
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 12,
    paddingHorizontal: 18,
  },
  textoBotaoPrimario: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '700',
  },
  textoBotaoSecundario: {
    color: '#1D4ED8',
    fontSize: 16,
    fontWeight: '700',
  },
  aviso: {
    color: '#64748B',
    fontSize: 12,
    textAlign: 'center',
    marginTop: 20,
  },
});