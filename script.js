import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
import { getFirestore, doc, setDoc, getDoc, onSnapshot } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";

// For Firebase JS SDK v7.20.0 and later, measurementId is optional
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

// Detección de Rol mediante la URL (?role=jefe)
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

// Mostrar botón "Nueva" solo si eres el jefe
if (isJefe) {
    btnNuevaLista.classList.remove('hidden');
}

// Cargar la base de datos de tiendas conocidas
getDoc(refTiendas).then(snap => {
    if (snap.exists()) bdTiendas = snap.data();
});

// Sincronización en tiempo real
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

// Lógica de procesamiento de texto
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

// Lógica de Asignación por Chips
function mostrarAsignacionTiendas() {
    cambiarVista(views.tiendas);
    renderListaPendientes();
}

function renderListaPendientes() {
    const contenedor = document.getElementById('lista-sin-tienda');
    contenedor.innerHTML = '';
    
    // Si ya no quedan pendientes, mostrar botón de guardar
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

    // Autoseleccionar el primero
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

// Escuchar clicks en los chips predefinidos
document.querySelectorAll('.chip[data-tienda]').forEach(btn => {
    btn.addEventListener('click', (e) => asignarTienda(e.target.dataset.tienda));
});

// Escuchar el botón para añadir un chip nuevo manualmente
document.getElementById('btn-add-tienda').addEventListener('click', () => {
    const input = document.getElementById('nueva-tienda-input');
    if(input.value.trim() !== '') {
        asignarTienda(input.value.trim());
        input.value = '';
    }
});

function asignarTienda(nombreTienda) {
    if (itemSeleccionadoIndex === null || !itemsPendientes[itemSeleccionadoIndex]) return;
    
    const item = itemsPendientes[itemSeleccionadoIndex];
    item.tienda = nombreTienda;
    bdTiendas[item.nombre] = nombreTienda; // Lo memoriza para futuros pedidos
    
    // Lo sacamos de la lista de pendientes
    itemsPendientes.splice(itemSeleccionadoIndex, 1);
    itemSeleccionadoIndex = null;
    
    renderListaPendientes();
}

// Al terminar de asignar todo, lo subimos a la nube
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

// Lógica de Checklist Final
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
                </div>
            `;
        });
        html += `</div>`;
        contenedor.innerHTML += html;
    }

    document.querySelectorAll('.checklist-item').forEach(el => {
        el.addEventListener('click', async (e) => {
            const idx = e.currentTarget.getAttribute('data-index');
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
