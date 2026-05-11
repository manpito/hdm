# SmartWallet - Sistema de Pagamento NFC e Gestão de Stock

O **SmartWallet** é uma solução completa para gestão de vendas em recintos fechados (festivais, cantinas, eventos), utilizando cartões NFC (simulados via software) para transações seguras e rápidas.

## 🏗️ Arquitetura do Projeto

O sistema é dividido em duas partes principais:

1.  **Backend (Servidor):** Construído com **Node.js** e **Express**. Utiliza uma base de dados **SQLite** para armazenar produtos, saldos de cartões, utilizadores e transações. O SQLite foi escolhido por não exigir instalação de um servidor de base de dados separado, facilitando o uso inicial.
2.  **Frontend (Interface):** Desenvolvido com **React** e **Vite**, utilizando **Tailwind CSS** para o design. É aqui que os operadores realizam as vendas e os administradores gerem o stock e os relatórios.

---

## 📋 Pré-requisitos

Antes de começar, certifica-te de que tens instalado:
- **Node.js:** Versão 18.0 ou superior. [Download aqui](https://nodejs.org/)
- **Gestor de pacotes:** NPM (vem instalado com o Node.js).

---

## 🚀 Instalação e Configuração

Ssegue estes passos no teu terminal (Command Prompt, PowerShell ou Terminal do VS Code):

### 1. Clonar ou Obter o Código
Entra na pasta principal do projeto:
```bash
cd smart-wallet
```

### 2. Configurar o Backend
Entra na pasta do backend e instala as dependências:
```bash
cd backend
npm install
```

Cria um ficheiro `.env` baseado no exemplo:
```bash
cp .env.example .env
```
*(Nota: Podes abrir o ficheiro .env e mudar a `JWT_SECRET` para algo seguro).*

**Base de Dados:** Não precisas de fazer nada! O sistema cria automaticamente o ficheiro `database.sqlite` e as tabelas necessárias quando o ligares pela primeira vez. Também cria um utilizador administrador padrão.

### 3. Configurar o Frontend
Abre uma **nova janela de terminal**, volta à pasta raiz e entra no frontend:
```bash
cd smart-wallet/frontend
npm install
```

Cria o ficheiro `.env`:
```bash
cp .env.example .env
```

---

## 🛠️ Como Correr o Projeto

Precisas de ter dois terminais abertos ao mesmo tempo:

**Terminal 1 (Backend):**
```bash
cd smart-wallet/backend
npm start
```
O servidor ficará ativo em `http://localhost:3001`.

**Terminal 2 (Frontend):**
```bash
cd smart-wallet/frontend
npm run dev
```
Abre o navegador em `http://localhost:5173`.

### Dados de Acesso (Login)
- **Utilizador:** `admin`
- **Password:** `admin123`

---

## 🔒 Variáveis de Ambiente (.env)

### Backend (`/backend/.env`)
- `JWT_SECRET`: Uma chave aleatória para assinar os tokens de segurança.
- `PORT`: Porta onde o servidor corre (padrão 3001).

### Frontend (`/frontend/.env`)
- `VITE_API_URL`: O endereço do teu backend (ex: `http://localhost:3001/api`).

---

## 🧪 Como Testar o Sistema

1.  **Login:** Entra com as credenciais de admin.
2.  **Stock:** Vai ao menu "Stock" e adiciona alguns produtos (ex: "Água", Preço: 5.00, Quantidade: 50).
3.  **Carregar Cartão:** Vai ao menu "Cartão", inventa um ID (ex: `NFC-001`) e carrega 100 unidades.
4.  **Venda (POS):** Vai ao menu "POS", clica nos produtos, insere o ID `NFC-001` no campo do cartão e clica em "Pagar".
5.  **Relatórios:** Verifica em "Relatórios" se a venda aparece no histórico e se o stock diminuiu.

> **⚠️ Limitação de Hardware:** Este software simula a leitura NFC através de um campo de texto onde inseres o ID do cartão. Para usar cartões físicos reais, seria necessário um leitor NFC USB e integrar a biblioteca WebHID no navegador.

---

## 📂 Estrutura de Pastas

```text
smart-wallet/
├── backend/                # Código do servidor
│   ├── index.js            # Ficheiro principal (rotas e lógica)
│   ├── db.js               # Configuração da base de dados
│   ├── package.json        # Dependências do backend
│   └── .env.example        # Modelo de configurações
├── frontend/               # Código da interface (React)
│   ├── src/
│   │   ├── components/     # Páginas (POS, Stock, Relatórios, etc.)
│   │   ├── App.jsx         # Componente principal
│   │   └── config.js       # Configurações da API
│   ├── package.json        # Dependências do frontend
│   └── .env.example        # Modelo de configurações
└── README.md               # Este guia
```

---

## 📞 Suporte
Se encontrares erros, verifica se o backend está ligado e se instalaste as dependências com `npm install` em ambas as pastas.
