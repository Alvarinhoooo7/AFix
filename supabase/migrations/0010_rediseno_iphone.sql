-- Rediseño del flujo iPhone (plan §4): lecturas USB, accesorios, documentos emitidos,
-- registros del equipo, cláusulas versionadas, datos del taller y checklist v2.

-- Ficha ---------------------------------------------------------------------------------
alter table ficha
  -- La lectura USB completa, tal como la entregó el agente. Es la prueba; los campos
  -- sueltos (ios_version, bateria_pct...) se siguen llenando desde ahí para listar.
  add column lectura_ingreso jsonb,
  add column lectura_salida jsonb,
  -- Resultado de la vigilancia en vivo durante las pruebas de salida (plan §3.7).
  add column vigilancia_salida jsonb,
  add column accesorios jsonb not null default '[]'::jsonb,
  -- Si el cliente dejó el código. El código NUNCA se guarda.
  add column codigo_entregado boolean,
  -- Copias de Ajustes al emitir: una ficha vieja muestra lo que aceptó el cliente.
  add column clausulas_version integer,
  add column garantia_meses integer,
  -- Por trabajo: pieza y calidad (original / compatible).
  add column piezas_cambiadas jsonb not null default '[]'::jsonb,
  add column en_reparacion_en timestamptz,
  add column listo_en timestamptz;

-- Equipo --------------------------------------------------------------------------------
alter table equipo
  add column udid text,
  add column numero_modelo text,
  add column region text;

-- "Ya pasó por el taller" busca por IMEI, serie, ECID o UDID (plan §3.4).
create index equipo_udid_idx on equipo (udid) where udid is not null;
create index equipo_ecid_idx on equipo (ecid) where ecid is not null;

-- Documentos emitidos -------------------------------------------------------------------
-- El PDF vive en Supabase Storage (bucket privado 'documentos'); acá queda su huella.
-- Un documento emitido no se reemplaza: si hay que corregir, se emite otro.
create table documento (
  id uuid primary key default gen_random_uuid(),
  ficha_numero integer not null references ficha (numero),
  tipo text not null check (tipo in ('ingreso', 'salida')),
  emitido_en timestamptz not null default now(),
  sha256 text not null check (sha256 ~ '^[0-9a-f]{64}$'),
  bytes integer not null check (bytes > 0),
  ruta_storage text not null unique,
  enviado_en timestamptz
);

create index documento_ficha_idx on documento (ficha_numero, emitido_en);

-- Registros del equipo ------------------------------------------------------------------
-- Pánicos, reinicios forzados, bloqueos y faltas de memoria leídos del iPhone. Solo el
-- texto que importa, nunca el archivo (plan §3.7). No se editan ni se borran.
create table registro_equipo (
  id integer primary key generated always as identity,
  ficha_numero integer not null references ficha (numero),
  momento text not null check (momento in ('ingreso', 'salida', 'vigilancia')),
  tipo text not null check (tipo in ('panic', 'reinicio_forzado', 'stacks', 'reset_counter', 'jetsam')),
  fecha_evento timestamptz,
  nombre_original text not null,
  resumen text not null default '',
  texto text not null,
  causa_probable text,
  linea_checklist text,
  sha256 text check (sha256 is null or sha256 ~ '^[0-9a-f]{64}$'),
  leido_en timestamptz not null default now(),
  unique (ficha_numero, momento, nombre_original)
);

create index registro_equipo_ficha_idx on registro_equipo (ficha_numero, fecha_evento desc);

-- Cláusulas versionadas -----------------------------------------------------------------
-- Igual que el catálogo del checklist: una fila por cláusula y versión; la activa es la
-- mayor. {meses} se reemplaza por garantia_meses al imprimir.
create table clausula (
  version integer not null check (version > 0),
  orden integer not null check (orden > 0),
  titulo text not null check (length(btrim(titulo)) > 0),
  texto text not null check (length(btrim(texto)) > 0),
  creada_en timestamptz not null default now(),
  primary key (version, orden)
);

insert into clausula (version, orden, titulo, texto) values
  (1, 1, 'Revisión limitada', 'El estado de los componentes y funciones marcados como "No probado" no pudo verificarse al momento de la recepción (equipo apagado, bloqueado o sin acceso). AFix no se hace responsable por fallas en esos componentes o funciones detectadas después de la recepción.'),
  (1, 2, 'Estado previo', 'El equipo se recibe en el estado físico descrito en este documento. Daños, rayas o golpes no descritos y visibles se entienden preexistentes salvo que AFix los haya causado.'),
  (1, 3, 'Riesgo propio de la reparación', 'Equipos con daño por líquido, golpes, apertura previa o reparaciones de terceros pueden presentar fallas nuevas durante o después de la intervención, ajenas al trabajo realizado.'),
  (1, 4, 'Piezas y avisos de iOS', 'Al reemplazar ciertas piezas, iOS puede mostrar el aviso "pieza desconocida" o desactivar funciones asociadas (por ejemplo True Tone o el porcentaje de salud de batería), sin que ello afecte el funcionamiento de la pieza.'),
  (1, 5, 'Datos personales', 'AFix no accede al contenido personal del equipo. Se recomienda respaldar la información antes de entregarlo; AFix no responde por pérdida de datos.'),
  (1, 6, 'Accesorios', 'AFix solo responde por los accesorios listados en este documento.'),
  (1, 7, 'Retiro', 'Las especies no retiradas en el plazo de un año desde la fecha de este documento se entienden abandonadas a favor de AFix (art. 42, Ley 19.496).'),
  (1, 8, 'Garantía', 'El trabajo realizado tiene una garantía de {meses} meses desde la fecha de entrega, conforme a la Ley 19.496, sobre la pieza reemplazada y la mano de obra. No cubre golpes, humedad, mal uso ni intervención de terceros.'),
  (1, 9, 'Antecedentes de fallas', 'Los registros de diagnóstico del propio equipo, leídos al momento de la recepción y detallados en este documento, dan cuenta de fallas anteriores al ingreso. AFix conserva una copia de esos registros. Estas fallas no se atribuyen a la intervención de AFix, y su reparación solo está incluida si se indica en el trabajo solicitado.');

-- Datos del taller ----------------------------------------------------------------------
alter table ajustes_taller
  add column razon_social text,
  add column rut text,
  add column correo text,
  add column instagram text,
  add column whatsapp text,
  add column garantia_meses integer not null default 3 check (garantia_meses between 0 and 60);

-- Checklist versión 2 (plan §5) ---------------------------------------------------------
-- 'condicion' es el estado físico. La versión activa es la mayor, así que desde acá los
-- ingresos nuevos usan la 2 y las fichas viejas siguen leyendo la 1.
insert into catalogo_checklist (version, clave, etiqueta, bloque, orden, estados) values
  (2, 'pantalla_tactil', 'Pantalla y táctil', 'funcionamiento', 1, '["Bien","Falla","No probado"]'),
  (2, 'tactil_bordes', 'Teclado y táctil en los bordes', 'funcionamiento', 2, '["Bien","Falla","No probado"]'),
  (2, 'true_tone', 'True Tone', 'funcionamiento', 3, '["Bien","Falla","No probado"]'),
  (2, 'face_id', 'Face ID', 'funcionamiento', 4, '["Bien","Falla","No probado"]'),
  (2, 'camara_trasera', 'Cámara trasera', 'funcionamiento', 5, '["Bien","Falla","No probado"]'),
  (2, 'camara_frontal', 'Cámara frontal', 'funcionamiento', 6, '["Bien","Falla","No probado"]'),
  (2, 'flash_linterna', 'Flash y linterna', 'funcionamiento', 7, '["Bien","Falla","No probado"]'),
  (2, 'parlante', 'Parlante', 'funcionamiento', 8, '["Bien","Falla","No probado"]'),
  (2, 'auricular', 'Auricular', 'funcionamiento', 9, '["Bien","Falla","No probado"]'),
  (2, 'microfonos', 'Micrófonos', 'funcionamiento', 10, '["Bien","Falla","No probado"]'),
  (2, 'llamada', 'Llamada (auricular y micrófono)', 'funcionamiento', 11, '["Bien","Falla","No probado"]'),
  (2, 'carga', 'Carga', 'funcionamiento', 12, '["Bien","Falla","No probado"]'),
  (2, 'botones', 'Botones', 'funcionamiento', 13, '["Bien","Falla","No probado"]'),
  (2, 'vibrador', 'Vibrador', 'funcionamiento', 14, '["Bien","Falla","No probado"]'),
  (2, 'wifi_senal', 'Wi-Fi y señal', 'funcionamiento', 15, '["Bien","Falla","No probado"]'),
  (2, 'sensor_proximidad', 'Sensor de proximidad', 'funcionamiento', 16, '["Bien","Falla","No probado"]'),
  (2, 'vidrio_pantalla', 'Vidrio de pantalla', 'condicion', 17, '["Sano","Rayas leves","Rayas profundas","Trizado","Quebrado"]'),
  (2, 'imagen_pantalla', 'Imagen de pantalla', 'condicion', 18, '["Normal","Manchas","Líneas","Píxeles muertos","Quemada","Sin imagen","No verificable"]'),
  (2, 'chasis', 'Marco / chasis', 'condicion', 19, '["Sano","Rayado","Golpes","Doblado"]'),
  (2, 'vidrio_trasero', 'Vidrio trasero', 'condicion', 20, '["Sano","Rayado","Trizado","Quebrado"]'),
  (2, 'lentes_camara', 'Lentes de cámara', 'condicion', 21, '["Sanos","Rayados","Trizados"]'),
  (2, 'botones_fisico', 'Botones (físico)', 'condicion', 22, '["Completos","Hundidos","Faltan"]'),
  (2, 'puerto_carga', 'Puerto de carga', 'condicion', 23, '["Limpio","Con suciedad","Dañado"]'),
  (2, 'bandeja_sim', 'Bandeja SIM', 'condicion', 24, '["Presente","Ausente"]'),
  (2, 'tornillos', 'Tornillos inferiores', 'condicion', 25, '["Presentes","Faltan","No originales"]'),
  (2, 'apertura_previa', 'Apertura previa', 'condicion', 26, '["Sin señales","Con señales"]'),
  (2, 'indicador_humedad', 'Indicador de humedad', 'condicion', 27, '["Sin indicio","Activado","No visible"]');

-- iPad (plan §1: iPhone e iPad) ---------------------------------------------------------
-- Mismo criterio que 0006: solo identificadores de los que hay certeza.
insert into modelo_iphone (product_type, modelo_comercial) values
  ('iPad11,1', 'iPad mini (5.ª generación)'),
  ('iPad11,2', 'iPad mini (5.ª generación)'),
  ('iPad11,3', 'iPad Air (3.ª generación)'),
  ('iPad11,4', 'iPad Air (3.ª generación)'),
  ('iPad11,6', 'iPad (8.ª generación)'),
  ('iPad11,7', 'iPad (8.ª generación)'),
  ('iPad12,1', 'iPad (9.ª generación)'),
  ('iPad12,2', 'iPad (9.ª generación)'),
  ('iPad13,1', 'iPad Air (4.ª generación)'),
  ('iPad13,2', 'iPad Air (4.ª generación)'),
  ('iPad13,16', 'iPad Air (5.ª generación)'),
  ('iPad13,17', 'iPad Air (5.ª generación)'),
  ('iPad13,18', 'iPad (10.ª generación)'),
  ('iPad13,19', 'iPad (10.ª generación)'),
  ('iPad14,1', 'iPad mini (6.ª generación)'),
  ('iPad14,2', 'iPad mini (6.ª generación)');

-- Protección como en 0003: RLS es por tabla y no se hereda ---------------------------------
alter table documento enable row level security;
alter table registro_equipo enable row level security;
alter table clausula enable row level security;
revoke all on documento, registro_equipo, clausula from anon, authenticated;

-- Bucket privado para los PDF -----------------------------------------------------------
-- En Supabase cloud el esquema storage existe y el bucket se crea acá. En el stack local
-- Storage está apagado (config.toml) y este bloque no hace nada: las pruebas guardan los
-- PDF en una carpeta (ALMACEN_DIRECTORIO).
do $$
begin
  if exists (select 1 from information_schema.tables where table_schema = 'storage' and table_name = 'buckets') then
    insert into storage.buckets (id, name, public)
    values ('documentos', 'documentos', false)
    on conflict (id) do nothing;
  end if;
end
$$;
