from database import get_connection

def list_memories(search_term=""):
    conn = get_connection()
    cursor = conn.cursor()
    if search_term:
        query = """
            SELECT * FROM memories 
            WHERE key_topic LIKE ? OR content LIKE ? OR category LIKE ?
            ORDER BY updated_at DESC
        """
        wildcard = f"%{search_term}%"
        cursor.execute(query, (wildcard, wildcard, wildcard))
    else:
        cursor.execute("SELECT * FROM memories ORDER BY updated_at DESC")
    
    rows = cursor.fetchall()
    conn.close()
    return [dict(r) for r in rows]

def add_or_update_memory(category, key_topic, content):
    conn = get_connection()
    cursor = conn.cursor()
    
    # Verifica se já existe um tópico parecido na mesma categoria
    cursor.execute(
        "SELECT id FROM memories WHERE LOWER(key_topic) = LOWER(?)", 
        (key_topic.strip(),)
    )
    existing = cursor.fetchone()
    
    if existing:
        cursor.execute(
            """
            UPDATE memories 
            SET category = ?, content = ?, updated_at = CURRENT_TIMESTAMP
            WHERE id = ?
            """,
            (category.strip(), content.strip(), existing["id"])
        )
        mem_id = existing["id"]
    else:
        cursor.execute(
            """
            INSERT INTO memories (category, key_topic, content)
            VALUES (?, ?, ?)
            """,
            (category.strip(), key_topic.strip(), content.strip())
        )
        mem_id = cursor.lastrowid
        
    conn.commit()
    conn.close()
    return mem_id

def delete_memory(memory_id):
    conn = get_connection()
    cursor = conn.cursor()
    cursor.execute("DELETE FROM memories WHERE id = ?", (memory_id,))
    deleted = cursor.rowcount > 0
    conn.commit()
    conn.close()
    return deleted

def get_memories_context():
    """Retorna uma string formatada com todas as memórias conhecidas para injetar no system prompt da IA"""
    memories = list_memories()
    if not memories:
        return "Nenhuma memória ou dado pessoal foi registrado ainda."
    
    lines = ["DADOS E MEMÓRIAS QUE VOCÊ DEVE LEMBRAR SOBRE O USUÁRIO E O CONTEXTO:"]
    for m in memories:
        lines.append(f"- [{m['category']}] {m['key_topic']}: {m['content']}")
    return "\n".join(lines)
