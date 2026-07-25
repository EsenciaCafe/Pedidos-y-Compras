import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
import { getFirestore, doc, setDoc, getDoc, onSnapshot } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";

const firebaseConfig = {
  apiKey: "AIzaSyBRckUgIWW36rZ8Wv52yZnrxY5VsFatf4E",
  authDomain: "chickencrunchersapp.firebaseapp.com",
  projectId: "chickencrunchersapp",
  storageBucket: "chickencrunchersapp.firebasestorage.app",
  messagingSenderId: "947163923288",
  appId: "1:947163923288:web:8ee5fd7758e146a1e99b2d",
  measurementId: "G-HT3CWMWWEP"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

const refTiendas = doc(db, 'cafeteria', 'bdTiendas');
const refLista = doc(db, 'cafeteria', 'listaActiva');

const urlParams = new URLSearchParams(window.location.search);
const isJefe = urlParams.get('role') === 'jefe';

const views = {
    input: document.getElementById('view-input'),
    tiendas: document.getElementById('view-tiendas'),
    checklist: document.getElementById('view-checklist')
};

const syncIndicator = document.getElementById('sync-indicator');
const btnNuevaLista = document.getElementById('btn-nueva-lista');
let bdTiendas = {};
let listaActual = [];
let itemsPendientes = [];
let itemSeleccionadoIndex = null;

const tiendasBase = ['Mercadona', 'Makro', 'Frutería', 'Otros'];
let tiendasExtra = [];

if (isJefe) {
    btnNuevaLista.classList.remove('hidden');
}

// Cargar tiendas y extraer tiendas guardadas históricamente
getDoc(refTiendas).then(snap => {
    if (snap.exists()) {
        bdTiendas = snap.data();
        const allStores = Object.values(bdTiendas);
        tiendasExtra = [...new Set(allStores)].filter(t => !tiendasBase.includes(t));
    }
    renderChips();
});

onSnapshot(refLista, (snap) => {
    if (snap.exists()) {
        listaActual = snap.data().items || [];
        if (listaActual.length > 0 && itemsPendientes.length === 0) {
            mostrarChecklist();
        } else if (listaActual.length === 0) {
            if (isJefe) cambiarVista(views.input);
            else {
                cambiarVista(views.checklist);
                document.getElementById('contenedor-checklist').innerHTML = '<p class="instruction">No hay pedidos activos.</p>';
            }
        }
    } else {
        if (isJefe) cambiarVista(views.input);
    }
});

function setSyncing(status) {
    if(status) syncIndicator.classList.remove('hidden');
    else syncIndicator.classList.add('hidden');
}

btnNuevaLista.addEventListener('click', async () => {
    if(confirm('¿Crear nueva lista? Esto la borrará del móvil del empleado.')) {
        setSyncing(true);
        await setDoc(refLista, { items: [] });
        document.getElementById('texto-pedido').value = '';
        setSyncing(false);
    }
});

document.getElementById('btn-procesar').addEventListener('click', () => {
    const texto = document.getElementById('texto-pedido').value;
    const regex = /-\s*(.*?)\s*(?:—|-)\s*(.*)/;
    const nuevosItems = [];

    texto.split('\n').forEach(linea => {
        const match = linea.match(regex);
        if (match) {
            const nombre = match[1].trim();
            nuevosItems.push({ 
                nombre, 
                cantidad: match[2].trim(), 
                checked: false, 
                tienda: bdTiendas[nombre] || null 
            });
        }
    });

    if (nuevosItems.length === 0) return alert('No se detectaron productos.');

    listaActual = nuevosItems;
    itemsPendientes = listaActual.filter(item => !item.tienda);

    if (itemsPendientes.length > 0) mostrarAsignacionTiendas();
    else guardarListaNube();
});

function mostrarAsignacionTiendas() {
    cambiarVista(views.tiendas);
    renderListaPendientes();
}

function renderListaPendientes() {
    const contenedor = document.getElementById('lista-sin-tienda');
    contenedor.innerHTML = '';
    
    if (itemsPendientes.length === 0) {
        document.getElementById('btn-guardar-tiendas').classList.remove('hidden');
        return;
    }

    itemsPendientes.forEach((item, index) => {
        const div = document.createElement('div');
        div.className = 'tienda-item';
        div.innerHTML = `<span>${item.nombre}</span><span style="font-size:0.85rem; color:#888">${item.cantidad}</span>`;
        div.onclick = () => seleccionarItemPendiente(index);
        contenedor.appendChild(div);
    });

    seleccionarItemPendiente(0);
}

function seleccionarItemPendiente(index) {
    itemSeleccionadoIndex = index;
    const nodos = document.getElementById('lista-sin-tienda').children;
    Array.from(nodos).forEach((nodo, i) => {
        if (i === index) nodo.classList.add('selected');
        else nodo.classList.remove('selected');
    });
}

function renderChips() {
    const contenedor = document.getElementById('contenedor-chips');
    if (!contenedor) return;
    contenedor.innerHTML = '';
    
    const todas = [...tiendasBase, ...tiendasExtra];
    todas.forEach(t => {
        const btn = document.createElement('button');
        btn.className = 'chip';
        btn.textContent = t;
        btn.onclick = () => asignarTienda(t);
        contenedor.appendChild(btn);
    });

    const inputHTML = `
        <input type="text" id="nueva-tienda-input" class="chip-input" placeholder="+ Tienda">
        <button class="chip btn-add-tienda" id="btn-add-tienda">Añadir</button>
    `;
    contenedor.insertAdjacentHTML('beforeend', inputHTML);

    document.getElementById('btn-add-tienda').addEventListener('click', () => {
        const input = document.getElementById('nueva-tienda-input');
        const nueva = input.value.trim();
        if(nueva !== '') {
            if(!tiendasBase.includes(nueva) && !tiendasExtra.includes(nueva)) {
                tiendasExtra.push(nueva);
                renderChips(); 
            }
            asignarTienda(nueva);
        }
    });
}

function asignarTienda(nombreTienda) {
    if (itemSeleccionadoIndex === null || !itemsPendientes[itemSeleccionadoIndex]) return;
    
    const item = itemsPendientes[itemSeleccionadoIndex];
    item.tienda = nombreTienda;
    bdTiendas[item.nombre] = nombreTienda; 
    
    itemsPendientes.splice(itemSeleccionadoIndex, 1);
    itemSeleccionadoIndex = null;
    
    renderListaPendientes();
}

document.getElementById('btn-guardar-tiendas').addEventListener('click', async () => {
    setSyncing(true);
    await setDoc(refTiendas, bdTiendas);
    await guardarListaNube();
    document.getElementById('btn-guardar-tiendas').classList.add('hidden');
    setSyncing(false);
});

async function guardarListaNube() {
    setSyncing(true);
    await setDoc(refLista, { items: listaActual });
    setSyncing(false);
}

function mostrarChecklist() {
    cambiarVista(views.checklist);
    const contenedor = document.getElementById('contenedor-checklist');
    contenedor.innerHTML = '';

    const grupos = listaActual.reduce((acc, item) => {
        const t = item.tienda || 'Otros';
        if (!acc[t]) acc[t] = [];
        acc[t].push(item);
        return acc;
    }, {});

    for (const [tienda, items] of Object.entries(grupos)) {
        let html = `<div class="tienda-group"><h2>${tienda}</h2>`;
        items.forEach(item => {
            const index = listaActual.findIndex(i => i.nombre === item.nombre);
            html += `
                <div class="checklist-item ${item.checked ? 'checked' : ''}" data-index="${index}">
                    <div class="custom-checkbox"></div>
                    <div class="item-details">
                        <span class="item-name">${item.nombre}</span>
                        <span class="item-qty">${item.cantidad}</span>
                    </div>
                    ${isJefe ? `<span class="edit-tienda" data-index="${index}">Editar</span>` : ''}
                </div>
            `;
        });
        html += `</div>`;
        contenedor.innerHTML += html;
    }

    document.querySelectorAll('.checklist-item').forEach(el => {
        el.addEventListener('click', async (e) => {
            const idx = e.currentTarget.getAttribute('data-index');
            
            // Lógica si se hace clic en Editar
            if (e.target.classList.contains('edit-tienda')) {
                e.stopPropagation(); // Evita que se marque el checkbox
                const item = listaActual[idx];
                const nuevaTienda = prompt(`Nueva tienda para: ${item.nombre}`, item.tienda);
                
                if (nuevaTienda !== null && nuevaTienda.trim() !== '') {
                    const t = nuevaTienda.trim();
                    listaActual[idx].tienda = t;
                    bdTiendas[item.nombre] = t;
                    
                    if(!tiendasBase.includes(t) && !tiendasExtra.includes(t)) {
                        tiendasExtra.push(t);
                        renderChips();
                    }

                    setSyncing(true);
                    await setDoc(refTiendas, bdTiendas);
                    await setDoc(refLista, { items: listaActual });
                    setSyncing(false);
                }
                return;
            }

            // Lógica normal de marcar/desmarcar producto
            listaActual[idx].checked = !listaActual[idx].checked;
            setSyncing(true);
            await setDoc(refLista, { items: listaActual });
            setSyncing(false);
        });
    });
}

function cambiarVista(vistaActiva) {
    Object.values(views).forEach(v => {
        v.classList.remove('active');
        v.classList.add('hidden');
    });
    vistaActiva.classList.remove('hidden');
    vistaActiva.classList.add('active');
}
