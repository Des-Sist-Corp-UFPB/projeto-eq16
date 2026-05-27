# Doc Componentes (Token-saving)

Formato: [Nome] | [Objetivo] | [Props] | [Ações/Interações]

## Catálogo de Componentes
* **AuthForm** | Login/Cadastro tabs | `onAuthSuccess(user)` | Realiza requisições POST `/api/auth/login` e `/api/auth/register`, valida credenciais, retorna dados do morador e redireciona.
* **HouseManager** | Criar ou entrar em casa | `onHouseSuccess()`, `onLogout()`, `userName` | Form de criação (envia POST `/api/house/create`) ou entrada (envia POST `/api/house/join` com código de 6 digitos).
* **ExpenseForm** | Cadastro de gastos | `onExpenseAdded()` | Form para lançar gasto (identificação, valor unitário, quantidade, tipo), envia POST `/api/expenses`, valida dados.
* **ExpenseList** | Tabela de despesas correntes | `expenses`, `currentUserId`, `currentUserRole`, `onExpenseDeleted` | Filtros por tipo, exibe colunas, deleta gastos via DELETE `/api/expenses?id=X` se criador ou ADMIN.
* **BalanceSplit** | Rateio e acertos de contas | `expenses`, `residents`, `currentUserRole`, `onMonthClosed` | Calcula saldos (gastos - cota individual), lista transferências (algoritmo guloso) e envia POST `/api/house/close-month` (Admin apenas).
* **HistoryCharts** | Gráficos históricos comparativos | `history` | Renderiza 2 gráficos SVG nativos (Total de Gastos e Comparativo de Categorias) comparando os 3 últimos meses fechados cronologicamente.
* **ExportPdfButton** | Botão de exportação PDF | `houseName`, `expenses`, `residents`, `history` | Renderiza layout invisível na tela (`.print-area`) mas visível na impressão, e chama `window.print()` abrindo o preview nativo do browser de salvamento em PDF.
