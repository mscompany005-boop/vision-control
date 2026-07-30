/* ============================================================
   VISION CONTROL — Firebase (robusto, no rompe la página)
   ============================================================ */

// Config pública (no es secreto). databaseURL de tu proyecto.
const firebaseConfig = {
    databaseURL: "https://dronentrega-default-rtdb.firebaseio.com/"
};

// Fallback por si Firebase no carga: la función existe pero avisa en consola.
window.enviarAutorizacionFirebase = async function () {
    console.warn('Firebase todavía no está listo.');
    return false;
};

// Cargar Firebase de forma dinámica y segura
(async () => {
    try {
        const { initializeApp } = await import("https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js");
        const { getDatabase, ref, set } = await import("https://www.gstatic.com/firebasejs/10.7.1/firebase-database.js");

        const app = initializeApp(firebaseConfig);
        const db = getDatabase(app);

        window.enviarAutorizacionFirebase = async function (usuario, confianza) {
            try {
                const datos = {
                    estado: 'AUTORIZADO',
                    nombre: usuario.nombre,
                    curp: usuario.curp,
                    cliente: usuario.cliente,
                    distancia: parseFloat((1 - confianza / 100).toFixed(3)),
                    confianza: confianza,
                    timestamp: Math.floor(Date.now() / 1000),
                    fuente: 'PWA Vision Control'
                };
                await set(ref(db, 'autorizaciones'), datos);
                console.log('✅ Autorización enviada a Firebase:', datos);
                return true;
            } catch (e) {
                console.error('❌ Error enviando a Firebase:', e);
                return false;
            }
        };

        console.log('✅ Firebase JS conectado');
    } catch (e) {
        console.error('⚠️ No se pudo cargar Firebase (la app sigue funcionando):', e);
    }
})();
