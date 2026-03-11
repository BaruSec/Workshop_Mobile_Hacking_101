// =============================================================================
// 🦊 Script de Frida para Bypass de SSL Pinning
//    Workshop: Mobile Hacking Workshop 101
// =============================================================================
//
// USO:
//   frida -U -f com.workshop.pinningdemo -l frida-ssl-bypass.js --no-pause
//
// SI DA ERROR DE _isAppProcess, usar modo ATTACH (abrir la app primero):
//   frida -U com.workshop.pinningdemo -l frida-ssl-bypass.js
//
// ¿QUÉ ES "HOOKEAR"?
//   Hookear = interceptar una función en tiempo de ejecución.
//   Cuando una app llama a la función original, Frida redirige la
//   llamada a NUESTRA versión modificada. La app no se da cuenta.
// =============================================================================

function instalarHooks() {
    Java.perform(function () {

        console.log("\n==============================================");
        console.log("🦊 Frida SSL Pinning Bypass - Workshop Edition");
        console.log("==============================================\n");

        // =====================================================================
        // BYPASS 1: OkHttp CertificatePinner.check()
        // =====================================================================
        // OkHttp es la librería HTTP más popular en Android.
        // Su método check() lanza una excepción si el certificado no coincide.
        // Lo reemplazamos con una función vacía que NUNCA lanza la excepción.
        // =====================================================================

        try {
            var CertificatePinner = Java.use("okhttp3.CertificatePinner");

            CertificatePinner.check.overload(
                "java.lang.String",
                "java.util.List"
            ).implementation = function (hostname, peerCertificates) {
                console.log("[+] 🔓 OkHttp CertificatePinner.check() interceptado!");
                console.log("    ↳ Hostname: " + hostname);
                console.log("    ↳ Verificación SALTADA ✅\n");
            };

            console.log("[✓] Hook instalado: OkHttp CertificatePinner.check(String, List)");

        } catch (e) {
            console.log("[!] OkHttp CertificatePinner no encontrado: " + e.message);
        }

        // =====================================================================
        // BYPASS 2: OkHttp CertificatePinner.check$okhttp (versiones nuevas)
        // =====================================================================

        try {
            var CertificatePinner = Java.use("okhttp3.CertificatePinner");

            CertificatePinner.check$okhttp.overload(
                "java.lang.String",
                "kotlin.jvm.functions.Function0"
            ).implementation = function (hostname, cleanupAction) {
                console.log("[+] 🔓 OkHttp check$okhttp() interceptado!");
                console.log("    ↳ Hostname: " + hostname);
                console.log("    ↳ Verificación SALTADA ✅\n");
            };

            console.log("[✓] Hook instalado: OkHttp check$okhttp(String, Function0)");

        } catch (e) {
            console.log("[i] Sobrecarga check$okhttp no encontrada (normal en algunas versiones)");
        }

        // =====================================================================
        // BYPASS 3: TrustManagerImpl del sistema Android
        // =====================================================================
        // Además de OkHttp, el propio Android tiene su verificador.
        // Lo hookeamos como "safety net".
        // =====================================================================

        try {
            var TrustManagerImpl = Java.use("com.android.org.conscrypt.TrustManagerImpl");
            var ArrayList = Java.use("java.util.ArrayList");

            TrustManagerImpl.checkTrustedRecursive.implementation = function () {
                console.log("[+] 🔓 TrustManagerImpl.checkTrustedRecursive() interceptado!");
                console.log("    ↳ Verificación del sistema SALTADA ✅\n");
                return ArrayList.$new();
            };

            console.log("[✓] Hook instalado: TrustManagerImpl.checkTrustedRecursive()");

        } catch (e) {
            console.log("[i] TrustManagerImpl no disponible: " + e.message);
        }

        // =====================================================================
        // BYPASS 4: X509TrustManager genérico
        // =====================================================================

        try {
            var X509TrustManager = Java.use("javax.net.ssl.X509TrustManager");
            var SSLContext = Java.use("javax.net.ssl.SSLContext");

            var TrustManager = Java.registerClass({
                name: "com.workshop.BypassTrustManager",
                implements: [X509TrustManager],
                methods: {
                    checkClientTrusted: function (chain, authType) {},
                    checkServerTrusted: function (chain, authType) {
                        console.log("[+] 🔓 X509TrustManager.checkServerTrusted() interceptado!");
                        console.log("    ↳ AuthType: " + authType);
                        console.log("    ↳ Certificado aceptado sin verificar ✅\n");
                    },
                    getAcceptedIssuers: function () {
                        return [];
                    }
                }
            });

            console.log("[✓] X509TrustManager personalizado registrado");

        } catch (e) {
            console.log("[i] No se pudo registrar X509TrustManager: " + e.message);
        }

        // =====================================================================
        // RESUMEN FINAL
        // =====================================================================

        console.log("\n==============================================");
        console.log("🎯 Hooks instalados correctamente");
        console.log("   Ahora puedes usar la app normalmente.");
        console.log("   El tráfico HTTPS será visible en tu proxy.");
        console.log("==============================================\n");

    });
}

// Reintento robusto si Java no está lista (Frida 16.7.x spawn bug)
function esperarYHookear() {
    try {
        instalarHooks();
    } catch (e) {
        console.log("[i] Java VM no lista todavía, reintentando en 500ms...");
        setTimeout(esperarYHookear, 500);
    }
}

setTimeout(esperarYHookear, 200);
