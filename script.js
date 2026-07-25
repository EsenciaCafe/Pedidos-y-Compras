import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
import { getFirestore, doc, setDoc, getDoc, onSnapshot } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";

// Configuración de base de datos en la nube (requiere crear proyecto gratuito en Firebase)
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

const views = {
    input: document.getElementById('view-input'),
    tiendas: document.getElementById('view-tiendas'),
    checklist: document.getElementById('view-checklist')
};

const syncIndicator = document.getElementById('sync-indicator');
let bdTiendas = {};
let listaActual = [];
let itemsPendientes = [];

// Cargar tiendas guardadas históricamente
getDoc(refTiendas).then(snap => {
    if (snap.exists()) bdTiendas = snap.data();
});

// Escuchar cambios en tiempo real (Sincronización instantánea entre teléfonos)
onSnapshot(refLista, (snap) => {
    if (snap.exists()) {
        listaActual = snap.data().items || [];
        if (listaActual.length > 0 && itemsPendientes.length === 0) {
            mostrarChecklist();
        } else if (listaActual.length === 0) {
            cambiarVista(views.input);
        }
    }
});

function setSyncing(status) {
    if(status) syncIndicator.classList.remove('hidden');
    else syncIndicator.classList.add('hidden');
}

document.getElementById('btn-nueva-lista').addEventListener('click', async () => {
    if(confirm('¿Crear nueva lista?')) {
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
    const contenedor = document.getElementById('lista-sin-tienda');
    contenedor.innerHTML = '';

    itemsPendientes.forEach((item, index) => {
        contenedor.innerHTML += `
            <div class="tienda-item">
                <span>${item.nombre}</span>
                <input type="text" id="tienda-input-${index}" placeholder="Tienda (ej. Mercadona)">
            </div>
        `;
    });
}

document.getElementById('btn-guardar-tiendas').addEventListener('click', async () => {
    setSyncing(true);
    itemsPendientes.forEach((item, index) => {
        const inputVal = document.getElementById(`tienda-input-${index}`).value.trim();
        const tiendaFinal = inputVal || 'Otros';
        item.tienda = tiendaFinal;
        bdTiendas[item.nombre] = tiendaFinal;
    });

    await setDoc(refTiendas, bdTiendas);
    await guardarListaNube();
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
