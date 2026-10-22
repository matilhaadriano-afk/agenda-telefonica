# 🧠 Aura AI — Chatbot com Memória & Banco de Dados

Um assistente virtual moderno e inteligente construído com **Python (Flask)**, **SQLite**, **HTML5/CSS3/JavaScript** e integração com o **Google Gemini (2.5 Flash)**.

---

## ✨ Recursos Principais

- 🧠 **Memória de Longo Prazo:** A IA consulta um banco de dados relacional (SQLite) antes de responder para lembrar dados pessoais, preferências, anotações e tarefas sobre você.
- 💾 **Banco de Dados SQLite:** Três tabelas principais integradas:
  - `conversations`: Histórico de sessões de chat.
  - `messages`: Mensagens enviadas e recebidas com timestamps.
  - `memories`: Dados e fatos memorizados categorizados (Pessoal, Preferência, Tarefa, Fato, Geral).
  - `settings`: Configurações persistidas (como a chave da API).
- 💬 **Interface Web Futurista (HTML & CSS Moderno):**
  - Dark mode refinado com efeitos glassmorphism e animações suaves.
  - Balões de conversa com suporte completo a Markdown (códigos, listas, tópicos).
  - Indicador de digitação e feedback instantâneo de memórias capturadas.
  - Painel administrativo para pesquisar, adicionar ou excluir memórias salvas no banco.
- ⚡ **Modo Híbrido Inteligente:** Funciona tanto com a API do Google Gemini quanto em modo local inteligente caso nenhuma chave tenha sido informada.

---

## 🚀 Como Executar

### 1. Iniciar o Servidor
Abra o terminal dentro da pasta `chatbot-ia` e execute:

```bash
python app.py
```

### 2. Acessar no Navegador
Abra o navegador no endereço:
```
http://127.0.0.1:5000
```

### 3. Conectar a Chave do Gemini (Opcional, mas recomendado)
- Obtenha uma chave gratuita no [Google AI Studio](https://aistudio.google.com/).
- Cole a chave diretamente na aba **Configurações** na interface web ou em um arquivo `.env` com a variável `GEMINI_API_KEY`.
