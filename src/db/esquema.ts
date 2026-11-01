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
import type { Accesorio, PiezaCambiada, ResultadoVigilancia } from '@/dominio/ficha'
import type { Lectura, TipoRegistro } from '@/dominio/lectura'

export const estadoFicha = pgEnum('estado_ficha', [
  'recibido',
  'en_reparacion',
  'listo',
  'entregado',
  'entregado_sin_reparar',
])
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
    udid: text('udid'),
    numeroModelo: text('numero_modelo'),
    region: text('region'),
    creadoEn: timestamp('creado_en', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [uniqueIndex('equipo_imei_unico').on(t.imei).where(sql`${t.imei} is not null`)],
)

export const ficha = pgTable('ficha', {
  numero: integer('numero').primaryKey().generatedAlwaysAsIdentity(),
  equipoId: uuid('equipo_id')
    .notNull()
    .references(() => equipo.id),
  estado: estadoFicha('estado').notNull().default('recibido'),
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
  lecturaIngreso: jsonb('lectura_ingreso').$type<Lectura>(),
  lecturaSalida: jsonb('lectura_salida').$type<Lectura>(),
  vigilanciaSalida: jsonb('vigilancia_salida').$type<ResultadoVigilancia>(),
  accesorios: jsonb('accesorios').notNull().default(sql`'[]'::jsonb`).$type<Accesorio[]>(),
  codigoEntregado: boolean('codigo_entregado'),
  clausulasVersion: integer('clausulas_version'),
  garantiaMeses: integer('garantia_meses'),
  piezasCambiadas: jsonb('piezas_cambiadas').notNull().default(sql`'[]'::jsonb`).$type<PiezaCambiada[]>(),
  enReparacionEn: timestamp('en_reparacion_en', { withTimezone: true }),
  listoEn: timestamp('listo_en', { withTimezone: true }),
})

export const ajustesTaller = pgTable(
  'ajustes_taller',
  {
    id: integer('id').primaryKey().default(1),
    nombre: text('nombre'),
    telefono: text('telefono'),
    direccion: text('direccion'),
    rutaLogo: text('ruta_logo'),
    razonSocial: text('razon_social'),
    rut: text('rut'),
    correo: text('correo'),
    instagram: text('instagram'),
    whatsapp: text('whatsapp'),
    garantiaMeses: integer('garantia_meses').notNull().default(3),
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

export const documento = pgTable('documento', {
  id: uuid('id').primaryKey().default(sql`gen_random_uuid()`),
  fichaNumero: integer('ficha_numero')
    .notNull()
    .references(() => ficha.numero),
  tipo: text('tipo').notNull().$type<'ingreso' | 'salida'>(),
  emitidoEn: timestamp('emitido_en', { withTimezone: true }).notNull().defaultNow(),
  sha256: text('sha256').notNull(),
  bytes: integer('bytes').notNull(),
  rutaStorage: text('ruta_storage').notNull().unique(),
  enviadoEn: timestamp('enviado_en', { withTimezone: true }),
})

export const registroEquipo = pgTable('registro_equipo', {
  id: integer('id').primaryKey().generatedAlwaysAsIdentity(),
  fichaNumero: integer('ficha_numero')
    .notNull()
    .references(() => ficha.numero),
  momento: text('momento').notNull().$type<'ingreso' | 'salida' | 'vigilancia'>(),
  tipo: text('tipo').notNull().$type<TipoRegistro>(),
  fechaEvento: timestamp('fecha_evento', { withTimezone: true }),
  nombreOriginal: text('nombre_original').notNull(),
  resumen: text('resumen').notNull().default(''),
  texto: text('texto').notNull(),
  causaProbable: text('causa_probable'),
  lineaChecklist: text('linea_checklist'),
  sha256: text('sha256'),
  leidoEn: timestamp('leido_en', { withTimezone: true }).notNull().defaultNow(),
})

export const clausula = pgTable(
  'clausula',
  {
    version: integer('version').notNull(),
    orden: integer('orden').notNull(),
    titulo: text('titulo').notNull(),
    texto: text('texto').notNull(),
    creadaEn: timestamp('creada_en', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [primaryKey({ columns: [t.version, t.orden] })],
)
