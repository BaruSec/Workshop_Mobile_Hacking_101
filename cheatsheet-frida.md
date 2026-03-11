# Frida Cheatsheet - Mobile Bug Bounty

## 🚀 Comandos Básicos

```bash
# Verificar versión de Frida
frida --version

# Listar dispositivos conectados
frida-ls-devices

# Listar procesos en ejecución
frida-ps -U

# Listar apps instaladas
frida-ps -Uai

# Conectar a app en ejecución
frida -U com.example.app

# Iniciar app con Frida
frida -U -f com.example.app

# Ejecutar script al iniciar
frida -U -f com.example.app -l script.js

# Sin pausar al inicio
frida -U -f com.example.app -l script.js --no-pause
```

---

## 🛠️ Objection (Frida automatizado)

```bash
# Instalar objection
pip install objection

# Conectar a app
objection -g com.example.app explore

# Comandos dentro de objection:
android sslpinning disable          # Bypass SSL Pinning
android root disable                # Bypass Root Detection
android hooking list classes        # Listar clases
android hooking list class_methods com.example.ClassName
android hooking watch class com.example.ClassName
```

---

## 📜 Scripts Esenciales para Bug Bounty

### 1. Bypass SSL Pinning (Universal)

```javascript
// ssl-bypass.js
Java.perform(function() {
    console.log("[*] Iniciando bypass de SSL Pinning...");
    
    // TrustManager
    var TrustManager = Java.use('com.android.org.conscrypt.TrustManagerImpl');
    TrustManager.verifyChain.overload('[Ljava.security.cert.X509Certificate;', 'java.lang.String', 'java.lang.String', 'java.lang.String', 'boolean', '[B').implementation = function() {
        console.log("[+] TrustManager bypass");
        return arguments[0];
    };

    // OkHttp3 CertificatePinner
    try {
        var CertificatePinner = Java.use('okhttp3.CertificatePinner');
        CertificatePinner.check.overload('java.lang.String', 'java.util.List').implementation = function() {
            console.log("[+] OkHttp3 CertificatePinner bypass");
            return;
        };
    } catch(e) {}

    // WebViewClient
    try {
        var WebViewClient = Java.use('android.webkit.WebViewClient');
        WebViewClient.onReceivedSslError.implementation = function(view, handler, error) {
            console.log("[+] WebView SSL bypass");
            handler.proceed();
        };
    } catch(e) {}

    console.log("[*] SSL Pinning bypass completo!");
});
```

---

### 2. Bypass Root Detection

```javascript
// root-bypass.js
Java.perform(function() {
    console.log("[*] Iniciando bypass de Root Detection...");

    // Bypass común: buscar archivos de root
    var File = Java.use("java.io.File");
    File.exists.implementation = function() {
        var path = this.getAbsolutePath();
        var rootPaths = ["su", "Superuser", "busybox", "magisk"];
        
        for (var i = 0; i < rootPaths.length; i++) {
            if (path.indexOf(rootPaths[i]) !== -1) {
                console.log("[+] Bloqueado check de: " + path);
                return false;
            }
        }
        return this.exists();
    };

    // Runtime.exec
    var Runtime = Java.use("java.lang.Runtime");
    Runtime.exec.overload('java.lang.String').implementation = function(cmd) {
        if (cmd.indexOf("su") !== -1 || cmd.indexOf("which") !== -1) {
            console.log("[+] Bloqueado comando: " + cmd);
            throw new Error("Command not found");
        }
        return this.exec(cmd);
    };

    // Build.TAGS
    var Build = Java.use("android.os.Build");
    Build.TAGS.value = "release-keys";

    console.log("[*] Root Detection bypass completo!");
});
```

---

### 3. Hookear Función de Login

```javascript
// hook-login.js
Java.perform(function() {
    // Ajustar nombre de clase según la app target
    var LoginActivity = Java.use("com.example.app.LoginActivity");
    
    LoginActivity.login.implementation = function(username, password) {
        console.log("===============================");
        console.log("[CREDENTIALS CAPTURED]");
        console.log("Username: " + username);
        console.log("Password: " + password);
        console.log("===============================");
        
        // Llamar función original
        return this.login(username, password);
    };
});
```

---

### 4. Interceptar Todas las URLs/Requests

```javascript
// intercept-urls.js
Java.perform(function() {
    // HttpURLConnection
    var URL = Java.use("java.net.URL");
    URL.openConnection.overload().implementation = function() {
        console.log("[URL] " + this.toString());
        return this.openConnection();
    };

    // OkHttp3
    try {
        var OkHttpClient = Java.use("okhttp3.OkHttpClient");
        var Builder = Java.use("okhttp3.Request$Builder");
        
        Builder.build.implementation = function() {
            var request = this.build();
            console.log("[OkHttp] " + request.url().toString());
            return request;
        };
    } catch(e) {}

    // Retrofit
    try {
        var Retrofit = Java.use("retrofit2.Retrofit");
        Retrofit.baseUrl.implementation = function() {
            var url = this.baseUrl();
            console.log("[Retrofit BaseURL] " + url.toString());
            return url;
        };
    } catch(e) {}
});
```

---

### 5. Modificar Return Values

```javascript
// modify-return.js
Java.perform(function() {
    // Ejemplo: Bypass verificación de premium
    var PremiumCheck = Java.use("com.example.app.PremiumManager");
    
    PremiumCheck.isPremiumUser.implementation = function() {
        console.log("[+] isPremiumUser() -> forzando TRUE");
        return true;
    };

    // Bypass verificación de tiempo
    var LicenseCheck = Java.use("com.example.app.LicenseValidator");
    
    LicenseCheck.isLicenseValid.implementation = function() {
        console.log("[+] isLicenseValid() -> forzando TRUE");
        return true;
    };
});
```

---

### 6. Dump de Clases y Métodos

```javascript
// enum-classes.js
Java.perform(function() {
    Java.enumerateLoadedClasses({
        onMatch: function(className) {
            // Filtrar por package de la app
            if (className.startsWith("com.target.app")) {
                console.log("[CLASS] " + className);
            }
        },
        onComplete: function() {
            console.log("[*] Enumeración completa");
        }
    });
});
```

```javascript
// enum-methods.js
Java.perform(function() {
    var targetClass = Java.use("com.example.app.TargetClass");
    var methods = targetClass.class.getDeclaredMethods();
    
    console.log("[*] Métodos de " + targetClass);
    methods.forEach(function(method) {
        console.log("  -> " + method.getName());
    });
});
```

---

### 7. Bypass Biométrico

```javascript
// biometric-bypass.js
Java.perform(function() {
    var BiometricPrompt = Java.use("android.hardware.biometrics.BiometricPrompt");
    
    BiometricPrompt.authenticate.overload('android.os.CancellationSignal', 'java.util.concurrent.Executor', 'android.hardware.biometrics.BiometricPrompt$AuthenticationCallback').implementation = function(cancel, executor, callback) {
        console.log("[+] Biometric bypass - simulando éxito");
        
        var AuthResult = Java.use("android.hardware.biometrics.BiometricPrompt$AuthenticationResult");
        var result = AuthResult.$new();
        callback.onAuthenticationSucceeded(result);
    };
});
```

---

### 8. Trazar Crypto Operations

```javascript
// trace-crypto.js
Java.perform(function() {
    var Cipher = Java.use("javax.crypto.Cipher");
    
    Cipher.doFinal.overload('[B').implementation = function(data) {
        console.log("[CRYPTO] Mode: " + this.getAlgorithm());
        console.log("[CRYPTO] Input: " + bytesToHex(data));
        
        var result = this.doFinal(data);
        console.log("[CRYPTO] Output: " + bytesToHex(result));
        return result;
    };

    function bytesToHex(bytes) {
        var hex = "";
        for (var i = 0; i < bytes.length; i++) {
            hex += ("0" + (bytes[i] & 0xFF).toString(16)).slice(-2);
        }
        return hex;
    }
});
```

---

## 🎯 One-Liners Útiles

```bash
# Bypass rápido SSL + Root con objection
objection -g com.target.app explore --startup-command "android sslpinning disable"

# Ejecutar múltiples scripts
frida -U -f com.target.app -l ssl-bypass.js -l root-bypass.js --no-pause

# Buscar strings en memoria
frida -U com.target.app -e "Process.enumerateModules().forEach(function(m){if(m.name.indexOf('target')!=-1){console.log(m.name)}})"
```

---

## 📚 Recursos

- **Frida CodeShare:** https://codeshare.frida.re
- **Frida Docs:** https://frida.re/docs/
- **Objection Wiki:** https://github.com/sensepost/objection/wiki
