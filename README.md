# Plasma_Gerente
Bot vendedor de bots
---

## 🤖 Gerente da Loja Plasma

O **Gerente Plasma** é um bot automatizado responsável pela venda, gestão e controle de bots no servidor, com sistema de negociação segura, pagamentos parciais, anti-spam e histórico completo de clientes.

Toda a comunicação com jogadores ocorre **exclusivamente via /tell**, evitando interferência no chat global.

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
O valor é acumulado automaticamente até atingir o preço do bot.

---

## 🛡️ Proteções Automáticas

* **Anti-spam**:
  Mais de 10 mensagens em 1 minuto → bloqueio por 5 minutos.
* **Pagamentos parciais** acumulados com segurança.
* **Correção de centavos** (nunca converte 0.11 em 11).
* **Expiração de saldo** após 2 dias.
* **Negociação cancelada automaticamente** por inatividade.

---

## 👑 Comandos de Administrador (no terminal)

Executados diretamente no terminal onde o gerente roda.

| Comando                 | Função                      |
| ----------------------- | --------------------------- |
| `teste <nick> <dias>`   | Concede bot de teste        |
| `verificar`             | Restaura bots ativos do DB  |
| `bots`                  | Lista bots em execução      |
| `pendentes`             | Lista negociações pendentes |
| `reload` *(se ativado)* | Recarrega o DB do disco     |
| `exit`                  | Encerra o gerente           |

---

## 🗃️ Banco de Dados

O gerente mantém registros em arquivo JSON, incluindo:

* Clientes ativos
* Negociações em andamento
* Saldos acumulados
* Reembolsos
* Histórico completo de clientes expirados

Nenhuma informação é perdida em reinícios.

---

## 📊 Painel Web (opcional)

Painel HTML separado do bot, com:

* clientes ativos
* negociações
* histórico
* tempo de expiração

Atualização automática.

---

Se quiser, no próximo passo posso:

* transformar isso em **README.md pronto**
* ou escrever uma **mensagem curta de divulgação** para jogadores.
