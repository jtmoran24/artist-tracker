// A panel dressed as an old desktop window: gradient title bar, fake
// minimise/maximise/close buttons.
export function RetroWindow({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="window">
      <header className="window-title">
        <span className="pixel text-lg">{title}</span>
        <span className="window-buttons" aria-hidden>
          <i />
          <i />
          <i />
        </span>
      </header>
      <div className="p-4">{children}</div>
    </section>
  );
}
