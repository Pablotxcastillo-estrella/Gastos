(function(){
  "use strict";

  var STORAGE_KEY = "ledger-transactions-v1";
  var form = document.getElementById("entry-form");
  var descInput = document.getElementById("desc");
  var amountInput = document.getElementById("amount");
  var dateInput = document.getElementById("date");
  var categorySelect = document.getElementById("category");
  var formError = document.getElementById("form-error");
  var ledgerBody = document.getElementById("ledger-body");
  var emptyState = document.getElementById("empty-state");
  var balanceValue = document.getElementById("balance-value");
  var incomeValue = document.getElementById("income-value");
  var expenseValue = document.getElementById("expense-value");
  var countLabel = document.getElementById("count-label");
  var clearAllBtn = document.getElementById("clear-all");
  var filterType = document.getElementById("filter-type");
  var filterSearch = document.getElementById("filter-search");
  var srStatus = document.getElementById("sr-status");
  var todayLabel = document.getElementById("today-label");

  var currencyFmt = new Intl.NumberFormat("es-GT", { style: "currency", currency: "GTQ" });
  var dateFmt = new Intl.DateTimeFormat("es-GT", { day: "2-digit", month: "short", year: "numeric" });

  // Calcula la fecha de hoy (AAAA-MM-DD) en la zona horaria local del dispositivo.
  function todayISO(){
    var d = new Date();
    var offset = d.getTimezoneOffset();
    var local = new Date(d.getTime() - offset * 60000);
    return local.toISOString().slice(0,10);
  }

  // Mantiene el rótulo "hoy" y el campo de fecha del formulario sincronizados
  // con el día real, incluso si la página se queda abierta y cruza la medianoche.
  var currentToday = todayISO();

  function applyToday(){
    todayLabel.textContent = dateFmt.format(new Date());
    // Solo actualiza el campo de fecha si el usuario no lo ha cambiado a otro día.
    if(dateInput.value === currentToday || dateInput.value === ""){
      dateInput.value = todayISO();
    }
  }

  function checkDateRollover(){
    var freshToday = todayISO();
    if(freshToday !== currentToday){
      currentToday = freshToday;
      applyToday();
    }
  }

  applyToday();
  // Revisa cada minuto si cambió el día (por ejemplo, al pasar la medianoche
  // con la pestaña abierta) y también al regresar a la pestaña.
  setInterval(checkDateRollover, 60 * 1000);
  document.addEventListener("visibilitychange", function(){
    if(document.visibilityState === "visible"){
      checkDateRollover();
    }
  });

  function loadTransactions(){
    try{
      var raw = localStorage.getItem(STORAGE_KEY);
      if(!raw) return [];
      var parsed = JSON.parse(raw);
      if(!Array.isArray(parsed)) return [];
      return parsed;
    }catch(err){
      console.error("No se pudieron leer los movimientos guardados:", err);
      return [];
    }
  }

  function saveTransactions(list){
    try{
      localStorage.setItem(STORAGE_KEY, JSON.stringify(list));
    }catch(err){
      console.error("No se pudieron guardar los movimientos:", err);
    }
  }

  var transactions = loadTransactions();

  function formatDate(iso){
    var parts = iso.split("-");
    var d = new Date(Number(parts[0]), Number(parts[1]) - 1, Number(parts[2]));
    return dateFmt.format(d);
  }

  function escapeHtml(str){
    var div = document.createElement("div");
    div.textContent = str;
    return div.innerHTML;
  }

  function render(){
    var typeFilter = filterType.value;
    var searchTerm = filterSearch.value.trim().toLowerCase();

    var filtered = transactions.filter(function(t){
      if(typeFilter !== "todos" && t.type !== typeFilter) return false;
      if(searchTerm){
        var haystack = (t.desc + " " + t.category).toLowerCase();
        if(haystack.indexOf(searchTerm) === -1) return false;
      }
      return true;
    });

    var sorted = filtered.slice().sort(function(a,b){
      if(a.date === b.date) return b.createdAt - a.createdAt;
      return a.date < b.date ? 1 : -1;
    });

    ledgerBody.innerHTML = "";

    if(sorted.length === 0){
      emptyState.hidden = false;
    } else {
      emptyState.hidden = true;
      sorted.forEach(function(t){
        var tr = document.createElement("tr");
        tr.className = t.type === "ingreso" ? "income" : "expense";

        var sign = t.type === "ingreso" ? "+" : "\u2212";

        tr.innerHTML =
          "<td>" + formatDate(t.date) + "</td>" +
          "<td class=\"desc\">" + escapeHtml(t.desc) + "</td>" +
          "<td><span class=\"cat-tag\">" + escapeHtml(t.category) + "</span></td>" +
          "<td class=\"num\">" + sign + " " + currencyFmt.format(t.amount) + "</td>" +
          "<td><button type=\"button\" class=\"btn-delete\" data-id=\"" + t.id + "\" aria-label=\"Eliminar movimiento: " + escapeHtml(t.desc) + "\">Eliminar</button></td>";

        ledgerBody.appendChild(tr);
      });
    }

    var totals = transactions.reduce(function(acc, t){
      if(t.type === "ingreso") acc.income += t.amount;
      else acc.expense += t.amount;
      return acc;
    }, { income: 0, expense: 0 });

    var balance = totals.income - totals.expense;

    balanceValue.textContent = currencyFmt.format(balance);
    incomeValue.textContent = currencyFmt.format(totals.income);
    expenseValue.textContent = currencyFmt.format(totals.expense);

    var count = transactions.length;
    countLabel.textContent = count === 1 ? "1 movimiento registrado" : count + " movimientos registrados";
  }

  form.addEventListener("submit", function(e){
    e.preventDefault();
    formError.textContent = "";

    var desc = descInput.value.trim();
    var amount = parseFloat(amountInput.value);
    var date = dateInput.value;
    var type = form.querySelector('input[name="type"]:checked').value;
    var category = categorySelect.value;

    if(!desc){
      formError.textContent = "Escribe una descripción para el movimiento.";
      descInput.focus();
      return;
    }
    if(isNaN(amount) || amount <= 0){
      formError.textContent = "Ingresa un monto mayor a cero.";
      amountInput.focus();
      return;
    }
    if(!date){
      formError.textContent = "Selecciona una fecha.";
      dateInput.focus();
      return;
    }

    var entry = {
      id: Date.now().toString(36) + Math.random().toString(36).slice(2,7),
      type: type,
      desc: desc,
      amount: Math.round(amount * 100) / 100,
      date: date,
      category: category,
      createdAt: Date.now()
    };

    transactions.push(entry);
    saveTransactions(transactions);
    render();

    srStatus.textContent = (type === "ingreso" ? "Ingreso" : "Egreso") + " de " + currencyFmt.format(entry.amount) + " agregado.";

    form.reset();
    dateInput.value = todayISO();
    document.getElementById("type-income").checked = true;
    descInput.focus();
  });

  ledgerBody.addEventListener("click", function(e){
    var btn = e.target.closest(".btn-delete");
    if(!btn) return;
    var id = btn.getAttribute("data-id");
    var removed = transactions.find(function(t){ return t.id === id; });
    transactions = transactions.filter(function(t){ return t.id !== id; });
    saveTransactions(transactions);
    render();
    if(removed){
      srStatus.textContent = "Movimiento eliminado: " + removed.desc + ".";
    }
  });

  clearAllBtn.addEventListener("click", function(){
    if(transactions.length === 0) return;
    var confirmClear = window.confirm("¿Seguro que deseas borrar todos los movimientos? Esta acción no se puede deshacer.");
    if(!confirmClear) return;
    transactions = [];
    saveTransactions(transactions);
    render();
    srStatus.textContent = "Todos los movimientos fueron eliminados.";
  });

  filterType.addEventListener("change", render);
  filterSearch.addEventListener("input", render);

  render();
})();