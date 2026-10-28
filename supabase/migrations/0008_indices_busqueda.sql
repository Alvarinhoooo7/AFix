-- Indices para la pantalla de inicio y el buscador insensible a mayusculas y acentos.
create index ficha_estado_recibido_idx on ficha (estado, recibido_en desc);
create index equipo_serie_lower_idx on equipo (lower(numero_serie));
create index equipo_modelo_lower_idx on equipo (translate(lower(coalesce(modelo_comercial, '')), 'áéíóúüñ', 'aeiouun'));
create index ficha_quien_lower_idx on ficha (translate(lower(coalesce(quien_lo_trajo, '')), 'áéíóúüñ', 'aeiouun'));
