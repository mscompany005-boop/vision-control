/* ============================================= */
/* VISION CONTROL - Firebase                     */
/* ============================================= */

import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import { getDatabase, ref, set } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-database.js";

// CONFIGURACIÓN DE FIREBASE
// (Esta es PÚBLICA, no es secreto. Las credenciales privadas siguen en firebase_key.json del Python)
const firebaseConfig = {
    databaseURL: "https://dronentrega-default-rtdb.firebaseio.com/"
};

const app = initializeApp(firebaseConfig);
const db = getDatabase(app);

/**
 * Envía la autorización a Firebase para que la reciba la interfaz del operador.
 */
window.enviarAutorizacionFirebase = async function(usuario, confianza) {
    try {
        const datos = {
            estado: 'AUTORIZADO',
            nombre: usuario.nombre,
            curp: usuario.curp,
            cliente: usuario.cliente,
            distancia: parseFloat((1 - confianza/100).toFixed(3)),
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