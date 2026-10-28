-- Equivalencia ProductType (lo que reporta el equipo, p. ej. iPhone13,2) a nombre comercial
-- (lo que dice la gente, p. ej. iPhone 12). Cubre de iPhone 8 en adelante.
--
-- Solo se siembran codigos de los que hay certeza (identificadores publicos de Apple,
-- tal como los listan las bases de identificadores de dispositivos). Un codigo que no
-- este aqui NO es un error: la app devuelve el codigo crudo y deja escribir el nombre a
-- mano. Es preferible una tabla incompleta pero correcta a una completa con adivinanzas.

create table modelo_iphone (
  product_type text primary key check (length(btrim(product_type)) > 0),
  modelo_comercial text not null check (length(btrim(modelo_comercial)) > 0)
);

insert into modelo_iphone (product_type, modelo_comercial) values
  ('iPhone10,1', 'iPhone 8'),
  ('iPhone10,4', 'iPhone 8'),
  ('iPhone10,2', 'iPhone 8 Plus'),
  ('iPhone10,5', 'iPhone 8 Plus'),
  ('iPhone10,3', 'iPhone X'),
  ('iPhone10,6', 'iPhone X'),
  ('iPhone11,2', 'iPhone XS'),
  ('iPhone11,4', 'iPhone XS Max'),
  ('iPhone11,6', 'iPhone XS Max'),
  ('iPhone11,8', 'iPhone XR'),
  ('iPhone12,1', 'iPhone 11'),
  ('iPhone12,3', 'iPhone 11 Pro'),
  ('iPhone12,5', 'iPhone 11 Pro Max'),
  ('iPhone12,8', 'iPhone SE (2.ª generación)'),
  ('iPhone13,1', 'iPhone 12 mini'),
  ('iPhone13,2', 'iPhone 12'),
  ('iPhone13,3', 'iPhone 12 Pro'),
  ('iPhone13,4', 'iPhone 12 Pro Max'),
  ('iPhone14,2', 'iPhone 13 Pro'),
  ('iPhone14,3', 'iPhone 13 Pro Max'),
  ('iPhone14,4', 'iPhone 13 mini'),
  ('iPhone14,5', 'iPhone 13'),
  ('iPhone14,6', 'iPhone SE (3.ª generación)'),
  ('iPhone14,7', 'iPhone 14'),
  ('iPhone14,8', 'iPhone 14 Plus'),
  ('iPhone15,2', 'iPhone 14 Pro'),
  ('iPhone15,3', 'iPhone 14 Pro Max'),
  ('iPhone15,4', 'iPhone 15'),
  ('iPhone15,5', 'iPhone 15 Plus'),
  ('iPhone16,1', 'iPhone 15 Pro'),
  ('iPhone16,2', 'iPhone 15 Pro Max'),
  ('iPhone17,1', 'iPhone 16 Pro'),
  ('iPhone17,2', 'iPhone 16 Pro Max'),
  ('iPhone17,3', 'iPhone 16'),
  ('iPhone17,4', 'iPhone 16 Plus'),
  ('iPhone17,5', 'iPhone 16e');

-- Misma proteccion que 0003: RLS es por tabla y no se hereda. Sin politicas, anon y
-- authenticated no ven nada.
alter table modelo_iphone enable row level security;
revoke all on modelo_iphone from anon, authenticated;
