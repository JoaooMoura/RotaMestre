# RotaMestre

<br>

## 🌀 Protótipo Navegável
**:link: Clique no link abaixo para visualizar o Protótipo Navegável do projeto:**  
> [Protótipo Navegável](https://www.figma.com/make/1VkbUL3B6XL8jct0X9eRHj/Read-the-prompt?fullscreen=1&t=TtKunWDrsCcNMzIX-1&code-node-id=0-6)

<br>

---

## 📱 Escopo do Protótipo

O protótipo atual representa a **Sprint 1 — Fundação e operação básica** do RotaMestre, em formato **mobile**, com foco nos principais fluxos de uso do motorista e do gestor. **É um único aplicativo com dois tipos de conta (motorista e gestor), sem painel web separado.**

### ✅ O que já está prototipado

- Cadastro de motorista, CNH e veículo;
- Login com e-mail e senha conferidos no servidor (bcrypt + JWT), com o papel **Motorista** ou **Gestor** definido pelo backend — cada papel acessa apenas as operações autorizadas;
- Confirmação de acesso por código enviado por e-mail (**simulada**: nenhum e-mail é enviado e qualquer código de 6 dígitos é aceito);
- Recuperação de senha (**simulada**: apenas exibe a confirmação, sem envio de e-mail);
- Resumo diário do motorista;
- Central de notificações;
- Consulta da rota e das paradas;
- Início, pausa e retomada da rota;
- Adição e remoção de paradas durante a pausa;
- Atualização do status das entregas;
- Verificação visual de presença no destino;
- Coleta de assinatura do recebedor;
- Anexo de foto do comprovante;
- Telas de gestão da frota (criação/atribuição de rotas) dentro do próprio app.

### 🔐 Executando localmente

1. Copie `backend/.env.example` para `backend/.env` e preencha `JWT_SECRET` (o próprio arquivo traz o comando para gerar um segredo).
2. Na pasta `backend/`, rode `npm install` e `npm start`.
3. Com `ROTAMESTRE_SEED_DEMO=1`, o backend cria as contas de demonstração abaixo (senha `123`). Não habilite essa opção em servidor público.

| Papel | E-mail |
| :--- | :--- |
| Gestor | `gestor@rotamestre.com` |
| Motorista | `motorista@rotamestre.com` |

A sessão fica apenas em memória: ao fechar o aplicativo é preciso entrar novamente (manter a sessão salva no aparelho está previsto junto com o modo offline da Sprint 2).

### 🚧 Próximas etapas

As funcionalidades de **mapa, navegação, localização contínua, recálculo de rota e operação offline** estão previstas para a Sprint 2. Recursos como **chat, botão de pânico, histórico de viagens, acompanhamento de frota e acessibilidade avançada** fazem parte da Sprint 3. O restante dos requisitos do documento (não essenciais ao MVP) está listado na seção **Backlog Pós-MVP**, ao final deste documento.

<br>

---

## 📋 Backlog (MVP — Sprints 1 a 3)

### Sprint 1 — Fundação e operação básica
Objetivo: Permitir cadastro/acesso, e planejar e executar rotas e entregas.

| User Story | Descrição | Requisitos |
| :--- | :--- | :--- |
| US02.01 - Cadastrar motorista e veículo | Como motorista, quero cadastrar meus dados pessoais, CNH e veículo, para me identificar e utilizar o sistema. | RF01, RF29, RNF04, RNF11 |
| US02.02 - Entrar e manter a sessão | Como motorista, quero entrar com e-mail e senha e manter minha sessão quando escolher, para acessar minhas atividades com segurança. | RF02, RF18, RNF04, RNF11 |
| US02.03 - Recuperar a senha por e-mail | Como motorista, quero recuperar minha senha por e-mail, para voltar a acessar o aplicativo quando esquecer a credencial. | RF02, RNF04 |
| US02.04 - Confirmar acesso por código de e-mail | Como motorista, quero confirmar meu login com um código recebido por e-mail, para proteger o acesso à minha conta. | RF18, RNF04 |
| US02.05 - Separar acesso de gestor e motorista | Como gestor, quero que cada perfil acesse somente as operações autorizadas, para proteger os dados e a gestão da frota. | RF19, RF25, RF58, RNF04, RNF11 |
| US03.01 - Acessar as telas de gestão da frota | Como gestor, quero acessar as telas de gestão da frota dentro do aplicativo, para administrar a operação sem depender de um sistema separado. | RF19, RF25, RNF07, RNF08 |
| US03.02 - Atribuir rota e entregá-la ao motorista | Como gestor, quero atribuir uma rota a um motorista, para organizar a execução das entregas. | RF19, RF58 |
| US03.03 - Reatribuir rota em caso de imprevisto | Como gestor, quero reatribuir uma rota a outro motorista, para continuar a operação diante de um imprevisto. | RF19, RF58 |
| US03.05 - Receber push de atribuições e alterações | Como motorista, quero receber notificações de novas rotas e alterações, para saber quando minha programação mudar. | RF19, RF40 |
| US03.06 - Consultar o resumo diário | Como motorista, quero visualizar o resumo da minha jornada, para conhecer o trabalho programado para o dia. | RF03, RNF03, RNF07 |
| US04.01 - Cadastrar a programação de uma rota | Como gestor, quero cadastrar uma rota com pontos de coleta e entrega, para preparar sua atribuição a um motorista. | RF04, RF09, RF19 |
| US04.02 - Otimizar paradas com janelas de horário | Como gestor, quero obter uma sequência de coletas e entregas que considere tempos e janelas de horário, para organizar um trajeto eficiente. | RF04, RNF03 |
| US04.03 - Adicionar parada durante a execução | Como motorista, quero adicionar uma parada imprevista à rota, para ajustar meu percurso durante a viagem. | RF07 |
| US04.04 - Pausar e retomar a rota | Como motorista, quero pausar e retomar uma rota preservando seu estado, para continuar a viagem após uma interrupção. | RF31 |
| US04.05 - Ajustar paradas com a navegação pausada | Como motorista, quero adicionar ou remover paradas durante uma pausa, para retomar a navegação com a programação ajustada. | RF07, RF31 |
| US07.01 - Consultar paradas e atualizar status | Como motorista, quero consultar as paradas e atualizar o status das entregas, para registrar o andamento do trabalho. | RF09, RNF07 |
| US07.02 - Verificar presença no destino | Como motorista, quero que minha localização seja verificada ao confirmar a entrega, para comprovar que estou no destino informado. | RF27 |
| US07.03 - Coletar a assinatura do recebedor | Como motorista, quero coletar a assinatura do recebedor, para registrar o comprovante da entrega. | RF10, RNF07, RNF11 |
| US07.04 - Anexar foto do comprovante com conexão | Como motorista, quero anexar uma foto do comprovante quando estiver conectado, para complementar o registro da entrega. | RF10, RNF04, RNF11 |

### Sprint 2 — Navegação, mapa e operação offline
Objetivo: Guiar o motorista até o destino e manter o app funcional mesmo com conexão instável.

| User Story | Descrição | Requisitos |
| :--- | :--- | :--- |
| US05.01 - Visualizar o trajeto no mapa | Como motorista, quero visualizar minha rota em um mapa interativo, para compreender o trajeto e as paradas. | RF05, RNF03, RNF07 |
| US05.02 - Navegar com instruções visuais e de voz | Como motorista, quero receber instruções visuais e faladas para cada manobra, para seguir a rota durante a condução. | RF05, RNF03, RNF07, RNF09 |
| US05.03 - Manter a localização durante a viagem | Como motorista, quero que minha localização continue sendo acompanhada durante a viagem, para manter o andamento da rota atualizado. | RF06, RNF03, RNF09 |
| US05.04 - Recalcular após desvio com conexão | Como motorista, quero receber um novo trajeto quando sair da rota, para continuar até as paradas restantes. | RF06 |
| US05.05 - Receber alertas de navegação | Como motorista, quero receber alertas de aproximação, desvio e excesso de velocidade, para perceber situações relevantes durante o percurso. | RF17, RNF07 |
| US05.06 - Restringir interações durante movimento | Como motorista, quero que interações que exijam digitação sejam restringidas em movimento, para reduzir distrações. | RF53, RNF07 |
| US05.07 - Consultar previsão de chegada | Como motorista, quero acompanhar a previsão de chegada a cada destino, para conhecer o andamento da jornada. | RF54 |
| US06.01 - Baixar rota e mapa regional | Como motorista, quero baixar previamente minha rota e os recursos do mapa, para consultá-los sem conexão. | RF08, RF64, RNF05, RNF09 |
| US06.02 - Consultar rota baixada sem rede | Como motorista, quero abrir minha rota já baixada sem internet, para consultar o percurso e suas paradas. | RF08, RF64, RNF05 |
| US06.03 - Guardar assinatura coletada offline | Como motorista, quero coletar e guardar a assinatura do recebedor sem internet, para preservar o comprovante até recuperar a conexão. | RF08, RF10, RNF04, RNF05, RNF11 |
| US06.04 - Sincronizar assinaturas ao reconectar | Como motorista, quero que assinaturas pendentes sejam enviadas quando a conexão voltar, para completar o registro dos comprovantes. | RF08, RF24, RNF05 |
| US06.05 - Receber atualizações em segundo plano | Como motorista, quero receber atualizações da programação em segundo plano, para consultar as informações disponíveis mais recentes. | RF24, RNF05, RNF09 |

### Sprint 3 — Comunicação, acompanhamento e qualidade
Objetivo: Fechar o MVP com comunicação em emergência, acompanhamento de frota, histórico consultável e acessibilidade.

| User Story | Descrição | Requisitos |
| :--- | :--- | :--- |
| US03.04 - Acompanhar a frota no mapa | Como gestor, quero acompanhar a localização e as tarefas dos motoristas no mapa, para conhecer o andamento da operação. | RF19, RF25, RF58, RNF03, RNF09 |
| US08.01 - Trocar mensagens de texto com a central | Como motorista, quero trocar mensagens de texto com a central, para esclarecer situações durante a operação. | RF14, RNF04 |
| US08.02 - Compartilhar fotos e localização no chat | Como motorista, quero enviar fotos e compartilhar minha localização com a central no chat, para explicar a situação da viagem. | RF14, RNF04, RNF09, RNF11 |
| US08.03 - Acionar o botão de pânico | Como motorista, quero acionar um alerta de emergência para a central e meus contatos, para comunicar uma situação crítica com minha localização. | RF12, RNF04, RNF11 |
| US08.04 - Cadastrar contatos de emergência | Como motorista, quero cadastrar os contatos que receberão os e-mails de emergência, para direcionar os alertas às pessoas escolhidas. | RF12 |
| US09.01 - Consultar histórico de viagens | Como motorista, quero consultar e filtrar minhas viagens realizadas, para conferir a execução do trabalho. | RF15, RNF03, RNF11 |
| US09.02 - Registrar e reproduzir o trajeto | Como motorista, quero registrar o trajeto em segundo plano e reproduzi-lo depois, para analisar por onde passei. | RF28, RNF03, RNF09, RNF11 |
| US11.01 - Utilizar uma interface adequada à condução | Como motorista, quero controles claros e legíveis, para consultar e operar o aplicativo com menor distração. | RNF07 |
| US11.02 - Usar TalkBack e fontes ajustáveis | Como motorista, quero utilizar leitor de tela e fontes ajustadas, para acessar o aplicativo conforme minhas necessidades de visão. | RNF12 |

<br>

---

## 🔧 Itens técnicos / infraestrutura (MVP)

Estes itens não são pedidos de usuário — são trabalho de engenharia necessário para sustentar o backlog acima. Por isso não seguem o formato "Como X, quero, para". Estão separados das User Stories para deixar claro o que é requisito do produto e o que é decisão de construção/operação.

| Item | Descrição | Origem |
| :--- | :--- | :--- |
| T01 - Hospedar em VM gratuita de nuvem | Disponibilizar backend, banco e serviços de mapa em infraestrutura sem custo recorrente. | **Decisão própria de orçamento — não exigida pelo documento.** Relacionado indiretamente a RNF01, RNF02. |
| T02 - Delimitar dados geográficos ao Vale do Paraíba | Restringir o recorte de mapa/roteirização à região de operação inicial, para caber nos recursos disponíveis. | **Decisão própria de escopo regional — não exigida pelo documento.** Relacionado indiretamente a RF04, RF05, RF08, RF64. |
| T03 - Validar viabilidade dos serviços na VM de 12GB | Medir o consumo real de backend + banco + serviços de mapa/rota rodando juntos, antes de depender dessa hospedagem em operação. | RNF03, RNF08, RNF09 (desempenho e otimização de recursos). |
| T04 - Recuperar dados e republicar após falha da VM | Ter um plano de restauração caso o servidor gratuito caia ou seja reciclado. | **Não há RNF no documento que exija isso.** É uma decisão própria de continuidade, dado o risco natural de usar infraestrutura gratuita. |
| T05 - Preparar API pronta para futura integração web | Garantir que os endpoints de rotas e status da frota estejam disponíveis para consumo externo, mesmo sem construir uma interface web nesta fase. | RF58 (atendido parcialmente nesta fase — a "visibilidade via web" fica como evolução futura; a visibilidade em si já é entregue via app, nas US03.01/03.04). |
| T06 - Cobrir fluxos essenciais com testes automatizados | Testes unitários e de integração (Jest / React Native Testing Library) para os fluxos críticos do MVP. | RNF06, RNF08. |
| T07 - Manter organização arquitetural e documentação | Seguir MVVM/DI e manter a documentação do código atualizada. | RNF01, RNF08. |

<br>

---

## 📎 Nota sobre RF58

O documento original descreve RF58 como o aplicativo sincronizando dados com "um sistema de gestão de frota baseado na web". Nesta fase, optamos por entregar a visibilidade do gestor **dentro do próprio aplicativo** (US03.01, US03.04), em vez de construir um painel web dedicado — o que reduz significativamente o escopo de infraestrutura sem deixar de atender à necessidade real do requisito (gestor acompanhar a operação). A integração com um sistema web externo fica registrada como evolução possível (T05), não como pendência do MVP.

<br>

---

## 📦 Backlog Pós-MVP (evolução futura)

Requisitos classificados como diferencial na Fase 0 — ficam fora das Sprints 1-3, mas continuam registrados aqui para cobrir 100% do documento do professor. Ainda sem sprint definida.

### EP02 — Cadastro, autenticação e acesso

| User Story | Descrição | Requisitos |
| :--- | :--- | :--- |
| HU02.06 - Entrar com conta Google | Como motorista, quero entrar usando minha conta Google, para simplificar meu acesso ao aplicativo. | RF69, RNF04, RNF11 |

### EP04 — Planejamento e alteração de rotas

| User Story | Descrição | Requisitos |
| :--- | :--- | :--- |
| HU04.06 - Considerar restrições de caminhões | Como motorista, quero informar as características do caminhão, para obter rotas compatíveis com as restrições do veículo. | RF21 |
| HU04.07 - Reordenar paradas manualmente | Como motorista, quero reordenar as paradas arrastando os itens, para ajustar a sequência da minha rota. | RF32 |
| HU04.08 - Adicionar ponto de interesse sugerido | Como motorista, quero receber sugestões de postos, restaurantes e áreas de descanso, para acrescentar uma parada útil ao percurso. | RF34 |
| HU04.09 - Comparar alternativas com trânsito | Como motorista, quero comparar rotas alternativas diante de trânsito intenso, para escolher o percurso mais adequado. | RF35 |
| HU04.10 - Escolher perfil de condução | Como motorista, quero escolher um perfil Econômico, Normal ou Rápido, para ajustar o planejamento às minhas preferências. | RF37 |
| HU04.11 - Planejar transporte de passageiros | Como motorista, quero organizar embarques e desembarques considerando lotação e preferências, para planejar viagens com vários passageiros. | RF38 |
| HU04.12 - Agrupar entregas próximas | Como gestor, quero agrupar entregas próximas em uma rota, para reduzir deslocamentos na programação. | RF46 |
| HU04.13 - Calcular retorno ao ponto de partida | Como motorista, quero calcular a volta ao ponto de partida após as entregas, para organizar o encerramento da viagem. | RF51 |
| HU04.14 - Importar destinos de arquivo | Como motorista, quero importar destinos de CSV ou Excel, para carregar uma lista de endereços com menos digitação. | RF52 |
| HU04.15 - Reutilizar locais favoritos | Como motorista, quero salvar locais favoritos, para reutilizá-los como origem ou destino. | RF62 |
| HU04.16 - Enviar feedback sobre a rota | Como motorista, quero informar bloqueios ou problemas na rota sugerida, para contribuir com a melhoria das sugestões. | RF72 |

### EP05 — Mapas, navegação e localização

| User Story | Descrição | Requisitos |
| :--- | :--- | :--- |
| HU05.08 - Consultar alertas viários ampliados | Como motorista, quero consultar alertas de limites, radares e rodízio na rota, para conhecer restrições relevantes do percurso. | RF41 |
| HU05.09 - Consultar clima ao longo da rota | Como motorista, quero visualizar a previsão do tempo no percurso, para me preparar para as condições esperadas. | RF45 |
| HU05.10 - Visualizar trânsito em tempo real | Como motorista, quero visualizar a fluidez do trânsito no mapa, para conhecer as condições do trajeto. | RF55 |
| HU05.11 - Filtrar pontos de interesse | Como motorista, quero filtrar pontos de interesse no mapa, para encontrar serviços úteis ao percurso. | RF60 |
| HU05.12 - Melhorar orientação combinando sensores | Como motorista, quero uma orientação que combine os sensores disponíveis, para melhorar a leitura da direção em condições de GPS fraco. | RF61 |
| HU05.13 - Visualizar rota em 3D | Como motorista, quero visualizar a rota em uma vista 3D, para perceber melhor o terreno e as curvas. | RF63 |
| HU05.14 - Estimar posição com GPS instável | Como motorista, quero uma estimativa de posição quando o GPS estiver instável, para manter orientação durante a perda do sinal. | RF68 |

### EP06 — Operação offline e sincronização

| User Story | Descrição | Requisitos |
| :--- | :--- | :--- |
| HU06.06 - Ativar economia de dados | Como motorista, quero ativar um modo de economia de dados, para reduzir o consumo do meu plano móvel. | RF56, RNF09 |

### EP07 — Execução e comprovação de entregas

| User Story | Descrição | Requisitos |
| :--- | :--- | :--- |
| HU07.05 - Identificar pacote por código | Como motorista, quero ler QR Code ou código de barras, para identificar o pacote ou ponto de entrega com menos digitação. | RF11 |
| HU07.06 - Receber avaliações de entregas | Como motorista, quero consultar as avaliações recebidas pelas entregas, para acompanhar a percepção dos destinatários sobre meu serviço. | RF26 |
| HU07.07 - Registrar condição do veículo ou carga | Como motorista, quero fotografar o veículo ou a carga no início e no final da viagem, para documentar sua condição. | RF42 |

### EP08 — Comunicação e emergência

| User Story | Descrição | Requisitos |
| :--- | :--- | :--- |
| HU08.05 - Compartilhar acompanhamento temporário | Como motorista, quero compartilhar um link temporário da viagem com um contato, para permitir que ele acompanhe minha localização e meu status. | RF39, RNF04, RNF11 |
| HU08.06 - Iniciar chamada pelo telefone | Como motorista, quero iniciar uma chamada para a central ou destinatário pelo aplicativo, para facilitar o contato telefônico. | RF48 |
| HU08.07 - Compartilhar rota com a equipe | Como motorista, quero compartilhar uma rota planejada com outros motoristas da frota, para coordenar uma operação conjunta. | RF65 |

### EP09 — Histórico e acompanhamento da execução

| User Story | Descrição | Requisitos |
| :--- | :--- | :--- |
| HU09.03 - Registrar telemetria da viagem | Como gestor, quero consultar indicadores de telemetria das viagens, para acompanhar o desempenho operacional. | RF13, RNF03, RNF09 |
| HU09.04 - Exportar relatório de atividades | Como motorista, quero gerar um relatório PDF de um período, para prestar contas das minhas atividades. | RF16 |
| HU09.05 - Receber relatório semanal por e-mail | Como motorista, quero receber um relatório semanal de desempenho por e-mail, para acompanhar minha evolução. | RF36 |
| HU09.06 - Visualizar concentração das entregas | Como motorista, quero visualizar um mapa de calor das entregas frequentes, para identificar concentrações no meu trabalho. | RF44 |
| HU09.07 - Reconsultar rotas apenas visualizadas | Como motorista, quero consultar as rotas que já visualizei, para encontrá-las novamente mesmo sem ter iniciado a navegação. | RF66 |
| HU09.08 - Analisar tempo por etapa | Como motorista, quero consultar o tempo gasto em cada etapa da rota, para identificar onde ocorrem demoras. | RF67 |

### EP10 — Custos da viagem e manutenção veicular

| User Story | Descrição | Requisitos |
| :--- | :--- | :--- |
| HU10.01 - Estimar custo de combustível | Como motorista, quero visualizar o custo estimado da viagem, para considerar a despesa de combustível no planejamento. | RF33 |
| HU10.02 - Acompanhar necessidade de manutenção | Como motorista, quero receber avisos de manutenção e consultar oficinas próximas, para acompanhar os cuidados com o veículo. | RF47 |
| HU10.03 - Comparar custos com orçamento | Como motorista, quero definir um orçamento para combustível e pedágios, para perceber quando o custo previsto ultrapassar meu limite. | RF71 |

### EP11 — Usabilidade, acessibilidade e personalização

| User Story | Descrição | Requisitos |
| :--- | :--- | :--- |
| HU11.03 - Escolher idioma do aplicativo | Como motorista, quero utilizar português, inglês ou espanhol, para compreender o aplicativo no idioma escolhido. | RF20 |
| HU11.04 - Ativar modo escuro | Como motorista, quero utilizar um tema escuro, para melhorar a leitura durante o uso noturno. | RF22, RNF07 |
| HU11.05 - Consultar a jornada pelo widget | Como motorista, quero consultar próximo destino e previsão de chegada no widget Android, para obter um resumo sem abrir o aplicativo. | RF23, RNF09 |
| HU11.06 - Conhecer o aplicativo no primeiro acesso | Como motorista, quero um tutorial interativo no primeiro login, para conhecer as funcionalidades principais. | RF30 |
| HU11.07 - Suspender avisos não essenciais | Como motorista, quero ativar o modo soneca durante o descanso, para suspender notificações não essenciais. | RF43 |
| HU11.08 - Consultar ajuda e contatar suporte | Como motorista, quero consultar dúvidas frequentes e enviar uma solicitação de suporte, para resolver dificuldades de uso. | RF49 |
| HU11.09 - Personalizar alertas | Como motorista, quero configurar alertas de eventos da viagem, para receber avisos conforme minhas preferências. | RF50 |
| HU11.10 - Experimentar uma rota simulada | Como motorista, quero experimentar uma rota sem utilizar GPS, para conhecer as funcionalidades antes da operação real. | RF70 |

### EP12 — Qualidade, desempenho e evolução técnica

| User Story | Descrição | Requisitos |
| :--- | :--- | :--- |
| HU12.05 - Receber pequenas atualizações OTA | Como motorista, quero receber correções e pequenas melhorias pelo mecanismo OTA, para atualizar o aplicativo com menor necessidade de redistribuição. | RNF10 |

## ❓ Itens a validar com o professor/orientador

Pontos do documento original com alcance ambíguo — ainda não classificados como MVP nem diferencial.

| User Story | Descrição | Requisitos |
| :--- | :--- | :--- |
| HU07.08 - Registrar documentos fiscais | Como motorista, quero registrar documentos fiscais da carga por foto ou leitura de código, para associá-los à operação. | RF57 |
| HU08.08 - Enviar mensagem rápida de status | Como motorista, quero enviar um status predefinido com um toque, para atualizar a central rapidamente. | RF59 |
| HU08.09 - Conversar com o destinatário da entrega | Como motorista, quero conversar com o destinatário da entrega, para alinhar informações sobre o recebimento. | RF14, RNF04, RNF11 |
