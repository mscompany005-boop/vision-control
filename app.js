/* ============================================= */
/* VISION CONTROL - Lógica principal             */
/* ============================================= */

console.log('🛸 Vision Control - Sistema iniciado');

/**
 * Cambia entre pantallas con animación.
 * @param {string} screenName - 'welcome' | 'register' | 'verify' | 'result-success' | 'result-fail'
 */
function goToScreen(screenName) {
    // Ocultar todas las pantallas
    const screens = document.querySelectorAll('.screen');
    screens.forEach(s => s.classList.remove('active'));
    
    // Mostrar la solicitada
    const target = document.getElementById('screen-' + screenName);
    if (target) {
        target.classList.add('active');
        window.scrollTo(0, 0);
        
        // Si es la pantalla de éxito, actualiza la hora
        if (screenName === 'result-success') {
            const ahora = new Date();
            const hora = ahora.toLocaleTimeString('es-MX', { 
                hour: '2-digit', 
                minute: '2-digit' 
            });
            const elemHora = document.getElementById('result-time');
            if (elemHora) elemHora.textContent = hora;
        }
    } else {
        console.error('Pantalla no encontrada:', screenName);
    }
}

// Hacer la función accesible globalmente desde HTML
window.goToScreen = goToScreen;
