import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
import { getFirestore, collection, doc, getDoc, setDoc, updateDoc, deleteDoc, onSnapshot, serverTimestamp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";

const firebaseConfig={apiKey:"AIzaSyBRckUgIWW36rZ8Wv52yZnrxY5VsFatf4E",authDomain:"chickencrunchersapp.firebaseapp.com",projectId:"chickencrunchersapp",storageBucket:"chickencrunchersapp.firebasestorage.app",messagingSenderId:"947163923288",appId:"1:947163923288:web:8ee5fd7758e146a1e99b2d"};
const db=getFirestore(initializeApp(firebaseConfig));
const catalogRef=doc(db,"esencia","catalogo");
const storesRef=doc(db,"esencia","tiendas");
const ordersRef=collection(db,"pedidos");
const DEFAULT_STORES=["Mercadona","Makro","Frutería","Otros"];
const DEFAULT_PRODUCTS=[
  {id:"servilletas",nombre:"Servilletas",unidad:"paquete",stockActual:0,stockMax:4,tienda:"Mercadona"},
  {id:"vasos",nombre:"Vasos para llevar",unidad:"caja",stockActual:0,stockMax:2,tienda:"Makro"},
  {id:"leche-entera",nombre:"Leche entera",unidad:"caja 12 u",stockActual:0,stockMax:3,tienda:"Mercadona"}
];
const DEMO_IDS=new Set(DEFAULT_PRODUCTS.map(product=>product.id));
let products=[],stores=[],orders=[],touched=new Set(),filter="all",query="",unsubscribe=null;
const $=s=>document.querySelector(s), $$=s=>[...document.querySelectorAll(s)];
const uid=()=>crypto.randomUUID?.()||`${Date.now()}-${Math.random().toString(16).slice(2)}`;
const safe=n=>Math.max(0,Number(n)||0);
const needed=p=>Math.max(0,safe(p.stockMax)-safe(p.stockActual));
const escapeHtml=s=>String(s??"").replace(/[&<>'"]/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;","'":"&#39;",'"':"&quot;"}[c]));
const fmtDate=value=>{const d=value?.toDate?.()||new Date(value||Date.now());return new Intl.DateTimeFormat("es-ES",{day:"2-digit",month:"short",hour:"2-digit",minute:"2-digit"}).format(d)};

function setSync(text="Guardado"){ $("#sync-status").textContent=text; }
function toast(text){const el=$("#toast");el.textContent=text;el.classList.add("show");setTimeout(()=>el.classList.remove("show"),2200)}
async function saveCatalog(){setSync("Guardando…");await setDoc(catalogRef,{products,updatedAt:serverTimestamp()});setSync()}
async function saveStores(){setSync("Guardando…");await setDoc(storesRef,{stores,updatedAt:serverTimestamp()});setSync()}

async function initManager(){
  $("#manager-app").classList.remove("hidden");
  try{
    const [catSnap,storeSnap]=await Promise.all([getDoc(catalogRef),getDoc(storesRef)]);
    const savedProducts=catSnap.exists()&&Array.isArray(catSnap.data().products)?catSnap.data().products:[];
    const isDemoCatalog=savedProducts.length===DEFAULT_PRODUCTS.length&&savedProducts.every(product=>DEMO_IDS.has(product.id));
    if(!savedProducts.length||isDemoCatalog){
      const response=await fetch("catalogo-inicial.json");
      products=response.ok?await response.json():DEFAULT_PRODUCTS;
    }else products=savedProducts;
    stores=storeSnap.exists()&&Array.isArray(storeSnap.data().stores)?storeSnap.data().stores:DEFAULT_STORES;
    if(!catSnap.exists()||isDemoCatalog) await saveCatalog(); if(!storeSnap.exists()) await saveStores();
    renderAll();
    unsubscribe=onSnapshot(ordersRef,snapshot=>{orders=snapshot.docs.map(x=>({id:x.id,...x.data()}));renderOrders();setSync("Sincronizado")},error=>{console.error(error);setSync("Error de conexión")});
  }catch(error){console.error(error);setSync("Error de conexión");toast("No se pudo conectar con Firebase")}
  bindManager();
}

function bindManager(){
  $$('[data-view]').forEach(btn=>btn.addEventListener("click",()=>showView(btn.dataset.view)));
  $$(".filter").forEach(btn=>btn.addEventListener("click",()=>{filter=btn.dataset.filter;$$(".filter").forEach(x=>x.classList.toggle("active",x===btn));renderProducts()}));
  $("#search").addEventListener("input",e=>{query=e.target.value.toLowerCase().trim();renderProducts()});
  $("#add-product").addEventListener("click",()=>{products.push({id:uid(),nombre:"Nuevo producto",unidad:"unidad",stockActual:0,stockMax:0,tienda:""});saveCatalog();renderProducts()});
  $("#create-order").addEventListener("click",openDraft);
  $("#save-order").addEventListener("click",e=>{e.preventDefault();createOrder()});
  $("#store-form").addEventListener("submit",e=>{e.preventDefault();const name=$("#store-name").value.trim();if(name&&!stores.some(x=>x.toLowerCase()===name.toLowerCase())){stores.push(name);saveStores();renderStores()}e.target.reset()});
  $("#orders-list").addEventListener("click",handleOrderAction);
  $("#stores-list").addEventListener("click",e=>{const btn=e.target.closest("[data-delete-store]");if(!btn)return;stores=stores.filter(x=>x!==btn.dataset.deleteStore);saveStores();renderStores()});
}
function showView(name){$$('[data-view]').forEach(x=>x.classList.toggle("active",x.dataset.view===name));$$(".view").forEach(x=>x.classList.toggle("active",x.id===`view-${name}`));window.scrollTo({top:0,behavior:"smooth"});if(name==="orders")renderOrders()}
function renderAll(){renderProducts();renderStores();renderOrders()}
function visibleProducts(){return products.filter(p=>(!query||`${p.nombre} ${p.unidad}`.toLowerCase().includes(query))&&(filter==="all"||(filter==="pending"&&!touched.has(p.id))||(filter==="buy"&&needed(p)>0)))}
function renderProducts(){
  const list=$("#product-list"),visible=visibleProducts();
  list.innerHTML=visible.length?visible.map(p=>`<article class="product-card ${touched.has(p.id)?"":"pending"}" data-id="${p.id}"><div class="product-info"><input data-field="nombre" value="${escapeHtml(p.nombre)}" aria-label="Producto"><input class="unit" data-field="unidad" value="${escapeHtml(p.unidad)}" placeholder="Unidad" aria-label="Unidad"></div><div class="numbers"><div class="number-field"><label>Actual</label><input data-field="stockActual" type="number" min="0" value="${safe(p.stockActual)}"></div><div class="number-field"><label>Máximo</label><input data-field="stockMax" type="number" min="0" value="${safe(p.stockMax)}"></div></div><span class="need ${needed(p)>0?"yes":""}">${needed(p)>0?`Pedir ${needed(p)}`:"OK"}</span><button class="icon-button delete-product" aria-label="Eliminar">×</button></article>`).join(""):"<p class='muted'>No hay productos para este filtro.</p>";
  list.querySelectorAll("input").forEach(input=>input.addEventListener("change",()=>{const card=input.closest("[data-id]"),p=products.find(x=>x.id===card.dataset.id);p[input.dataset.field]=input.type==="number"?safe(input.value):input.value.trim();if(input.dataset.field==="stockActual")touched.add(p.id);saveCatalog();renderProducts()}));
  list.querySelectorAll(".delete-product").forEach(btn=>btn.addEventListener("click",()=>{const id=btn.closest("[data-id]").dataset.id;if(confirm("¿Eliminar este producto del catálogo?")){products=products.filter(x=>x.id!==id);saveCatalog();renderProducts()}}));
  const buy=products.filter(p=>needed(p)>0);$("#stock-summary").innerHTML=`<strong>${touched.size}</strong> revisados · <strong>${products.length}</strong> productos · <strong>${buy.length}</strong> para pedir`;$("#order-count").textContent=buy.length;
}
function renderStores(){$("#stores-list").innerHTML=stores.map(s=>`<div class="store-row"><strong>${escapeHtml(s)}</strong><button class="icon-button" data-delete-store="${escapeHtml(s)}" aria-label="Eliminar">×</button></div>`).join("")}
function openDraft(){const buy=products.filter(p=>needed(p)>0);if(!buy.length)return toast("No hay productos pendientes de compra");$("#draft-list").innerHTML=buy.map(p=>`<div class="draft-row" data-id="${p.id}"><div><strong>${escapeHtml(p.nombre)}</strong><small>${needed(p)} ${escapeHtml(p.unidad)}</small></div><select aria-label="Tienda"><option value="">Elegir tienda…</option>${stores.map(s=>`<option ${p.tienda===s?"selected":""}>${escapeHtml(s)}</option>`).join("")}</select></div>`).join("");$("#order-dialog").showModal()}
async function createOrder(){
  const rows=$$("#draft-list .draft-row"),missing=rows.find(r=>!r.querySelector("select").value);if(missing){missing.querySelector("select").focus();return toast("Asigna una tienda a todos los productos")}
  const id=uid(),items=rows.map(r=>{const p=products.find(x=>x.id===r.dataset.id),tienda=r.querySelector("select").value;p.tienda=tienda;return{id:uid(),productId:p.id,nombre:p.nombre,cantidad:needed(p),unidad:p.unidad,tienda,checked:false}});
  const order={title:`Compra ${new Intl.DateTimeFormat("es-ES",{day:"2-digit",month:"long"}).format(new Date())}`,note:$("#order-note").value.trim(),status:"active",items,createdAt:serverTimestamp(),updatedAt:serverTimestamp()};
  try{setSync("Creando pedido…");await Promise.all([setDoc(doc(ordersRef,id),order),saveCatalog()]);$("#order-dialog").close();$("#order-note").value="";showView("orders");await copyLink(id);setSync()}catch(error){console.error(error);toast("No se pudo crear el pedido")}
}
function shareLink(id){const url=new URL(window.location.href);url.search="";url.hash="";url.searchParams.set("checklist",id);return url.toString()}
async function copyLink(id){try{await navigator.clipboard.writeText(shareLink(id));toast("Enlace del checklist copiado")}catch{prompt("Copia este enlace:",shareLink(id))}}
function renderOrders(){
  orders.sort((a,b)=>(b.createdAt?.seconds||new Date(b.createdAt||0).getTime())-(a.createdAt?.seconds||new Date(a.createdAt||0).getTime()));
  $("#orders-list").innerHTML=orders.length?orders.map(o=>{const done=(o.items||[]).filter(x=>x.checked).length,total=(o.items||[]).length,isDone=o.status==="completed"||done===total;return`<article class="order-card"><div><div class="order-top"><h3>${escapeHtml(o.title||"Pedido")}</h3><span class="status ${isDone?"done":""}">${isDone?"Completado":"En curso"}</span></div><p>${fmtDate(o.createdAt)} · ${done} de ${total} productos · ${new Set((o.items||[]).map(x=>x.tienda)).size} tiendas</p>${o.note?`<p>${escapeHtml(o.note)}</p>`:""}</div><div class="order-actions"><button class="button secondary" data-copy="${o.id}">Copiar enlace</button><a class="button primary" href="${shareLink(o.id)}">Abrir</a><button class="icon-button" data-delete="${o.id}" aria-label="Eliminar">×</button></div></article>`}).join(""):"<div class='card' style='padding:24px;text-align:center'><p class='muted'>Aún no hay pedidos. Revisa el stock para crear el primero.</p></div>";
}
async function handleOrderAction(e){const copy=e.target.closest("[data-copy]"),del=e.target.closest("[data-delete]");if(copy)return copyLink(copy.dataset.copy);if(del&&confirm("¿Eliminar este pedido? El enlace dejará de funcionar.")){await deleteDoc(doc(ordersRef,del.dataset.delete));orders=orders.filter(x=>x.id!==del.dataset.delete);renderOrders();toast("Pedido eliminado")}}

async function initChecklist(id){
  $("#checklist-app").classList.remove("hidden");$("#sync-status").textContent="Checklist compartido";
  const ref=doc(ordersRef,id);unsubscribe=onSnapshot(ref,snap=>{if(!snap.exists()){renderMissing();return}renderChecklist({id,...snap.data()})},error=>{console.error(error);renderMissing()});
  $("#checklist-list").addEventListener("change",async e=>{if(!e.target.matches("input[type=checkbox]"))return;const snap=await getDoc(ref);if(!snap.exists())return;const data=snap.data(),item=data.items.find(x=>x.id===e.target.dataset.item);item.checked=e.target.checked;const done=data.items.every(x=>x.checked);await updateDoc(ref,{items:data.items,status:done?"completed":"active",updatedAt:serverTimestamp()})});
}
function renderChecklist(order){
  const items=order.items||[],done=items.filter(x=>x.checked).length,total=items.length,pct=total?Math.round(done/total*100):0;$("#checklist-title").textContent=order.title||"Compra de Esencia";$("#checklist-meta").textContent=order.note||`${total} productos en ${new Set(items.map(x=>x.tienda)).size} tiendas`;$("#checklist-progress").innerHTML=`<div class="progress-line"><span>${done} de ${total} productos</span><span>${pct}%</span></div><div class="progress-track"><div class="progress-fill" style="width:${pct}%"></div></div>`;
  const groups=Object.groupBy?Object.groupBy(items,x=>x.tienda||"Otros"):items.reduce((a,x)=>((a[x.tienda||"Otros"]??=[]).push(x),a),{});$("#checklist-list").innerHTML=Object.entries(groups).map(([store,list])=>`<section class="store-group"><h2>${escapeHtml(store)}</h2>${list.map(x=>`<label class="check-item ${x.checked?"checked":""}"><input type="checkbox" data-item="${x.id}" ${x.checked?"checked":""}><span>${escapeHtml(x.nombre)}</span><small>${x.cantidad} ${escapeHtml(x.unidad)}</small></label>`).join("")}</section>`).join("");$("#checklist-complete").classList.toggle("hidden",pct!==100);setSync("Actualizado ahora")
}
function renderMissing(){$("#checklist-title").textContent="Pedido no disponible";$("#checklist-meta").textContent="Comprueba que el enlace sea correcto o pide uno nuevo.";$("#checklist-progress").classList.add("hidden")}
const checklistId=new URLSearchParams(location.search).get("checklist");checklistId?initChecklist(checklistId):initManager();
window.addEventListener("beforeunload",()=>unsubscribe?.());
