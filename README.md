---

## 🤖 Gerente da Loja Plasma

O **Gerente Plasma** é um bot automatizado responsável pela venda, gestão e controle de bots operacionais (Workers) no servidor, com sistema de negociação segura, pagamentos parciais, anti-spam e histórico completo de clientes.

Toda a comunicação com jogadores ocorre **exclusivamente via /tell**, evitando interferência no chat global.

---

## 🧩 Bot Operacional Plasma (Workers)

Os **Bots Operacionais Plasma (Workers)** são os bots que realizam a função contratada pelo cliente (ex: mineração, presença, automação, etc.).

O **Gerente Plasma** é responsável por:

* iniciar os workers
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
* Pagamentos parciais acumulados
* Cancelamento automático de negociação
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

## 🗃️ Banco de Dados

O sistema mantém registros persistentes de:

* clientes ativos
* negociações
* saldos acumulados
* reembolsos
* histórico de clientes expirados

Nenhuma informação é perdida em reinicializações.

---

## 📊 Painel Web (opcional)

Painel separado do bot, utilizado apenas para visualização administrativa:

* clientes ativos
* tempo de expiração
* negociações
* histórico

---

## 📎 Informações do Bot Operacional Plasma (Workers)

Para detalhes técnicos, comandos internos, limitações e comportamento dos **Bots Operacionais Plasma (Workers)**, consulte o arquivo de ajuda:

[WORKER.md](https://github.com/WastoLord/Plasma_Gerente/blob/main/WORKER.md)

Este arquivo contém:

* descrição das funções dos workers
* regras de uso
* limites operacionais
* boas práticas

---
