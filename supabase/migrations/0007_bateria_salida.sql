-- Lectura de bateria al momento de la salida, para comparar contra el ingreso en la ficha y el voucher.
alter table ficha
  add column bateria_salida_pct integer,
  add column bateria_salida_ciclos integer;
