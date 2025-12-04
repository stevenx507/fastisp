🚀 Cómo Ejecutar el Sistema
Paso 1: Clonar y Configurar

git clone https://github.com/stevenx507/ISPFAST
cd ispmax

# Hacer ejecutable el script de instalación
chmod +x install.sh

# Iniciar en modo desarrollo
./install.sh dev

Paso 2: Acceder a las Interfaces
Frontend Cliente: http://localhost:3000

Usuario: cliente@ispmax.com

Contraseña: pass123

Panel Admin: http://localhost:3000/admin

Usuario: admin@ispmax.com

Contraseña: admin123

API Backend: http://localhost:5000/api

PGAdmin: http://localhost:5050

Paso 3: Funcionalidades Disponibles
✅ Login y Autenticación con JWT
✅ Dashboard Cliente con widgets arrastrables
✅ Prueba de Velocidad 4K en tiempo real
✅ Gestión de Facturación con Stripe
✅ Soporte IA 24/7 con ChatGPT
✅ Mapa de Red interactivo con Leaflet
✅ Panel Admin profesional
✅ Auto-Provisioning de MikroTik
✅ Responsive Design para móviles
✅ PWA para instalación como app

🚀 5. Funcionalidades Implementadas
✅ Funciones COMPLETAS para MikroTik:
Gestión de Clientes:

✅ Provisionamiento automático

✅ Configuración IP estática/PPPoE/DHCP

✅ Activación/Desactivación de clientes

✅ Cambio de velocidad/plan en tiempo real

✅ Suspensión por impago automática

QoS Avanzado:

✅ Colas simples con burst dinámico

✅ PCQ (Per Connection Queuing)

✅ Priorización por aplicación

✅ Límites de ancho de banda

✅ Optimización para gaming/VoIP

Monitoreo:

✅ Estado del router en tiempo real

✅ Métricas de CPU, memoria, uptime

✅ Estadísticas de interfaces

✅ Colas y conexiones activas

✅ Score de salud automático

Seguridad:

✅ Firewall básico configurado

✅ Bloqueo de puertos peligrosos

✅ Rate limiting por cliente

✅ Listas de acceso dinámicas

Features Avanzados:

✅ Hotspot con captive portal

✅ Multi-WAN con failover

✅ Backup/restore automático

✅ Scripting remoto

✅ IPv6 nativo

Auto-Provisioning:

✅ Descubrimiento automático de routers

✅ Configuración cero-toque

✅ Plantillas configurables

✅ Códigos QR para clientes

🔧 Endpoints API Disponibles:
bash
# Gestión de Routers
GET    /api/mikrotik/routers                 # Listar routers
GET    /api/mikrotik/routers/{id}           # Detalles router
GET    /api/mikrotik/routers/{id}/health    # Salud del router
GET    /api/mikrotik/routers/{id}/queues    # Colas activas
GET    /api/mikrotik/routers/{id}/connections # Conexiones

# Gestión de Clientes
POST   /api/mikrotik/provision              # Provisionar cliente
POST   /api/mikrotik/clients/{id}/suspend   # Suspender cliente
POST   /api/mikrotik/clients/{id}/activate  # Activar cliente
POST   /api/mikrotik/clients/{id}/update-speed # Cambiar velocidad

# Operaciones del Router
POST   /api/mikrotik/routers/{id}/backup    # Backup config
POST   /api/mikrotik/routers/{id}/reboot    # Reiniciar
POST   /api/mikrotik/routers/{id}/execute-script # Ejecutar script
POST   /api/mikrotik/routers/{id}/hotspot   # Configurar hotspot
POST   /api/mikrotik/routers/{id}/multi-wan # Configurar multi-WAN

# Descubrimiento
GET    /api/mikrotik/discover               # Descubrir routers
POST   /api/mikrotik/advanced/provision     # Provision avanzado
🎯 Características Únicas:
Soporte Multi-Versión: Funciona con RouterOS v6 y v7

Zero-Touch Provisioning: Configura routers nuevos automáticamente

Auto-Healing: Reinicio automático si detecta problemas

Monitoreo 24/7: Métricas en tiempo real con alertas

API Completa: Todas las operaciones vía REST API

Interfaz Web: Gestión completa desde el navegador

Integración Total: Con facturación, clientes, soporte

📊 Dashboard de Monitoreo:
El sistema incluye un dashboard completo que muestra:

✅ Estado de todos los routers

✅ Uso de CPU y memoria

✅ Tráfico en tiempo real

✅ Clientes conectados

✅ Alertas y notificaciones

✅ Gráficos históricos



Paso 4: Configurar MikroTik
Subir los scripts a tu router

Configurar API access

Probar conexión desde el panel admin

🎯 Características Visuales Implementadas
Para Clientes:
🎨 Interfaz moderna con gradientes y animaciones

📱 Diseño responsive que funciona en móviles

⚡ Carga rápida con optimizaciones

🎯 UX intuitiva con navegación simple

🌙 Tema claro/oscuro (implementable)

Para Administradores:
📊 Dashboard ejecutivo con métricas en tiempo real

🗺️ Mapa de calor de clientes

🔔 Sistema de alertas visual

📈 Gráficos interactivos con Chart.js

🔧 Herramientas avanzadas para gestión

Características Técnicas:
🔐 Autenticación JWT con refresh tokens

📡 WebSockets para actualizaciones en tiempo real

💾 Cache Redis para mejor performance

🐳 Dockerizado para fácil despliegue

📱 PWA para instalación como app nativa

El sistema está 100% funcional y listo para producción. Solo necesitas configurar las variables de entorno y tus servicios externos (Stripe, Twilio, etc.).
