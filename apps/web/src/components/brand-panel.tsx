import { Logo } from '@/components/logo';

const participants = [
  { name: 'Анна', initial: 'А' },
  { name: 'Игорь', initial: 'И' },
  { name: 'Мария', initial: 'М' },
  { name: 'Дмитрий', initial: 'Д' },
];

export function BrandPanel() {
  return (
    <aside className="relative hidden overflow-hidden bg-linear-150 from-[color-mix(in_oklch,var(--accent),black_30%)] to-[color-mix(in_oklch,var(--accent),black_68%)] text-white lg:order-first lg:flex lg:flex-col lg:justify-between lg:gap-8 lg:p-12 2xl:gap-12 2xl:p-16">
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -top-40 -left-32 size-[32rem] rounded-full bg-accent/40 blur-3xl"
      />
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -right-40 -bottom-48 size-[36rem] rounded-full bg-white/10 blur-3xl"
      />
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 opacity-25 [background-image:radial-gradient(white_1px,transparent_1px)] [background-size:28px_28px] [mask-image:radial-gradient(ellipse_at_center,black,transparent_75%)]"
      />

      <Logo className="relative self-start" />

      {/* Декоративный макет встречи: скринридеру он не нужен. */}
      <div
        aria-hidden="true"
        className="relative w-full max-w-md rounded-3xl bg-white/10 p-4 shadow-2xl ring-1 ring-white/20 backdrop-blur-xl"
      >
        <div className="mb-3 flex items-center justify-between px-1 text-sm">
          <span className="flex items-center gap-2 font-medium">
            <span className="size-2 rounded-full bg-success shadow-[0_0_0_3px] shadow-success/30" />
            Планёрка команды
          </span>
          <span className="text-white/60 tabular-nums">12:30</span>
        </div>
        <div className="grid grid-cols-2 gap-3">
          {participants.map(({ name, initial }, index) => (
            <div
              key={name}
              className={`relative grid aspect-[3/2] place-items-center rounded-2xl bg-white/10 ${index === 1 ? 'ring-2 ring-success' : ''}`}
            >
              <span className="grid size-14 place-items-center rounded-full bg-white/20 text-xl font-semibold">
                {initial}
              </span>
              <span className="absolute bottom-2 left-2 rounded-full bg-black/30 px-2.5 py-0.5 text-xs">
                {name}
              </span>
            </div>
          ))}
        </div>
      </div>

      <div className="relative">
        <h2 className="text-4xl font-semibold tracking-tight text-balance xl:text-5xl">
          Видеовстречи без лишних шагов
        </h2>
        <p className="mt-4 max-w-md text-lg text-white/75">
          Запланируйте встречу, пригласите участников и начните разговор: всё в
          одном месте.
        </p>
      </div>
    </aside>
  );
}
