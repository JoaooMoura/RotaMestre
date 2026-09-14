# RotaMestre

Plataforma para motoristas profissionais e gestores de frota, com recursos de planejamento de rotas, navegação, execução de entregas, comunicação e acompanhamento operacional.

O produto é composto por um aplicativo Android em React Native e um backend em Node.js. A experiência do gestor também prevê integração com uma solução web de gestão de frota.

## Protótipo navegável

O protótipo apresenta os principais fluxos iniciais do motorista e do gestor em formato mobile.

[Acessar o protótipo navegável no Figma](https://www.figma.com/make/1VkbUL3B6XL8jct0X9eRHj/Read-the-prompt?fullscreen=1&t=TtKunWDrsCcNMzIX-1&code-node-id=0-6)

## Escopo atual do protótipo

O protótipo já representa partes das seguintes macro-histórias:

| História | Funcionalidades representadas no protótipo |
|---|---|
| US01 | Cadastro de motorista, CNH e veículo; login; recuperação de senha; perfis Motorista e Gestor; confirmação por código de e-mail |
| US02 | Resumo diário do motorista |
| US05 | Criação e organização básica de rotas |
| US09 | Início, pausa e retomada da rota; adição e remoção de paradas durante a pausa |
| US11 | Consulta de paradas e atualização do status das entregas |
| US12 | Verificação visual de presença, assinatura do recebedor e foto do comprovante |
| US14 | Dashboard do gestor; atribuição e reatribuição de motoristas; central de notificações |

> A presença de uma macro-história nesta tabela não significa que todos os seus critérios estejam prototipados. O protótipo demonstra apenas as funcionalidades explicitamente listadas.

> A US14 prevê uma experiência web para o gestor no produto final. Na etapa atual, parte desse fluxo foi adaptada para mobile para permitir a validação inicial da interação.

## Backlog do produto

O backlog foi reconstruído a partir dos **88 requisitos do tema**:

- **78 requisitos funcionais:** RF01 a RF78;
- **10 requisitos não funcionais:** RNF01 a RNF10;
- **20 histórias de usuário:** US01 a US20;
- **0 requisitos sem cobertura.**

Requisitos repetidos ou muito próximos continuam identificados separadamente, mas podem ser atendidos pela mesma história. As histórias abaixo são macro-histórias e devem ser divididas em itens menores durante o refinamento das sprints.

### Histórias de alta prioridade

| ID | História de usuário | Requisitos cobertos |
|---|---|---|
| **US01 - Criar conta e acessar o sistema com segurança** | Como motorista, quero cadastrar minha conta e acessar o RotaMestre por um processo seguro, para utilizar minhas informações e rotas sem expor meus dados. | RF01, RF02, RF18, RF29, RF68, RF73 |
| **US02 - Consultar o resumo da jornada** | Como motorista, quero consultar um resumo atualizado da minha jornada, para conhecer rapidamente o trabalho previsto e o próximo compromisso. | RF03, RF23 |
| **US05 - Montar e otimizar uma rota** | Como motorista ou gestor, quero montar uma rota com vários destinos e obter uma sequência eficiente, para reduzir tempo e deslocamento no atendimento das paradas. | RF04, RF32, RF37, RF46, RF53, RF64 |
| **US07 - Visualizar e seguir a navegação da rota** | Como motorista, quero visualizar e seguir a rota com instruções claras, para chegar a cada destino com segurança e previsibilidade. | RF05, RF55, RF61, RF65 |
| **US08 - Manter a localização e corrigir desvios** | Como motorista, quero que o aplicativo acompanhe minha posição e corrija a rota quando eu me desviar, para continuar recebendo orientações úteis mesmo com variações do sinal. | RF06, RF63, RF72 |
| **US09 - Alterar e concluir o percurso em andamento** | Como motorista, quero ajustar uma rota já iniciada e calcular meu retorno, para reagir a imprevistos sem perder o progresso da viagem. | RF07, RF31, RF34, RF52, RF69, RF76 |
| **US10 - Trabalhar com conexão intermitente** | Como motorista, quero acessar os dados necessários da rota e registrar o trabalho mesmo com internet instável, para continuar a operação sem perder informações. | RF08, RF24, RF57, RF66 |
| **US11 - Executar paradas e atualizar entregas** | Como motorista, quero consultar minhas paradas e atualizar rapidamente cada atendimento, para manter a execução da rota organizada e visível à central. | RF09, RF11, RF60 |
| **US12 - Comprovar a entrega e a condição da carga** | Como motorista, quero registrar evidências da entrega, do veículo e da carga, para comprovar que a operação ocorreu nas condições informadas. | RF10, RF27, RF42, RF58 |
| **US13 - Comunicar ocorrências e compartilhar a viagem** | Como motorista, quero me comunicar e compartilhar informações da viagem com pessoas autorizadas, para coordenar o trabalho e pedir ajuda quando necessário. | RF12, RF14, RF39, RF48, RF67 |
| **US14 - Administrar e acompanhar a frota** | Como gestor de frota, quero atribuir rotas e acompanhar sua execução em uma visão web, para coordenar os motoristas e reagir a mudanças da operação. | RF19, RF25, RF40, RF49, RF59 |
| **US15 - Receber alertas sem aumentar a distração** | Como motorista, quero receber alertas relevantes e limitar interações arriscadas, para conduzir com mais segurança e menos distrações. | RF17, RF41, RF43, RF51, RF54 |
| **US20 - Utilizar um aplicativo confiável, seguro e atualizável** | Como motorista ou gestor, quero usar um aplicativo Android estável, seguro, eficiente e fácil de atualizar, para realizar minhas atividades sem travamentos, perda de dados ou exposição de informações. | RNF01 a RNF10 |

### Histórias de média prioridade

| ID | História de usuário | Requisitos cobertos |
|---|---|---|
| **US03 - Personalizar uma interface acessível** | Como motorista, quero adaptar idioma, aparência e acessibilidade do aplicativo, para utilizá-lo com conforto e autonomia. | RF20, RF22, RF78 |
| **US04 - Aprender a usar o aplicativo e obter suporte** | Como novo motorista, quero conhecer as funções do RotaMestre e acessar ajuda quando necessário, para usar o aplicativo corretamente antes e durante o trabalho. | RF30, RF50, RF74 |
| **US06 - Planejar viagens para caminhões e passageiros** | Como motorista profissional, quero planejar a rota de acordo com o tipo e as características do veículo, para receber um percurso compatível com minha operação. | RF21, RF38 |
| **US16 - Consultar trânsito, clima e pontos de interesse** | Como motorista, quero consultar condições e serviços relevantes ao longo da rota, para escolher melhor o percurso e planejar minhas paradas. | RF35, RF45, RF56, RF62 |
| **US17 - Consultar telemetria e histórico das viagens** | Como motorista, quero consultar o histórico e os indicadores das minhas viagens, para prestar contas e identificar oportunidades de melhoria. | RF13, RF15, RF28, RF70, RF71 |
| **US18 - Analisar resultados e fornecer feedback** | Como motorista ou gestor, quero analisar resultados e registrar avaliações sobre entregas e rotas, para acompanhar o desempenho e melhorar o serviço. | RF16, RF26, RF36, RF44, RF77 |
| **US19 - Planejar custos e manutenção do veículo** | Como motorista, quero acompanhar custos previstos e necessidades de manutenção, para planejar a viagem e cuidar do veículo. | RF33, RF47, RF75 |

## Critérios de aceite resumidos

### US01 - Conta e acesso

- Cadastrar dados pessoais, CNH e veículo com validação local e no servidor.
- Entrar com e-mail e senha, recuperar a senha e manter a sessão quando autorizado.
- Exigir segundo fator por e-mail ou SMS e permitir login associado ao Google.
- Proteger credenciais, dados pessoais e localização no dispositivo e na comunicação.

### US02 - Resumo da jornada

- Exibir viagens ou entregas do dia, quilômetros previstos e estimativa de término.
- Diferenciar carregamento, ausência de programação e erro de comunicação.
- Mostrar próximo destino e ETA em um widget Android com proteção de privacidade.

### US03 - Personalização e acessibilidade

- Disponibilizar português, inglês e espanhol.
- Aplicar modo escuro com contraste adequado em todas as telas.
- Permitir TalkBack e fontes ajustáveis sem ocultar ações essenciais.

### US04 - Aprendizado e suporte

- Apresentar tutorial no primeiro acesso e permitir sua consulta posterior.
- Simular uma rota sem GPS em um modo claramente identificado como demonstração.
- Oferecer perguntas frequentes e formulário de contato com confirmação de envio.

### US05 - Planejamento e otimização

- Receber destinos manualmente ou por CSV/Excel e identificar entradas inválidas.
- Permitir favoritos, agrupamento de entregas próximas e reordenação manual.
- Calcular a sequência considerando distância, tempo, janelas e perfil de condução.
- Informar paradas ou restrições inviáveis sem apresentar uma rota impossível como válida.

### US06 - Caminhões e passageiros

- Considerar altura, peso, comprimento e tipo de carga quando houver dados viários confiáveis.
- Indicar quando não houver informação suficiente para garantir a passagem do caminhão.
- No modo passageiro, respeitar embarques, desembarques, lotação e preferências cadastradas.

### US07 - Navegação

- Exibir origem, destino, paradas e trajeto em mapa interativo.
- Fornecer instruções visuais e por voz para cada manobra.
- Atualizar o ETA por destino e oferecer vista 3D quando suportada.

### US08 - Localização e desvios

- Acompanhar a localização, inclusive em segundo plano quando permitido.
- Recalcular a rota após desvio acima da tolerância configurada.
- Combinar sensores e usar dead reckoning temporário quando o GPS estiver instável.
- Identificar posição estimada, falta de permissão, perda de sinal e falha de recálculo.

### US09 - Alterações durante a rota

- Adicionar paradas e pontos sugeridos e recalcular a partir da posição atual.
- Pausar, alterar e retomar a rota preservando o trabalho concluído.
- Calcular o retorno ao ponto de partida, considerando trânsito quando disponível.
- Manter a última rota válida se a alteração falhar.

### US10 - Operação com rede intermitente

- Baixar rota, entregas e mapa antes da viagem.
- Manter disponíveis os dados baixados e armazenar operações offline permitidas.
- Sincronizar ao reconectar sem perder silenciosamente conflitos ou rejeições.
- Oferecer cache de mapas, atualizações em segundo plano e economia de dados.

### US11 - Paradas e status

- Listar endereço, destinatário, instruções e status de cada parada.
- Ler QR Code ou código de barras sem alterar itens quando o código for inválido.
- Enviar mensagens rápidas de status e refletir mudanças confirmadas no servidor.

### US12 - Evidências da operação

- Coletar assinatura, foto do comprovante e validação geográfica da entrega.
- Registrar fotos do veículo ou da carga no início e no fim da viagem.
- Anexar documentos fiscais por foto ou código de barras.
- Mostrar o estado de envio e preservar evidências pendentes.

### US13 - Comunicação e emergência

- Permitir chat com texto, fotos e localização e iniciar chamadas telefônicas.
- Compartilhar rota com motoristas autorizados e gerar link temporário de acompanhamento.
- Enviar alerta de pânico com a localização mais recente para central e contatos.
- Não confirmar falsamente o envio quando houver falha de rede ou localização.

### US14 - Gestão da frota

- Atribuir e reatribuir rotas preservando registros já realizados.
- Notificar o motorista sobre atribuições, inclusões e cancelamentos.
- Exibir no mapa motoristas, atualização da posição, rota e status das tarefas.
- Sincronizar aplicativo e sistema web e impedir acesso a equipes não autorizadas.

### US15 - Alertas e condução segura

- Alertar aproximação, desvio e excesso de velocidade.
- Exibir limites, radares e rodízio somente com fonte identificada.
- Permitir alertas personalizados e modo soneca sem ocultar eventos críticos.
- Restringir digitação em movimento sem bloquear o botão de pânico.

### US16 - Contexto da rota

- Exibir trânsito em tempo real e comparar alternativas por tempo e distância.
- Mostrar previsão do tempo com horário de referência.
- Filtrar postos, descanso e alimentação; indicar fonte e atualização de preços.
- Identificar indisponibilidade de dados externos.

### US17 - Telemetria e histórico

- Registrar telemetria, trajeto, duração, quilometragem e eventos da viagem.
- Filtrar viagens e reproduzir o percurso no mapa.
- Manter histórico de rotas visualizadas e tempo gasto por etapa.
- Identificar lacunas de telemetria sem inventar dados.

### US18 - Relatórios e feedback

- Gerar relatório de atividades por período e exportá-lo em PDF.
- Enviar relatório semanal com pontualidade, eficiência e feedback dos clientes.
- Registrar avaliação da entrega e feedback sobre a rota.
- Apresentar mapa de calor e indicar como métricas e pontuações foram calculadas.

### US19 - Custos e manutenção

- Estimar combustível com base em distância, consumo e preço informado.
- Comparar combustível e pedágios com o orçamento e alertar ultrapassagens.
- Gerar lembretes de manutenção por quilometragem e sugerir oficinas disponíveis.

### US20 - Qualidade do produto

- Manter backend Node.js, aplicativo React Native, responsabilidades separadas e código versionado.
- Distribuir APK Android compatível com as versões-alvo.
- Manter fluidez em dispositivo de baixo custo e proteger dados sensíveis.
- Cobrir regras, APIs e fluxos críticos com testes adequados.
- Aplicar interface de baixa distração, arquitetura definida e documentação atualizada.
- Reduzir consumo de bateria e dados e permitir atualizações OTA compatíveis com a plataforma.

## Critérios transversais

1. Carregamento, ausência de dados, falta de permissão, operação offline e erro devem ser estados visualmente diferentes.
2. Nenhuma operação pode ser apresentada como concluída antes da confirmação local ou do servidor aplicável ao fluxo.
3. Dados inválidos devem ser recusados no aplicativo e no backend.
4. Localização e dados pessoais só podem ser acessados por usuários e contatos autorizados.
5. Trânsito, clima, radares, restrições, preços e oficinas devem indicar indisponibilidade ou data da atualização.
6. Alterações em qualquer US devem preservar testes, acessibilidade, segurança, desempenho e documentação previstos na US20.
7. Funcionalidades em segundo plano devem respeitar as permissões, limitações e políticas do Android.

## Rastreabilidade

### Requisitos funcionais

| US | Requisitos funcionais |
|---|---|
| US01 | RF01, RF02, RF18, RF29, RF68, RF73 |
| US02 | RF03, RF23 |
| US03 | RF20, RF22, RF78 |
| US04 | RF30, RF50, RF74 |
| US05 | RF04, RF32, RF37, RF46, RF53, RF64 |
| US06 | RF21, RF38 |
| US07 | RF05, RF55, RF61, RF65 |
| US08 | RF06, RF63, RF72 |
| US09 | RF07, RF31, RF34, RF52, RF69, RF76 |
| US10 | RF08, RF24, RF57, RF66 |
| US11 | RF09, RF11, RF60 |
| US12 | RF10, RF27, RF42, RF58 |
| US13 | RF12, RF14, RF39, RF48, RF67 |
| US14 | RF19, RF25, RF40, RF49, RF59 |
| US15 | RF17, RF41, RF43, RF51, RF54 |
| US16 | RF35, RF45, RF56, RF62 |
| US17 | RF13, RF15, RF28, RF70, RF71 |
| US18 | RF16, RF26, RF36, RF44, RF77 |
| US19 | RF33, RF47, RF75 |

### Requisitos não funcionais

| Requisito | Cobertura principal |
|---|---|
| RNF01 | US20 e critério transversal 6 |
| RNF02 | US20 |
| RNF03 | US07, US08, US17 e US20 |
| RNF04 | US01, US10, US12, US13, US14, US17 e US20 |
| RNF05 | US10, US12 e US20 |
| RNF06 | US20 e critério transversal 6 |
| RNF07 | US03, US07, US11, US15 e US20 |
| RNF08 | US20 e critério transversal 6 |
| RNF09 | US08, US10, US14, US17 e US20 |
| RNF10 | US20 |

## Conferência de cobertura

| Conjunto | Esperado | Mapeado | Sem cobertura |
|---|---:|---:|---:|
| Requisitos funcionais | 78 | 78 | 0 |
| Requisitos não funcionais | 10 | 10 | 0 |
| **Total** | **88** | **88** | **0** |

## Tecnologias previstas

- **Aplicativo:** React Native para Android;
- **Backend:** Node.js;
- **Autenticação:** JWT, recuperação de senha e segundo fator;
- **Mapas e localização:** mapas interativos, GPS e sensores do dispositivo;
- **Persistência offline:** banco local e sincronização posterior;
- **Comunicação:** notificações push e comunicação em tempo real;
- **Qualidade:** testes unitários, de integração e de interface;
- **Organização:** versionamento Git, separação de responsabilidades, arquitetura definida e documentação.

## Observação de planejamento

Este README apresenta o backlog do produto, não uma promessa de entrega por sprint. Por agruparem os 88 requisitos em apenas 20 itens, várias US possuem tamanho de épico e deverão ser refinadas e divididas antes da estimativa e da distribuição em sprints.
