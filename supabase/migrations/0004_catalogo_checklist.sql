-- Catalogo de checklist versionado: una fila por linea y por version. Las lineas son
-- datos, no codigo. La ficha guarda en catalogo_version el numero que uso; sin llave
-- foranea porque version no es unica aqui. La version activa es la mayor.

create table catalogo_checklist (
  version integer not null check (version > 0),
  clave text not null,
  etiqueta text not null,
  bloque text not null check (bloque in ('funcionamiento', 'condicion')),
  orden integer not null,
  estados jsonb not null check (jsonb_typeof(estados) = 'array' and jsonb_array_length(estados) > 0),
  primary key (version, clave)
);

-- Misma proteccion que 0003: sin politicas, anon y authenticated no ven nada.
alter table catalogo_checklist enable row level security;
revoke all on catalogo_checklist from anon, authenticated;

-- Version 1: las 17 lineas del diseno (9.4).
insert into catalogo_checklist (version, clave, etiqueta, bloque, orden, estados) values
  (1, 'pantalla_tactil', 'Pantalla y táctil', 'funcionamiento', 1, '["Bien","Falla","No probado"]'),
  (1, 'true_tone', 'True Tone', 'funcionamiento', 2, '["Bien","Falla","No probado"]'),
  (1, 'face_id', 'Face ID', 'funcionamiento', 3, '["Bien","Falla","No probado"]'),
  (1, 'camara_trasera', 'Cámara trasera', 'funcionamiento', 4, '["Bien","Falla","No probado"]'),
  (1, 'camara_frontal', 'Cámara frontal', 'funcionamiento', 5, '["Bien","Falla","No probado"]'),
  (1, 'parlante', 'Parlante', 'funcionamiento', 6, '["Bien","Falla","No probado"]'),
  (1, 'auricular', 'Auricular', 'funcionamiento', 7, '["Bien","Falla","No probado"]'),
  (1, 'microfonos', 'Micrófonos', 'funcionamiento', 8, '["Bien","Falla","No probado"]'),
  (1, 'carga', 'Carga', 'funcionamiento', 9, '["Bien","Falla","No probado"]'),
  (1, 'botones', 'Botones', 'funcionamiento', 10, '["Bien","Falla","No probado"]'),
  (1, 'vibrador', 'Vibrador', 'funcionamiento', 11, '["Bien","Falla","No probado"]'),
  (1, 'wifi_senal', 'Wi-Fi y señal', 'funcionamiento', 12, '["Bien","Falla","No probado"]'),
  (1, 'sensor_proximidad', 'Sensor de proximidad', 'funcionamiento', 13, '["Bien","Falla","No probado"]'),
  (1, 'apertura_previa', 'Apertura previa', 'condicion', 14, '["Sin señales","Con señales"]'),
  (1, 'indicador_humedad', 'Indicador de humedad', 'condicion', 15, '["Sin indicio","Activado"]'),
  (1, 'vidrio_trasero', 'Vidrio trasero', 'condicion', 16, '["Sano","Rayado","Trizado"]'),
  (1, 'chasis', 'Chasis', 'condicion', 17, '["Sano","Golpes","Doblado"]');
