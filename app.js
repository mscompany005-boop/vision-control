/* ============================================= */
/* VISION CONTROL - Lógica principal              */
/* ============================================= */

console.log('🛸 Vision Control - Iniciando...');

// ============================================================
// ESTADO GLOBAL
// ============================================================
const state = {
    modelosListos: false,
    streamActual: null,           // Stream de cámara activa
    intervaloDeteccion: null,     // Loop de detección
    descripciones: [],            // Descriptors capturados durante registro
    fotosTomadas: 0,              // Contador de fotos en registro
    rostroDetectadoActual: null,  // Última detección
    datosRegistro: {
        nombre: '',
        curp: '',
        cliente: ''
    }
};

// ============================================================
// CARGA DE MODELOS DE IA (al abrir la app)
// ============================================================
window.addEventListener('load', async () => {
    mostrarLoader('Cargando IA...');
    
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

// ============================================================
// LOADER
// ============================================================
function mostrarLoader(texto) {
    document.getElementById('loader-text').textContent = texto;
    document.getElementById('global-loader').classList.add('active');
}

function actualizarLoader(texto) {
    document.getElementById('loader-text').textContent = texto;
}

function ocultarLoader() {
    document.getElementById('global-loader').classList.remove('active');
}

// ============================================================
// NAVEGACIÓN ENTRE PANTALLAS
// ============================================================
function goToScreen(screenName) {
    // Detener cámara si está activa al cambiar de pantalla
    detenerCamara();
    
    document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
    
    const target = document.getElementById('screen-' + screenName);
    if (target) {
        target.classList.add('active');
        window.scrollTo(0, 0);
        
        // Activar funcionalidad según pantalla
        if (screenName === 'verify') {
            iniciarVerificacion();
        }
    }
}

window.goToScreen = goToScreen;

// ============================================================
// CÁMARA - INICIAR
// ============================================================
async function iniciarCamara(videoElement) {
    try {
        const stream = await navigator.mediaDevices.getUserMedia({
            video: {
                facingMode: 'user',
                width: { ideal: 480 },
                height: { ideal: 480 }
            },
            audio: false
        });
        
        videoElement.srcObject = stream;
        state.streamActual = stream;
        
        return new Promise((resolve) => {
            videoElement.onloadedmetadata = () => resolve();
        });
    } catch (e) {
        console.error('Error accediendo a cámara:', e);
        alert('No se pudo acceder a la cámara. Verifica permisos en configuración.');
        throw e;
    }
}

// ============================================================
// CÁMARA - DETENER
// ============================================================
function detenerCamara() {
    if (state.streamActual) {
        state.streamActual.getTracks().forEach(track => track.stop());
        state.streamActual = null;
    }
    if (state.intervaloDeteccion) {
        clearInterval(state.intervaloDeteccion);
        state.intervaloDeteccion = null;
    }
}

// ============================================================
// REGISTRO - INICIAR CAPTURA
// ============================================================
async function iniciarCapturaRegistro() {
    // Validar formulario
    const nombre = document.getElementById('input-nombre').value.trim();
    const curp = document.getElementById('input-curp').value.trim();
    const cliente = document.getElementById('input-cliente').value.trim();
    
    if (!nombre || !curp || !cliente) {
        alert('Por favor llena todos los campos.');
        return;
    }
    
    if (curp.length !== 18) {
        alert('La CURP debe tener exactamente 18 caracteres.');
        return;
    }
    
    // Guardar datos
    state.datosRegistro = { nombre, curp, cliente };
    state.descripciones = [];
    state.fotosTomadas = 0;
    
    goToScreen('capture');
    
    if (!state.modelosListos) {
        alert('Los modelos de IA aún no están listos. Espera unos segundos.');
        return;
    }
    
    // Iniciar cámara
    const video = document.getElementById('capture-video');
    await iniciarCamara(video);
    
    // Iniciar loop de detección
    iniciarLoopDeteccion(video, 'capture');
}

window.iniciarCapturaRegistro = iniciarCapturaRegistro;

// ============================================================
// LOOP DE DETECCIÓN (corre cada 200ms)
// ============================================================
function iniciarLoopDeteccion(videoElement, modo) {
    state.intervaloDeteccion = setInterval(async () => {
        if (!videoElement.videoWidth) return;
        
        const detection = await faceapi
            .detectSingleFace(videoElement, new faceapi.TinyFaceDetectorOptions({
                inputSize: 224,
                scoreThreshold: 0.5
            }))
            .withFaceLandmarks()
            .withFaceDescriptor();
        
        state.rostroDetectadoActual = detection;
        
        if (modo === 'capture') {
            actualizarUICaptura(detection);
        } else if (modo === 'verify') {
            await procesarVerificacion(detection);
        }
    }, 200);
}

// ============================================================
// REGISTRO - UI durante captura
// ============================================================
function actualizarUICaptura(detection) {
    const guide = document.getElementById('capture-guide');
    const statusDot = document.getElementById('capture-status-dot');
    const statusText = document.getElementById('capture-status');
    const btn = document.getElementById('capture-btn');
    
    if (detection) {
        guide.classList.add('detected');
        statusDot.classList.add('detected');
        statusText.textContent = '✓ Rostro detectado. Listo para capturar.';
        btn.disabled = false;
    } else {
        guide.classList.remove('detected');
        statusDot.classList.remove('detected');
        statusText.textContent = 'Buscando rostro...';
        btn.disabled = true;
    }
}

// ============================================================
// REGISTRO - CAPTURAR FOTO
// ============================================================
function capturarFoto() {
    if (!state.rostroDetectadoActual) {
        alert('No se detectó tu rostro. Mira a la cámara.');
        return;
    }
    
    // Guardar el descriptor (huella facial)
    state.descripciones.push(state.rostroDetectadoActual.descriptor);
    state.fotosTomadas++;
    
    // Actualizar puntos de progreso
    document.getElementById('dot-' + state.fotosTomadas).classList.add('completed');
    
    if (state.fotosTomadas < 3) {
        // Pedir siguiente foto
        const btn = document.getElementById('capture-btn');
        btn.textContent = `Tomar foto ${state.fotosTomadas + 1} de 3`;
        
        // Pequeña pausa visual
        btn.disabled = true;
        setTimeout(() => {
            const instruction = document.getElementById('capture-instruction');
            if (state.fotosTomadas === 1) {
                instruction.textContent = 'Ahora gira ligeramente a la izquierda.';
            } else if (state.fotosTomadas === 2) {
                instruction.textContent = 'Ahora gira ligeramente a la derecha.';
            }
        }, 300);
    } else {
        // Las 3 fotos capturadas → guardar usuario
        guardarUsuario();
    }
}

window.capturarFoto = capturarFoto;

// ============================================================
// GUARDAR USUARIO EN LOCALSTORAGE
// ============================================================
function guardarUsuario() {
    detenerCamara();
    
    // Promediar los 3 descriptores en uno solo
    const descriptorPromedio = promediarDescriptors(state.descripciones);
    
    // Recuperar usuarios existentes
    const usuarios = JSON.parse(localStorage.getItem('vc_usuarios') || '[]');
    
    // Verificar si ya existe (por CURP)
    const yaExiste = usuarios.find(u => u.curp === state.datosRegistro.curp);
    if (yaExiste) {
        if (!confirm('Ya existe un usuario con esa CURP. ¿Sobrescribir?')) {
            goToScreen('welcome');
            return;
        }
        // Eliminar el viejo
        const idx = usuarios.findIndex(u => u.curp === state.datosRegistro.curp);
        usuarios.splice(idx, 1);
    }
    
    // Agregar nuevo
    usuarios.push({
        nombre: state.datosRegistro.nombre,
        curp: state.datosRegistro.curp,
        cliente: state.datosRegistro.cliente,
        descriptor: Array.from(descriptorPromedio),
        fechaRegistro: new Date().toISOString()
    });
    
    localStorage.setItem('vc_usuarios', JSON.stringify(usuarios));
    
    alert(`✅ ${state.datosRegistro.nombre} registrado correctamente.`);
    goToScreen('welcome');
}

function promediarDescriptors(descriptors) {
    const promedio = new Float32Array(descriptors[0].length);
    for (let i = 0; i < promedio.length; i++) {
        let suma = 0;
        for (const d of descriptors) {
            suma += d[i];
        }
        promedio[i] = suma / descriptors.length;
    }
    return promedio;
}

// ============================================================
// CANCELAR CAPTURA
// ============================================================
function cancelarCaptura() {
    detenerCamara();
    state.descripciones = [];
    state.fotosTomadas = 0;
    document.querySelectorAll('.progress-dot').forEach(d => d.classList.remove('completed'));
    document.getElementById('capture-btn').textContent = 'Tomar foto 1 de 3';
    goToScreen('welcome');
}

window.cancelarCaptura = cancelarCaptura;

// ============================================================
// VERIFICACIÓN - INICIAR
// ============================================================
async function iniciarVerificacion() {
    if (!state.modelosListos) {
        alert('Los modelos de IA aún no están listos. Espera unos segundos.');
        goToScreen('welcome');
        return;
    }
    
    // Verificar que haya usuarios registrados
    const usuarios = JSON.parse(localStorage.getItem('vc_usuarios') || '[]');
    if (usuarios.length === 0) {
        alert('No hay usuarios registrados. Regístrate primero.');
        goToScreen('register');
        return;
    }
    
    const video = document.getElementById('verify-video');
    
    try {
        await iniciarCamara(video);
        
        document.getElementById('verify-status').textContent = 'Buscando rostro...';
        document.getElementById('match-info').textContent = '';
        
        iniciarLoopDeteccion(video, 'verify');
    } catch (e) {
        goToScreen('welcome');
    }
}

// ============================================================
// VERIFICACIÓN - PROCESAR
// ============================================================
let intentosFallidos = 0;
const UMBRAL_MATCH = 0.5; // más bajo = más estricto. 0.5 es estándar.
const MAX_INTENTOS_FALLIDOS = 50; // ~10 segundos a 5fps

async function procesarVerificacion(detection) {
    const guide = document.getElementById('verify-guide');
    const statusDot = document.getElementById('verify-status-dot');
    const statusText = document.getElementById('verify-status');
    const matchInfo = document.getElementById('match-info');
    
    if (!detection) {
        guide.classList.remove('detected', 'recognized');
        statusDot.classList.remove('detected');
        statusText.textContent = 'Buscando rostro...';
        matchInfo.textContent = '';
        return;
    }
    
    guide.classList.add('detected');
    statusDot.classList.add('detected');
    
    // Comparar contra todos los usuarios registrados
    const usuarios = JSON.parse(localStorage.getItem('vc_usuarios') || '[]');
    
    let mejorMatch = null;
    let menorDistancia = 1.0;
    
    for (const u of usuarios) {
        const descriptorGuardado = new Float32Array(u.descriptor);
        const distancia = faceapi.euclideanDistance(detection.descriptor, descriptorGuardado);
        
        if (distancia < menorDistancia) {
            menorDistancia = distancia;
            mejorMatch = u;
        }
    }
    
    matchInfo.textContent = `Distancia: ${menorDistancia.toFixed(3)}`;
    
    if (menorDistancia < UMBRAL_MATCH && mejorMatch) {
        // ¡MATCH!
        guide.classList.add('recognized');
        statusText.textContent = `✓ ${mejorMatch.nombre}`;
        
        // Detener cámara
        detenerCamara();
        intentosFallidos = 0;
        
        // Calcular confianza (invertir distancia)
        const confianza = ((1 - menorDistancia) * 100).toFixed(1);
        
       // Mostrar pantalla de éxito + enviar a Firebase
        setTimeout(() => {
            mostrarResultadoExito(mejorMatch, confianza);
            
            // Enviar autorización a Firebase para que la reciba el operador
            if (window.enviarAutorizacionFirebase) {
                window.enviarAutorizacionFirebase(mejorMatch, parseFloat(confianza))
                    .then(ok => {
                        if (ok) {
                            console.log('🎉 Operador notificado vía Firebase');
                        }
                    });
            }
        }, 800);
    } else {
        statusText.textContent = 'Verificando...';
        intentosFallidos++;
        
        if (intentosFallidos > MAX_INTENTOS_FALLIDOS) {
            detenerCamara();
            intentosFallidos = 0;
            mostrarResultadoFallo('No pudimos verificar tu identidad después de varios intentos.');
        }
    }
}

function detenerVerificacion() {
    detenerCamara();
    intentosFallidos = 0;
    goToScreen('welcome');
}

window.detenerVerificacion = detenerVerificacion;

// ============================================================
// RESULTADOS
// ============================================================
function mostrarResultadoExito(usuario, confianza) {
    document.getElementById('result-name').textContent = usuario.nombre;
    document.getElementById('result-confidence').textContent = confianza + '%';
    
    const ahora = new Date();
    const hora = ahora.toLocaleTimeString('es-MX', { 
        hour: '2-digit', 
        minute: '2-digit',
        second: '2-digit'
    });
    document.getElementById('result-time').textContent = hora;
    
    goToScreen('result-success');
}

function mostrarResultadoFallo(razon) {
    document.getElementById('fail-reason').innerHTML = razon;
    goToScreen('result-fail');
}

console.log('✅ Vision Control - Listo');