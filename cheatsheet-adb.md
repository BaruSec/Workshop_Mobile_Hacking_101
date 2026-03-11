# ADB Cheatsheet - Mobile Bug Bounty

## 📱 Conexión y Dispositivos

```bash
# Listar dispositivos conectados
adb devices

# Conectar a dispositivo via WiFi
adb tcpip 5555
adb connect <IP>:5555

# Reiniciar servidor ADB
adb kill-server
adb start-server

# Shell interactivo
adb shell

# Shell como root (si disponible)
adb root
adb shell
```

---

## 📦 Gestión de Aplicaciones

```bash
# Listar todas las apps instaladas
adb shell pm list packages

# Buscar app específica
adb shell pm list packages | grep <nombre>

# Ver path del APK
adb shell pm path com.example.app

# Extraer APK del dispositivo
adb pull /data/app/com.example.app-1/base.apk ./app.apk

# Instalar APK
adb install app.apk

# Instalar APK (reemplazar existente)
adb install -r app.apk

# Desinstalar app
adb uninstall com.example.app

# Limpiar datos de app
adb shell pm clear com.example.app
```

---

## 📂 Sistema de Archivos

```bash
# Copiar archivo del dispositivo al PC
adb pull /ruta/remota /ruta/local

# Copiar archivo del PC al dispositivo
adb push /ruta/local /ruta/remota

# Listar archivos
adb shell ls -la /data/data/com.example.app/

# Ver contenido de archivo
adb shell cat /data/data/com.example.app/shared_prefs/config.xml

# Buscar archivos con datos sensibles
adb shell find /data/data/com.example.app -name "*.db"
adb shell find /data/data/com.example.app -name "*.xml"
```

---

## 🔍 Análisis de Datos Locales

```bash
# Ver shared preferences (configs)
adb shell cat /data/data/com.example.app/shared_prefs/*.xml

# Copiar bases de datos SQLite
adb pull /data/data/com.example.app/databases/ ./databases/

# Abrir base de datos (en PC después de extraer)
sqlite3 database.db
.tables
SELECT * FROM users;

# Ver logs de la app
adb logcat | grep com.example.app

# Filtrar logs por tag
adb logcat -s "MyAppTag"

# Limpiar logs
adb logcat -c
```

---

## 🌐 Configuración de Proxy

```bash
# Configurar proxy global
adb shell settings put global http_proxy <IP>:<PUERTO>

# Verificar configuración de proxy
adb shell settings get global http_proxy

# Eliminar proxy
adb shell settings put global http_proxy :0
```

---

## 🔐 Certificados (root requerido)

```bash
# Copiar cert de Burp al sistema (Android 7+)
# Primero exportar cert como DER, convertir a PEM
openssl x509 -inform DER -in cacert.der -out cacert.pem

# Obtener hash del certificado
openssl x509 -inform PEM -subject_hash_old -in cacert.pem | head -1
# Output ejemplo: 9a5ba575

# Renombrar y copiar
mv cacert.pem 9a5ba575.0
adb push 9a5ba575.0 /sdcard/

# En dispositivo (mount sistema como escritura)
adb shell
su
mount -o rw,remount /system
mv /sdcard/9a5ba575.0 /system/etc/security/cacerts/
chmod 644 /system/etc/security/cacerts/9a5ba575.0
reboot
```

---

## 🚀 Actividades e Intents

```bash
# Iniciar actividad específica
adb shell am start -n com.example.app/.MainActivity

# Iniciar actividad con datos
adb shell am start -n com.example.app/.DeepLinkActivity -d "myapp://action?param=value"

# Probar deep links
adb shell am start -W -a android.intent.action.VIEW -d "https://example.com/path"

# Enviar broadcast
adb shell am broadcast -a com.example.CUSTOM_ACTION

# Ver actividades exportadas (potencial vuln)
adb shell dumpsys package com.example.app | grep -A 5 "Activity"
```

---

## 📸 Capturas y Grabación

```bash
# Screenshot
adb shell screencap /sdcard/screen.png
adb pull /sdcard/screen.png

# Grabar pantalla
adb shell screenrecord /sdcard/video.mp4
# Ctrl+C para detener
adb pull /sdcard/video.mp4
```

---

## 🎯 Comandos Rápidos Bug Bounty

```bash
# One-liner: Extraer y analizar APK
PKG="com.target.app" && adb pull $(adb shell pm path $PKG | cut -d: -f2) $PKG.apk

# Buscar tokens/keys en shared_prefs
adb shell cat /data/data/com.target.app/shared_prefs/*.xml | grep -iE "token|key|secret|password"

# Monitorear tráfico de red (root)
adb shell tcpdump -i any -s 0 -w /sdcard/capture.pcap

# Ver permisos de la app
adb shell dumpsys package com.target.app | grep permission
```
