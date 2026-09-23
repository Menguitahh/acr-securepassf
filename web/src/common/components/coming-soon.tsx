interface Props {
  title: string;
}

export function ComingSoon({ title }: Props) {
  return (
    <section className="flex flex-col gap-2">
      <h1 className="text-2xl font-semibold">{title}</h1>
      <p className="text-text-muted">Próximamente</p>
    </section>
  );
}
