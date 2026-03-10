# 🤖 Gerente da Loja Plasma

![Node.js](https://img.shields.io/badge/Node.js-v18%2B-green?logo=node.js)
![JavaScript](https://img.shields.io/badge/JavaScript-ES2020-yellow?logo=javascript)
![License](https://img.shields.io/badge/License-MIT-blue)
![Status](https://img.shields.io/badge/Status-Active-brightgreen)

Bot automatizado responsável pela **venda, gestão e controle de bots operacionais (Workers)**, com sistema de negociação segura, pagamentos parciais, anti-spam e histórico completo de clientes.

Toda a comunicação com jogadores ocorre **exclusivamente via /tell**, evitando interferência no chat global.

---

## 📁 Estrutura do Projeto

```
📁 Plasma_Gerente
├── core/              # Núcleo do sistema
├── systems/           # Módulos de funcionalidades
├── painel/            # Painel administrativo
├── V2/                # Segunda versão em desenvolvimento
├── plasma_gerente.js  # Arquivo principal
├── worker_loader.js   # Carregador de workers
├── worker_logic.js    # Lógica dos workers
├── WORKER.md          # Documentação dos workers
└── package.json
```

---

## 🧩 Bot Operacional Plasma (Workers)

Os **Bots Operacionais Plasma (Workers)** são os bots que realizam a função contratada pelo cliente (ex: mineração, presença, automação, etc.).

O **Gerente Plasma** é responsável por:

- Iniciar os workers (via sessões tmux)
- Encerrar automaticamente ao expirar
- Renovar quando contratado novamente
- Manter isolamento entre clientes
- Garantir funcionamento durante o período contratado

> ⚠️ O jogador **não interage diretamente** com os workers. Toda comunicação, pagamentos e status passam pelo **Gerente**.

---

## 🎮 Comandos para Jogadores (via /tell)

| Comando | Função |
|---------|--------|
| `qualquer mensagem` | Inicia o atendimento |
| `negociar` | Inicia a negociação do bot |
| `confirmar` | Confirma o interesse e aguarda pagamento |
| `saldo` | Consulta o saldo acumulado atual |
| `tempo` / `status` / `meu bot` | Mostra quanto tempo resta do bot |
| `devolver` | Devolve saldo acumulado (se houver) |
| `preco` *(se ativado)* | Mostra o valor do aluguel |

> 📌 O jogador pode pagar **aos poucos**. O valor é acumulado automaticamente até atingir o valor do bot.

---

## 🛡️ Proteções Automáticas

- Anti-spam (10 mensagens/min → bloqueio 5 min)
- Pagamentos parciais acumulados (troco salvo automaticamente)
- Cancelamento automático de negociação por inatividade
- Expiração de saldo acumulado (2 dias)
- Comunicação restrita a /tell

---

## 👑 Comandos de Administrador (Terminal)

| Comando | Função |
|---------|--------|
| `teste <nick> <dias>` | Concede bot de teste |
| `verificar` | Restaura bots ativos do banco de dados |
| `bots` | Lista bots em execução |
| `pendentes` | Lista negociações pendentes |
| `reload` | Recarrega o banco de dados do disco |
| `exit` | Encerra o gerente |

---

## 🛠️ Requisitos e Instalação

**Dependências:**
- Node.js v18 ou superior
- TMUX instalado (essencial para rodar bots em background)

```bash
# Instalar tmux (Ubuntu/Debian)
sudo apt install tmux

# Instalar dependências do projeto
npm install
```

**Inicialização:**

```bash
export BOT_PASSWORD='SuaSenhaDoLogin'
node plasma_gerente.js
```

---

## 🕵️ Monitoramento de Workers (Admin)

Cada bot de cliente roda em uma sessão `tmux` isolada.

```bash
# Listar sessões ativas
tmux ls

# Ver console de um cliente
tmux attach -t plasma_nick

# Sair do console (Detach)
CTRL+B → D
```

---

## 🗃️ Banco de Dados

O sistema mantém registros persistentes em `plasma_db.json`:

- Clientes ativos e datas de vencimento
- Negociações em andamento
- Saldos acumulados (em centavos)
- Reembolsos e histórico

> ⚠️ O arquivo `plasma_db.json` contém dados sensíveis e **não deve ser commitado**. Já está no `.gitignore`.

---

## 📎 Documentação dos Workers

Para detalhes técnicos, comandos internos e comportamento dos Bots Operacionais, consulte:

👉 [WORKER.md](./WORKER.md)

---

## 📄 Licença

MIT — veja [LICENSE](./LICENSE) para detalhes.
