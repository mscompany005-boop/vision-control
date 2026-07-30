/* ============================================================
   VISION CONTROL — Lógica principal
   (reconocimiento facial + navegación + animaciones landing)
   ============================================================ */

console.log('🛸 Vision Control - Iniciando…');

const state = {
    modelosListos:false, streamActual:null, intervaloDeteccion:null,
    descripciones:[], fotosTomadas:0, rostroDetectadoActual:null,
    datosRegistro:{nombre:'',curp:'',cliente:''}
};

// ---------- CARGA DE MODELOS ----------
window.addEventListener('load', async () => {
    // Animaciones de la landing
    initScrollReveal();
    initNavScroll();

    mostrarLoader('Cargando IA…');
    try {
        const MODEL_URL = './models';
        await Promise.all([
            faceapi.nets.tinyFaceDetector.loadFromUri(MODEL_URL),
            faceapi.nets.faceLandmark68Net.loadFromUri(MODEL_URL),
            faceapi.nets.faceRecognitionNet.loadFromUri(MODEL_URL)
        ]);
        state.modelosListos = true;
        console.log('✅ Modelos de IA cargados');
        ocultarLoader();
    } catch (e) {
        console.error('Error cargando modelos:', e);
        actualizarLoader('Error cargando IA. Refresca la página.');
    }
});

// ---------- LOADER ----------
function mostrarLoader(t){document.getElementById('loader-text').textContent=t;
    document.getElementById('global-loader').classList.add('active');}
function actualizarLoader(t){document.getElementById('loader-text').textContent=t;}
function ocultarLoader(){document.getElementById('global-loader').classList.remove('active');}

// ---------- NAV: cambia estilo al hacer scroll ----------
function initNavScroll(){
    const nav = document.getElementById('nav');
    if(!nav) return;
    window.addEventListener('scroll', () => {
        if(window.scrollY > 40) nav.classList.add('scrolled');
        else nav.classList.remove('scrolled');
    });
}

// ---------- REVEAL: elementos aparecen al hacer scroll ----------
let revealObserver = null;
function initScrollReveal(){
    revealObserver = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            if(entry.isIntersecting){
                entry.target.classList.add('visible');
            }
        });
    }, {threshold:0.12});
    observarReveals();
}
function observarReveals(){
    if(!revealObserver) return;
    document.querySelectorAll('.reveal:not(.visible)').forEach(el => revealObserver.observe(el));
}

// ---------- NAVEGACIÓN ENTRE PANTALLAS ----------
function goToScreen(screenName){
    detenerCamara();
    document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
    const target = document.getElementById('screen-' + screenName);
    if(target){
        target.classList.add('active');
        window.scrollTo(0,0);
        if(screenName === 'landing'){
            // reactivar animaciones al volver
            setTimeout(observarReveals, 100);
        }
        if(screenName === 'verify') iniciarVerificacion();
    }
}
window.goToScreen = goToScreen;

// ---------- CÁMARA ----------
async function iniciarCamara(videoElement){
    try{
        const stream = await navigator.mediaDevices.getUserMedia({
            video:{facingMode:'user',width:{ideal:480},height:{ideal:480}},audio:false});
        videoElement.srcObject = stream;
        state.streamActual = stream;
        return new Promise(res => {videoElement.onloadedmetadata = () => res();});
    }catch(e){
        console.error('Error cámara:',e);
        alert('No se pudo acceder a la cámara. Verifica permisos.');
        throw e;
    }
}
function detenerCamara(){
    if(state.streamActual){state.streamActual.getTracks().forEach(t=>t.stop());state.streamActual=null;}
    if(state.intervaloDeteccion){clearInterval(state.intervaloDeteccion);state.intervaloDeteccion=null;}
}

// ---------- REGISTRO ----------
async function iniciarCapturaRegistro(){
    const nombre=document.getElementById('input-nombre').value.trim();
    const curp=document.getElementById('input-curp').value.trim();
    const cliente=document.getElementById('input-cliente').value.trim();
    if(!nombre||!curp||!cliente){alert('Por favor llena todos los campos.');return;}
    if(curp.length!==18){alert('La CURP debe tener exactamente 18 caracteres.');return;}
    state.datosRegistro={nombre,curp,cliente};
    state.descripciones=[];state.fotosTomadas=0;
    goToScreen('capture');
    if(!state.modelosListos){alert('Los modelos de IA aún no están listos. Espera unos segundos.');return;}
    const video=document.getElementById('capture-video');
    await iniciarCamara(video);
    iniciarLoopDeteccion(video,'capture');
}
window.iniciarCapturaRegistro = iniciarCapturaRegistro;

function iniciarLoopDeteccion(videoElement,modo){
    state.intervaloDeteccion=setInterval(async()=>{
        if(!videoElement.videoWidth)return;
        const det=await faceapi.detectSingleFace(videoElement,
            new faceapi.TinyFaceDetectorOptions({inputSize:224,scoreThreshold:0.5}))
            .withFaceLandmarks().withFaceDescriptor();
        state.rostroDetectadoActual=det;
        if(modo==='capture')actualizarUICaptura(det);
        else if(modo==='verify')await procesarVerificacion(det);
    },200);
}

function actualizarUICaptura(det){
    const g=document.getElementById('capture-guide');
    const sd=document.getElementById('capture-status-dot');
    const st=document.getElementById('capture-status');
    const btn=document.getElementById('capture-btn');
    if(det){g.classList.add('detected');sd.classList.add('detected');
        st.textContent='✓ Rostro detectado. Listo para capturar.';btn.disabled=false;}
    else{g.classList.remove('detected');sd.classList.remove('detected');
        st.textContent='Buscando rostro…';btn.disabled=true;}
}

function capturarFoto(){
    if(!state.rostroDetectadoActual){alert('No se detectó tu rostro. Mira a la cámara.');return;}
    state.descripciones.push(state.rostroDetectadoActual.descriptor);
    state.fotosTomadas++;
    document.getElementById('dot-'+state.fotosTomadas).classList.add('completed');
    if(state.fotosTomadas<3){
        const btn=document.getElementById('capture-btn');
        btn.textContent=`Tomar foto ${state.fotosTomadas+1} de 3`;btn.disabled=true;
        setTimeout(()=>{const ins=document.getElementById('capture-instruction');
            if(state.fotosTomadas===1)ins.textContent='Ahora gira ligeramente a la izquierda.';
            else if(state.fotosTomadas===2)ins.textContent='Ahora gira ligeramente a la derecha.';},300);
    }else{guardarUsuario();}
}
window.capturarFoto = capturarFoto;

function guardarUsuario(){
    detenerCamara();
    const dp=promediarDescriptors(state.descripciones);
    const usuarios=JSON.parse(localStorage.getItem('vc_usuarios')||'[]');
    const ya=usuarios.find(u=>u.curp===state.datosRegistro.curp);
    if(ya){if(!confirm('Ya existe un usuario con esa CURP. ¿Sobrescribir?')){goToScreen('landing');return;}
        usuarios.splice(usuarios.findIndex(u=>u.curp===state.datosRegistro.curp),1);}
    usuarios.push({nombre:state.datosRegistro.nombre,curp:state.datosRegistro.curp,
        cliente:state.datosRegistro.cliente,descriptor:Array.from(dp),
        fechaRegistro:new Date().toISOString()});
    localStorage.setItem('vc_usuarios',JSON.stringify(usuarios));
    alert(`✅ ${state.datosRegistro.nombre} registrado correctamente.`);
    goToScreen('landing');
}
function promediarDescriptors(ds){
    const p=new Float32Array(ds[0].length);
    for(let i=0;i<p.length;i++){let s=0;for(const d of ds)s+=d[i];p[i]=s/ds.length;}
    return p;
}
function cancelarCaptura(){
    detenerCamara();state.descripciones=[];state.fotosTomadas=0;
    document.querySelectorAll('.progress-dot').forEach(d=>d.classList.remove('completed'));
    document.getElementById('capture-btn').textContent='Tomar foto 1 de 3';
    goToScreen('landing');
}
window.cancelarCaptura = cancelarCaptura;

// ---------- VERIFICACIÓN ----------
async function iniciarVerificacion(){
    if(!state.modelosListos){alert('Los modelos de IA aún no están listos.');goToScreen('landing');return;}
    const usuarios=JSON.parse(localStorage.getItem('vc_usuarios')||'[]');
    if(usuarios.length===0){alert('No hay usuarios registrados. Regístrate primero.');goToScreen('register');return;}
    const video=document.getElementById('verify-video');
    try{
        await iniciarCamara(video);
        document.getElementById('verify-status').textContent='Buscando rostro…';
        document.getElementById('match-info').textContent='';
        iniciarLoopDeteccion(video,'verify');
    }catch(e){goToScreen('landing');}
}

let intentosFallidos=0;
const UMBRAL_MATCH=0.5;
const MAX_INTENTOS_FALLIDOS=50;

async function procesarVerificacion(det){
    const g=document.getElementById('verify-guide');
    const sd=document.getElementById('verify-status-dot');
    const st=document.getElementById('verify-status');
    const mi=document.getElementById('match-info');
    if(!det){g.classList.remove('detected','recognized');sd.classList.remove('detected');
        st.textContent='Buscando rostro…';mi.textContent='';return;}
    g.classList.add('detected');sd.classList.add('detected');
    const usuarios=JSON.parse(localStorage.getItem('vc_usuarios')||'[]');
    let mejor=null,menor=1.0;
    for(const u of usuarios){
        const dg=new Float32Array(u.descriptor);
        const dist=faceapi.euclideanDistance(det.descriptor,dg);
        if(dist<menor){menor=dist;mejor=u;}
    }
    mi.textContent=`Distancia: ${menor.toFixed(3)}`;
    if(menor<UMBRAL_MATCH&&mejor){
        g.classList.add('recognized');st.textContent=`✓ ${mejor.nombre}`;
        detenerCamara();intentosFallidos=0;
        const conf=((1-menor)*100).toFixed(1);
        setTimeout(()=>{
            mostrarResultadoExito(mejor,conf);
            if(window.enviarAutorizacionFirebase){
                window.enviarAutorizacionFirebase(mejor,parseFloat(conf))
                    .then(ok=>{if(ok)console.log('🎉 Operador notificado vía Firebase');});
            }
        },800);
    }else{
        st.textContent='Verificando…';intentosFallidos++;
        if(intentosFallidos>MAX_INTENTOS_FALLIDOS){
            detenerCamara();intentosFallidos=0;
            mostrarResultadoFallo('No pudimos verificar tu identidad después de varios intentos.');
        }
    }
}
function detenerVerificacion(){detenerCamara();intentosFallidos=0;goToScreen('landing');}
window.detenerVerificacion = detenerVerificacion;

// ---------- RESULTADOS ----------
function mostrarResultadoExito(u,conf){
    document.getElementById('result-name').textContent=u.nombre;
    document.getElementById('result-confidence').textContent=conf+'%';
    const ahora=new Date();
    document.getElementById('result-time').textContent=
        ahora.toLocaleTimeString('es-MX',{hour:'2-digit',minute:'2-digit',second:'2-digit'});
    goToScreen('result-success');
}
function mostrarResultadoFallo(r){
    document.getElementById('fail-reason').innerHTML=r;
    goToScreen('result-fail');
}

console.log('✅ Vision Control - Listo');
