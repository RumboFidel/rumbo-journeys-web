# RUMBO — reglas para agentes

Este repositorio es el sitio público de RUMBO ("Fiel a Fidel"), el recorrido de
Fidel por los cantones de Ecuador. La operación diaria vive fuera de aquí, en la
carpeta `RUMBO` (Excel maestro, originales, rutinas numeradas).

## Herramienta vigente

El proyecto se desarrolla y se mantiene con **Claude Code**. **No existe
integración operativa con Lovable**: no se edita desde su editor, no se sincroniza
con él y no hay restricciones derivadas de esa plataforma.

Las dependencias `@lovable.dev/*` del `package.json` sí siguen en uso: son parte
del build (`vite.config.ts` importa `@lovable.dev/vite-tanstack-config`, que
agrupa TanStack Start, React, Tailwind y Nitro). Se resuelven desde el registro
público de npm. **No las quites ni refactorices `vite.config.ts`, `.lovable/` o
`src/lib/lovable-error-reporting.ts`** sin una decisión explícita: romperían el
build.

## Datos y originales

- **No modificar originales.** Los archivos que carga Fidel se conservan
  intactos en `01 ENTRADA` y `02 BITACORA ORIGINAL`. Nunca renombrar, convertir,
  comprimir ni sobrescribir.
- **No escribir el Excel maestro sin autorización explícita.** Es la fuente de
  verdad y la única auditoría del proyecto. Leerlo es libre; escribirlo, no.
- **No editar a mano los datos generados** (`public/data/rumbo/`,
  `src/data/generated/rumbo-web/`, `RUMBO/04_PUBLICACION_WEB/`). Se regeneran
  con `npm run generar:paquete-web` y `npm run sync:web`.

## Aprobaciones

- Ninguna Carrera ni Historia llega al sitio sin la aprobación editorial de
  Fidel (`status` = `confirmada` / `aprobada_fidel` o `publicada`).
- Ninguna publicación en Instagram o Facebook se prepara sin una autorización de
  redes registrada, distinta de la aprobación editorial.
- No inventar datos, fechas, lugares, autorías, licencias ni autorizaciones. Lo
  que falte queda vacío o "Pendiente de confirmación".

## Publicación y git

- **No publicar, no hacer push, no desplegar sin autorización.** Ningún script
  del repositorio hace commit, push ni deploy por su cuenta, y ninguno debe
  empezar a hacerlo.
- **Preservar el historial de git.** Nada de `--force`, `rebase`, `--amend` ni
  `squash` sobre historia ya publicada, salvo autorización expresa.
- Trabajar con commits nuevos y mensajes descriptivos.

## Qué nunca se versiona

Este repositorio es **público**. No deben entrar nunca:

- `guia-proyecto-fidel.html` (guía interna del proyecto);
- el Excel maestro ni ninguna copia suya;
- los originales de la bitácora (`public/data/rumbo/archivos/originales/`);
- archivos de actividad `*.fit`, `*.gpx`, `*.tcx`;
- `rumbo.config.json` ni ninguna configuración local con rutas personales;
- credenciales, tokens o secretos de cualquier tipo.

El `.gitignore` cubre todo lo anterior, pero es una red de seguridad, no un
sustituto de revisar qué se está subiendo.

## Las rutinas mandan

Las rutinas numeradas de `RUMBO/00_RUTINAS/` son las reglas operativas del
proyecto: qué hace cada etapa, qué la detiene y en qué orden va. Consultarlas
antes de automatizar cualquier paso.

**Una rutina documentada no es una rutina implementada.** Varias describen
comportamiento que todavía no existe en el código. Antes de ejecutar o prometer
un paso, comprobar que el script existe en la rama activa. `00_RUTINA_MAESTRA.md`
lleva el estado real de cada una.
