# BitEric Jeep

Personal journal for Jeep Wrangler and Gladiator vehicles. Tracks maintenance, fuel, modifications, parts, and trail runs — all offline, all on-device.

## Installation

1. `npm install`
2. `npm start`
3. Open <http://localhost:8080/jeep.html>

## Getting started

When you open the app, the loader offers four ways to begin:

- **Start Fresh** — asks you to pick a currency (US$ or RD$), clears any saved data, and drops you on the Add Vehicle form.
- **Demo Truck** — seeds a sample Gladiator (3.0L EcoDiesel, severe service, 2.5" lift, 33" KO2s) with ten maintenance entries, eighteen fuel fills, thirteen mods, eight parts, and four trail runs so you can explore every tab.
- **Import .json** — restore a previously exported backup (drag-and-drop or tap to pick).
- **Continue** — resume where you left off (shown once you have saved data).

## Features

### Core

- Offline-first PWA with install banner for Android + iOS
- Multiple vehicle profiles with full drivetrain specs (engine, transmission, transfer case, axle ratio, tire size, lift height)
- Severe-service toggle halves default maintenance intervals for dust, water, low-range, and towing use
- Bilingual (EN / ES) with flag toggle; dark / light theme
- Currency picker at Start Fresh: US$ Dollars or RD$ Pesos (Dominican). Every price in the app — budgets, TCO, $/mile, $/gal, report totals — renders with the chosen symbol.
- JSON export / import with schema-version stamping, orphan-row validation, an i18n'd Replace-all confirm, and an optional exclude-photos toggle for slim backups

### Jeep-aware maintenance

- Quick templates for oil, coolant, spark plugs, brake fluid, transmission, diff / transfer-case fluid, U-joints, steering inspection, and more
- **Engine-aware intervals** — picking a template uses the right value for your engine:
  - 3.6L Pentastar (JK 2012+, JL, JT): spark plugs 100k, coolant 150k / 10 yr
  - 3.8L V6 (JK 2007-2011): spark plugs 30k (copper), coolant 100k / 5 yr HOAT, 3k / 6 mo oil
  - 3.0L EcoDiesel: 10k / 12 mo oil, no spark plugs
  - 2.0L Turbo / 4xe: 40k plugs, 5k / 12 mo oil
- Platform-specific templates: oil cooler / housing inspect (Pentastar weak point), EGR cooler inspect (EcoDiesel), death-wobble steering inspection, TPMS sensor battery, brake caliper slide lube, body mount re-torque
- Follow-up reminders: wheel re-torque at +50 mi after tire work, lift re-torque at +500 mi, alignment check, gear break-in, and more — all anchored to the service date and odometer (not today's)
- Service-interval reminders on the dashboard with severity (overdue / due soon / upcoming), per-item progress bars, snooze, and dismiss
- Duplicate detection with case-insensitive type matching

### Jeep-aware fuel log

- MPG computed tank-to-tank using the current fill's gallons and any partial top-offs in between — matches the Fuelly / OEM trip-computer convention
- **Engine-aware fuel-type warnings:**
  - Gasoline on an EcoDiesel → hard warn (misfueling is the #1 EcoDiesel killer)
  - Diesel on any gasoline engine → hard warn
  - Regular 87 on 2.0L Turbo, 4xe, or 6.4L HEMI / 392 → premium-required warn
  - E85 on any Wrangler / Gladiator → warn (none of these platforms are flex-fuel)
- Driving-condition tracking (Highway / Mixed / City / Offroad / Towing) surfaces offroad-vs-highway MPG separately
- Tank-size sanity warning above 25 gal; duplicate detection on same-date fills

### Jeep-aware modifications

- Install date + **install odometer** (required) — follow-ups anchor to the install mileage
- Category-aware follow-ups:
  - Suspension → lift re-torque + alignment + death-wobble inspection
  - Tires / Wheels → wheel re-torque + TPMS relearn + alignment
  - Gearing / Drivetrain → gear break-in + differential fluid swap + death-wobble
- **Regear soft warning** — installing 35 / 37 / 38 / 40" tires on stock-ish gears (3.21 / 3.45 / 3.73) flags a "consider regearing to 4.56 or 4.88" confirm. Works with free-text axle ratio like "3.73 stock" or "3.73:1"
- Jeep-specific categories: Fender flares, Top / doors / panels, Sway bar disconnect, Fuel tank skid
- Removal tracking: Still Installed toggle, removed-on date, and removal-reason notes

### Jeep-aware trail log

- Water-crossing depth: shallow (no spawn) vs deep / axles-submerged (spawns differential fluid check front + rear, transfer case fluid, and wheel bearing inspect at +50 mi)
- Condition-aware follow-ups:
  - Snow / ice → undercarriage rinse at +7 days (frame-rust preventive)
  - Mud or sand / dust → air filter check at +100 mi
  - Rock or heavy low-range → post-crawl inspection (u-joints / tie rods / skids)
  - Any trail → universal undercarriage rinse at +7 days
- Aired-down PSI, damage checkbox + notes, and trail odometer stored for provenance

### Jeep-aware parts inventory

- Structured part number / SKU (Mopar MO-899, K&N 33-2437, …), category (Fluids / Filters / Brakes / Tires / Electrical / Fasteners / Tools / Other), cost per unit, purchase date
- Reorder threshold — rows below it show a red **LOW STOCK** chip
- Duplicate detection offers to increment existing stock instead of creating a new row

### Settings safety

- VIN soft-validation (17 chars, no I / O / Q)
- Year sanity warn outside 1987 – (current + 1)
- Axle-ratio datalist autocomplete: 3.21 / 3.45 / 3.55 / 3.73 / 4.10 / 4.56 / 4.88 / 5.13 / 5.38
- Delete-vehicle confirm names the specific vehicle
- Import refuses orphan rows (a maintenance entry pointing at a vehicle that isn't in the file) and warns on schema-version mismatch
- `min="0"` on every numeric field

### Data visualizations

- Dashboard: per-reminder progress bars (green / amber / red), mileage-over-time sparkline, cost breakdown pie (maintenance / fuel / mods), maintenance-by-type donut, monthly stacked spend
- Fuel: MPG-over-time, $/gal-over-time, MPG-by-driving-condition bar
- Mods: spend-by-category horizontal bar
- Trails: condition-frequency donut
- Parts: inventory-value-by-category bar
- Maintenance: reminder-status donut (overdue / due soon / on schedule)

## Testing

End-to-end tests run with Playwright:

```bash
npx playwright test
```

The suite covers:

- Dashboard cards + reminder progress (17 specs)
- Maintenance templates, engine-aware intervals, follow-up spawning, duplicates (28 specs)
- Fuel MPG math, engine-aware warnings, tank sanity (23 specs)
- Mods with category-aware follow-ups, regear warning, removal tracking (22 specs)
- Trails depth-gated spawns, snow / sand / universal rinse (18 specs)
- Parts with SKU, category, cost, low-stock (14 specs)
- Vehicle + Settings including import / export round-trip, VIN / year sanity, schema-version mismatch (32 specs)
- Currency picker, charts, accessibility, i18n, PWA, smoke, menu (~60 specs across currency / charts / a11y / i18n / loader / menu / pwa / smoke / data / reminders)

Total: 236 specs at time of writing.

All tests run offline against the local dev server; no network access or external services required.

## Icons

Replace `icon-192.png` and `icon-512.png` with your own 192x192 and 512x512 PNG icons before installing the PWA.

---

## Diario BitEric Jeep (Español)

Diario personal para vehículos Jeep Wrangler y Gladiator. Rastrea mantenimiento, combustible, modificaciones, piezas y rutas — todo sin conexión, todo en el dispositivo.

### Instalación

1. `npm install`
2. `npm start`
3. Abre <http://localhost:8080/jeep.html>

### Primeros pasos

La pantalla inicial ofrece cuatro formas de comenzar:

- **Empezar de cero** — te pide elegir una moneda (US$ o RD$), borra los datos guardados y te lleva al formulario "Agregar Vehículo".
- **Camioneta Demo** — carga un Gladiator de ejemplo (3.0L EcoDiesel, servicio severo, lift 2.5", neumáticos 33" KO2) con diez entradas de mantenimiento, dieciocho cargas de combustible, trece modificaciones, ocho piezas y cuatro rutas para que puedas explorar cada pestaña.
- **Importar .json** — restaura una copia de seguridad exportada previamente (arrastra o toca para elegir).
- **Continuar** — retoma donde lo dejaste (aparece cuando hay datos guardados).

### Características

#### Núcleo

- PWA sin conexión con banner de instalación para Android + iOS
- Múltiples perfiles de vehículo con especificaciones completas de tren motriz (motor, transmisión, caja transfer, relación, neumáticos, elevación)
- Modo de servicio severo que reduce a la mitad los intervalos predeterminados para polvo, agua, low-range y remolque
- Bilingüe (EN / ES) con alternador de bandera; tema oscuro / claro
- Selector de moneda al Empezar de cero: US$ Dólares o RD$ Pesos dominicanos — cada precio en la app (presupuestos, TCO, $/milla, $/galón, reportes) se renderiza con el símbolo elegido
- Exportación / importación JSON con verificación de referencias, confirmación "Reemplazar todo" traducida, y opción para excluir fotos

#### Mantenimiento consciente del motor

- Plantillas rápidas para aceite, refrigerante, bujías, líquido de frenos, transmisión, diferenciales / caja transfer, crucetas, inspección de dirección y más
- **Intervalos específicos por motor** al elegir una plantilla:
  - 3.6L Pentastar (JK 2012+, JL, JT): bujías 100k, refrigerante 150k / 10 años
  - 3.8L V6 (JK 2007-2011): bujías 30k (cobre), refrigerante 100k / 5 años HOAT, aceite 3k / 6 meses
  - 3.0L EcoDiesel: aceite 10k / 12 meses, sin bujías
  - 2.0L Turbo / 4xe: bujías 40k, aceite 5k / 12 meses
- Plantillas específicas de plataforma: inspección cooler / carcasa de aceite (punto débil Pentastar), cooler EGR (EcoDiesel), inspección dirección (death wobble), batería sensor TPMS, guías de caliper de freno, re-torque de montajes de carrocería
- Recordatorios de seguimiento con severidad (vencido / próximo / por venir), barras de progreso por ítem, posponer y descartar
- Detección de duplicados con comparación de tipo insensible a mayúsculas

#### Combustible consciente del motor

- MPG calculado tanque-a-tanque usando los galones de la carga actual más cualquier carga parcial intermedia
- **Advertencias por tipo de combustible:**
  - Gasolina en EcoDiesel → advertencia fuerte (la forma #1 de destruir un EcoDiesel)
  - Diésel en motor a gasolina → advertencia fuerte
  - Regular 87 en 2.0L Turbo, 4xe o 6.4L HEMI / 392 → advertencia de premium requerido
  - E85 en cualquier Wrangler / Gladiator → advertencia (ningún modelo es flex-fuel)
- Rastreo de condición de manejo (Carretera / Mixto / Ciudad / Offroad / Remolque) muestra el MPG offroad vs carretera por separado
- Advertencia de tamaño de tanque sobre 25 galones; detección de duplicados

#### Modificaciones conscientes del Jeep

- Fecha + **odómetro al instalar** (requerido) — los seguimientos se anclan a la kilometraje del mod
- Seguimientos por categoría:
  - Suspensión → re-torque lift + alineación + inspección death-wobble
  - Neumáticos / Ruedas → re-torque tuercas + relearn TPMS + alineación
  - Tren motriz → break-in de engranajes + cambio fluido diferencial + inspección
- **Advertencia de regear** — instalar neumáticos 35 / 37 / 38 / 40" en relaciones stock (3.21 / 3.45 / 3.73) dispara un recordatorio de "considerar cambiar a 4.56 o 4.88"
- Categorías específicas de Jeep: Guardafangos, Techo / puertas / paneles, Desconexión de barra, Protector de tanque
- Rastreo de remoción: toggle "Aún instalado", fecha de remoción y notas de motivo

#### Rutas conscientes del Jeep

- Profundidad del agua: poca (no dispara) vs profunda / ejes sumergidos (agenda revisión de diferenciales, caja transfer e inspección de rodamientos)
- Seguimientos por condición:
  - Nieve / hielo → lavado de bajos a +7 días
  - Barro o arena / polvo → revisión filtro de aire a +100 millas
  - Roca o low-range intenso → inspección post-crawl (crucetas / tie rods / protectores)
  - Cualquier ruta → lavado de bajos universal a +7 días
- PSI desinflado, checkbox de daño + notas, y odómetro de la ruta

#### Inventario de piezas

- Número de parte estructurado / SKU, categoría (Fluidos / Filtros / Frenos / Neumáticos / Eléctrico / Tornillería / Herramientas / Otros), costo por unidad, fecha de compra
- Umbral de reorden — filas debajo del umbral muestran chip rojo **STOCK BAJO**
- Detección de duplicados que ofrece sumar al stock existente en lugar de crear una fila nueva

#### Seguridad en Configuración

- Validación suave del VIN (17 caracteres, sin I / O / Q)
- Advertencia de año fuera del rango 1987 – (actual + 1)
- Autocompletado de relación de eje: 3.21 / 3.45 / 3.55 / 3.73 / 4.10 / 4.56 / 4.88 / 5.13 / 5.38
- Confirmación de eliminación nombra el vehículo específico
- La importación rechaza filas huérfanas (una entrada que apunta a un vehículo que no está en el archivo) y advierte en desajuste de versión
- `min="0"` en cada campo numérico

#### Visualizaciones de datos

- Panel: barras de progreso por recordatorio (verde / amarillo / rojo), sparkline de millas, pie de desglose de costos, donut de mantenimiento por tipo, barras de gasto mensual
- Combustible: MPG en el tiempo, $/galón en el tiempo, MPG por condición
- Mods: barra horizontal de gasto por categoría
- Rutas: donut de frecuencia de condiciones
- Piezas: barra de valor de inventario por categoría
- Mantenimiento: donut de estado de recordatorios (vencido / próximo / al día)

### Pruebas

Pruebas end-to-end con Playwright:

```bash
npx playwright test
```

### Iconos

Reemplaza `icon-192.png` e `icon-512.png` con tus propios iconos PNG de 192x192 y 512x512 antes de instalar la PWA.
