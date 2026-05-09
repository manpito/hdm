# SmartWallet

Sistema de venda de produtos cloud-based com pagamentos via cartão NFC.

## Arquitetura Proposta

### Backend (Node.js + Express)
- **Gestão de Cartões**: Criação e carregamento de unidades.
- **Gestão de Stock**: CRUD de produtos e controle de inventário.
- **Transações**: Registro de vendas e sincronização em tempo real.
- **Segurança**: Verificação de saldo e prevenção de fraude.

### Frontend (React)
- **Painel Central**: Gestão de stock, relatórios e carregamento de cartões.
- **Terminal POS**: Interface de venda optimizada para tablets/terminais com leitor NFC.

### Sincronização
- Utilização de WebSockets para actualização imediata de saldos e stocks entre terminais.

## Considerações de Segurança
- O saldo será mantido preferencialmente na cloud vinculado ao ID do cartão para evitar manipulação física do cartão.
- Sincronização em tempo real para evitar o uso do mesmo saldo em múltiplos terminais simultaneamente (double-spending).
