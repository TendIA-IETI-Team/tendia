'use client';

import { useEffect, useState } from 'react';
import { PageTitle } from '@/components/Shell';
import { type Satisfaccion, TableroSatisfaccion } from '@/components/Satisfaccion';
import { Alerta } from '@/components/ui';
import { api } from '@/lib/api';

/** Tablero de la pregunta de satisfacción del tendero al terminar (TND-081). */
export default function SatisfaccionPage() {
  const [datos, setDatos] = useState<Satisfaccion | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api<Satisfaccion>('/aliado/satisfaccion')
      .then(setDatos)
      .catch((e: Error) => setError(e.message));
  }, []);

  return (
    <>
      <PageTitle
        title="Satisfacción de los tenderos"
        subtitle="Al cerrar su solicitud, cada tendero califica la experiencia de 1 a 5."
      />
      {error && <Alerta>{error}</Alerta>}
      {datos && <TableroSatisfaccion datos={datos} />}
    </>
  );
}
