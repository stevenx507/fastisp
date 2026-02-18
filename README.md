# ISPFAST: GestiÃ³n Integral de Proveedores de Servicios de Internet (ISP)

## ðŸš€ DescripciÃ³n del Proyecto
ISPFAST es una soluciÃ³n integral para la gestiÃ³n de proveedores de servicios de Internet (ISP). Ofrece un panel de administraciÃ³n profesional, un dashboard de cliente interactivo y funcionalidades avanzadas para la gestiÃ³n de dispositivos MikroTik, facturaciÃ³n, soporte y monitoreo en tiempo real. Construido con una arquitectura moderna, ISPFAST estÃ¡ diseÃ±ado para ser escalable, seguro y fÃ¡cil de desplegar.

## âœ¨ CaracterÃ­sticas Principales
*   **AutenticaciÃ³n Segura:** Login y AutenticaciÃ³n con JWT (JSON Web Tokens).
*   **Dashboard de Cliente:** Interfaz intuitiva con widgets arrastrables.
*   **Pruebas de Velocidad:** MediciÃ³n de velocidad 4K en tiempo real.
*   **GestiÃ³n de FacturaciÃ³n:** IntegraciÃ³n con Stripe para pagos y suscripciones.
*   **Soporte IA:** Asistencia 24/7 con integraciÃ³n de ChatGPT.
*   **Mapa de Red Interactivo:** VisualizaciÃ³n de la infraestructura con Leaflet.
*   **Panel de AdministraciÃ³n:** Herramientas completas para la gestiÃ³n de operaciones del ISP.
*   **Auto-Provisioning MikroTik:** ConfiguraciÃ³n y gestiÃ³n automatizada de routers MikroTik.
*   **DiseÃ±o Adaptativo:** Responsive Design para una experiencia Ã³ptima en dispositivos mÃ³viles (PWA para instalaciÃ³n como app).

## Novedades (18 feb 2026)
*   **UI futurista con 3 temas (Azul, Esmeralda, Platinum)** y chips de estado unificados (verde = activo/pagado, amarillo = pendiente, rojo = caÃ­do/deuda).
*   **Tarjetas de Pagados/Pendientes enlazadas:** al hacer click en "Pagados" o "Pendientes por cobrar" el dashboard abre directamente Finanzas con el listado correspondiente (pagos registrados o facturas por cobrar).
*   **Lista de Clientes estilo enterprise:** barra de acciones masivas (zona, acciÃ³n, ejecutar), filtros por columna (usuario, IP, interfaz LAN, dÃ­a de corte), vista compacta y exportes rÃ¡pidos.
*   **Flujo de cobranza mejorado:** exportes CSV, recordatorios masivos y navegaciÃ³n directa entre Finanzas, Clientes y Tickets.
*   **Red & OLT listas para producciÃ³n:** panel de MikroTik endurecido y scripts de conexiÃ³n rÃ¡pida para OLT ZTE/Huawei/VSOL desde el dashboard.
*   **Licencias SaaS con recordatorios:** panel dedicado de suscripciones con recordatorio de vencidos, MRR y filtros por estado.
*   **Salud de red unificada:** widget de salud (routers/OLT, latencia, pÃ©rdida) y API `/network/health` para conectar monitoreo real.
*   **Wizard TR-064/ACS:** pruebas de conectividad y generaciÃ³n de script de aprovisionamiento para OLT Huawei/ZTE/VSOL, listo para copiar.
*   **OLT avanzado:** acciones rápidas (PON, lista ONU, potencia óptica, backup), comandos de login y scripts listos para Windows/Linux.
*   **Onboarding rÃ¡pido:** login/registro demo (demo1/demo2) y botÃ³n "Iniciar con Google" (demo) para facilitar pruebas.
*   **Provisionamiento clientes MikroTik listo:** alta de clientes PPPoE/DHCP/estática, genera credenciales PPPoE si faltan, asigna plan/router y puede provisionar automático (`provision=true`).
*   **MFA TOTP opcional:** `/auth/mfa/setup|enable|disable` y login con `mfa_code` cuando está activo.
*   **Límites anti-fuerza bruta:** rate limiting en login/registro/checkout.

### OLT â ConexiÃ³n fÃ¡cil
- Comando rÃ¡pido: `GET /olt/devices/<id>/quick-login?platform=windows|linux`.
- Script asistido: `POST /olt/devices/<id>/quick-connect-script` devuelve bloque de comandos listo para pegar.
- Acciones soportadas: `show_pon_summary`, `show_onu_list`, `find_onu`, `authorize_onu`, `deauthorize_onu`, `reboot_onu`, `backup_running_config`, `show_optical_power`, `save_config`.

### ðŸ“¡ Funcionalidades Avanzadas para MikroTik
*   **GestiÃ³n de Clientes:** Provisionamiento automÃ¡tico, configuraciÃ³n IP estÃ¡tica/PPPoE/DHCP, activaciÃ³n/desactivaciÃ³n, cambio de velocidad/plan en tiempo real, suspensiÃ³n automÃ¡tica por impago.
*   **QoS Avanzado:** Colas simples con burst dinÃ¡mico, PCQ (Per Connection Queuing), priorizaciÃ³n por aplicaciÃ³n, lÃ­mites de ancho de banda, optimizaciÃ³n para gaming/VoIP.
*   **Monitoreo:** Estado del router en tiempo real, mÃ©tricas de CPU, memoria, uptime, estadÃ­sticas de interfaces, colas y conexiones activas, score de salud automÃ¡tico.
*   **Seguridad:** Firewall bÃ¡sico configurado, bloqueo de puertos peligrosos, rate limiting por cliente, listas de acceso dinÃ¡micas.
*   **Features Avanzados:** Hotspot con captive portal, Multi-WAN con failover, backup/restore automÃ¡tico, scripting remoto, IPv6 nativo.
*   **Auto-Provisioning:** Descubrimiento automÃ¡tico de routers, configuraciÃ³n cero-toque, plantillas configurables, cÃ³digos QR para clientes.

### ðŸŽ¯ CaracterÃ­sticas Ãšnicas
*   **Soporte Multi-VersiÃ³n:** Funciona con RouterOS v6 y v7.
*   **Zero-Touch Provisioning:** Configura routers nuevos automÃ¡ticamente.
*   **Auto-Healing:** Reinicio automÃ¡tico si detecta problemas.
*   **Monitoreo 24/7:** MÃ©tricas en tiempo real con alertas y una API Completa.
*   **Interfaz Web:** GestiÃ³n completa desde el navegador.
*   **IntegraciÃ³n Total:** Con facturaciÃ³n, clientes, soporte.

## ðŸ› ï¸ TecnologÃ­as Utilizadas
*   **Backend:** Python (Flask), Flask-RESTful, SQLAlchemy, JWT, Celery, Prometheus, Stripe, Twilio, OpenAI, RouterOS API.
*   **Frontend:** React, TypeScript, Vite, Tailwind CSS, Chart.js, Leaflet, Socket.IO, Zustand.
*   **Base de Datos:** PostgreSQL.
*   **Cache/Broker de Mensajes:** Redis.
*   **ContenerizaciÃ³n:** Docker, Docker Compose.
*   **Servidor Web (ProducciÃ³n):** Gunicorn (Backend), Nginx (Frontend).
*   **Proxy Inverso/Load Balancer (ProducciÃ³n):** Traefik (con Let's Encrypt).

## âš¡ Quick Start (5 minutos)

### OpciÃ³n 1: Con Docker Compose (Recomendado)

```bash
# Necesitas: Docker Desktop instalado (https://docker.com/products/docker-desktop)
docker compose -f docker-compose.dev.yml up --build -d --remove-orphans

# Espera 30-60 segundos y luego accede a:
# Frontend: http://localhost:3000
# Backend API: http://localhost:5000
# Admin Login: demo1@ispmax.com / demo1
# Cliente demo: demo2@ispmax.com / demo2
```

### OpciÃ³n 2: Local (Backend + Frontend separados)

**Requisitos previos:**
- Python 3.10+ (con venv)
- Node.js 16+ LTS

```powershell
# Terminal 1: Backend Flask (Puerto 5000)
cd backend
# Genera ENCRYPTION_KEY y variables de entorno
$env:ENCRYPTION_KEY = $(python -c "from cryptography.fernet import Fernet; print(Fernet.generate_key().decode())")
$env:DATABASE_URL = 'sqlite:///dev.db'
$env:REDIS_URL = 'redis://localhost:6379/0'
$env:CORS_ORIGINS = 'http://localhost:3000'
$env:MIKROTIK_DEFAULT_USERNAME = 'admin'
$env:MIKROTIK_DEFAULT_PASSWORD = 'admin'
python run.py

# Terminal 2: Frontend Vite (Puerto 3000)
cd frontend
npm install
npm run dev
```

Accede a **http://localhost:3000** â†’ Login â†’ Â¡Listo! ðŸŽ‰

## ðŸ“‹ Pre-requisitos
Antes de comenzar, asegÃºrate de tener instalados los siguientes componentes:
*   [**Git**](https://git-scm.com/downloads)
*   [**Docker**](https://docs.docker.com/get-docker/) (opcional si ejecutas localmente)
*   [**Node.js 16+ LTS**](https://nodejs.org/) (para frontend local)
*   [**Docker y Docker Compose**](https://www.docker.com/products/docker-desktop/) (Docker Desktop para Windows y Mac ya incluye Compose).

## ðŸš€ InstalaciÃ³n
Sigue estos pasos para poner en marcha el proyecto.

### 1. Clonar el Repositorio
```bash
git clone https://github.com/stevenx507/ISPFAST
cd ISPFAST
```

### 2. ConfiguraciÃ³n de Variables de Entorno
Copia los archivos de ejemplo de variables de entorno. **Este paso es crucial.**

*   **`.env`**: Contiene las variables principales de la aplicaciÃ³n (claves de API, configuraciÃ³n de base de datos, etc.).
*   **`.env.influx`**: Contiene las variables para la configuraciÃ³n del stack de monitoreo (InfluxDB y Grafana).

```bash
# En Windows (Command Prompt)
copy .env.example .env
copy .env.influx.example .env.influx

# En Windows (PowerShell)
Copy-Item .env.example .env
Copy-Item .env.influx.example .env.influx

# En Linux/macOS
cp .env.example .env
cp .env.influx.example .env.influx
```
Luego, **abre los archivos `.env` y `.env.influx` en un editor de texto** y rellena todas las variables necesarias.

### 3. Ejecutar la AplicaciÃ³n (MÃ©todo Automatizado - Recomendado)
Hemos creado scripts para facilitar la instalaciÃ³n en diferentes sistemas operativos.

#### En Windows
Usa el script de PowerShell `install.ps1`. Abre una terminal de PowerShell, navega hasta la raÃ­z del proyecto y ejecuta:

```powershell
# Puede que necesites permitir la ejecuciÃ³n de scripts en tu sesiÃ³n actual
Set-ExecutionPolicy -Scope Process -ExecutionPolicy RemoteSigned

# Instalar para entorno de desarrollo (por defecto)
.\install.ps1

# O para entorno de producciÃ³n
.\install.ps1 -Environment prod
```

#### En Linux / macOS
> **Nota:** Se debe crear o verificar el script `install.sh`. Las siguientes instrucciones asumen su existencia.

Usa el script de shell `install.sh`. Abre una terminal, dale permisos de ejecuciÃ³n y lÃ¡nzalo:
```bash
# Dar permisos de ejecuciÃ³n la primera vez
chmod +x install.sh

# Instalar para entorno de desarrollo (por defecto)
./install.sh dev

# O para entorno de producciÃ³n
./install.sh prod
```

### 4. Ejecutar la AplicaciÃ³n (MÃ©todo Manual)
Si prefieres levantar los servicios manualmente, puedes usar `docker compose` directamente.

#### Modo Desarrollo
```bash
docker compose -f docker-compose.dev.yml up --build -d
```

#### Modo ProducciÃ³n
AsegÃºrate de que tus variables de entorno en `.env` estÃ©n configuradas para producciÃ³n.
```bash
docker compose -f docker-compose.prod.yml up --build -d
```

### 5. Actualizaciones y Migraciones de Base de Datos
Si realizas cambios en los modelos de la base de datos (archivos en `backend/app/models.py`) o descargas cambios que los incluyen, necesitarÃ¡s generar y aplicar una migraciÃ³n:
```bash
# 1. Navega al directorio del backend
cd backend

# 2. Activa tu entorno virtual de Python
# En Windows:
.venv\Scripts\activate
# En macOS/Linux:
# source .venv/bin/activate

# 3. Genera el script de migraciÃ³n (dale un mensaje descriptivo)
flask db migrate -m "DescripciÃ³n del cambio en el modelo"

# 4. Aplica la migraciÃ³n a la base de datos
flask db upgrade
```

## ðŸ’» Acceso a las Interfaces
*   **Frontend Cliente:** `http://localhost:3000` (en desarrollo) o `https://your-frontend-domain.com` (en producciÃ³n, segÃºn `FRONTEND_HOST`)
    *   **Usuario demo:** `demo2@ispmax.com`
    *   **ContraseÃ±a:** `demo2`
    *   O crea tu acceso con el botÃ³n **Crear acceso demo** o **Iniciar con Google** (demo sin OAuth real).
*   **Panel Admin:** `http://localhost:3000/admin` (en desarrollo) o `https://your-frontend-domain.com/admin`
    *   **Usuario:** `demo1@ispmax.com`
    *   **ContraseÃ±a:** `demo1`
*   **API Backend:** `http://localhost:5000/api` (en desarrollo)
*   **PGAdmin:** `http://localhost:5050`
*   **Grafana (Monitoreo):** `http://localhost:3001`

## ðŸ“Š Monitoreo Avanzado y Alertas
El sistema ahora incluye un stack de monitoreo avanzado para anÃ¡lisis histÃ³rico y visualizaciÃ³n.
*   **Base de Datos de Series Temporales (InfluxDB):** Almacena mÃ©tricas de rendimiento de los routers a lo largo del tiempo.
*   **VisualizaciÃ³n (Grafana):** Permite crear dashboards interactivos.
    *   **Acceso:** Visita `http://localhost:3001`.
    *   **Credenciales:** `admin` / `password` (configurables en `.env.influx`).
    *   **Dashboard Incluido:** Se ha pre-configurado un dashboard llamado **"MikroTik Router Monitoring"** que muestra la carga de CPU, uso de memoria y trÃ¡fico por interfaz.
*   **Sistema de Alertas (En desarrollo):** Se estÃ¡ implementando un sistema para notificar proactivamente sobre problemas de red basados en umbrales configurables.

## ðŸ”§ ConfiguraciÃ³n Adicional de MikroTik
Para integrar MikroTik con ISPFAST, necesitarÃ¡s:
1.  **Subir los scripts** proporcionados (e.g., `scripts/mikrotik/initial_config.rsc`) a tu router MikroTik.
2.  **Configurar el acceso API** en tu router.
3.  **Probar la conexiÃ³n** desde el panel de administraciÃ³n de ISPFAST.

## OLT Live (ZTE / Huawei / VSOL)
El modulo `AdminOLT` soporta dos modos de ejecucion:
- `simulate`: no ejecuta comandos reales, solo genera transcripcion.
- `live`: ejecuta comandos reales por `ssh` o `telnet` segun el dispositivo.

Para habilitar `live`, configura estas variables en `.env`:
```env
OLT_DEFAULT_USERNAME=admin
OLT_DEFAULT_PASSWORD=
OLT_DEFAULT_ENABLE_PASSWORD=
OLT_CREDENTIALS_JSON={"OLT-ZTE-001":{"username":"admin","password":"secret"}}
OLT_LIVE_TIMEOUT_SECONDS=6
OLT_COMMAND_DELAY_SECONDS=0.2
OLT_MAX_OUTPUT_CHARS=30000
OLT_STRICT_HOST_KEY=false
```

Notas de seguridad y operacion:
- En `run_mode=live` se exige `live_confirm=true` en el endpoint de ejecucion.
- `GET /api/olt/audit-log` devuelve la bitacora de ejecuciones (actor, modo, estado, timestamps).
- Para `ssh live` se requiere `paramiko` en el entorno Python del backend.

## ðŸ“ Endpoints API Disponibles
```bash
# GestiÃ³n de Routers
GET    /api/mikrotik/routers                 # Listar routers
GET    /api/mikrotik/routers/{id}           # Detalles router
GET    /api/mikrotik/routers/{id}/health    # Salud del router
GET    /api/mikrotik/routers/{id}/queues    # Colas activas
GET    /api/mikrotik/routers/{id}/connections # Conexiones
GET    /api/mikrotik/routers/{id}/metrics   # MÃ©tricas histÃ³ricas desde InfluxDB

# GestiÃ³n de Clientes
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
```

## âœ¨ CaracterÃ­sticas Visuales Implementadas
*   **Para Clientes:** Interfaz moderna con gradientes y animaciones, diseÃ±o responsive, carga rÃ¡pida con optimizaciones, UX intuitiva, tema claro/oscuro (implementable).
*   **Para Administradores:** Dashboard ejecutivo con mÃ©tricas en tiempo real, mapa de calor de clientes, sistema de alertas visual, grÃ¡ficos interactivos con Chart.js, herramientas avanzadas para gestiÃ³n.

---
Este sistema estÃ¡ 100% funcional y listo para producciÃ³n, siempre y cuando las variables de entorno y los servicios externos estÃ©n configurados correctamente.

## Quality Checks
Run these commands before pushing changes:

```bash
# Frontend
cd frontend
npm run lint
npm run build

# Backend tests
cd ../backend
python -m pytest -q tests
```

CI is configured in `.github/workflows/ci.yml` to run the same checks automatically on `push` and `pull_request`.

## Enterprise Scale Foundation
- Multi-tenant base and tenant-aware auth claims: `backend/app/models.py`, `backend/app/tenancy.py`.
- API versioning aliases under `/api/v1`: `backend/app/init.py`.
- Request tracing + structured access logs: `backend/app/init.py`.
- NOC automation + KPI aggregation tasks: `backend/app/tasks.py`.
- Kubernetes autoscaling manifests: `deploy/k8s/`.
- DR and operations runbooks: `docs/operations/`.
- Scale architecture notes: `docs/architecture/scale-blueprint.md`.
