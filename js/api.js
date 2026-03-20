/**
 * api.js — Acceso a la API de gasolineras del MITECO
 *
 * API: Ministerio para la Transición Ecológica y el Reto Demográfico
 * Base URL: https://sedeaplicaciones.minetur.gob.es/ServiciosRESTCarburantes/PreciosCarburantes/
 * Documentación: https://sedeaplicaciones.minetur.gob.es/ServiciosRESTCarburantes/PreciosCarburantes/help
 *
 * La API soporta CORS (Access-Control-Allow-Origin: *), sin API key.
 *
 * IMPORTANTE: No existe endpoint por lat/lon/radio.
 * Estrategia: buscar gasolineras por provincia → filtrar por distancia en cliente.
 */

const API_BASE = 'https://sedeaplicaciones.minetur.gob.es/ServiciosRESTCarburantes/PreciosCarburantes';
const NOMINATIM_REVERSE = 'https://nominatim.openstreetmap.org/reverse';
const TIMEOUT_MS = 15000;

/**
 * Tabla de conversión: nombre de provincia → IDProvincia de la API MITECO.
 * Los IDs corresponden a los códigos INE de dos dígitos.
 * Se incluyen variantes de nombre para mayor robustez en el matching.
 */
const PROVINCIAS_ID = {
    'álava': '01', 'alava': '01', 'araba': '01',
    'albacete': '02',
    'alicante': '03', 'alacant': '03',
    'almería': '04', 'almeria': '04',
    'ávila': '05', 'avila': '05',
    'badajoz': '06',
    'illes balears': '07', 'islas baleares': '07', 'balears': '07', 'baleares': '07',
    'barcelona': '08',
    'burgos': '09',
    'cáceres': '10', 'caceres': '10',
    'cádiz': '11', 'cadiz': '11',
    'castellón': '12', 'castellon': '12', 'castelló': '12',
    'ciudad real': '13',
    'córdoba': '14', 'cordoba': '14',
    'a coruña': '15', 'la coruña': '15', 'coruña': '15', 'a coruna': '15',
    'cuenca': '16',
    'girona': '17', 'gerona': '17',
    'granada': '18',
    'guadalajara': '19',
    'gipuzkoa': '20', 'guipúzcoa': '20', 'guipuzcoa': '20',
    'huelva': '21',
    'huesca': '22',
    'jaén': '23', 'jaen': '23',
    'león': '24', 'leon': '24',
    'lleida': '25', 'lérida': '25', 'lerida': '25',
    'la rioja': '26', 'rioja': '26',
    'lugo': '27',
    'madrid': '28',
    'málaga': '29', 'malaga': '29',
    'murcia': '30',
    'navarra': '31', 'nafarroa': '31',
    'ourense': '32', 'orense': '32',
    'asturias': '33',
    'palencia': '34',
    'las palmas': '35', 'palmas': '35',
    'pontevedra': '36',
    'salamanca': '37',
    'santa cruz de tenerife': '38', 'tenerife': '38',
    'cantabria': '39',
    'segovia': '40',
    'sevilla': '41',
    'soria': '42',
    'tarragona': '43',
    'teruel': '44',
    'toledo': '45',
    'valencia': '46', 'valència': '46',
    'valladolid': '47',
    'bizkaia': '48', 'vizcaya': '48',
    'zamora': '49',
    'zaragoza': '50',
    'ceuta': '51',
    'melilla': '52',
};

// ── API pública ──────────────────────────────────────────────────────────────

/**
 * Obtiene las gasolineras cercanas a unas coordenadas dentro de un radio dado.
 *
 * Flujo:
 *   1. Reverse geocode (Nominatim) → nombre de provincia
 *   2. Mapear a IDProvincia → fetch estaciones de esa provincia
 *   3. Si no se obtiene provincia → fetch todas las estaciones de España (fallback)
 *   4. Filtrar por distancia ≤ radioKm en cliente
 *   5. Normalizar y ordenar por distancia
 *
 * @param {number} latitud  - Latitud del usuario en grados decimales
 * @param {number} longitud - Longitud del usuario en grados decimales
 * @param {number} radioKm  - Radio de búsqueda en kilómetros (1–25)
 * @returns {Promise<Object[]>} Array de gasolineras normalizadas, ordenadas por distancia
 * @throws {Error} Si la red no está disponible o la API devuelve un error
 *
 * @example
 * const lista = await fetchGasolineras(40.4168, -3.7038, 5);
 * console.log(lista[0].nombre); // 'REPSOL'
 */
async function fetchGasolineras(latitud, longitud, radioKm) {
    const idProvincia = await _getIdProvinciaDesdeCoords(latitud, longitud);

    const endpoint = idProvincia
        ? `${API_BASE}/EstacionesTerrestres/FiltroProvincia/${idProvincia}`
        : `${API_BASE}/EstacionesTerrestres/`;

    const datos = await _fetchConTimeout(endpoint, TIMEOUT_MS);
    return _normalizarRespuesta(datos, latitud, longitud, radioKm);
}

// ── Funciones privadas ───────────────────────────────────────────────────────

/**
 * Obtiene el IDProvincia de la API MITECO haciendo reverse geocoding con Nominatim.
 * Devuelve null si no puede determinarse la provincia (se usará fallback all-Spain).
 *
 * @param {number} lat
 * @param {number} lon
 * @returns {Promise<string|null>} IDProvincia (ej: '28') o null
 */
async function _getIdProvinciaDesdeCoords(lat, lon) {
    try {
        const params = new URLSearchParams({
            lat:     lat,
            lon:     lon,
            format:  'json',
            zoom:    '10',       // Nivel 10 = comarca/provincia en OSM España
            addressdetails: '1',
        });

        const geoController = new AbortController();
        const geoTimer = setTimeout(() => geoController.abort(), 5000);

        let respuesta;
        try {
            respuesta = await fetch(`${NOMINATIM_REVERSE}?${params}`, {
                headers: { 'Accept-Language': 'es' },
                signal: geoController.signal,
            });
        } finally {
            clearTimeout(geoTimer);
        }

        if (!respuesta.ok) return null;

        const datos = await respuesta.json();
        const address = datos.address || {};

        // Nominatim en España puede devolver el nombre de provincia en distintos campos
        const candidatos = [
            address.county,
            address.state_district,
            address.province,
            address.state,
        ].filter(Boolean);

        for (const nombre of candidatos) {
            const id = _buscarIdProvincia(nombre);
            if (id) return id;
        }

        return null;

    } catch (error) {
        console.warn('[GasoApp] No se pudo determinar la provincia por geocodificación:', error.message);
        return null;
    }
}

/**
 * Busca el IDProvincia normalizando el nombre (sin tildes, minúsculas).
 *
 * @param {string} nombre - Nombre de la provincia tal como devuelve Nominatim
 * @returns {string|null} IDProvincia o null si no hay coincidencia
 */
function _buscarIdProvincia(nombre) {
    if (!nombre) return null;

    // Normalizar: minúsculas + quitar tildes
    const normalizado = nombre.toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .trim();

    // Búsqueda directa
    if (PROVINCIAS_ID[normalizado]) return PROVINCIAS_ID[normalizado];

    // Búsqueda parcial: ¿alguna clave conocida está contenida en el nombre recibido?
    for (const [clave, id] of Object.entries(PROVINCIAS_ID)) {
        if (normalizado.includes(clave) || clave.includes(normalizado)) return id;
    }

    return null;
}

/**
 * Realiza fetch con timeout usando AbortController (compatible con todos los browsers).
 *
 * @param {string} url       - URL a solicitar
 * @param {number} timeoutMs - Milisegundos antes de abortar
 * @returns {Promise<Object>} JSON parseado
 * @throws {Error} Si la respuesta HTTP no es 2xx o se supera el timeout
 */
async function _fetchConTimeout(url, timeoutMs) {
    const controller = new AbortController();
    const timerId = setTimeout(() => controller.abort(), timeoutMs);

    let respuesta;
    try {
        respuesta = await fetch(url, { signal: controller.signal });
    } finally {
        clearTimeout(timerId);
    }

    if (!respuesta.ok) {
        throw new Error(`Error ${respuesta.status} al contactar con la API de gasolineras.`);
    }

    return respuesta.json();
}

/**
 * Transforma la respuesta cruda de la API en el array normalizado interno.
 * Filtra las estaciones fuera del radio indicado.
 *
 * @param {Object} datos     - JSON crudo de la API MITECO
 * @param {number} latOrigen - Latitud del usuario
 * @param {number} lonOrigen - Longitud del usuario
 * @param {number} radioKm   - Radio máximo de búsqueda
 * @returns {Object[]} Gasolineras dentro del radio, ordenadas por distancia
 * @throws {Error} Si la respuesta no tiene el formato esperado
 */
function _normalizarRespuesta(datos, latOrigen, lonOrigen, radioKm) {
    const lista = datos && datos.ListaEESSPrecio;

    if (!Array.isArray(lista)) {
        throw new Error('La API devolvió una respuesta inesperada. Inténtalo más tarde.');
    }

    if (lista.length === 0) return [];

    return lista
        .map(eess => _normalizarGasolinera(eess, latOrigen, lonOrigen))
        .filter(g => g !== null && g.distanciaKm <= radioKm)
        .sort((a, b) => a.distanciaKm - b.distanciaKm);
}

/**
 * Normaliza un objeto individual de estación de servicio de la API MITECO.
 *
 * Notas sobre el formato de la API:
 *   - Coordenadas con coma decimal:  "40,416775" → parseFloat con replace
 *   - Precios con coma decimal:      "1,879"     → parsearPrecio() en utils.js
 *   - El campo de gasoil es "Precio Gasoleo A" (no "Gasoil")
 *
 * @param {Object} eess     - Objeto crudo de la API
 * @param {number} latOrigen
 * @param {number} lonOrigen
 * @returns {Object|null} Gasolinera normalizada o null si las coordenadas son inválidas
 */
function _normalizarGasolinera(eess, latOrigen, lonOrigen) {
    const lat = parseFloat((eess['Latitud'] || '').replace(',', '.'));
    const lon = parseFloat((eess['Longitud (WGS84)'] || '').replace(',', '.'));

    if (isNaN(lat) || isNaN(lon)) return null;

    return {
        id:          String(eess['IDEESS'] || ''),
        nombre:      _sanitizar(eess['Rótulo'] || 'Sin nombre'),
        direccion:   _sanitizar(eess['Dirección'] || ''),
        localidad:   _sanitizar(eess['Localidad'] || ''),
        provincia:   _sanitizar(eess['Provincia'] || ''),
        latitud:     lat,
        longitud:    lon,
        horario:     _sanitizar(eess['Horario'] || 'No disponible'),
        distanciaKm: calcularDistancia(latOrigen, lonOrigen, lat, lon),
        precios: {
            g95:        parsearPrecio(eess['Precio Gasolina 95 E5']),
            g98:        parsearPrecio(eess['Precio Gasolina 98 E5']),
            diesel:     parsearPrecio(eess['Precio Gasoleo A']),       // ← "Gasoleo", no "Gasoil"
            dieselPlus: parsearPrecio(eess['Precio Gasoleo Premium']), // ← "Gasoleo", no "Gasoil"
        },
    };
}

/**
 * Escapa entidades HTML para prevenir XSS con datos de la API.
 *
 * @param {*} valor
 * @returns {string}
 */
function _sanitizar(valor) {
    const div = document.createElement('div');
    div.appendChild(document.createTextNode(String(valor)));
    return div.innerHTML;
}
