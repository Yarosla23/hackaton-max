import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState, type FormEvent, type ReactNode } from "react";

import type { Benchmark, Dashboard, VacancyInput } from "@hackathon-max/contracts";

import { ApiRequestError, api } from "./api";

const regions = [
  { code: "7700000000000", name: "Москва" },
  { code: "7800000000000", name: "Санкт-Петербург" },
  { code: "5000000000000", name: "Московская область" },
  { code: "6600000000000", name: "Свердловская область" },
] as const;

const money = new Intl.NumberFormat("ru-RU", {
  style: "currency",
  currency: "RUB",
  maximumFractionDigits: 0,
});

const sourceLabels: Record<Benchmark["competitors"][number]["source"], string> = {
  trudvsem: "Работа России",
  hh: "HeadHunter",
  superjob: "SuperJob",
  demo: "Демо",
};

function Icon({ children, size = 20 }: { children: ReactNode; size?: number }) {
  return (
    <svg
      aria-hidden="true"
      className="icon"
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      {children}
    </svg>
  );
}

function RefreshIcon() {
  return (
    <Icon>
      <path d="M20 11a8 8 0 1 0-2.3 5.7" />
      <path d="M20 4v7h-7" />
    </Icon>
  );
}

function EditIcon() {
  return (
    <Icon>
      <path d="M12 20h9" />
      <path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L8 18l-4 1 1-4Z" />
    </Icon>
  );
}

function ArrowIcon() {
  return (
    <Icon size={18}>
      <path d="M7 17 17 7" />
      <path d="M7 7h10v10" />
    </Icon>
  );
}

function BackIcon() {
  return (
    <Icon>
      <path d="m15 18-6-6 6-6" />
    </Icon>
  );
}

function Brand() {
  return (
    <div className="brand" aria-label="Рынок рядом">
      <span className="brand__mark" aria-hidden="true">
        <span />
      </span>
      <span className="brand__copy">
        <strong>Рынок рядом</strong>
        <small>зарплатный радар</small>
      </span>
    </div>
  );
}

function positionText(position: Benchmark["position"]): string {
  if (position === "below_market") return "Ниже рынка";
  if (position === "above_market") return "Выше рынка";
  if (position === "in_market") return "В рынке";
  return "Мало данных";
}

function salaryComparison(offeredSalary: number, medianSalary: number | null): string {
  if (medianSalary === null || medianSalary === 0) return "Нет медианы для сравнения";
  const difference = Math.round(((offeredSalary - medianSalary) / medianSalary) * 100);
  if (Math.abs(difference) < 1) return "совпадает с медианой";
  return `${Math.abs(difference)}% ${difference > 0 ? "выше" : "ниже"} медианы`;
}

function updatedAt(value: string): string {
  return new Date(value).toLocaleString("ru-RU", {
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function SalaryPosition({ dashboard }: { dashboard: Dashboard }) {
  const { benchmark, monitor } = dashboard;
  if (!benchmark) return null;

  const range =
    benchmark.marketMin !== null && benchmark.marketMax !== null
      ? Math.max(1, benchmark.marketMax - benchmark.marketMin)
      : 1;
  const marker =
    benchmark.marketMin === null
      ? 50
      : Math.max(
          3,
          Math.min(97, ((monitor.offeredSalaryRub - benchmark.marketMin) / range) * 100),
        );

  return (
    <section className="market-card" aria-labelledby="market-title">
      <div className="market-card__topline">
        <p className="section-label">Зарплатная позиция</p>
        <span className={`position-pill position-pill--${benchmark.position ?? "unknown"}`}>
          <span aria-hidden="true" />
          {positionText(benchmark.position)}
        </span>
      </div>

      {benchmark.medianSalary === null ? (
        <div className="empty-market">
          <h2 id="market-title">Недостаточно зарплатных вилок</h2>
          <p>Мы нашли вакансии, но работодатели не указали обе границы зарплаты.</p>
        </div>
      ) : (
        <>
          <div className="salary-focus">
            <div>
              <span>Ваше предложение</span>
              <h2 id="market-title">{money.format(monitor.offeredSalaryRub)}</h2>
            </div>
            <p>{salaryComparison(monitor.offeredSalaryRub, benchmark.medianSalary)}</p>
          </div>

          <div
            className="market-band"
            role="img"
            aria-label={`Предложение ${money.format(monitor.offeredSalaryRub)}. Рыночный диапазон от ${money.format(benchmark.marketMin ?? 0)} до ${money.format(benchmark.marketMax ?? 0)}. Медиана ${money.format(benchmark.medianSalary)}.`}
          >
            <div className="market-band__labels" aria-hidden="true">
              <span>ниже</span>
              <span>рынок</span>
              <span>выше</span>
            </div>
            <div className="market-band__track" aria-hidden="true">
              <span className="market-band__median" />
              <span className="market-band__marker" style={{ left: `${marker}%` }}>
                <i />
              </span>
            </div>
            <div className="market-band__values" aria-hidden="true">
              <span>{benchmark.marketMin === null ? "—" : money.format(benchmark.marketMin)}</span>
              <span>{money.format(benchmark.medianSalary)} медиана</span>
              <span>{benchmark.marketMax === null ? "—" : money.format(benchmark.marketMax)}</span>
            </div>
          </div>
        </>
      )}

      <dl className="metric-grid">
        <div>
          <dt>Перцентиль</dt>
          <dd>{benchmark.percentile === null ? "—" : `${benchmark.percentile}-й`}</dd>
        </div>
        <div>
          <dt>В расчёте</dt>
          <dd>{benchmark.salarySampleSize}</dd>
        </div>
        <div>
          <dt>Найдено</dt>
          <dd>{benchmark.totalFound.toLocaleString("ru-RU")}</dd>
        </div>
      </dl>

      <div className="freshness">
        <span className={`live-indicator live-indicator--${benchmark.dataMode}`}>
          <i aria-hidden="true" />
          {benchmark.dataMode === "live" ? "Живые данные" : "Демо-данные"}
        </span>
        <span>Обновлено {updatedAt(benchmark.fetchedAt)}</span>
      </div>

      {benchmark.insufficientData && (
        <p className="warning" role="status">
          Выборка меньше пяти вакансий. Используйте оценку как ориентир.
        </p>
      )}

      <div className="source-grid" aria-label="Источники данных">
        {(benchmark.sources.length > 0
          ? benchmark.sources
          : [{ id: "trudvsem" as const, name: "Источник данных", url: benchmark.sourceUrl }]
        ).map((source) => (
          <a key={source.id} className="source-card" href={source.url} target="_blank" rel="noreferrer">
            <span>
              <small>Источник</small>
              <strong>{source.name}</strong>
            </span>
            {"salarySampleSize" in source && (
              <b>{source.salarySampleSize} / {source.totalFound.toLocaleString("ru-RU")}</b>
            )}
            <ArrowIcon />
          </a>
        ))}
      </div>
    </section>
  );
}

function VacancyForm({
  dashboard,
  onDone,
  onCancel,
}: {
  dashboard: Dashboard | null;
  onDone: () => void;
  onCancel: () => void;
}) {
  const queryClient = useQueryClient();
  const [title, setTitle] = useState(dashboard?.monitor.title ?? "");
  const [regionCode, setRegionCode] = useState(
    dashboard?.monitor.region.code ?? regions[0].code,
  );
  const [salary, setSalary] = useState(dashboard?.monitor.offeredSalaryRub.toString() ?? "");
  const save = useMutation({
    mutationFn: async (input: VacancyInput) => {
      await api.saveMonitor(input);
      return api.runBenchmark();
    },
    onSuccess: (result) => {
      queryClient.setQueryData(["dashboard"], result);
      onDone();
    },
  });

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const region = regions.find((item) => item.code === regionCode) ?? regions[0];
    save.mutate({ title, region: { ...region }, offeredSalaryRub: Number(salary) });
  }

  return (
    <div className="setup-shell">
      <header className="setup-header">
        <Brand />
        {dashboard && (
          <button className="ghost-button" type="button" onClick={onCancel}>
            <BackIcon />
            Назад
          </button>
        )}
      </header>

      <main className="setup-main">
        <div className="setup-intro">
          <span className="setup-intro__index">01—03</span>
          <p className="section-label">Новый мониторинг</p>
          <h1>{dashboard ? "Уточните предложение" : "Проверьте зарплату до публикации"}</h1>
          <p>Сопоставим условия с живыми вакансиями региона и продолжим следить за рынком.</p>
        </div>

        <form className="vacancy-form" onSubmit={submit} noValidate={false}>
          <label className="field" htmlFor="title">
            <span className="field__heading"><b>01</b> Должность</span>
            <input
              id="title"
              name="title"
              value={title}
              onChange={(event) => setTitle(event.target.value)}
              placeholder="Например, продавец-консультант"
              minLength={2}
              maxLength={120}
              autoComplete="organization-title"
              required
            />
            <small>Используйте название, которое увидит кандидат.</small>
          </label>

          <label className="field" htmlFor="region">
            <span className="field__heading"><b>02</b> Регион поиска</span>
            <select
              id="region"
              name="region"
              value={regionCode}
              onChange={(event) => setRegionCode(event.target.value)}
            >
              {regions.map((region) => (
                <option key={region.code} value={region.code}>{region.name}</option>
              ))}
            </select>
          </label>

          <label className="field" htmlFor="salary">
            <span className="field__heading"><b>03</b> Зарплата на руки</span>
            <span className="salary-input">
              <input
                id="salary"
                name="salary"
                type="number"
                inputMode="numeric"
                value={salary}
                onChange={(event) => setSalary(event.target.value)}
                placeholder="70 000"
                min={10_000}
                max={2_000_000}
                step={1_000}
                required
              />
              <span aria-hidden="true">₽ / мес.</span>
            </span>
          </label>

          {save.isError && (
            <p className="form-error" role="alert">
              {save.error instanceof ApiRequestError
                ? save.error.message
                : "Не удалось получить данные рынка. Проверьте соединение и повторите."}
            </p>
          )}

          <button className="primary-button" type="submit" disabled={save.isPending}>
            {save.isPending ? (
              <><span className="button-spinner" aria-hidden="true" />Собираем рынок…</>
            ) : (
              <>Сравнить с рынком <ArrowIcon /></>
            )}
          </button>
          <p className="form-footnote">
            Используем «Работу России», HeadHunter и подключённые открытые источники. В расчёт входят только полные рублёвые вилки.
          </p>
        </form>
      </main>
    </div>
  );
}

function CompetitorList({ benchmark }: { benchmark: Benchmark }) {
  if (benchmark.competitors.length === 0) return null;

  return (
    <section className="competitors" aria-labelledby="competitors-title">
      <div className="section-heading">
        <div>
          <p className="section-label">Рынок в деталях</p>
          <h2 id="competitors-title">Похожие вакансии</h2>
        </div>
        <span>{benchmark.competitors.length}</span>
      </div>
      <ul>
        {benchmark.competitors.map((vacancy) => (
          <li key={vacancy.id}>
            <a href={vacancy.url} target="_blank" rel="noreferrer">
              <span className="competitor-copy">
                <strong>{vacancy.employer}</strong>
                <small>{vacancy.title}</small>
                <em className={`source-badge source-badge--${vacancy.source}`}>
                  {sourceLabels[vacancy.source]}
                </em>
              </span>
              <span className="competitor-salary">
                <b>{money.format(vacancy.salaryMin)}</b>
                <small>до {money.format(vacancy.salaryMax)}</small>
              </span>
              <ArrowIcon />
            </a>
          </li>
        ))}
      </ul>
    </section>
  );
}

function DashboardView({ dashboard, onEdit }: { dashboard: Dashboard; onEdit: () => void }) {
  const queryClient = useQueryClient();
  const refresh = useMutation({
    mutationFn: api.runBenchmark,
    onSuccess: (result) => queryClient.setQueryData(["dashboard"], result),
  });
  const benchmark = refresh.data?.benchmark ? refresh.data.benchmark : dashboard.benchmark;
  const currentDashboard = refresh.data ?? dashboard;

  return (
    <div className="app-shell">
      <header className="app-header">
        <Brand />
        <span className="header-status">
          <i aria-hidden="true" />
          Мониторинг активен
        </span>
      </header>

      <main className="dashboard">
        <section className="vacancy-summary">
          <div>
            <p className="section-label">Активная вакансия</p>
            <h1>{dashboard.monitor.title}</h1>
            <p>{dashboard.monitor.region.name} <span aria-hidden="true">·</span> обновление раз в сутки</p>
          </div>
          <div className="dashboard-actions">
            <button
              className="secondary-button"
              type="button"
              onClick={() => refresh.mutate()}
              disabled={refresh.isPending}
            >
              <RefreshIcon />
              {refresh.isPending ? "Обновляем…" : "Обновить рынок"}
            </button>
            <button className="ghost-button" type="button" onClick={onEdit}>
              <EditIcon />
              Изменить
            </button>
          </div>
          <p className="refresh-status" aria-live="polite">
            {refresh.isSuccess ? "Данные обновлены" : ""}
            {refresh.isError
              ? refresh.error instanceof ApiRequestError
                ? refresh.error.message
                : "Не удалось обновить рынок"
              : ""}
          </p>
        </section>

        {benchmark ? (
          <div className="dashboard-grid">
            <SalaryPosition dashboard={currentDashboard} />
            <CompetitorList benchmark={benchmark} />
          </div>
        ) : (
          <section className="empty-dashboard">
            <p className="section-label">Первый срез</p>
            <h2>Данные рынка ещё не собраны</h2>
            <button className="primary-button" type="button" onClick={() => refresh.mutate()}>
              Собрать рынок <ArrowIcon />
            </button>
          </section>
        )}
      </main>
    </div>
  );
}

function LoadingState() {
  return (
    <main className="state-page" aria-live="polite">
      <Brand />
      <div className="radar-loader" aria-hidden="true"><span /></div>
      <h1>Сверяемся с рынком</h1>
      <p>Собираем актуальные вакансии и зарплатные вилки.</p>
    </main>
  );
}

export default function App() {
  const [editing, setEditing] = useState(false);
  const me = useQuery({ queryKey: ["me"], queryFn: api.me, retry: false });
  const dashboard = useQuery({
    queryKey: ["dashboard"],
    queryFn: api.dashboard,
    enabled: me.isSuccess,
    retry: false,
  });

  useEffect(() => window.WebApp?.ready?.(), []);

  if (me.isPending || dashboard.isPending) return <LoadingState />;

  if (me.isError || dashboard.isError) {
    const error = me.error ?? dashboard.error;
    return (
      <main className="state-page state-page--error">
        <Brand />
        <span className="error-code">СВЯЗЬ / 01</span>
        <h1>Не удалось открыть рынок</h1>
        <p>
          {error instanceof ApiRequestError
            ? error.message
            : "Проверьте соединение и откройте приложение снова."}
        </p>
        <button className="primary-button" type="button" onClick={() => window.location.reload()}>
          Повторить <RefreshIcon />
        </button>
      </main>
    );
  }

  const currentDashboard = dashboard.data;
  if (!currentDashboard || editing) {
    return (
      <VacancyForm
        dashboard={currentDashboard}
        onDone={() => setEditing(false)}
        onCancel={() => setEditing(false)}
      />
    );
  }

  return <DashboardView dashboard={currentDashboard} onEdit={() => setEditing(true)} />;
}
