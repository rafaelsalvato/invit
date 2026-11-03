# InvIT

O **InvIT** é um protótipo para apoiar decisões sobre equipamentos de TI locados: manter para realocar ou devolver ao locador. A análise considera contratos de 12 meses, multa de 30% do saldo, previsão de reutilização e eventual nova locação.

## Como executar

Baixe os arquivos e abra `index.html` em um navegador atualizado, mantendo a pasta `assets` no mesmo diretório. Não é necessário instalar dependências ou iniciar um servidor. A aplicação funciona sem internet.

## Funcionalidades

- Cadastro e edição de contratos de notebooks, desktops e servidores.
- Comparação das políticas de manutenção e devolução.
- Simulação de prazo, duração de uso, compatibilidade e nova mensalidade.
- Detalhamento de mensalidades, multas e diferença entre os cenários.
- Análise de sensibilidade do prazo de realocação.
- Memória de cálculo, exportação CSV e backup JSON.
- Geração de minutas e acompanhamento de assinatura em demonstração.

## Estrutura dos arquivos

| Arquivo                 | Função                                                     |
| ----------------------- | ---------------------------------------------------------- |
| `index.html`            | Estrutura principal e carregamento dos recursos.           |
| `assets/css/styles.css` | Aparência, componentes e responsividade.                   |
| `assets/js/model.js`    | Regras financeiras, calendário e validação.                |
| `assets/js/data.js`     | Ícones e base inicial demonstrativa.                       |
| `assets/js/app.js`      | Navegação, interface, cadastros, simulações e exportações. |
| `tests/model.test.js`   | Verificações automáticas do modelo de decisão.             |

Os scripts são clássicos e carregam na ordem `model.js`, `data.js` e `app.js`. Não utilizam módulos, CDNs ou frameworks.

## Modelo de decisão

O modelo compara duas políticas atendendo à mesma demanda: manter o equipamento atual para reutilizá-lo ou devolvê-lo agora e contratar outro quando necessário. Novas locações têm 12 meses; contratos encerrados antes disso geram multa de 30% do saldo.

No modo padrão, a demanda termina no vencimento do contrato atual. Na duração personalizada, o cálculo inclui eventual locação complementar após esse vencimento e rescisão antecipada quando o uso termina antes dele. As premissas e parcelas dos custos aparecem na aplicação.

O modelo usa meses inteiros, valores nominais e arredondamento de multas por contrato. Custos não informados, como transporte, não estão incluídos. A previsão é informada pelo responsável; não há previsão automática de contratações. O resultado compara duas políticas determinadas, sem otimização global de todas as datas de troca e rescisão.

## Dados e assinatura

Os dados ficam no navegador. Para transferir a base a outro computador, exporte e importe o backup JSON em **Como calculamos**. A base inicial é simulada: as mensalidades de notebooks seguem os materiais do desafio; os valores de desktops e servidores são demonstrativos.

O fluxo de assinatura é **simulado**. Não há envio a um provedor nem produção de assinatura jurídica. Uma integração efetiva exige backend, credenciais e confirmação do provedor.

## Verificações

Para executar os 15 testes do modelo, tenha Node.js instalado e rode, na raiz do projeto:

```sh
node tests/model.test.js
```

Node.js é necessário apenas para esses testes, não para abrir a aplicação.

## Antes de apresentar

Na base inicial, mantenha a referência em **03/11/2026** e abra **NB-001**. A realocação em dois meses favorece manter; em seis meses favorece devolver, sob as premissas do cenário. Confira também uso personalizado, persistência após recarregar, downloads e fluxo documental.
