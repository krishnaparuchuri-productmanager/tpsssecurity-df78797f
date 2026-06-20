import { ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";

interface Props {
  total: number;
  page: number;
  pageSize: number;
  onPage: (p: number) => void;
}

export default function Paginator({ total, page, pageSize, onPage }: Props) {
  const pages = Math.ceil(total / pageSize);
  if (pages <= 1) return null;
  const from = (page - 1) * pageSize + 1;
  const to = Math.min(page * pageSize, total);
  return (
    <div className="flex items-center justify-between px-3 py-2 text-sm border-t border-app-border">
      <span className="text-xs text-app-muted">{from}–{to} of {total}</span>
      <div className="flex items-center gap-1">
        <Button size="sm" variant="ghost" disabled={page === 1} onClick={() => onPage(page - 1)}>
          <ChevronLeft className="h-4 w-4" />
        </Button>
        <span className="text-xs text-app-muted px-1">{page} / {pages}</span>
        <Button size="sm" variant="ghost" disabled={page === pages} onClick={() => onPage(page + 1)}>
          <ChevronRight className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}
