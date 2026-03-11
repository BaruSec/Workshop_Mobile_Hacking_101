// =============================================================================
// 🔓 Script de Frida para Bypass de Detección de Root
//    Workshop: Mobile Hacking Workshop 101
// =============================================================================
//
// USO:
//   frida -U -f com.workshop.rootdetection -l frida-root-bypass.js
// =============================================================================

Java.perform(function () {
    console.log("\n==============================================");
    console.log("🔓 Frida Root Bypass - Workshop Edition");
    console.log("==============================================\n");

    // Paso 1: Bloquear System.exit para que la app no se mate
    //         mientras instalamos el hook de RootUtil
    var System = Java.use("java.lang.System");
    System.exit.implementation = function(codigo) {
        console.log("[*] System.exit(" + codigo + ") bloqueado!\n");
    };
    console.log("[✓] System.exit() bloqueado");

    // Paso 2: Hookear la clase de detección de root
    try {
        var RootUtil = Java.use("com.workshop.rootdetection.RootUtil");

        RootUtil.isDeviceRooted.implementation = function () {
            console.log("[+] 🔓 RootUtil.isDeviceRooted() interceptado!");
            console.log("    ↳ Forzando respuesta 'false' (Dispositivo Seguro)\n");
            return false;
        };

        console.log("[✓] Hook instalado: RootUtil.isDeviceRooted()");
        console.log("\n🎯 Bypass activado. La app creerá que NO hay root.\n");

    } catch (e) {
        console.log("[!] Error: " + e.message);
    }
});
