// Espeja a mano las tablas creadas en supabase/migrations/. Drizzle no genera ni aplica
// migraciones: solo da consultas tipadas sobre este esquema. Al agregar una tabla en una
// migracion, se agrega aqui tambien.
import { sql } from 'drizzle-orm'
import {
  boolean,
  check,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  primaryKey,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from 'drizzle-orm/pg-core'
import type { Checklist } from '@/dominio/checklist'

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
  bateriaSalidaPct: integer('bateria_salida_pct'),
  bateriaSalidaCiclos: integer('bateria_salida_ciclos'),
  codigoProtegido: boolean('codigo_protegido'),
  estadoActivacion: text('estado_activacion'),
  origenDatos: origenDatos('origen_datos').notNull().default('manual'),
  trabajosRealizados: jsonb('trabajos_realizados').notNull().default(sql`'[]'::jsonb`).$type<string[]>(),
  notaReparacion: text('nota_reparacion').notNull().default(''),
  observacionIngreso: text('observacion_ingreso').notNull().default(''),
  observacionSalida: text('observacion_salida').notNull().default(''),
  checklistIngreso: jsonb('checklist_ingreso').notNull().default(sql`'{}'::jsonb`).$type<Checklist>(),
  checklistSalida: jsonb('checklist_salida').notNull().default(sql`'{}'::jsonb`).$type<Checklist>(),
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

export const catalogoChecklist = pgTable(
  'catalogo_checklist',
  {
    version: integer('version').notNull(),
    clave: text('clave').notNull(),
    etiqueta: text('etiqueta').notNull(),
    bloque: text('bloque').notNull(),
    orden: integer('orden').notNull(),
    estados: jsonb('estados').notNull().$type<string[]>(),
  },
  (t) => [primaryKey({ columns: [t.version, t.clave] })],
)

export const notaPosterior = pgTable('nota_posterior', {
  id: integer('id').primaryKey().generatedAlwaysAsIdentity(),
  fichaNumero: integer('ficha_numero')
    .notNull()
    .references(() => ficha.numero),
  texto: text('texto').notNull(),
  creadaEn: timestamp('creada_en', { withTimezone: true }).notNull().defaultNow(),
})

export const modeloIphone = pgTable('modelo_iphone', {
  productType: text('product_type').primaryKey(),
  modeloComercial: text('modelo_comercial').notNull(),
})
