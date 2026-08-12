import { format, formatDistanceToNow, isToday, isYesterday } from "date-fns";
import { ptBR } from "date-fns/locale";

const toDate = (value: Date | string | number): Date =>
  value instanceof Date ? value : new Date(value);

/** 08/08/2026 */
export function formatDate(value: Date | string | number): string {
  return format(toDate(value), "dd/MM/yyyy", { locale: ptBR });
}

/** 08/08/2026 14:32 */
export function formatDateTime(value: Date | string | number): string {
  return format(toDate(value), "dd/MM/yyyy HH:mm", { locale: ptBR });
}

/** 14:32 */
export function formatTime(value: Date | string | number): string {
  return format(toDate(value), "HH:mm", { locale: ptBR });
}

/** "Hoje, 14:32" / "Ontem, 14:32" / "08/08/2026 14:32" */
export function formatDayLabel(value: Date | string | number): string {
  const date = toDate(value);
  if (isToday(date)) return `Hoje, ${formatTime(date)}`;
  if (isYesterday(date)) return `Ontem, ${formatTime(date)}`;
  return formatDateTime(date);
}

/** "há 3 dias" */
export function formatRelative(value: Date | string | number): string {
  return formatDistanceToNow(toDate(value), {
    addSuffix: true,
    locale: ptBR,
  });
}

/** 1.234 */
export function formatNumber(value: number): string {
  return new Intl.NumberFormat("pt-BR").format(value);
}

/** R$ 49,90 */
export function formatCurrency(valueInCents: number): string {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(valueInCents / 100);
}
