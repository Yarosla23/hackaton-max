import { useQuery } from "@tanstack/react-query";
import { Link, Route, Routes } from "react-router-dom";

type Health = {
  status: "ok";
  database: "ok";
};

async function getHealth(): Promise<Health> {
  const response = await fetch("/api/health/");

  if (!response.ok) {
    throw new Error(`Backend ответил с кодом ${response.status}`);
  }

  return response.json() as Promise<Health>;
}

function HomePage() {
  const health = useQuery({ queryKey: ["health"], queryFn: getHealth });

  let status = "Проверяем подключение…";
  let tone = "loading";

  if (health.isSuccess) {
    status = "Backend и база данных доступны";
    tone = "success";
  } else if (health.isError) {
    status = health.error.message;
    tone = "error";
  }

  return (
    <main className="page-shell">
      <section className="intro" aria-labelledby="page-title">
        <p className="eyebrow">Техническая основа</p>
        <h1 id="page-title">Hackathon MAX</h1>
        <p className="lead">Проект готов к разработке</p>

        <div className={`status status--${tone}`} aria-live="polite">
          <span className="status__dot" aria-hidden="true" />
          <div>
            <span className="status__label">Состояние системы</span>
            <strong>{status}</strong>
          </div>
        </div>

        <div className="actions">
          {health.isError && (
            <button type="button" onClick={() => void health.refetch()}>
              Проверить снова
            </button>
          )}
          <a href="/api/docs/">Открыть Swagger UI</a>
        </div>
      </section>
    </main>
  );
}

function App() {
  return (
    <Routes>
      <Route path="/" element={<HomePage />} />
      <Route path="*" element={<Link to="/">Вернуться на главную</Link>} />
    </Routes>
  );
}

export default App;
