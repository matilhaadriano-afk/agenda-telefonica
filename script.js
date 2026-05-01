// Elementos do DOM
const contactForm = document.getElementById('contact-form');
const nameInput = document.getElementById('name');
const phoneInput = document.getElementById('phone');
const contactsContainer = document.getElementById('contacts-container');
const contactCount = document.getElementById('contact-count');
const searchInput = document.getElementById('search');

// Estado da Aplicação
let contacts = JSON.parse(localStorage.getItem('contacts')) || [];

// Máscara de Telefone Simples
phoneInput.addEventListener('input', function(e) {
    let value = e.target.value.replace(/\D/g, ''); // Remove tudo que não é número
    
    // Formatação: (XX) XXXXX-XXXX ou (XX) XXXX-XXXX
    if (value.length > 11) value = value.slice(0, 11);
    
    if (value.length > 2) {
        value = `(${value.slice(0, 2)}) ${value.slice(2)}`;
    }
    if (value.length > 9) {
        value = `${value.slice(0, 10)}-${value.slice(10)}`;
    }
    
    e.target.value = value;
});

// Inicialização
function init() {
    renderContacts(contacts);
}

// Salvar no LocalStorage
function saveContacts() {
    localStorage.setItem('contacts', JSON.stringify(contacts));
}

// Obter iniciais do nome para o avatar
function getInitials(name) {
    return name
        .split(' ')
        .map(n => n[0])
        .slice(0, 2)
        .join('')
        .toUpperCase();
}

// Adicionar Contato
contactForm.addEventListener('submit', function(e) {
    e.preventDefault();

    const name = nameInput.value.trim();
    const phone = phoneInput.value.trim();

    if (name === '' || phone === '') return;

    const newContact = {
        id: Date.now().toString(),
        name: name,
        phone: phone
    };

    contacts.push(newContact);
    saveContacts();
    
    // Animação de adicionar
    renderContacts(contacts);
    
    // Limpar formulário
    nameInput.value = '';
    phoneInput.value = '';
    nameInput.focus();
});

// Excluir Contato
function deleteContact(id) {
    const contactElement = document.querySelector(`[data-id="${id}"]`);
    
    // Adiciona animação de saída
    if (contactElement) {
        contactElement.style.animation = 'fadeOut 0.3s ease-out forwards';
        
        setTimeout(() => {
            contacts = contacts.filter(contact => contact.id !== id);
            saveContacts();
            renderContacts(contacts);
        }, 300); // Espera a animação terminar
    } else {
        contacts = contacts.filter(contact => contact.id !== id);
        saveContacts();
        renderContacts(contacts);
    }
}

// Filtrar Contatos
searchInput.addEventListener('input', function(e) {
    const searchTerm = e.target.value.toLowerCase();
    
    const filteredContacts = contacts.filter(contact => 
        contact.name.toLowerCase().includes(searchTerm) || 
        contact.phone.includes(searchTerm)
    );
    
    renderContacts(filteredContacts);
});

// Renderizar Contatos
function renderContacts(contactsToRender) {
    contactsContainer.innerHTML = '';
    contactCount.textContent = contacts.length;

    if (contactsToRender.length === 0) {
        contactsContainer.innerHTML = `
            <div class="empty-state">
                <i class="fa-regular fa-address-book"></i>
                <p>${contacts.length === 0 ? 'Nenhum contato na sua agenda.' : 'Nenhum contato encontrado.'}</p>
            </div>
        `;
        return;
    }

    // Ordenar alfabeticamente
    const sortedContacts = [...contactsToRender].sort((a, b) => a.name.localeCompare(b.name));

    sortedContacts.forEach(contact => {
        const contactEl = document.createElement('div');
        contactEl.classList.add('contact-item');
        contactEl.setAttribute('data-id', contact.id);

        contactEl.innerHTML = `
            <div class="contact-info">
                <div class="contact-avatar">${getInitials(contact.name)}</div>
                <div class="contact-details">
                    <h3>${contact.name}</h3>
                    <p><i class="fa-solid fa-phone fa-xs"></i> ${contact.phone}</p>
                </div>
            </div>
            <button class="btn-delete" onclick="deleteContact('${contact.id}')" aria-label="Excluir contato" title="Excluir">
                <i class="fa-solid fa-trash-can"></i>
            </button>
        `;

        contactsContainer.appendChild(contactEl);
    });
}

// Iniciar a aplicação
init();
