const STORAGE_KEY = "saldo.expense-tracker.v1";
const BUDGET_KEY = "saldo.monthly-budget.v1";

const categories = {
  expense: [
    { name: "Alimentação", icon: "A", color: "#c4f06b", bg: "#303c27" },
    { name: "Moradia", icon: "M", color: "#86c3df", bg: "#293940" },
    { name: "Transporte", icon: "T", color: "#e8b969", bg: "#3e3426" },
    { name: "Saúde", icon: "S", color: "#ff917a", bg: "#402c28" },
    { name: "Lazer", icon: "L", color: "#ce9de8", bg: "#392d40" },
    { name: "Compras", icon: "C", color: "#e39bb8", bg: "#402d37" },
    { name: "Educação", icon: "E", color: "#7dd5bb", bg: "#283d36" },
    { name: "Contas", icon: "Ct", color: "#9ba9ef", bg: "#30344a" },
    { name: "Outros", icon: "O", color: "#a6b0a7", bg: "#303632" },
  ],
  income: [
    { name: "Salário", icon: "S", color: "#76d6a1", bg: "#263d31" },
    { name: "Freelance", icon: "F", color: "#86c3df", bg: "#293940" },
    { name: "Investimentos", icon: "I", color: "#c4f06b", bg: "#303c27" },
    { name: "Reembolso", icon: "R", color: "#e8b969", bg: "#3e3426" },
    { name: "Outros", icon: "O", color: "#a6b0a7", bg: "#303632" },
  ],
};

const currency = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });
const dateFormatter = new Intl.DateTimeFormat("pt-BR", { day: "2-digit", month: "short", year: "numeric" });
const monthFormatter = new Intl.DateTimeFormat("pt-BR", { month: "long", year: "numeric" });
const today = new Date();
const monthFilter = document.querySelector("#month-filter");
const entryDialog = document.querySelector("#entry-dialog");
const budgetDialog = document.querySelector("#budget-dialog");
const entryForm = document.querySelector("#entry-form");
const budgetForm = document.querySelector("#budget-form");
const transactionList = document.querySelector("#transaction-list");
const emptyState = document.querySelector("#empty-state");
const searchInput = document.querySelector("#search-transactions");
const toast = document.querySelector("#toast");

let transactions = loadTransactions();
let budgetCents = loadBudget();
let toastTimeout;

function localDateValue(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function loadTransactions() {
  try {
    const stored = JSON.parse(localStorage.getItem(STORAGE_KEY) || "[]");
    if (!Array.isArray(stored)) return [];
    return stored.filter((item) => item && typeof item.id === "string" && typeof item.description === "string" && Number.isInteger(item.amountCents) && item.amountCents > 0 && (item.type === "expense" || item.type === "income") && typeof item.category === "string" && /^\d{4}-\d{2}-\d{2}$/.test(item.date));
  } catch {
    return [];
  }
}

function loadBudget() {
  try {
    const saved = Number(localStorage.getItem(BUDGET_KEY));
    return Number.isSafeInteger(saved) && saved > 0 ? saved : 0;
  } catch {
    return 0;
  }
}

function persist() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(transactions));
    if (budgetCents > 0) localStorage.setItem(BUDGET_KEY, String(budgetCents));
    else localStorage.removeItem(BUDGET_KEY);
    return true;
  } catch {
    showToast("Não foi possível salvar. Verifique o espaço disponível no navegador.");
    return false;
  }
}

function selectedMonth() {
  return monthFilter.value || localDateValue(today).slice(0, 7);
}

function monthTransactions(month = selectedMonth()) {
  return transactions.filter((item) => item.date.startsWith(month));
}

function formatCurrency(cents) {
  return currency.format(cents / 100);
}

function formatDate(value) {
  const [year, month, day] = value.split("-").map(Number);
  return dateFormatter.format(new Date(year, month - 1, day));
}

function selectedMonthLabel() {
  const [year, month] = selectedMonth().split("-").map(Number);
  return monthFormatter.format(new Date(year, month - 1, 1));
}

function getCategory(type, name) {
  return categories[type].find((item) => item.name === name) || categories[type][categories[type].length - 1];
}

function setCategoryOptions(type, preferredName) {
  const select = document.querySelector("#entry-category");
  const options = categories[type].map((category) => `<option value="${category.name}">${category.name}</option>`).join("");
  select.innerHTML = options;
  if (preferredName && categories[type].some((category) => category.name === preferredName)) select.value = preferredName;
}

function render() {
  renderHeading();
  renderSummary();
  renderTrendChart();
  renderCategories();
  renderTransactions();
}

function renderHeading() {
  const month = selectedMonth();
  document.querySelector("#selected-period").textContent = `Aqui está o resumo das suas finanças em ${selectedMonthLabel()}.`;
  document.querySelector("#today-label").textContent = new Intl.DateTimeFormat("pt-BR", { day: "numeric", month: "long", year: "numeric" }).format(today);
  document.querySelector("#greeting").textContent = month === localDateValue(today).slice(0, 7) ? "SEU DINHEIRO, COM MAIS CLAREZA" : "RESUMO DO PERÍODO SELECIONADO";
}

function renderSummary() {
  const entries = monthTransactions();
  const expenses = entries.filter((item) => item.type === "expense").reduce((sum, item) => sum + item.amountCents, 0);
  const income = entries.filter((item) => item.type === "income").reduce((sum, item) => sum + item.amountCents, 0);
  const balance = income - expenses;
  document.querySelector("#expenses-total").textContent = formatCurrency(expenses);
  document.querySelector("#income-total").textContent = formatCurrency(income);
  document.querySelector("#balance-total").textContent = formatCurrency(balance);
  document.querySelector("#balance-total").classList.toggle("negative-value", balance < 0);
  document.querySelector("#balance-total").classList.toggle("positive-value", balance > 0);
  document.querySelector("#expenses-foot").textContent = expenses ? `${entries.filter((item) => item.type === "expense").length} despesa(s) no período` : "Nenhuma despesa registrada";

  const budgetTotal = document.querySelector("#budget-total");
  const progress = document.querySelector("#budget-progress");
  const track = document.querySelector(".budget-track");
  const foot = document.querySelector("#budget-foot");
  const percent = budgetCents ? Math.round((expenses / budgetCents) * 100) : 0;
  budgetTotal.textContent = budgetCents ? formatCurrency(budgetCents) : "Não definido";
  progress.style.width = `${Math.min(percent, 100)}%`;
  track.classList.toggle("is-over", percent > 100);
  track.setAttribute("aria-valuenow", String(Math.min(percent, 100)));
  if (!budgetCents) foot.textContent = "Defina um limite mensal para acompanhar.";
  else if (expenses > budgetCents) foot.textContent = `${formatCurrency(expenses - budgetCents)} acima do limite`;
  else foot.textContent = `${formatCurrency(budgetCents - expenses)} disponíveis (${percent}% usado)`;
}

function createSvgElement(tag, attributes = {}) {
  const element = document.createElementNS("http://www.w3.org/2000/svg", tag);
  Object.entries(attributes).forEach(([name, value]) => element.setAttribute(name, String(value)));
  return element;
}

function renderTrendChart() {
  const container = document.querySelector("#trend-chart");
  const [year, month] = selectedMonth().split("-").map(Number);
  const months = Array.from({ length: 6 }, (_, index) => {
    const date = new Date(year, month - 1 - (5 - index), 1);
    const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
    const total = transactions.filter((item) => item.type === "expense" && item.date.startsWith(key)).reduce((sum, item) => sum + item.amountCents, 0);
    return { label: new Intl.DateTimeFormat("pt-BR", { month: "short" }).format(date).replace(".", ""), total };
  });

  if (months.every((item) => item.total === 0)) {
    container.innerHTML = '<div class="chart-empty"><strong>Seu gráfico começa com o primeiro gasto</strong><span>Registre uma despesa para acompanhar sua evolução.</span></div>';
    return;
  }

  const width = 620;
  const height = 184;
  const left = 32;
  const right = 10;
  const top = 12;
  const bottom = 26;
  const plotHeight = height - top - bottom;
  const plotWidth = width - left - right;
  const max = Math.max(...months.map((item) => item.total), 1);
  const step = plotWidth / months.length;
  const baseline = top + plotHeight;
  const svg = createSvgElement("svg", { viewBox: `0 0 ${width} ${height}`, role: "img", "aria-label": `Despesas nos últimos seis meses, total máximo ${formatCurrency(max)}` });

  for (let index = 0; index < 4; index += 1) {
    const y = top + (plotHeight / 3) * index;
    svg.append(createSvgElement("line", { x1: left, y1: y, x2: width - right, y2: y, stroke: "#2d352f", "stroke-width": 1 }));
  }

  months.forEach((item, index) => {
    const barWidth = Math.min(37, step * 0.43);
    const barHeight = item.total ? Math.max(4, (item.total / max) * (plotHeight - 4)) : 2;
    const x = left + step * index + (step - barWidth) / 2;
    const y = baseline - barHeight;
    const bar = createSvgElement("rect", {
      x, y, width: barWidth, height: barHeight, rx: 3,
      fill: index === months.length - 1 ? "#c4f06b" : "#6e8750",
      opacity: item.total ? (index === months.length - 1 ? 1 : 0.78) : 0.34,
    });
    if (item.total) {
      const title = createSvgElement("title");
      title.textContent = `${item.label}: ${formatCurrency(item.total)}`;
      bar.append(title);
    }
    svg.append(bar);
    const label = createSvgElement("text", { x: left + step * index + step / 2, y: height - 5, fill: "#89948b", "font-family": "DM Sans, sans-serif", "font-size": 10, "text-anchor": "middle" });
    label.textContent = item.label;
    svg.append(label);
  });
  container.replaceChildren(svg);
}

function renderCategories() {
  const container = document.querySelector("#category-chart");
  const expenses = monthTransactions().filter((item) => item.type === "expense");
  const totals = new Map();
  expenses.forEach((item) => totals.set(item.category, (totals.get(item.category) || 0) + item.amountCents));
  const sorted = [...totals.entries()].sort((first, second) => second[1] - first[1]);
  const total = sorted.reduce((sum, item) => sum + item[1], 0);
  document.querySelector("#category-total").textContent = formatCurrency(total);

  if (!sorted.length) {
    container.innerHTML = '<div class="category-empty"><strong>Sem despesas neste período</strong><span>As categorias aparecem conforme você registra gastos.</span></div>';
    return;
  }

  container.replaceChildren(...sorted.slice(0, 6).map(([name, amount]) => {
    const category = getCategory("expense", name);
    const row = document.createElement("div");
    row.className = "category-row";
    const label = document.createElement("span");
    label.className = "category-name";
    label.textContent = name;
    const bar = document.createElement("span");
    bar.className = "category-bar";
    bar.setAttribute("role", "img");
    bar.setAttribute("aria-label", `${name}: ${Math.round((amount / total) * 100)}%`);
    const fill = document.createElement("span");
    fill.style.width = `${(amount / total) * 100}%`;
    fill.style.setProperty("--bar-color", category.color);
    bar.append(fill);
    const value = document.createElement("span");
    value.className = "category-amount";
    value.textContent = formatCurrency(amount);
    row.append(label, bar, value);
    return row;
  }));
}

function renderTransactions() {
  const query = searchInput.value.trim().toLocaleLowerCase("pt-BR");
  const entries = monthTransactions()
    .filter((item) => `${item.description} ${item.category}`.toLocaleLowerCase("pt-BR").includes(query))
    .sort((first, second) => second.date.localeCompare(first.date) || second.id.localeCompare(first.id));
  transactionList.replaceChildren(...entries.map(createTransactionRow));
  const showEmpty = entries.length === 0;
  emptyState.classList.toggle("is-visible", showEmpty);
  document.querySelector(".table-wrap table").hidden = showEmpty;
  const count = document.querySelector("#results-count");
  count.textContent = `${entries.length} ${entries.length === 1 ? "lançamento" : "lançamentos"}`;
  if (query && showEmpty) {
    emptyState.querySelector("strong").textContent = "Nenhum resultado encontrado";
    emptyState.querySelector("span:not(.empty-mark)").textContent = "Tente buscar por outra descrição ou categoria.";
    emptyState.querySelector(".text-button").hidden = true;
  } else {
    emptyState.querySelector("strong").textContent = "Nenhum lançamento por aqui";
    emptyState.querySelector("span:not(.empty-mark)").textContent = "Adicione uma entrada ou despesa para começar.";
    emptyState.querySelector(".text-button").hidden = false;
  }
}

function createTransactionRow(item) {
  const category = getCategory(item.type, item.category);
  const row = document.createElement("tr");
  const titleCell = document.createElement("td");
  const title = document.createElement("div");
  title.className = "transaction-title";
  const icon = document.createElement("span");
  icon.className = "transaction-icon";
  icon.textContent = category.icon;
  icon.style.setProperty("--icon-color", category.color);
  icon.style.setProperty("--icon-bg", category.bg);
  const copy = document.createElement("span");
  copy.className = "transaction-copy";
  const description = document.createElement("strong");
  description.textContent = item.description;
  const detail = document.createElement("small");
  detail.textContent = item.type === "income" ? "Entrada" : "Despesa";
  copy.append(description, detail);
  title.append(icon, copy);
  titleCell.append(title);

  const categoryCell = document.createElement("td");
  const pill = document.createElement("span");
  pill.className = "category-pill";
  pill.textContent = item.category;
  categoryCell.append(pill);

  const dateCell = document.createElement("td");
  dateCell.className = "date-cell";
  dateCell.textContent = formatDate(item.date);

  const amountCell = document.createElement("td");
  amountCell.className = `amount-cell${item.type === "income" ? " income" : ""}`;
  amountCell.textContent = `${item.type === "income" ? "+" : "−"} ${formatCurrency(item.amountCents)}`;

  const actionCell = document.createElement("td");
  const remove = document.createElement("button");
  remove.className = "delete-button";
  remove.type = "button";
  remove.textContent = "Excluir";
  remove.setAttribute("aria-label", `Excluir ${item.description}`);
  remove.addEventListener("click", () => deleteTransaction(item.id));
  actionCell.append(remove);
  row.append(titleCell, categoryCell, dateCell, amountCell, actionCell);
  return row;
}

function showToast(message) {
  toast.textContent = message;
  toast.classList.add("is-visible");
  window.clearTimeout(toastTimeout);
  toastTimeout = window.setTimeout(() => toast.classList.remove("is-visible"), 3000);
}

function deleteTransaction(id) {
  transactions = transactions.filter((item) => item.id !== id);
  if (persist()) {
    render();
    showToast("Lançamento excluído.");
  }
}

function openEntryDialog() {
  entryForm.reset();
  entryForm.elements.date.value = localDateValue(today);
  setCategoryOptions("expense");
  entryDialog.showModal();
  document.querySelector("#entry-description").focus();
}

document.querySelector("#open-entry").addEventListener("click", openEntryDialog);
document.querySelector("#empty-add").addEventListener("click", openEntryDialog);
document.querySelector("#close-dialog").addEventListener("click", () => entryDialog.close());
document.querySelector("#cancel-dialog").addEventListener("click", () => entryDialog.close());
document.querySelector("#close-budget").addEventListener("click", () => budgetDialog.close());
document.querySelector("#edit-budget").addEventListener("click", () => {
  budgetForm.elements.budget.value = budgetCents ? (budgetCents / 100).toFixed(2) : "";
  budgetDialog.showModal();
});
document.querySelector("#remove-budget").addEventListener("click", () => {
  budgetCents = 0;
  if (persist()) {
    renderSummary();
    budgetDialog.close();
    showToast("Limite mensal removido.");
  }
});
document.querySelector("#empty-add").addEventListener("click", openEntryDialog);
monthFilter.addEventListener("change", render);
searchInput.addEventListener("input", renderTransactions);

entryForm.querySelectorAll('input[name="type"]').forEach((input) => {
  input.addEventListener("change", () => setCategoryOptions(input.value));
});

entryForm.addEventListener("submit", (event) => {
  event.preventDefault();
  if (!entryForm.reportValidity()) return;
  const formData = new FormData(entryForm);
  const amountCents = Math.round(Number(formData.get("amount")) * 100);
  if (!Number.isSafeInteger(amountCents) || amountCents < 1) {
    showToast("Informe um valor válido.");
    return;
  }
  transactions.push({
    id: crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(16).slice(2)}`,
    description: String(formData.get("description")).trim(),
    amountCents,
    type: String(formData.get("type")),
    category: String(formData.get("category")),
    date: String(formData.get("date")),
  });
  if (persist()) {
    searchInput.value = "";
    monthFilter.value = String(formData.get("date")).slice(0, 7);
    entryDialog.close();
    render();
    showToast("Lançamento salvo neste dispositivo.");
  }
});

budgetForm.addEventListener("submit", (event) => {
  event.preventDefault();
  if (!budgetForm.reportValidity()) return;
  const cents = Math.round(Number(budgetForm.elements.budget.value) * 100);
  if (!Number.isSafeInteger(cents) || cents < 1) {
    showToast("Informe um limite válido.");
    return;
  }
  budgetCents = cents;
  if (persist()) {
    budgetDialog.close();
    renderSummary();
    showToast("Limite mensal atualizado.");
  }
});

document.querySelectorAll(".main-nav .nav-link").forEach((link) => {
  link.addEventListener("click", () => {
    document.querySelectorAll(".main-nav .nav-link").forEach((item) => item.classList.toggle("is-active", item === link));
  });
});

monthFilter.value = localDateValue(today).slice(0, 7);
render();