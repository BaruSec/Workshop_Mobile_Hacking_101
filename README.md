# 🔓 Workshop: "Rompiendo el Candado" — Bypass de SSL Pinning para Bug Hunters

> **Taller práctico** donde aprenderás a interceptar tráfico HTTPS de aplicaciones Android que implementan SSL Pinning, convirtiéndolas en targets web convencionales para tu cacería de bugs.

---

## 📋 Requisitos Previos

Antes del taller, **asegúrate de tener todo instalado y funcionando**. El tiempo del workshop es limitado (40 min), así que llegaremos directo a la práctica.

### 💻 Requisitos de Hardware / Sistema

| Requisito | Detalle |
| :--- | :--- |
| **Sistema Operativo** | Windows, macOS o Linux |
| **RAM mínima** | 8 GB (16 GB recomendado para correr el emulador cómodamente) |
| **Espacio en disco** | Al menos 20 GB libres |
| **Virtualización** | Habilitada en BIOS/UEFI (Intel VT-x / AMD-V). Necesaria para el emulador de Android |

---

## 🛠️ Herramientas a Instalar

### 1. Android Studio + Emulador (o dispositivo Android rooteado)

Necesitamos un entorno Android donde ejecutar las apps. Tienes dos opciones:

#### Opción A: Emulador (Recomendado)

1. Descarga e instala [Android Studio](https://developer.android.com/studio).
2. Abre Android Studio → **More Actions** → **Virtual Device Manager**.
3. Crea un nuevo dispositivo virtual:
   - **Dispositivo:** Pixel 6 (o cualquier otro).
   - **System Image:** Descarga una imagen **sin Google Play** (ícono sin triángulo) con **API 28–33** (Android 9–13). Las imágenes sin Play Store permiten obtener acceso root fácilmente con `adb root`.
   - **Arquitectura:** Elige `x86_64` para mejor rendimiento en tu PC.
4. Inicia el emulador y verifica que aparece ejecutando en tu terminal:
   ```bash
   adb devices
   ```
   Deberías ver algo como: `emulator-5554  device`

> [!IMPORTANT]
> **¿Por qué sin Google Play?** Las imágenes con Google Play **NO** permiten rootear el dispositivo fácilmente, lo cual necesitamos para instalar el certificado de Burp como certificado del sistema y para correr `frida-server`.

#### Opción B: Teléfono Android Rooteado

Si tienes un teléfono rooteado (ej. con Magisk):

1. **Activa las Opciones de Desarrollador:**
   - Ve a **Ajustes → Acerca del teléfono** (o **Información del software**).
   - Toca **Número de compilación** (Build Number) **7 veces** seguidas.
   - Verás un mensaje: *"¡Ahora eres desarrollador!"*.
2. **Habilita Depuración USB:**
   - Ve a **Ajustes → Sistema → Opciones de desarrollador** (o **Ajustes → Opciones de desarrollador**).
   - Activa **Depuración USB**.
3. Conéctalo a tu PC con cable USB, acepta la ventana de autorización en el teléfono, y verifica con:
   ```bash
   adb devices
   ```

> [!NOTE]
> En el **emulador** de Android Studio, las Opciones de Desarrollador y la Depuración USB vienen habilitadas por defecto, por lo que no necesitas hacer estos pasos.

---

### 2. ADB (Android Debug Bridge)

ADB se instala automáticamente con Android Studio. Para verificar que está disponible en tu `PATH`:

```bash
adb --version
```

Si no lo reconoce, agrega la ruta de `platform-tools` a tu variable de entorno `PATH`:

| OS | Ruta típica |
| :--- | :--- |
| **Windows** | `C:\Users\<tu_usuario>\AppData\Local\Android\Sdk\platform-tools` |
| **macOS** | `~/Library/Android/sdk/platform-tools` |
| **Linux** | `~/Android/Sdk/platform-tools` |

---

### 3. Magisk (Root + Módulos)

Magisk es la herramienta estándar para rootear dispositivos Android y gestionar módulos que modifican el sistema.

#### Para emuladores: rootAVD

Si usas un emulador de Android Studio, la forma más fácil de instalar Magisk es con [rootAVD](https://gitlab.com/newbit/rootAVD):

```bash
# 1. Clonar rootAVD
git clone https://gitlab.com/newbit/rootAVD.git
cd rootAVD

# 2. Listar las imágenes disponibles (con el emulador corriendo)
./rootAVD.sh ListAllAVDs

# 3. Rootear el emulador (selecciona la imagen correcta de la lista anterior)
./rootAVD.sh system-images/android-XX/google_apis/x86_64/ramdisk.img
```

Después de reiniciar el emulador, la app **Magisk** debería aparecer instalada.

#### Para teléfonos físicos

Consulta la [documentación oficial de Magisk](https://topjohnwu.github.io/Magisk/install.html). El proceso varía según el fabricante y modelo.

---

### 4. Proxy de Interceptación (Burp Suite o Caido)

Necesitamos un proxy para interceptar el tráfico HTTP/HTTPS. Puedes usar **cualquiera** de los dos.

> [!WARNING]
> Sea cual sea el proxy que elijas, **DEBES configurarlo para que escuche en `All Interfaces` (0.0.0.0)**, no solo en `127.0.0.1`. De lo contrario, el dispositivo Android no podrá conectarse al proxy ni descargar el certificado.

#### Opción A: Burp Suite Community Edition

1. Descarga [Burp Suite Community Edition](https://portswigger.net/burp/communitydownload).
2. Instálalo y ábrelo. Verifica que puedas llegar a la pestaña **Proxy → Intercept**.
3. Ve a **Settings → Tools → Proxy → Proxy listeners** → Edita el listener y cambia **Bind to address** a **All interfaces**.
4. Anota el puerto de tu proxy (por defecto `8080`).

#### Opción B: Caido

1. Descarga [Caido](https://caido.io/download).
2. Instálalo y ábrelo.
3. En la configuración del listener, cambia la dirección de escucha a **`0.0.0.0:8080`** (All Interfaces).

---

#### Instalar el certificado del proxy como certificado del sistema

Este paso es **crítico** y se debe hacer antes del taller. En Android moderno (10+), ya **no es posible** copiar certificados directamente a `/system/etc/security/cacerts/` con `adb remount`. En Android 14+, los certificados del sistema se movieron a contenedores APEX de solo lectura, haciendo este método completamente obsoleto.

La solución verificada es: **instalar como certificado de usuario → usar el módulo de Magisk `cert-fixer` para promoverlo a certificado del sistema**.

> [!CAUTION]
> El método antiguo de `adb root && adb remount && adb push` a `/system/etc/security/cacerts/` **NO funciona en Android 10+**. Usa el método con Magisk + cert-fixer descrito a continuación.

##### Paso 1: Descargar el certificado del proxy en el dispositivo

Primero, configura el proxy en el dispositivo (ver sección "Configurar el proxy" más abajo). Una vez configurado, abre el **navegador del dispositivo Android** y navega a la dirección de tu proxy:

| Proxy | URL en el navegador del dispositivo | Acción | Archivo descargado |
| :--- | :--- | :--- | :--- |
| **Burp Suite** | `http://<IP_DE_TU_PC>:8080` | Click en **CA Certificate** | `cacert.der` |
| **Caido** | `http://<IP_DE_TU_PC>:8080` | Click en **CA Certificate** | `ca.crt` |

> [!TIP]
> - Desde un **emulador**, la IP de tu PC es `10.0.2.2` → navega a `http://10.0.2.2:8080`
> - Desde un **teléfono físico**, usa la IP local de tu PC en la misma red Wi-Fi (ej. `http://192.168.1.X:8080`)
> - Asegúrate de que Burp/Caido esté escuchando en **All Interfaces** (no solo `127.0.0.1`) para que el dispositivo pueda conectarse.

##### Paso 2: Instalar como certificado de usuario

En el dispositivo Android:
1. Ve a **Ajustes → Seguridad → Más ajustes de seguridad → Cifrado y credenciales → Instalar un certificado → Certificado CA**.
2. Selecciona el archivo descargado (`cacert.der` si usas Burp, o `ca.crt` si usas Caido) de la carpeta `Download`.
3. Confirma la instalación (ignora las advertencias de seguridad).

##### Paso 3: Promover a certificado del sistema con cert-fixer

1. Descarga el archivo `cert-fixer.zip` desde [pwnlogs/cert-fixer (GitHub)](https://github.com/pwnlogs/cert-fixer/releases).
2. Envíalo al dispositivo:
   ```bash
   adb push cert-fixer.zip /sdcard/Download/
   ```
3. En el dispositivo, abre la app **Magisk**.
4. Ve a la pestaña **Modules** (icono de pieza de puzzle abajo) → **Install from storage**.
5. Selecciona `cert-fixer.zip` y espera a que termine.
6. Toca **Reboot**.

##### Paso 4: Verificar

Después del reinicio, verifica que el certificado aparece en:
**Ajustes → Seguridad → Certificados de confianza → pestaña Sistema** (busca "PortSwigger" si usas Burp, o "Caido" si usas Caido).

> [!NOTE]
> Este proceso está verificado y funciona desde Android 9 hasta Android 15 (API 35). El módulo `cert-fixer` copia automáticamente **todos** los certificados de usuario al almacén del sistema durante cada arranque.
>
> 📖 Referencia: [System CA on Android: How to Install & Work Around Modern Restrictions](https://medium.com/@RoBoHackermann/system-ca-on-android-how-to-install-work-around-modern-restrictions-c570f000ab9a)

#### Configurar el proxy en el emulador

En el emulador de Android:
1. Ve a **Ajustes → Red e internet → Internet** (o Wi-Fi).
2. Mantén pulsada la red conectada → **Modificar red** (o ícono del lápiz).
3. En **Proxy**, selecciona **Manual**.
4. Configura:
   - **Host:** `10.0.2.2` (esta IP apunta a tu `localhost` desde el emulador)
   - **Puerto:** `8080`

> [!TIP]
> Si usas un **teléfono físico** en la misma red Wi-Fi que tu PC, el host del proxy será la **IP local de tu PC** (ej. `192.168.1.X`), no `10.0.2.2`.

---

### 5. Python 3 + pip

Frida y Objection se instalan vía `pip`. Verifica que tienes Python 3:

```bash
python3 --version
pip3 --version
```

Si no lo tienes:
- **Windows:** Descarga desde [python.org](https://www.python.org/downloads/) (marca "Add to PATH").
- **macOS:** `brew install python3`
- **Linux (Debian/Ubuntu):** `sudo apt install python3 python3-pip`

---

### 6. Frida (Cliente + Server)

Frida es la herramienta de instrumentación dinámica que usaremos para inyectar código en las apps.

#### Instalar el cliente de Frida en tu PC:

```bash
pip3 install frida-tools
```

Verifica la instalación:

```bash
frida --version
```

#### Descargar e instalar `frida-server` en el dispositivo Android:

```bash
# 1. Verificar la arquitectura del dispositivo
adb shell getprop ro.product.cpu.abi
# Ejemplo de salida: x86_64 (emulador) o arm64-v8a (teléfono físico)

# 2. Verificar tu versión de frida instalada
frida --version
# Ejemplo de salida: 16.x.x

# 3. Descargar frida-server de la MISMA versión desde:
#    https://github.com/frida/frida/releases
#    Busca: frida-server-<VERSION>-android-<ARQUITECTURA>.xz
#    Ejemplo: frida-server-16.x.x-android-x86_64.xz

# 4. Descomprimir
xz -d frida-server-*.xz

# 5. Enviar al dispositivo y dar permisos
adb root
adb push frida-server-* /data/local/tmp/frida-server
adb shell chmod +x /data/local/tmp/frida-server

# 6. Ejecutar frida-server en el dispositivo
adb shell "/data/local/tmp/frida-server &"
```

#### Verificar que Frida se conecta correctamente:

```bash
frida-ps -U
```

Si ves la lista de procesos del dispositivo, **¡Frida está lista!** ✅

> [!WARNING]
> La versión de `frida-tools` (tu PC) y `frida-server` (el dispositivo) **DEBEN SER LA MISMA** versión mayor. De lo contrario, obtendrás errores de incompatibilidad.

---

### 7. Objection

Objection es un toolkit construido encima de Frida que simplifica las tareas comunes de pentesting móvil.

```bash
pip3 install objection
```

Verifica la instalación:

```bash
objection version
```

---

### 8. Apps y Scripts del Workshop

Para las prácticas principales del taller, hemos creado dos aplicaciones específicas:

#### A. Bypass de SSL Pinning
- **App:** `PinningDemo.apk`
- **Script:** `frida-ssl-bypass.js`
- **Uso:** `frida -U -f com.workshop.pinningdemo -l frida-ssl-bypass.js`

#### B. Evasión de Root Detection Silenciosa
- **App:** `RootDetectionDemo.apk` (Se cierra sola si detecta root)
- **Script 1 (Trace):** `trace-cierre.js` (Descubre por qué se cierra)
  - **Uso:** `frida -U -f com.workshop.rootdetection -l trace-cierre.js`
- **Script 2 (Bypass):** `frida-root-bypass.js` (Burla la protección)
  - **Uso:** `frida -U -f com.workshop.rootdetection -l frida-root-bypass.js`

#### Instalación

Abre una terminal en la raíz de este repositorio e instala ambas aplicaciones:

```bash
adb install PinningDemo.apk
adb install RootDetectionDemo.apk
```

---

## ✅ Checklist Final — ¿Estás listo?

Antes del taller, asegúrate de que todos estos puntos están marcados:

- [ ] Emulador Android corriendo (o teléfono rooteado conectado por USB)
- [ ] `adb devices` muestra tu dispositivo
- [ ] Certificado de Burp Suite/Caido instalado como certificado del **sistema**
- [ ] Proxy configurado en el dispositivo (escuchando en All Interfaces)
- [ ] `frida --version` funciona en tu PC
- [ ] `frida-server` corriendo en el dispositivo
- [ ] `frida-ps -U` muestra la lista de procesos del dispositivo
- [ ] `objection version` funciona en tu PC
- [ ] **`PinningDemo.apk` instalada en el dispositivo**
- [ ] **`RootDetectionDemo.apk` instalada en el dispositivo**
- [ ] `adb devices` muestra tu dispositivo
- [ ] Certificado de Burp Suite/Caido instalado como certificado del **sistema**
- [ ] Proxy configurado en el dispositivo (escuchando en All Interfaces)
- [ ] `frida --version` funciona en tu PC
- [ ] `frida-server` corriendo en el dispositivo
- [ ] `frida-ps -U` muestra la lista de procesos del dispositivo
- [ ] `objection version` funciona en tu PC
- [ ] **`PinningDemo.apk` instalada en el dispositivo**

---

## 🆘 Troubleshooting Común

<details>
<summary><strong>❌ <code>adb devices</code> no muestra nada</strong></summary>

- Verifica que el emulador esté corriendo o que el teléfono tenga **Depuración USB** habilitada.
- Intenta `adb kill-server && adb start-server`.
</details>

<details>
<summary><strong>❌ <code>frida-ps -U</code> da error de conexión</strong></summary>

- Verifica que `frida-server` esté corriendo: `adb shell ps | grep frida`.
- Verifica que las versiones coincidan: `frida --version` (PC) vs la versión del binario descargado.
- Reinicia frida-server:
  ```bash
  adb shell "pkill frida-server; /data/local/tmp/frida-server &"
  ```
</details>

<details>
<summary><strong>❌ <code>adb root</code> dice "adbd cannot run as root"</strong></summary>

- Estás usando una imagen de sistema con Google Play. Necesitas una imagen **sin** Google Play (Google APIs está bien, Google Play no).
</details>

<details>
<summary><strong>❌ Burp no ve tráfico del emulador</strong></summary>

- Verifica que el proxy esté en `10.0.2.2:8080` en el emulador.
- Verifica que Burp esté escuchando en `All interfaces` o `127.0.0.1:8080`.
- Verifica que el certificado de Burp esté instalado como certificado del sistema (no solo de usuario).
</details>

<details>
<summary><strong>❌ Error: "Unable to connect to remote frida-server"</strong></summary>

- Asegúrate de ejecutar `adb root` antes de iniciar `frida-server`.
- Si usas un teléfono con Magisk, ejecuta frida-server con `su`:
  ```bash
  adb shell
  su
  /data/local/tmp/frida-server &
  ```
</details>

---

## 📚 Recursos Adicionales

- [Frida Docs](https://frida.re/docs/home/)
- [Frida CodeShare](https://codeshare.frida.re/) — Scripts listos para usar
- [Objection Wiki](https://github.com/sensepost/objection/wiki)
- [OWASP Mobile Testing Guide](https://mas.owasp.org/MASTG/)
- [Burp Suite Docs](https://portswigger.net/burp/documentation)
- [Android App Hacking — Black Belt Edition (Udemy)](https://www.udemy.com/course/android-app-hacking-black-belt-edition/)

---

> **¿Problemas instalando?** Abre un **Issue** en este repositorio o envía un mensaje al grupo del taller. ¡Es mejor resolver problemas de setup antes del día del evento!
