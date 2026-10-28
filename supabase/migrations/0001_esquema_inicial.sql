-- Esquema inicial de AFIX: equipo, ficha y ajustes_taller (diseno, seccion 7).

create type estado_ficha as enum ('en_taller', 'entregado', 'entregado_sin_reparar');
create type origen_datos as enum ('usb', 'manual', 'mixto');

-- El telefono fisico. Clave interna propia: el IMEI es opcional porque un equipo
-- que llega apagado puede no entregarlo, y el ingreso nunca se bloquea.
create table equipo (
  id uuid primary key default gen_random_uuid(),
  imei text,
  imei2 text,
  numero_serie text,
  ecid text,
  modelo_producto text,
  modelo_comercial text,
  capacidad text,
  color text,
  creado_en timestamptz not null default now()
);

-- Unico solo cuando existe: varios equipos sin IMEI conviven.
create unique index equipo_imei_unico on equipo (imei) where imei is not null;

-- Un trabajo, de ingreso a entrega. El correlativo visible es la clave.
create table ficha (
  numero integer generated always as identity primary key,
  equipo_id uuid not null references equipo (id),
  estado estado_ficha not null default 'en_taller',
  recibido_en timestamptz not null default now(),
  entregado_en timestamptz,
  congelada_en timestamptz,
  pidio_cliente text not null default '',
  quien_lo_trajo text,
  telefono text,
  -- Datos del equipo al momento de esta ficha (cambian entre trabajos).
  ios_version text,
  build text,
  bateria_pct integer,
  bateria_ciclos integer,
  codigo_protegido boolean,
  estado_activacion text,
  origen_datos origen_datos not null default 'manual',
  trabajos_realizados jsonb not null default '[]'::jsonb,
  nota_reparacion text not null default '',
  observacion_ingreso text not null default '',
  observacion_salida text not null default '',
  checklist_ingreso jsonb not null default '{}'::jsonb,
  checklist_salida jsonb not null default '{}'::jsonb,
  -- Version del catalogo con que se lleno el checklist; el catalogo llega en 0002.
  catalogo_version integer
);

create index ficha_equipo_idx on ficha (equipo_id);

-- Una sola fila, forzada por el check.
create table ajustes_taller (
  id integer primary key default 1 check (id = 1),
  nombre text,
  telefono text,
  direccion text,
  ruta_logo text
);

-- La fila existe desde el principio: leerAjustes nunca devuelve vacio.
insert into ajustes_taller (id, nombre) values (1, 'AFIX');
