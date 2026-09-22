/**
 * verify-logo.mjs — comprueba la marca del header en el navegador.
 *
 * ---------------------------------------------------------------------------
 * AISLAMIENTO DEL NAVEGADOR
 *
 * Abre su propia instancia de Chrome headless con perfil temporal exclusivo
 * (.audit-profile-logo) y puerto de depuración propio (9335). No busca,
 * reutiliza ni cierra instancias abiertas: solo hace `chrome.kill()` sobre su
 * propio hijo. Es seguro con el navegador del usuario en uso.
 *
 * No añadir `Get-Process chrome | Stop-Process` ni `taskkill /IM chrome.exe`.
 * ---------------------------------------------------------------------------
 */
import { spawn } from "node:child_process";
import { writeFile, rm } from "node:fs/promises";
import { existsSync } from "node:fs";
import { resolve } from "node:path";
