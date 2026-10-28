-- Notas con fecha sobre fichas ya congeladas. Una ficha entregada no se edita: lo que
-- aparezca despues se agrega aqui y nunca pisa lo original. Solo se insertan, no se editan.

create table nota_posterior (
  id integer primary key generated always as identity,
  ficha_numero integer not null references ficha (numero),
  texto text not null check (length(btrim(texto)) > 0),
  creada_en timestamptz not null default now()
);

create index nota_posterior_ficha_idx on nota_posterior (ficha_numero, creada_en, id);

-- Misma proteccion que 0003: RLS es por tabla y no se hereda. Sin politicas, anon y
-- authenticated no ven nada.
alter table nota_posterior enable row level security;
revoke all on nota_posterior from anon, authenticated;
