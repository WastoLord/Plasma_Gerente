# 🤖 Bot Operacional Plasma (Workers)

Este documento descreve o funcionamento, limitações e comandos dos **Bots Operacionais Plasma (Workers)**, que são gerenciados automaticamente pelo **Gerente da Loja Plasma**.

---

## 📌 Visão Geral

Os Workers são bots baseados em **Mineflayer** que executam tarefas operacionais dentro do servidor. Eles **não são vendidos diretamente**: todo o ciclo de vida (criação, ativação, expiração e desligamento) é controlado pelo **Gerente Plasma**.

O cliente **não precisa** (e não deve) interagir diretamente com o sistema interno do bot.

---

## 🔐 Segurança e Login

* O bot utiliza senha definida por variável de ambiente (`BOT_PASSWORD`).
* Caso a senha não esteja configurada, o worker **não inicia**.
* Login e registro são automáticos.
* Reconexões são tratadas automaticamente em caso de queda.

---

## 🧭 Entrada no Servidor e Lobby

Ao iniciar:

1. O bot conecta ao servidor
2. Realiza login automático
3. Detecta o lobby por item específico (diamante)
4. Entra no servidor correto
5. Executa comandos iniciais (ex: `/loja plasma`, skin, etc.)

O sistema possui um **radar de lobby permanente**: se o bot for devolvido ao lobby por reinício do servidor, ele se reencaixa sozinho.

---

## 🧠 Lógica Modular

A lógica principal do Worker está separada em módulos:

* **Lobby**: controle de estado inicial
* **Movement**: seguir jogador, elevador, parar
* **Combat**: guarda, ataque, defesa
* **Automation**: autoclick, drop de itens, pix
* **Health**: monitoramento de vida

A lógica pode ser atualizada **em tempo real** sem reiniciar o bot.

---

## 🎮 Comandos Disponíveis (Jogadores Autorizados)

Os comandos podem ser enviados por **chat normal ou /tell**.

### 📋 Comandos Básicos

| Comando          | Função                       |
| ---------------- | ---------------------------- |
| `vem`            | Bot segue o jogador          |
| `parar` / `paz`  | Para todas as ações          |
| `subir`          | Ativa elevador (subir)       |
| `descer`         | Ativa elevador (descer)      |
| `guarda`         | Modo guarda (defesa)         |
| `ataque`         | Ataca inimigos próximos      |
| `usar <tempo>`   | Autoclick por tempo definido |
| `itens`          | Dropa itens para o jogador   |
| `pix`            | Envia pix configurado        |
| `loja`           | Abre a loja configurada      |
| `help` / `ajuda` | Lista comandos               |

---

## 🛠️ Modo Suporte (Admin Temporário)

Comando especial:

```
suporte
```

* Concede permissões administrativas ao jogador
* Permite controle total do bot

Para sair:

```
suporte off
```

⚠️ Apenas jogadores autorizados pelo contexto podem usar este modo.

---

## 💀 Morte e Recuperação

* Ao morrer, o bot:

  * avisa no chat
  * interrompe todas as ações
  * respawna automaticamente
  * retorna para `/home`

---

## ⏳ Expiração e Encerramento

* A duração do worker é definida no momento da contratação.
* Ao expirar:

  * o gerente envia o comando `encerrar_contrato`
  * o bot retorna ao `/home`
  * o processo é finalizado automaticamente

Não há tolerância após expiração.

---

## ⚠️ Limitações Importantes

* O worker **não conversa** com jogadores comuns
* Não responde a comandos fora da lista
* Não executa PVP sem ordem
* Não persiste inventário entre contratos
* Não transfere saldo ou estado entre clientes

---

## 🧾 Observações Técnicas

* Logs excessivos são suprimidos automaticamente
* Erros comuns de rede são ignorados
* Sistema projetado para estabilidade contínua

---

## 🔗 Integração com o Gerente Plasma

* O Worker **não gerencia pagamentos**
* Não controla tempo de contrato
* Não decide renovações

Tudo isso é função exclusiva do **Gerente da Loja Plasma**.

---

## 📎 Suporte

Este arquivo faz parte do ecossistema Plasma.

Para informações sobre contratação, tempo restante ou pagamentos, fale com o **Gerente Plasma** via `/tell`.
