# GasoApp — CLAUDE.md del Proyecto

## Descripción
Aplicación web para consultar precios de gasolineras cercanas a la ubicación
del usuario. Muestra los datos en mapa interactivo y en listado ordenable.

## Stack tecnológico
- HTML5 + CSS3 + JavaScript (vanilla, sin frameworks)
- Leaflet.js — mapa interactivo (CDN)
- API pública REST — Ministerio para la Transición Ecológica (MITECO)
  Endpoint: https://sedeapitest.mincotur.gob.es/es/datos-abiertos/
  (verificar endpoint activo antes de implementar)
- Sin backend propio — todo en el lado del cliente

## Comandos
- Desarrollo: abrir index.html en el navegador (Live Server recomendado)
- Sin build necesario (proyecto vanilla)

## Estructura de carpetas
gasoapp/
  index.html
  css/
    styles.css
  js/
    app.js          ← lógica principal
    map.js          ← Leaflet, marcadores
    api.js          ← llamadas a la API
    ui.js           ← renderizado listado, filtros
    utils.js        ← cálculo distancias, colores precio
  assets/
    icons/
  CLAUDE.md
  README.md
  .env.example

## Variables de entorno
No se necesita API key para la API de MITECO (pública y abierta)
Si se usa OpenStreetMap + Nominatim para geocodificación: también gratuita

## Decisiones técnicas
- Vanilla JS elegido por coherencia con stack DAW 1º curso
- Leaflet por ser la librería de mapas más ligera y documentada
- mobile-first: diseño pensado primero para móvil
- Sin dependencias de npm para simplicidad de despliegue

## Modos activos en este proyecto
- PLANIFICAR/DISEÑAR → estructura, API, flujo de datos
- GENERAR CÓDIGO     → componentes JS separados por responsabilidad
- DEBUGGEAR          → problemas de geolocalización, CORS, API
- CODE REVIEW        → seguridad, rendimiento, clean code
- REFACTORIZAR       → tras tener versión funcional
- TESTS              → validaciones de entrada, edge cases de la API
- DOCUMENTAR         → README con capturas y guía de uso
