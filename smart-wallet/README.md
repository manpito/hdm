# SmartWallet - Sistema de Pagamento NFC e Gestão de Stock

Sistema cloud-based para gestão de vendas através de cartões NFC (simulados), ideal para eventos, cantinas ou recintos fechados.

## Arquitetura
- **Backend:** Node.js, Express, SQLite.
- **Frontend:** React, Tailwind CSS.
- **Segurança:** Autenticação via JWT (JSON Web Tokens).
- **Relatórios:** Exportação para PDF e Excel integrada.

## Funcionalidades
- **Gestão de Stock:** Controlo de inventário com alertas de stock baixo.
- **Terminais POS:** Suporte a múltiplos terminais sincronizados via API central.
- **Segurança de Transação:** Uso de transações SQL atómicas para evitar gastos duplos e inconsistências de stock.
- **Relatórios:** Análise de consumo diário, semanal e mensal.

## Como Executar

### Backend
1. `cd smart-wallet/backend`
2. `npm install`
3. `npm start` (Porta 3001)

### Frontend
1. `cd smart-wallet/frontend`
2. `npm install`
3. `npm run dev` (Porta 5173)

### Utilizador Padrão
- **Username:** admin
- **Password:** admin123
