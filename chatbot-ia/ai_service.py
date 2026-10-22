import os
import json
import re
from database import get_connection
from memory_service import get_memories_context, add_or_update_memory

# Tenta importar google-genai
try:
    from google import genai
    from google.genai import types
    HAS_GENAI = True
except ImportError:
    HAS_GENAI = False

def get_api_key():
    """Busca a chave no .env / ambiente ou no banco de dados SQLite"""
    env_key = os.getenv("GEMINI_API_KEY")
    if env_key and env_key.strip():
        return env_key.strip()
    
    conn = get_connection()
    cursor = conn.cursor()
    cursor.execute("SELECT value FROM settings WHERE key = 'gemini_api_key'")
    row = cursor.fetchone()
    conn.close()
    if row and row["value"]:
        return row["value"].strip()
    return None

def save_api_key(key):
    conn = get_connection()
    cursor = conn.cursor()
    cursor.execute(
        """
        INSERT INTO settings (key, value) VALUES ('gemini_api_key', ?)
        ON CONFLICT(key) DO UPDATE SET value = excluded.value
        """,
        (key.strip(),)
    )
    conn.commit()
    conn.close()

def auto_detect_memory_from_text(user_message):
    """
    Regras heurísticas locais para extrair memórias mesmo offline
    ou em conjunto com a IA.
    """
    msg_lower = user_message.lower()
    patterns = [
        (r"(?:lembre-se que|lembre que|lembra que|não esquece que|guarde que)\s+(.*)", "Geral"),
        (r"(?:meu nome é|me chamo)\s+([A-Za-zÀ-ÖØ-öø-ÿ\s]+)", "Pessoal", "Nome do usuário"),
        (r"(?:meu aniversário é|faço aniversário em|nasci em)\s+(.*)", "Pessoal", "Aniversário"),
        (r"(?:eu moro em|minha cidade é|vivo em)\s+(.*)", "Pessoal", "Localização"),
        (r"(?:minha comida favorita é|adoro comer|gosto de comer)\s+(.*)", "Preferência", "Comida favorita"),
        (r"(?:minha linguagem favorita é|eu programo em|minha stack é)\s+(.*)", "Preferência", "Linguagem / Stack"),
        (r"(?:anote|anota|tarefa|lembrete):\s*(.*)", "Tarefa", "Lembrete / Tarefa"),
    ]
    
    extracted = []
    for pat in patterns:
        match = re.search(pat[0], msg_lower)
        if match:
            content = match.group(1).strip()
            # Limpa pontuação final
            content = content.rstrip(".,;!?")
            category = pat[1]
            topic = pat[2] if len(pat) > 2 else f"Informação: {content[:30]}..."
            add_or_update_memory(category, topic, user_message.strip())
            extracted.append({"category": category, "topic": topic, "content": user_message.strip()})
            break
            
    return extracted

def generate_ai_response(conversation_history, user_message):
    """
    Gera a resposta do assistente usando o Google Gemini ou fallback local inteligente,
    garantindo que o bot consulte e lembre de todos os dados do banco SQLite.
    """
    # 1. Detecta memórias no texto do usuário
    auto_memories = auto_detect_memory_from_text(user_message)
    
    # 2. Obtém memórias existentes atualizadas
    memories_text = get_memories_context()
    
    api_key = get_api_key()
    
    system_instruction = f"""Você é a **Aura**, uma Inteligência Artificial assistente pessoal avançada e empática.
Você possui um módulo especial de banco de dados onde armazena memórias de longo prazo do usuário.

{memories_text}

DIRETRIZES FUNDAMENTAIS:
1. Sempre use os dados lembrados acima para personalizar suas respostas quando for pertinente (ex: cumprimente pelo nome se souber, mencione as preferências do usuário, consulte datas e notas lembradas).
2. Se o usuário pedir para você lembrar de algo novo, anotações, tarefas ou preferências, confirme calorosamente que guardou essa informação no banco de dados e mencione o que guardou.
3. Responda em Português do Brasil com clareza, formatação rica em Markdown (tópicos, negrito, etc.) e gentileza.
4. Se o usuário perguntar o que você lembra sobre ele, liste claramente todas as memórias que constam nos dados acima.
"""

    if api_key and HAS_GENAI:
        try:
            client = genai.Client(api_key=api_key)
            
            # Monta histórico de mensagens
            contents = []
            for msg in conversation_history[-10:]:  # últimos 10 turnos
                role = "user" if msg["sender"] == "user" else "model"
                contents.append(types.Content(
                    role=role,
                    parts=[types.Part.from_text(text=msg["content"])]
                ))
            
            # Adiciona mensagem atual
            contents.append(types.Content(
                role="user",
                parts=[types.Part.from_text(text=user_message)]
            ))
            
            config = types.GenerateContentConfig(
                system_instruction=system_instruction,
                temperature=0.7,
            )
            
            response = client.models.generate_content(
                model="gemini-2.5-flash",
                contents=contents,
                config=config
            )
            
            return {
                "response": response.text,
                "model_used": "gemini-2.5-flash",
                "extracted_memories": auto_memories
            }
        except Exception as e:
            error_msg = str(e)
            print(f"Erro ao chamar Gemini API: {error_msg}")
            # Se der erro na chave ou quota, cai no fallback com aviso amigável
            fallback_text = (
                f"⚠️ *Houve um erro na comunicação com a API do Gemini:* `{error_msg}`\n\n"
                f"**Ainda assim, acessei o seu Banco de Dados Local!**\n\n"
                f"{_local_smart_response(user_message, memories_text)}"
            )
            return {
                "response": fallback_text,
                "model_used": "local-fallback",
                "extracted_memories": auto_memories
            }

    # Fallback local quando nenhuma API Key foi informada ainda
    local_reply = _local_smart_response(user_message, memories_text, prompt_api_key=True)
    return {
        "response": local_reply,
        "model_used": "local-smart-agent",
        "extracted_memories": auto_memories
    }

def _local_smart_response(user_message, memories_text, prompt_api_key=False):
    msg_lower = user_message.lower()
    
    if any(w in msg_lower for w in ["o que você lembra", "o que lembra", "quais dados", "minhas memórias", "o que você sabe sobre mim"]):
        return (
            f"🧠 **Aqui está o que tenho guardado no Banco de Dados SQLite sobre você:**\n\n"
            f"{memories_text}\n\n"
            f"*Você pode ver, adicionar ou gerenciar mais itens na aba lateral 'Memórias & Dados'!*"
        )
        
    if any(w in msg_lower for w in ["lembre-se", "lembre que", "anote", "guarde"]):
        return (
            "✅ **Entendido! Salvei essa informação no meu Banco de Dados.**\n\n"
            "Eu sempre consultarei esse dado antes de responder suas próximas mensagens. "
            "Você pode conferir a lista completa de lembranças a qualquer momento na aba **Memórias & Dados**."
        )

    # Resposta padrão local
    text = (
        "Olá! Sou a **Aura**, sua IA assistente com memória de longo prazo e banco de dados SQLite.\n\n"
        "Estou pronta para conversar, registrar dados e lembrar de tudo o que você me disser!\n\n"
    )
    
    if prompt_api_key:
        text += (
            "💡 **Dica de Integração:**\n"
            "Atualmente estou operando no modo local. Para ativar o poder total do modelo **Google Gemini (2.5 Flash)**:\n"
            "1. Obtenha uma chave gratuita no [Google AI Studio](https://aistudio.google.com/)\n"
            "2. Cole sua chave na aba **⚙️ Configurações** no topo da página ou no arquivo `.env`.\n\n"
            "Enquanto isso, você já pode testar meu banco de dados pedindo: *'Lembre-se que eu moro em São Paulo'* ou *'O que você lembra sobre mim?'*!"
        )
    return text
