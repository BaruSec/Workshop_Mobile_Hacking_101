// =============================================================================
// 🔍 Script de Frida para Rastrear Cierres Silenciosos (Trace Cierre)
//    Workshop: Mobile Hacking Workshop 101
// =============================================================================
//
// USO:
//   frida -U -f com.workshop.rootdetection -l trace-cierre.js
// =============================================================================

Java.perform(function() {
    console.log("\n==============================================");
    console.log("🔍 Frida Trace Cierre - Buscando el origen...");
    console.log("==============================================\n");

    var System = Java.use("java.lang.System");
    
    System.exit.implementation = function(codigo) {
        console.log("\n[!] ⚠️  ALERTA: La app intentó cerrarse con System.exit(" + codigo + ")!");
        
        var Excepcion = Java.use("java.lang.Exception");
        var stack = Excepcion.$new().getStackTrace();
        
        console.log("\n== STACK TRACE (Origen del Cierre) ==");
        for (var i = 0; i < stack.length; i++) {
            console.log("    " + i + ": " + stack[i].toString());
        }
        
        console.log("\n[*] 🛡️  Cierre BLOQUEADO. La app seguirá viva.");
        console.log("----------------------------------------------\n");
        // No llamamos al método original → la app no se cierra
    };

    console.log("[✓] Hook instalado en System.exit()");
    console.log("[i] Esperando a que la app intente suicidarse...\n");
});
