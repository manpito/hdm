# SmartWallet - Sistema de Gestão e Venda NFC

Sistema multi-terminal para gestão de eventos e recintos com pagamentos via cartões NFC.

## 🏗️ Arquitetura
- **Backend:** Node.js + Express + SQLite
- **Backoffice:** React + Vite (Porta 5174) - Administração e Finanças
- **POS:** React + Vite (Porta 5173) - Terminal de Vendas

## 🚀 Instalação e Execução

### 1. Backend
```bash
cd smart-wallet/backend
npm install
npm start
```
*Porta: 3001*

### 2. Backoffice
```bash
cd smart-wallet/backoffice
npm install
npm run dev
```
*Porta: 5174*

### 3. POS
```bash
cd smart-wallet/pos
npm install
npm run dev
```
*Porta: 5173*

## 🔒 Variáveis de Ambiente (.env)

No backend, cria um `.env` com:
```env
PORT=3001
JWT_SECRET=mudar_para_chave_segura
MAX_POS_TERMINALS=2
```

## 👥 Credenciais de Teste

| Role | Utilizador | Password | Acesso |
| :--- | :--- | :--- | :--- |
| **Admin** | admin | admin123 | Total (Backoffice + POS) |
| **Financeiro** | financeiro | fin123 | Relatórios e Cartões (Backoffice) |
| **POS 1** | pos1 | pos123 | Vendas (POS) - Terminal 1 |
| **POS 2** | pos2 | pos456 | Vendas (POS) - Terminal 2 |

---
**Nota:** O limite de terminais ativos (`MAX_POS_TERMINALS`) impede que mais terminais do que o configurado sejam ativados simultaneamente no Backoffice.
