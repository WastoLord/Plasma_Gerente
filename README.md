```markdown
## 🤖 Gerente da Loja Plasma

O **Gerente Plasma** é um bot automatizado responsável pela venda, gestão e controle de bots operacionais (Workers) no servidor, com sistema de negociação segura, pagamentos parciais, anti-spam e histórico completo de clientes.

Toda a comunicação com jogadores ocorre **exclusivamente via /tell**, evitando interferência no chat global.

---

## 🧩 Bot Operacional Plasma (Workers)

Os **Bots Operacionais Plasma (Workers)** são os bots que realizam a função contratada pelo cliente (ex: mineração, presença, automação, etc.).

O **Gerente Plasma** é responsável por:

* iniciar os workers (via sessões tmux)
* encerrar automaticamente ao expirar
* renovar quando contratado novamente
* manter isolamento entre clientes
* garantir funcionamento durante o período contratado

⚠️ O jogador **não interage diretamente** com os workers.
Toda comunicação, pagamentos e status passam pelo **Gerente**.

---

## 🎮 Comandos para Jogadores (via /tell)

| Comando                | Função                                   |
| ---------------------- | ---------------------------------------- |
| `qualquer mensagem`    | Inicia o atendimento                     |
| `negociar`             | Inicia a negociação do bot               |
| `confirmar`            | Confirma o interesse e aguarda pagamento |
| `saldo`                | Consulta o saldo acumulado atual         |
| `tempo`                | Mostra quanto tempo resta do bot         |
| `status`               | Mesmo que `tempo`                        |
| `meu bot`              | Mesmo que `tempo`                        |
| `devolver`             | Devolve saldo acumulado (se houver)      |
| `preco` *(se ativado)* | Mostra o valor do aluguel                |

📌 O jogador pode pagar **aos poucos**.
O valor é acumulado automaticamente até atingir o valor do bot.

---

## 🛡️ Proteções Automáticas

* Anti-spam (10 mensagens/min → bloqueio 5 min)
* Pagamentos parciais acumulados (Troco fica salvo)
* Cancelamento automático de negociação por inatividade
* Expiração de saldo acumulado (2 dias)
* Comunicação restrita a /tell

---

## 👑 Comandos de Administrador (Terminal)

Executados diretamente no terminal onde o gerente está rodando.

| Comando               | Função                      |
| --------------------- | --------------------------- |
| `teste <nick> <dias>` | Concede bot de teste        |
| `verificar`           | Restaura bots ativos do DB  |
| `bots`                | Lista bots em execução      |
| `pendentes`           | Lista negociações pendentes |
| `reload`              | Recarrega o DB do disco     |
| `exit`                | Encerra o gerente           |

---

## 🛠️ Requisitos e Instalação

Para que o Gerente consiga criar os Workers, o ambiente (VPS) precisa de:

1.  **Node.js** (v18 ou superior)
2.  **TMUX** instalado (Essencial para rodar bots em background)
    * Ubuntu/Debian: `sudo apt install tmux`

### Inicialização Segura
O bot exige a senha definida via variável de ambiente.

```bash
export BOT_PASSWORD='SuaSenhaDoLogin'
node plasma_gerente.js

```

---

## 🕵️ Monitoramento de Workers (Admin)

Cada bot de cliente roda em uma sessão `tmux` isolada.

* **Listar sessões ativas:** `tmux ls`
* **Ver console de um cliente:** `tmux attach -t plasma_nick`
* **Sair do console (Detach):** `CTRL+B` depois `D`

---

## 🗃️ Banco de Dados

O sistema mantém registros persistentes em `plasma_db.json` de:

* clientes ativos e datas de vencimento
* negociações em andamento
* saldos acumulados (em centavos)
* reembolsos e histórico

---

## 📎 Informações do Bot Operacional Plasma (Workers)

Para detalhes técnicos, comandos internos e comportamento dos **Bots Operacionais**, consulte:

[WORKER.md](WORKER.md)

```

```
