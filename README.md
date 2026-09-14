# RotaMestre

<br>

## 🌀 Protótipo Navegável
**:link: Clique no link abaixo para visualizar o Protótipo Navegável do projeto:**  
> [Protótipo Navegável](https://www.figma.com/make/sKKY8iVereo5EtrZqYh6mO/Naveg%C3%A1vel-Or%C3%A7amento-F%C3%A1cil?fullscreen=1&t=8A0SOIvtsIsHBaED-1)

<br>

---

## 📱 Escopo do Protótipo

O protótipo atual representa a **Sprint 1 — Fundação e operação básica** do RotaMestre e foi desenvolvido em formato **mobile**, com foco nos principais fluxos de uso do motorista e do gestor.

### ✅ O que já está prototipado

- Cadastro de motorista, CNH e veículo;
- Login com separação entre os perfis **Motorista** e **Gestor**;
- Confirmação de acesso por código enviado por e-mail;
- Recuperação de senha;
- Resumo diário do motorista;
- Central de notificações;
- Consulta da rota e das paradas;
- Início, pausa e retomada da rota;
- Adição e remoção de paradas durante a pausa;
- Atualização do status das entregas;
- Verificação visual de presença no destino;
- Coleta de assinatura do recebedor;
- Anexo de foto do comprovante;
- Dashboard do gestor;
- Criação e organização de rotas;
- Atribuição e reatribuição de motoristas.

> **Observação:** a US03.01 prevê originalmente um painel web para o gestor. Para esta etapa de prototipação, essa experiência foi adaptada para **mobile**, mantendo as funcionalidades previstas para a Sprint 1.

### 🚧 Próximas etapas

As funcionalidades de **mapa, navegação, localização contínua, recálculo de rota e operação offline** estão previstas para a Sprint 2. Recursos como **chat, botão de pânico, histórico de viagens, acompanhamento de frota e acessibilidade avançada** fazem parte da Sprint 3.

<br>

---

## 📋 Backlog (MVP)

### Sprint 1 — Fundação e operação básica
Objetivo: Disponibilizar a base técnica, o cadastro/acesso, e permitir planejar e executar rotas e entregas.

| User Story | Descrição | Requisitos |
| :--- | :--- | :--- |
| US01.01 - Disponibilizar o sistema em nuvem gratuita | Como gestor, quero acessar os serviços do RotaMestre hospedados em uma VM gratuita de nuvem, para disponibilizar a operação aos motoristas. | RNF01, RNF02, RNF04, RNF08 |
| US01.02 - Delimitar os dados ao Vale do Paraíba | Como gestor, quero utilizar dados geográficos limitados ao Vale do Paraíba, para manter o atendimento regional dentro dos recursos disponíveis. | RF04, RF05, RF08, RF64, RNF03, RNF09 |
| US01.03 - Comprovar viabilidade na VM de 12 GB | Como gestor, quero conhecer o consumo real dos serviços com o recorte regional, para decidir sobre a hospedagem antes de depender dela na operação. | RNF03, RNF08, RNF09 |
| US01.04 - Recuperar dados e publicação | Como gestor, quero recuperar os dados e os serviços após uma falha da VM, para preservar a continuidade da operação. | RNF04, RNF08, RNF11 |
| US02.01 - Cadastrar motorista e veículo | Como motorista, quero cadastrar meus dados pessoais, CNH e veículo, para me identificar e utilizar o sistema. | RF01, RF29, RNF04, RNF11 |
| US02.02 - Entrar e manter a sessão | Como motorista, quero entrar com e-mail e senha e manter minha sessão quando escolher, para acessar minhas atividades com segurança. | RF02, RF18, RNF04, RNF11 |
| US02.03 - Recuperar a senha por e-mail | Como motorista, quero recuperar minha senha por e-mail, para voltar a acessar o aplicativo quando esquecer a credencial. | RF02, RNF04 |
| US02.04 - Confirmar acesso por código de e-mail | Como motorista, quero confirmar meu login com um código recebido por e-mail, para proteger o acesso à minha conta. | RF18, RNF04 |
| US02.05 - Separar acesso de gestor e motorista | Como gestor, quero que cada perfil acesse somente as operações autorizadas, para proteger os dados e a gestão da frota. | RF19, RF25, RF58, RNF04, RNF11 |
| US03.01 - Acessar o painel web da empresa | Como gestor, quero acessar um painel web da empresa, para administrar a operação da frota. | RF19, RF25, RF58, RNF07, RNF08 |
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
Objetivo: Fechar o MVP com comunicação em emergência, acompanhamento de frota, histórico consultável, acessibilidade e testes.

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
| US12.01 - Confiar nos fluxos verificados | Como gestor, quero que os fluxos essenciais sejam verificados, para reduzir falhas durante a operação da frota. | RNF06, RNF08 |
| US12.02 - Manter fluidez e controlar consumo | Como motorista, quero que mapa e navegação funcionem com consumo controlado, para utilizar o aplicativo durante a jornada. | RNF03, RNF09 |
| US12.03 - Manter organização e documentação | Como gestor, quero que o sistema tenha organização e documentação consistentes, para facilitar sua manutenção. | RNF01, RNF08 |
| US12.04 - Proteger comunicação e dados locais | Como motorista, quero que meus dados pessoais e de localização sejam protegidos, para preservar sua confidencialidade. | RNF04, RNF11 |

