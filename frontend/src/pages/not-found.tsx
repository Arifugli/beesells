import { Link } from "wouter";
import { Signal, Home } from "lucide-react";

export default function NotFound() {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center gap-6 text-center p-4">
      <div className="w-16 h-16 bg-primary/10 rounded-2xl flex items-center justify-center">
        <Signal className="w-8 h-8 text-primary" />
      </div>
      <div>
        <h1 className="text-6xl font-bold text-muted-foreground/30 mb-2">404</h1>
        <h2 className="text-xl font-semibold">Страница не найдена</h2>
        <p className="text-muted-foreground mt-1">Запрошенная страница не существует.</p>
      </div>
      <Link href="/">
        <span className="inline-flex items-center gap-2 px-4 h-10 bg-primary text-primary-foreground rounded-md text-sm font-medium hover:bg-primary/90 transition-colors cursor-pointer">
          <Home className="w-4 h-4" />
          На главную
        </span>
      </Link>
    </div>
  );
}
