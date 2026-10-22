// ESTADO DA APLICAÇÃO
let currentConversationId = null;
let currentCategoryFilter = "all";

// ELEMENTOS DOM
const sidebar = document.getElementById("sidebar");
const btnToggleSidebar = document.getElementById("btn-toggle-sidebar");
const btnNewChat = document.getElementById("btn-new-chat");
const conversationsList = document.getElementById("conversations-list");
const chatMessages = document.getElementById("chat-messages");
const chatForm = document.getElementById("chat-form");
const userInput = document.getElementById("user-input");
const btnSend = document.getElementById("btn-send");
const currentChatTitle = document.getElementById("current-chat-title");
const btnDeleteConv = document.getElementById("btn-delete-conv");
const memoryToast = document.getElementById("memory-toast");
const toastText = document.getElementById("toast-text");

// Abas
const navTabs = document.querySelectorAll(".nav-tab");
const tabPanes = document.querySelectorAll(".tab-pane");

// Memórias
const memoriesGrid = document.getElementById("memories-grid");
const memorySearch = document.getElementById("memory-search");
const categoryFilters = document.querySelectorAll(".filter-chip");
const btnOpenAddMemory = document.getElementById("btn-open-add-memory");
const memoryModal = document.getElementById("memory-modal");
const btnCloseModal = document.getElementById("btn-close-modal");
const btnCancelModal = document.getElementById("btn-cancel-modal");
const formMemory = document.getElementById("form-memory");

// Configurações
const settingsForm = document.getElementById("settings-form");
const geminiKeyInput = document.getElementById("gemini-key-input");
const apiKeyStatus = document.getElementById("api-key-status");
const toggleKeyVisibility = document.getElementById("toggle-key-visibility");

// Stats
const statMemories = document.getElementById("stat-memories");
const statMessages = document.getElementById("stat-messages");
const statConversations = document.getElementById("stat-conversations");
const sidebarMemCount = document.getElementById("sidebar-mem-count");

// ==================== INICIALIZAÇÃO ====================
document.addEventListener("DOMContentLoaded", () => {
    loadConversations();
    loadMemories();
    loadSettings();
    updateStats();
    setupEventListeners();
});

function setupEventListeners() {
    // Alternar abas
    navTabs.forEach(tab => {
        tab.addEventListener("click", () => {
            const targetTab = tab.getAttribute("data-tab");
            switchTab(targetTab);
        });
    });

    // Botão ver o que lembra (atalho rápido no header)
    document.getElementById("btn-show-memories-quick")?.addEventListener("click", () => {
        switchTab("memories");
    });

    // Envio do Chat
    chatForm.addEventListener("submit", handleChatSubmit);

    // Ajuste automático de altura da textarea & Envio com Enter
    userInput.addEventListener("input", autoResizeTextarea);
    userInput.addEventListener("keydown", (e) => {
        if (e.key === "Enter" && !e.shiftKey) {
            e.preventDefault();
            chatForm.dispatchEvent(new Event("submit"));
        }
    });

    // Nova Conversa
    btnNewChat.addEventListener("click", () => {
        startNewConversation();
        switchTab("chat");
    });

    // Excluir conversa atual
    btnDeleteConv.addEventListener("click", handleDeleteCurrentConversation);

    // Prompts rápidos do card de boas vindas
    document.querySelectorAll(".prompt-chip").forEach(chip => {
        chip.addEventListener("click", () => {
            const prompt = chip.getAttribute("data-prompt");
            userInput.value = prompt;
            autoResizeTextarea();
            userInput.focus();
        });
    });

    // Busca de memórias
    memorySearch.addEventListener("input", (e) => {
        loadMemories(e.target.value.trim());
    });

    // Filtros de categoria
    categoryFilters.forEach(chip => {
        chip.addEventListener("click", () => {
            categoryFilters.forEach(c => c.classList.remove("active"));
            chip.classList.add("active");
            currentCategoryFilter = chip.getAttribute("data-cat");
            filterMemoriesDOM();
        });
    });

    // Modal de Memória
    btnOpenAddMemory.addEventListener("click", () => {
        formMemory.reset();
        memoryModal.classList.add("active");
    });

    btnCloseModal.addEventListener("click", () => memoryModal.classList.remove("active"));
    btnCancelModal.addEventListener("click", () => memoryModal.classList.remove("active"));
    formMemory.addEventListener("submit", handleSaveManualMemory);

    // Configurações
    settingsForm.addEventListener("submit", handleSaveSettings);
    toggleKeyVisibility.addEventListener("click", () => {
        const isPass = geminiKeyInput.type === "password";
        geminiKeyInput.type = isPass ? "text" : "password";
        toggleKeyVisibility.innerHTML = isPass ? '<i class="fa-solid fa-eye-slash"></i>' : '<i class="fa-solid fa-eye"></i>';
    });

    // Toggle Sidebar em mobile
    btnToggleSidebar.addEventListener("click", () => {
        sidebar.classList.toggle("open");
    });
}

function autoResizeTextarea() {
    userInput.style.height = "auto";
    userInput.style.height = Math.min(userInput.scrollHeight, 140) + "px";
}

function switchTab(tabName) {
    navTabs.forEach(t => {
        t.classList.toggle("active", t.getAttribute("data-tab") === tabName);
    });
    tabPanes.forEach(pane => {
        pane.classList.toggle("active", pane.id === `tab-${tabName}`);
    });
    if (tabName === "memories") {
        loadMemories();
    }
}

// ==================== CONVERSAS E MENSAGENS ====================

async function loadConversations() {
    try {
        const res = await fetch("/api/conversations");
        const convs = await res.json();
        
        conversationsList.innerHTML = "";
        if (convs.length === 0) {
            conversationsList.innerHTML = `<p style="padding: 10px; font-size: 0.8rem; color: var(--text-faint);">Nenhuma conversa ainda.</p>`;
            return;
        }

        convs.forEach(conv => {
            const div = document.createElement("div");
            div.className = `conv-item ${conv.id === currentConversationId ? "active" : ""}`;
            div.innerHTML = `
                <span class="conv-title"><i class="fa-regular fa-message" style="margin-right: 8px;"></i>${escapeHtml(conv.title)}</span>
                <span class="conv-badge">${conv.message_count || 0}</span>
            `;
            div.addEventListener("click", () => selectConversation(conv.id, conv.title));
            conversationsList.appendChild(div);
        });
    } catch (err) {
        console.error("Erro ao carregar conversas:", err);
    }
}

async function selectConversation(convId, convTitle) {
    currentConversationId = convId;
    currentChatTitle.textContent = convTitle || "Conversa Ativa";
    
    // Atualiza estado ativo na sidebar
    document.querySelectorAll(".conv-item").forEach(item => {
        item.classList.remove("active");
    });
    loadConversations();

    // Carrega mensagens
    try {
        const res = await fetch(`/api/conversations/${convId}`);
        const data = await res.json();
        renderMessages(data.messages || []);
    } catch (err) {
        console.error("Erro ao obter mensagens:", err);
    }
}

function startNewConversation() {
    currentConversationId = null;
    currentChatTitle.textContent = "Nova Conversa";
    chatMessages.innerHTML = `
        <div class="welcome-card">
            <div class="welcome-icon">
                <i class="fa-solid fa-sparkles"></i>
            </div>
            <h2>Nova Conversa Iniciada</h2>
            <p>O que você gostaria de explorar ou guardar na memória hoje?</p>
            <div class="quick-prompts">
                <button class="prompt-chip" data-prompt="Lembre-se que eu moro em São Paulo e gosto de café">
                    💡 "Lembre-se que eu moro em São Paulo..."
                </button>
                <button class="prompt-chip" data-prompt="O que você lembra sobre mim?">
                    🧠 "O que você lembra sobre mim?"
                </button>
            </div>
        </div>
    `;
    // Reassocia eventos aos chips
    chatMessages.querySelectorAll(".prompt-chip").forEach(chip => {
        chip.addEventListener("click", () => {
            userInput.value = chip.getAttribute("data-prompt");
            userInput.focus();
        });
    });
    userInput.focus();
}

async function handleDeleteCurrentConversation() {
    if (!currentConversationId) {
        alert("Nenhuma conversa selecionada para excluir.");
        return;
    }
    if (!confirm("Tem certeza que deseja excluir esta conversa? As memórias gravadas no banco continuarão salvas.")) {
        return;
    }

    try {
        await fetch(`/api/conversations/${currentConversationId}`, { method: "DELETE" });
        startNewConversation();
        loadConversations();
        updateStats();
    } catch (err) {
        console.error("Erro ao deletar conversa:", err);
    }
}

function renderMessages(messages) {
    chatMessages.innerHTML = "";
    if (messages.length === 0) {
        startNewConversation();
        return;
    }

    messages.forEach(msg => {
        appendMessageBubble(msg.sender, msg.content);
    });
    scrollToBottom();
}

function appendMessageBubble(sender, content) {
    const isUser = sender === "user";
    const row = document.createElement("div");
    row.className = `message-row ${isUser ? "user" : "assistant"}`;

    const avatarHtml = isUser 
        ? `<div class="avatar"><i class="fa-solid fa-user"></i></div>` 
        : `<div class="avatar"><i class="fa-solid fa-sparkles"></i></div>`;

    const parsedContent = isUser ? escapeHtml(content) : (typeof marked !== "undefined" ? marked.parse(content) : escapeHtml(content));

    row.innerHTML = `
        ${avatarHtml}
        <div class="bubble">
            ${parsedContent}
        </div>
    `;

    chatMessages.appendChild(row);
    scrollToBottom();
}

function showTypingIndicator() {
    const row = document.createElement("div");
    row.className = "message-row assistant typing-indicator-row";
    row.id = "typing-indicator";
    row.innerHTML = `
        <div class="avatar"><i class="fa-solid fa-sparkles"></i></div>
        <div class="bubble">
            <div class="typing-dots">
                <span></span><span></span><span></span>
            </div>
        </div>
    `;
    chatMessages.appendChild(row);
    scrollToBottom();
}

function removeTypingIndicator() {
    const indicator = document.getElementById("typing-indicator");
    if (indicator) indicator.remove();
}

async function handleChatSubmit(e) {
    e.preventDefault();
    const text = userInput.value.trim();
    if (!text) return;

    // Limpa input
    userInput.value = "";
    userInput.style.height = "auto";

    // Se houver welcome card no chatMessages, limpa
    const welcomeCard = chatMessages.querySelector(".welcome-card");
    if (welcomeCard) welcomeCard.remove();

    // Adiciona bolha do usuário
    appendMessageBubble("user", text);
    showTypingIndicator();

    try {
        const res = await fetch("/api/chat", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                conversation_id: currentConversationId,
                message: text
            })
        });

        const data = await res.json();
        removeTypingIndicator();

        if (res.ok) {
            currentConversationId = data.conversation_id;
            appendMessageBubble("assistant", data.response);

            // Se novas memórias foram extraídas automaticamente
            if (data.extracted_memories && data.extracted_memories.length > 0) {
                const mem = data.extracted_memories[0];
                showToast(`🧠 Memória salva: [${mem.category}] ${mem.topic}`);
                loadMemories();
            }

            loadConversations();
            updateStats();
        } else {
            appendMessageBubble("assistant", `⚠️ Erro: ${data.error || "Não foi possível processar a mensagem."}`);
        }
    } catch (err) {
        removeTypingIndicator();
        appendMessageBubble("assistant", `⚠️ Erro de conexão com o servidor.`);
        console.error(err);
    }
}

// ==================== MEMÓRIAS & BANCO DE DADOS ====================

let allLoadedMemories = [];

async function loadMemories(search = "") {
    try {
        const url = search ? `/api/memories?q=${encodeURIComponent(search)}` : "/api/memories";
        const res = await fetch(url);
        allLoadedMemories = await res.json();
        filterMemoriesDOM();
        sidebarMemCount.textContent = allLoadedMemories.length;
        statMemories.textContent = allLoadedMemories.length;
    } catch (err) {
        console.error("Erro ao carregar memórias:", err);
    }
}

function filterMemoriesDOM() {
    const filtered = allLoadedMemories.filter(m => {
        if (currentCategoryFilter === "all") return true;
        return m.category.toLowerCase() === currentCategoryFilter.toLowerCase();
    });

    renderMemoriesGrid(filtered);
}

function renderMemoriesGrid(memories) {
    memoriesGrid.innerHTML = "";

    if (memories.length === 0) {
        memoriesGrid.innerHTML = `
            <div style="grid-column: 1 / -1; text-align: center; padding: 40px; color: var(--text-faint);">
                <i class="fa-solid fa-brain" style="font-size: 2.5rem; margin-bottom: 12px; opacity: 0.4;"></i>
                <p>Nenhuma memória encontrada no banco de dados.</p>
                <small>Converse com a Aura ou use o botão 'Adicionar Dado Manualmente' acima!</small>
            </div>
        `;
        return;
    }

    memories.forEach(mem => {
        const card = document.createElement("div");
        card.className = "memory-card";
        const badgeClass = (mem.category || "geral").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");

        card.innerHTML = `
            <div>
                <div class="mem-top">
                    <span class="mem-badge ${badgeClass}">${escapeHtml(mem.category)}</span>
                    <button class="btn-icon danger" onclick="deleteMemoryItem(${mem.id})" title="Excluir do banco" style="width: 28px; height: 28px;">
                        <i class="fa-solid fa-trash-can" style="font-size: 0.75rem;"></i>
                    </button>
                </div>
                <div class="mem-topic">${escapeHtml(mem.key_topic)}</div>
                <div class="mem-content">${escapeHtml(mem.content)}</div>
            </div>
            <div class="mem-footer">
                <span><i class="fa-solid fa-clock"></i> Gravado no SQLite</span>
                <span>ID #${mem.id}</span>
            </div>
        `;
        memoriesGrid.appendChild(card);
    });
}

window.deleteMemoryItem = async function(id) {
    if (!confirm("Excluir esta memória do banco de dados? A IA deixará de lembrar deste fato.")) return;
    try {
        await fetch(`/api/memories/${id}`, { method: "DELETE" });
        showToast("Memória removida do banco de dados.");
        loadMemories();
        updateStats();
    } catch (err) {
        console.error("Erro ao deletar memória:", err);
    }
};

async function handleSaveManualMemory(e) {
    e.preventDefault();
    const category = document.getElementById("modal-cat").value;
    const key_topic = document.getElementById("modal-topic").value.trim();
    const content = document.getElementById("modal-content").value.trim();

    if (!key_topic || !content) return;

    try {
        const res = await fetch("/api/memories", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ category, key_topic, content })
        });

        if (res.ok) {
            memoryModal.classList.remove("active");
            showToast("Dado guardado no Banco de Dados com sucesso!");
            loadMemories();
            updateStats();
        }
    } catch (err) {
        console.error("Erro ao salvar memória:", err);
    }
}

// ==================== CONFIGURAÇÕES ====================

async function loadSettings() {
    try {
        const res = await fetch("/api/settings");
        const data = await res.json();
        if (data.has_api_key) {
            apiKeyStatus.innerHTML = `<span style="color: var(--success);"><i class="fa-solid fa-check"></i> ${data.masked_key}</span>`;
        } else {
            apiKeyStatus.innerHTML = `<span style="color: var(--warning);"><i class="fa-solid fa-triangle-exclamation"></i> Não configurada (Usando Modo Local)</span>`;
        }
    } catch (err) {
        console.error("Erro ao carregar settings:", err);
    }
}

async function handleSaveSettings(e) {
    e.preventDefault();
    const key = geminiKeyInput.value.trim();
    if (!key) return;

    try {
        const res = await fetch("/api/settings", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ api_key: key })
        });
        if (res.ok) {
            geminiKeyInput.value = "";
            showToast("Chave da API Gemini atualizada com sucesso!");
            loadSettings();
        }
    } catch (err) {
        console.error("Erro ao salvar chave:", err);
    }
}

// ==================== ESTATÍSTICAS ====================

async function updateStats() {
    try {
        const res = await fetch("/api/stats");
        const data = await res.json();
        statMemories.textContent = data.memories;
        statMessages.textContent = data.messages;
        statConversations.textContent = data.conversations;
        sidebarMemCount.textContent = data.memories;
    } catch (err) {
        console.error("Erro ao atualizar estatísticas:", err);
    }
}

// ==================== UTILITÁRIOS ====================

function showToast(message) {
    toastText.textContent = message;
    memoryToast.classList.add("show");
    setTimeout(() => {
        memoryToast.classList.remove("show");
    }, 4000);
}

function scrollToBottom() {
    chatMessages.scrollTop = chatMessages.scrollHeight;
}

function escapeHtml(str) {
    if (!str) return "";
    return str
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
}
