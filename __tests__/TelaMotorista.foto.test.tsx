import React from 'react';
import {Alert} from 'react-native';
import {fireEvent, render, screen} from '@testing-library/react-native';
import {launchCamera, launchImageLibrary} from 'react-native-image-picker';
import {TelaMotorista} from '../src/telas/TelaMotorista';
import {Rota, Usuario} from '../src/tipos';

const ASSINATURA = 'data:image/png;base64,ASSINATURA';
const FOTO_MAX_BYTES = 512 * 1024;
const PREFIXO_JPEG = 'data:image/jpeg;base64,';

jest.mock('react-native-signature-canvas', () => {
  const ReactMock = require('react');
  const SignatureMock = ReactMock.forwardRef(
    (props: {onOK: (assinatura: string) => void}, ref: unknown) => {
      ReactMock.useImperativeHandle(ref, () => ({
        readSignature: () => props.onOK('data:image/png;base64,ASSINATURA'),
      }));
      return null;
    },
  );
  return {__esModule: true, default: SignatureMock};
});

jest.mock('react-native-image-picker', () => ({
  launchCamera: jest.fn(),
  launchImageLibrary: jest.fn(),
}));

jest.setTimeout(20000);

const camera = launchCamera as jest.Mock;
const galeria = launchImageLibrary as jest.Mock;

const usuario: Usuario = {
  id: '1',
  nome: 'Motorista Teste',
  email: 'motorista@rotamestre.com',
  papel: 'motorista',
};

const rota: Rota = {
  id: 'RT-001',
  nome: 'Rota de teste',
  data: 'Hoje',
  horario: '08:00',
  motoristaId: '1',
  status: 'Em andamento',
  paradas: [
    {
      id: 'P-1',
      tipo: 'Entrega',
      destinatario: 'Mercado Bom Preço',
      endereco: 'Rua A, 10',
      janela: '08:00 - 09:00',
      observacao: '',
      status: 'Pendente',
    },
    {
      id: 'P-2',
      tipo: 'Entrega',
      destinatario: 'Farmácia São Lucas',
      endereco: 'Rua B, 20',
      janela: '09:00 - 10:00',
      observacao: '',
      status: 'Pendente',
    },
  ],
};

function botao(nome: string) {
  return screen.getByRole('button', {name: nome});
}

async function renderizar(onAtualizarRota = jest.fn().mockResolvedValue(true)) {
  await render(
    <TelaMotorista
      usuario={usuario}
      rota={rota}
      onAtualizarRota={onAtualizarRota}
      onSair={jest.fn()}
    />,
  );
  return onAtualizarRota;
}

async function irParaFoto(destinatario = 'Mercado Bom Preço', recebedor = 'Maria') {
  await fireEvent.press(screen.getByText(destinatario));
  await fireEvent.press(botao('Confirmar chegada'));
  await fireEvent.press(botao('Atualizar status'));
  await fireEvent.press(screen.getByText('Entregue'));
  await fireEvent.press(botao('Confirmar status'));
  await fireEvent.changeText(screen.getByDisplayValue(''), recebedor);
  await fireEvent.press(botao('Confirmar traço'));
  await fireEvent.press(botao('Confirmar assinatura'));
  expect(screen.getByText('Foto do comprovante')).toBeOnTheScreen();
}

async function abrirTelaDaFoto(onAtualizarRota?: jest.Mock) {
  const atualizar = await renderizar(onAtualizarRota);
  await fireEvent.press(botao('Ver minha rota'));
  await irParaFoto();
  return atualizar;
}

function fotoTirada(base64: string, type: string | undefined = 'image/jpeg') {
  return {assets: [{base64, type, fileSize: base64.length}]};
}

async function tocarNaCamera() {
  await fireEvent.press(screen.getByText('Toque para fotografar o comprovante'));
}

let alerta: jest.SpyInstance;

beforeEach(() => {
  camera.mockReset();
  galeria.mockReset();
  alerta = jest.spyOn(Alert, 'alert').mockImplementation(() => {});
});

afterEach(() => {
  alerta.mockRestore();
});

describe('TelaMotorista - foto do comprovante (US07.04)', () => {
  test('renderiza a etapa da foto sem imagem anexada', async () => {
    await abrirTelaDaFoto();

    expect(screen.toJSON()).toMatchSnapshot();
    expect(botao('Confirmar entrega')).toBeDisabled();
    expect(botao('Escolher da galeria')).toBeOnTheScreen();
  });

  test('pede a câmera com compressão e Base64', async () => {
    camera.mockResolvedValue({didCancel: true});
    await abrirTelaDaFoto();

    await tocarNaCamera();

    expect(camera).toHaveBeenCalledWith({
      mediaType: 'photo',
      includeBase64: true,
      maxWidth: 1024,
      maxHeight: 1024,
      quality: 0.5,
    });
  });

  test('pede a galeria filtrando apenas JPEG e PNG', async () => {
    galeria.mockResolvedValue({didCancel: true});
    await abrirTelaDaFoto();

    await fireEvent.press(botao('Escolher da galeria'));

    expect(galeria).toHaveBeenCalledWith(
      expect.objectContaining({restrictMimeTypes: ['image/jpeg', 'image/png']}),
    );
  });

  describe('formato não suportado', () => {
    test.each(['image/heic', 'image/webp', 'image/gif'])(
      'recusa %s da galeria com aviso imediato',
      async tipo => {
        galeria.mockResolvedValue(fotoTirada('IMAGEM', tipo));
        await abrirTelaDaFoto();

        await fireEvent.press(botao('Escolher da galeria'));

        expect(alerta).toHaveBeenCalledWith(
          'Formato não suportado',
          'Escolha uma foto em JPEG ou PNG, ou use a câmera.',
        );
        expect(botao('Confirmar entrega')).toBeDisabled();
      },
    );

    test('a mesma regra vale para a câmera', async () => {
      camera.mockResolvedValue(fotoTirada('IMAGEM', 'image/heic'));
      await abrirTelaDaFoto();

      await tocarNaCamera();

      expect(alerta).toHaveBeenCalledWith(
        'Formato não suportado',
        'Escolha uma foto em JPEG ou PNG, ou use a câmera.',
      );
    });
  });

  describe('câmera cancelada', () => {
    test('não anexa foto, não alerta e mantém a entrega bloqueada', async () => {
      camera.mockResolvedValue({didCancel: true});
      await abrirTelaDaFoto();

      await tocarNaCamera();

      expect(alerta).not.toHaveBeenCalled();
      expect(screen.getByText('Toque para fotografar o comprovante')).toBeOnTheScreen();
      expect(botao('Confirmar entrega')).toBeDisabled();
    });

    test('cancelar a galeria também não anexa foto', async () => {
      galeria.mockResolvedValue({didCancel: true});
      await abrirTelaDaFoto();

      await fireEvent.press(botao('Escolher da galeria'));

      expect(alerta).not.toHaveBeenCalled();
      expect(botao('Confirmar entrega')).toBeDisabled();
    });
  });

  describe('erro da câmera', () => {
    test('mostra a mensagem da biblioteca e não anexa foto', async () => {
      camera.mockResolvedValue({
        errorCode: 'camera_unavailable',
        errorMessage: 'Câmera indisponível',
      });
      await abrirTelaDaFoto();

      await tocarNaCamera();

      expect(alerta).toHaveBeenCalledWith('Foto', 'Câmera indisponível');
      expect(botao('Confirmar entrega')).toBeDisabled();
    });

    test('usa mensagem padrão quando a biblioteca não informa o motivo', async () => {
      camera.mockResolvedValue({errorCode: 'permission'});
      await abrirTelaDaFoto();

      await tocarNaCamera();

      expect(alerta).toHaveBeenCalledWith('Foto', 'Não foi possível obter a foto.');
      expect(botao('Confirmar entrega')).toBeDisabled();
    });

    test('resposta sem Base64 é ignorada sem anexar foto', async () => {
      camera.mockResolvedValue({assets: [{uri: 'file:///foto.jpg', type: 'image/jpeg'}]});
      await abrirTelaDaFoto();

      await tocarNaCamera();

      expect(botao('Confirmar entrega')).toBeDisabled();
      expect(alerta).not.toHaveBeenCalled();
    });
  });

  describe('foto acima do limite', () => {
    test('recusa foto maior que 512 KB com alerta e mantém a entrega bloqueada', async () => {
      camera.mockResolvedValue(fotoTirada('A'.repeat(FOTO_MAX_BYTES)));
      await abrirTelaDaFoto();

      await tocarNaCamera();

      expect(alerta).toHaveBeenCalledWith(
        'Foto muito grande',
        'Tire outra foto mais próxima do comprovante.',
      );
      expect(screen.getByText('Toque para fotografar o comprovante')).toBeOnTheScreen();
      expect(botao('Confirmar entrega')).toBeDisabled();
    });

    test('aceita foto exatamente no limite (mesma regra do backend)', async () => {
      const base64 = 'A'.repeat(FOTO_MAX_BYTES - PREFIXO_JPEG.length);
      camera.mockResolvedValue(fotoTirada(base64));
      await abrirTelaDaFoto();

      await tocarNaCamera();

      expect(alerta).not.toHaveBeenCalled();
      expect(botao('Confirmar entrega')).toBeEnabled();
    });

    test('foto grande vinda da galeria também é recusada', async () => {
      galeria.mockResolvedValue(fotoTirada('A'.repeat(FOTO_MAX_BYTES), 'image/png'));
      await abrirTelaDaFoto();

      await fireEvent.press(botao('Escolher da galeria'));

      expect(alerta).toHaveBeenCalledWith(
        'Foto muito grande',
        'Tire outra foto mais próxima do comprovante.',
      );
      expect(botao('Confirmar entrega')).toBeDisabled();
    });
  });

  describe('caminho feliz e envio', () => {
    test('envia assinatura e foto junto com a conclusão da parada certa', async () => {
      camera.mockResolvedValue(fotoTirada('FOTO'));
      const atualizar = await abrirTelaDaFoto();

      await tocarNaCamera();
      await fireEvent.press(botao('Confirmar entrega'));

      expect(atualizar).toHaveBeenCalledTimes(1);
      const enviada: Rota = atualizar.mock.calls[0][0];
      expect(enviada.paradas[0]).toEqual({
        ...rota.paradas[0],
        status: 'Concluída',
        comprovante: {
          recebedor: 'Maria',
          assinatura: ASSINATURA,
          foto: `${PREFIXO_JPEG}FOTO`,
        },
      });
      expect(enviada.paradas[1]).toEqual(rota.paradas[1]);
      expect(screen.getByText('Entrega registrada')).toBeOnTheScreen();
    });

    test('foto PNG da galeria mantém o tipo no data URI', async () => {
      galeria.mockResolvedValue(fotoTirada('PNG', 'image/png'));
      const atualizar = await abrirTelaDaFoto();

      await fireEvent.press(botao('Escolher da galeria'));
      await fireEvent.press(botao('Confirmar entrega'));

      expect(atualizar.mock.calls[0][0].paradas[0].comprovante.foto).toBe(
        'data:image/png;base64,PNG',
      );
    });

    test('sem tipo informado, assume JPEG', async () => {
      camera.mockResolvedValue(fotoTirada('SEMTIPO', undefined));
      const atualizar = await abrirTelaDaFoto();

      await tocarNaCamera();
      await fireEvent.press(botao('Confirmar entrega'));

      expect(atualizar.mock.calls[0][0].paradas[0].comprovante.foto).toBe(
        `${PREFIXO_JPEG}SEMTIPO`,
      );
    });

    test('remover a foto volta ao estado inicial', async () => {
      camera.mockResolvedValue(fotoTirada('FOTO'));
      await abrirTelaDaFoto();

      await tocarNaCamera();
      await fireEvent.press(botao('Remover foto'));

      expect(screen.getByText('Toque para fotografar o comprovante')).toBeOnTheScreen();
      expect(botao('Escolher da galeria')).toBeOnTheScreen();
      expect(botao('Confirmar entrega')).toBeDisabled();
    });

    test('falha no envio mantém a foto na tela para tentar de novo', async () => {
      camera.mockResolvedValue(fotoTirada('FOTO'));
      const atualizar = await abrirTelaDaFoto(jest.fn().mockResolvedValue(false));

      await tocarNaCamera();
      await fireEvent.press(botao('Confirmar entrega'));

      expect(atualizar).toHaveBeenCalledTimes(1);
      expect(screen.getByText('Foto do comprovante')).toBeOnTheScreen();
      expect(botao('Remover foto')).toBeOnTheScreen();
      expect(botao('Confirmar entrega')).toBeEnabled();
    });

    test('toque duplo em "Confirmar entrega" envia a conclusão uma única vez', async () => {
      camera.mockResolvedValue(fotoTirada('FOTO'));
      const envioPendente = jest.fn(
        () => new Promise<boolean>(resolve => setTimeout(() => resolve(true), 100)),
      );
      await abrirTelaDaFoto(envioPendente);
      await tocarNaCamera();

      const confirmar = botao('Confirmar entrega');
      const primeiroToque = fireEvent.press(confirmar);
      await new Promise<void>(resolve => setTimeout(() => resolve(), 20));
      const segundoToque = fireEvent.press(confirmar);
      await Promise.all([primeiroToque, segundoToque]);

      expect(envioPendente).toHaveBeenCalledTimes(1);
    });

    test('a próxima parada começa sem a foto e a assinatura da anterior', async () => {
      camera.mockResolvedValue(fotoTirada('FOTO'));
      await abrirTelaDaFoto();

      await tocarNaCamera();
      await fireEvent.press(botao('Confirmar entrega'));
      await fireEvent.press(botao('Ir para próxima parada'));

      await fireEvent.press(screen.getByText('Farmácia São Lucas'));
      await fireEvent.press(botao('Confirmar chegada'));
      await fireEvent.press(botao('Atualizar status'));
      await fireEvent.press(screen.getByText('Entregue'));
      await fireEvent.press(botao('Confirmar status'));

      expect(botao('Confirmar traço')).toBeOnTheScreen();
      expect(botao('Confirmar assinatura')).toBeDisabled();
    });
  });
});
