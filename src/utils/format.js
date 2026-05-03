export const currency = new Intl.NumberFormat("pt-BR", {
  style: "currency",
  currency: "BRL"
}).format;

export const periodLabels = {
  day: "Hoje",
  week: "Ultimos 7 dias",
  month: "Mes selecionado"
};

export function shortDate(date) {
  return new Intl.DateTimeFormat("pt-BR", { day: "2-digit", month: "short" }).format(new Date(`${date}T12:00:00`));
}

export function shortDay(date) {
  return new Intl.DateTimeFormat("pt-BR", { day: "2-digit", month: "2-digit" }).format(new Date(`${date}T12:00:00`));
}
