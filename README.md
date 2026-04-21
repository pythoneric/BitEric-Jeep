# BitEric Jeep

Personal journal for Jeep Wrangler and Gladiator vehicles. Tracks maintenance, fuel, modifications, parts, and trail runs — all offline, all on-device.

## Installation

1. `npm install`
2. `npm start`
3. Open http://localhost:8080/jeep.html

## Getting started

When you open the app, the loader offers four ways to begin:

- **Start Fresh** — clears any saved data and drops you on the Add Vehicle form to enter your own rig (brand, model, year, odometer, etc.).
- **Demo SUV / Demo Truck** — seeds a sample Wrangler or Gladiator with maintenance, fuel, mods, and trail history so you can explore.
- **Import .json** — restore a previously exported backup (drag-and-drop or tap to pick).
- **Continue** — resume where you left off (shown once you have saved data).

## Features

- Offline-first PWA with install banner for Android + iOS
- Multiple vehicle profiles with drivetrain specs and a severe-service toggle that halves default maintenance intervals
- Maintenance log with templates, interval-based reminders, and snooze/dismiss
- Fuel log with MPG calculation, budget tracking, and charts
- Modifications and parts inventory
- Trail run journal — water crossings auto-spawn follow-up reminders for differentials, transfer case, and wheel bearings
- Dashboard with cost breakdown, monthly/annual budget progress, and vehicle value estimate
- Bilingual (EN/ES) with flag toggle
- Dark/light theme
- JSON data export/import

## Testing

End-to-end tests run with Playwright:

```
npx playwright test
```

## Icons

Replace `icon-192.png` and `icon-512.png` with your own 192x192 and 512x512 PNG icons before installing the PWA.

---

# Diario BitEric Jeep

Diario personal para vehículos Jeep Wrangler y Gladiator. Rastrea mantenimiento, combustible, modificaciones, partes y recorridos — todo sin conexión, todo en el dispositivo.

## Instalación

1. `npm install`
2. `npm start`
3. Abre http://localhost:8080/jeep.html

## Primeros pasos

La pantalla inicial ofrece cuatro formas de comenzar:

- **Empezar Fresco** — borra los datos guardados y te lleva al formulario "Agregar Vehículo" para ingresar tu propio vehículo (marca, modelo, año, odómetro, etc.).
- **SUV Demo / Camioneta Demo** — carga un Wrangler o Gladiator de ejemplo con historial de mantenimiento, combustible, modificaciones y recorridos.
- **Importar .json** — restaura una copia de seguridad exportada previamente (arrastra o toca para elegir).
- **Continuar** — retoma donde lo dejaste (aparece cuando hay datos guardados).

## Características

- PWA sin conexión con banner de instalación para Android + iOS
- Múltiples perfiles de vehículo con especificaciones de tren motriz y modo de servicio severo que reduce a la mitad los intervalos predeterminados
- Registro de mantenimiento con plantillas, recordatorios por intervalo y posponer/descartar
- Registro de combustible con cálculo de MPG, seguimiento de presupuesto y gráficos
- Inventario de modificaciones y partes
- Diario de recorridos — los cruces de agua generan recordatorios automáticos para diferenciales, caja de transferencia y rodamientos
- Panel con desglose de costos, progreso de presupuesto mensual/anual y estimación de valor del vehículo
- Bilingüe (EN/ES) con alternador de bandera
- Tema oscuro/claro
- Exportación/importación de datos JSON

## Pruebas

Pruebas end-to-end con Playwright:

```
npx playwright test
```

## Iconos

Reemplaza `icon-192.png` e `icon-512.png` con tus propios iconos PNG de 192x192 y 512x512 antes de instalar la PWA.
