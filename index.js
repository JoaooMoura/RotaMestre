import { AppRegistry } from 'react-native';
import BackgroundFetch from 'react-native-background-fetch';
import App from './App';
import { name as appName } from './app.json';
import { criarTarefaEmSegundoPlano } from './src/servicos/tarefaEmSegundoPlano';

AppRegistry.registerComponent(appName, () => App);

// Atualização da programação com o app FECHADO (US06.05): o Android acorda esta tarefa periodicamente.
BackgroundFetch.registerHeadlessTask(criarTarefaEmSegundoPlano(taskId => BackgroundFetch.finish(taskId)));
