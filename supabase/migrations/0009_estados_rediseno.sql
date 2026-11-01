-- Estados del rediseño (plan §0): recibido -> en_reparacion -> listo -> entregado |
-- entregado_sin_reparar. 'en_taller' pasa a llamarse 'recibido': el renombre conserva
-- el valor de todas las fichas existentes y el default de la columna.
--
-- Va sola en su archivo: Postgres no deja usar un valor de enum recién agregado dentro
-- de la misma transacción que lo agrega.

alter type estado_ficha rename value 'en_taller' to 'recibido';
alter type estado_ficha add value if not exists 'en_reparacion' after 'recibido';
alter type estado_ficha add value if not exists 'listo' after 'en_reparacion';
