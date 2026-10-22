import os
import uuid
from flask import Flask, render_template, request, jsonify
from dotenv import load_dotenv

# Carrega variáveis de ambiente do .env se existir
load_dotenv()

from database import init_db, get_connection
from memory_service import list_memories, add_or_update_memory, delete_memory
from ai_service import generate_ai_response, get_api_key, save_api_key

app = Flask(__name__)

# Garante que o banco de dados e tabelas estejam criados
init_db()

@app.route("/")
def index():
    return render_template("index.html")

# ==================== ROTAS DE CONVERSAS ====================

@app.route("/api/conversations", methods=["GET"])
def get_conversations():
    conn = get_connection()
    cursor = conn.cursor()
    cursor.execute("""
        SELECT c.*, 
               (SELECT COUNT(*) FROM messages m WHERE m.conversation_id = c.id) as message_count
        FROM conversations c 
        ORDER BY c.updated_at DESC
    """)
    rows = cursor.fetchall()
    conn.close()
    return jsonify([dict(r) for r in rows])

@app.route("/api/conversations", methods=["POST"])
def create_conversation():
    data = request.get_json() or {}
    title = data.get("title", "Nova Conversa").strip() or "Nova Conversa"
    conv_id = str(uuid.uuid4())
    
    conn = get_connection()
    cursor = conn.cursor()
    cursor.execute(
        "INSERT INTO conversations (id, title) VALUES (?, ?)",
        (conv_id, title)
    )
    conn.commit()
    conn.close()
    
    return jsonify({"id": conv_id, "title": title}), 201

@app.route("/api/conversations/<conv_id>", methods=["GET"])
def get_conversation_messages(conv_id):
    conn = get_connection()
    cursor = conn.cursor()
    cursor.execute("SELECT * FROM conversations WHERE id = ?", (conv_id,))
    conv = cursor.fetchone()
    if not conv:
        conn.close()
        return jsonify({"error": "Conversa não encontrada"}), 404
        
    cursor.execute(
        "SELECT * FROM messages WHERE conversation_id = ? ORDER BY created_at ASC",
        (conv_id,)
    )
    msgs = cursor.fetchall()
    conn.close()
    
    return jsonify({
        "conversation": dict(conv),
        "messages": [dict(m) for m in msgs]
    })

@app.route("/api/conversations/<conv_id>", methods=["DELETE"])
def delete_conversation_route(conv_id):
    conn = get_connection()
    cursor = conn.cursor()
    cursor.execute("DELETE FROM messages WHERE conversation_id = ?", (conv_id,))
    cursor.execute("DELETE FROM conversations WHERE id = ?", (conv_id,))
    conn.commit()
    conn.close()
    return jsonify({"success": True})

# ==================== ROTA DE CHAT ====================

@app.route("/api/chat", methods=["POST"])
def chat():
    data = request.get_json() or {}
    conv_id = data.get("conversation_id")
    user_message = data.get("message", "").strip()
    
    if not user_message:
        return jsonify({"error": "Mensagem não pode estar vazia"}), 400
        
    conn = get_connection()
    cursor = conn.cursor()
    
    # Se não foi fornecido conv_id ou não existir, cria uma nova conversa
    if not conv_id:
        conv_id = str(uuid.uuid4())
        # Cria título inicial baseado nos primeiros caracteres da mensagem
        title = (user_message[:28] + "...") if len(user_message) > 28 else user_message
        cursor.execute("INSERT INTO conversations (id, title) VALUES (?, ?)", (conv_id, title))
    else:
        cursor.execute("SELECT * FROM conversations WHERE id = ?", (conv_id,))
        if not cursor.fetchone():
            title = (user_message[:28] + "...") if len(user_message) > 28 else user_message
            cursor.execute("INSERT INTO conversations (id, title) VALUES (?, ?)", (conv_id, title))
            
    # Salva a mensagem do usuário no SQLite
    cursor.execute(
        "INSERT INTO messages (conversation_id, sender, content) VALUES (?, 'user', ?)",
        (conv_id, user_message)
    )
    conn.commit()
    
    # Carrega histórico para dar contexto à IA
    cursor.execute(
        "SELECT sender, content FROM messages WHERE conversation_id = ? ORDER BY created_at ASC",
        (conv_id,)
    )
    history = [dict(m) for m in cursor.fetchall()]
    conn.close()
    
    # Chama o serviço de IA com as memórias de longo prazo
    ai_result = generate_ai_response(history, user_message)
    bot_reply = ai_result["response"]
    
    # Salva resposta do assistente no SQLite
    conn = get_connection()
    cursor = conn.cursor()
    cursor.execute(
        "INSERT INTO messages (conversation_id, sender, content) VALUES (?, 'assistant', ?)",
        (conv_id, bot_reply)
    )
    # Atualiza timestamp da conversa
    cursor.execute(
        "UPDATE conversations SET updated_at = CURRENT_TIMESTAMP WHERE id = ?",
        (conv_id,)
    )
    conn.commit()
    conn.close()
    
    return jsonify({
        "conversation_id": conv_id,
        "response": bot_reply,
        "model_used": ai_result.get("model_used"),
        "extracted_memories": ai_result.get("extracted_memories", [])
    })

# ==================== ROTAS DE MEMÓRIA ====================

@app.route("/api/memories", methods=["GET"])
def get_memories():
    search = request.args.get("q", "")
    return jsonify(list_memories(search))

@app.route("/api/memories", methods=["POST"])
def create_memory():
    data = request.get_json() or {}
    category = data.get("category", "Geral")
    key_topic = data.get("key_topic", "")
    content = data.get("content", "")
    
    if not key_topic or not content:
        return jsonify({"error": "Tópico e Conteúdo são obrigatórios"}), 400
        
    mem_id = add_or_update_memory(category, key_topic, content)
    return jsonify({"id": mem_id, "success": True}), 201

@app.route("/api/memories/<int:mem_id>", methods=["DELETE"])
def remove_memory(mem_id):
    deleted = delete_memory(mem_id)
    return jsonify({"success": deleted})

# ==================== ROTAS DE CONFIGURAÇÃO E STATS ====================

@app.route("/api/settings", methods=["GET"])
def get_settings():
    key = get_api_key()
    masked = f"{key[:6]}...{key[-4:]}" if key and len(key) > 10 else ("Configurada" if key else "Não configurada")
    return jsonify({
        "has_api_key": bool(key),
        "masked_key": masked
    })

@app.route("/api/settings", methods=["POST"])
def update_settings():
    data = request.get_json() or {}
    api_key = data.get("api_key", "").strip()
    if not api_key:
        return jsonify({"error": "Chave API não informada"}), 400
    save_api_key(api_key)
    return jsonify({"success": True})

@app.route("/api/stats", methods=["GET"])
def get_stats():
    conn = get_connection()
    cursor = conn.cursor()
    cursor.execute("SELECT COUNT(*) FROM conversations")
    total_convs = cursor.fetchone()[0]
    cursor.execute("SELECT COUNT(*) FROM messages")
    total_msgs = cursor.fetchone()[0]
    cursor.execute("SELECT COUNT(*) FROM memories")
    total_mems = cursor.fetchone()[0]
    conn.close()
    
    return jsonify({
        "conversations": total_convs,
        "messages": total_msgs,
        "memories": total_mems
    })

if __name__ == "__main__":
    print("Iniciando Aura AI Chatbot no endereço: http://127.0.0.1:5000")
    app.run(host="127.0.0.1", port=5000, debug=True)
