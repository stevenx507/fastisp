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
