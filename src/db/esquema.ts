// Espeja supabase/migrations/0001_esquema_inicial.sql. Drizzle no genera ni aplica
// migraciones: solo da consultas tipadas sobre este esquema escrito a mano.
import { sql } from 'drizzle-orm'
import {
  boolean,
  check,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from 'drizzle-orm/pg-core'

export const estadoFicha = pgEnum('estado_ficha', ['en_taller', 'entregado', 'entregado_sin_reparar'])
export const origenDatos = pgEnum('origen_datos', ['usb', 'manual', 'mixto'])

export const equipo = pgTable(
  'equipo',
  {
    id: uuid('id').primaryKey().default(sql`gen_random_uuid()`),
    imei: text('imei'),
    imei2: text('imei2'),
    numeroSerie: text('numero_serie'),
    ecid: text('ecid'),
    modeloProducto: text('modelo_producto'),
    modeloComercial: text('modelo_comercial'),
    capacidad: text('capacidad'),
    color: text('color'),
    creadoEn: timestamp('creado_en', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [uniqueIndex('equipo_imei_unico').on(t.imei).where(sql`${t.imei} is not null`)],
)

export const ficha = pgTable('ficha', {
  numero: integer('numero').primaryKey().generatedAlwaysAsIdentity(),
  equipoId: uuid('equipo_id')
    .notNull()
    .references(() => equipo.id),
  estado: estadoFicha('estado').notNull().default('en_taller'),
  recibidoEn: timestamp('recibido_en', { withTimezone: true }).notNull().defaultNow(),
  entregadoEn: timestamp('entregado_en', { withTimezone: true }),
  congeladaEn: timestamp('congelada_en', { withTimezone: true }),
  pidioCliente: text('pidio_cliente').notNull().default(''),
  quienLoTrajo: text('quien_lo_trajo'),
  telefono: text('telefono'),
  iosVersion: text('ios_version'),
  build: text('build'),
  bateriaPct: integer('bateria_pct'),
  bateriaCiclos: integer('bateria_ciclos'),
  codigoProtegido: boolean('codigo_protegido'),
  estadoActivacion: text('estado_activacion'),
  origenDatos: origenDatos('origen_datos').notNull().default('manual'),
  trabajosRealizados: jsonb('trabajos_realizados').notNull().default(sql`'[]'::jsonb`),
  notaReparacion: text('nota_reparacion').notNull().default(''),
  observacionIngreso: text('observacion_ingreso').notNull().default(''),
  observacionSalida: text('observacion_salida').notNull().default(''),
  checklistIngreso: jsonb('checklist_ingreso').notNull().default(sql`'{}'::jsonb`),
  checklistSalida: jsonb('checklist_salida').notNull().default(sql`'{}'::jsonb`),
  catalogoVersion: integer('catalogo_version'),
})

export const ajustesTaller = pgTable(
  'ajustes_taller',
  {
    id: integer('id').primaryKey().default(1),
    nombre: text('nombre'),
    telefono: text('telefono'),
    direccion: text('direccion'),
    rutaLogo: text('ruta_logo'),
  },
  (t) => [check('ajustes_taller_id_check', sql`${t.id} = 1`)],
)
