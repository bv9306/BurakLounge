/* GitHub Pages cannot run the original /api server.
   Orders and nicknames stay in this browser via localStorage. */
(function () {
  var KEY = "house-bar-v1";
  var seed = {
    nicknames: {
      "Aperol Negroni": "Tuğçe Alkolik Değildir",
      "Godfather": "Özer Yuh Bre Adamım",
      "White Russian": "Ayık taklidi",
      "Black Russian": "Taşikardi",
      "Aperol Gin Fizz": "Acil durum kokteyli"
    },
    orders: [
      {
        id: "17e438d0-e94f-455b-ac73-cd8d955aed8e",
        orderDate: "2026-11-06",
        guestName: "Yonca",
        drinkName: "Espresso Martini",
        quantity: 1,
        note: "Bol buzlu",
        status: "new",
        createdAt: "2026-11-06 14:07:12"
      }
    ]
  };

  function load() {
    try {
      var raw = localStorage.getItem(KEY);
      if (raw) return JSON.parse(raw);
    } catch (e) {}
    return JSON.parse(JSON.stringify(seed));
  }

  function save(db) {
    localStorage.setItem(KEY, JSON.stringify(db));
  }

  function json(data, status) {
    return new Response(JSON.stringify(data), {
      status: status || 200,
      headers: { "content-type": "application/json" }
    });
  }

  var original = window.fetch.bind(window);
  window.fetch = function (input, init) {
    var url = typeof input === "string" ? input : (input && input.url) || "";
    var path = url.split("?")[0];
    var isOrders = path.endsWith("/api/orders");
    var isNicks = path.endsWith("/api/nicknames");
    if (!isOrders && !isNicks) return original(input, init);

    var method = ((init && init.method) || "GET").toUpperCase();
    var body = {};
    if (init && init.body) {
      try { body = JSON.parse(init.body); } catch (e) {}
    }
    var db = load();

    if (isNicks) {
      if (method === "PUT") {
        var name = String(body.nickname || "").trim();
        if (name) db.nicknames[body.drinkName] = name;
        else delete db.nicknames[body.drinkName];
        save(db);
      }
      return Promise.resolve(json({ nicknames: db.nicknames || {} }));
    }

    if (method === "POST") {
      var order = {
        id: (window.crypto && crypto.randomUUID) ? crypto.randomUUID() : String(Date.now()),
        orderDate: body.orderDate,
        guestName: body.guestName,
        drinkName: body.drinkName,
        quantity: Number(body.quantity) || 1,
        note: body.note || "",
        status: "new",
        createdAt: new Date().toISOString().slice(0, 19).replace("T", " ")
      };
      db.orders.push(order);
      save(db);
      return Promise.resolve(json({ order: order }));
    }

    if (method === "PATCH") {
      db.orders.forEach(function (order) {
        if (order.id === body.id && body.status) order.status = body.status;
      });
      save(db);
      return Promise.resolve(json({ ok: true }));
    }

    if (method === "DELETE") {
      db.orders = db.orders.filter(function (order) { return order.id !== body.id; });
      save(db);
      return Promise.resolve(json({ ok: true }));
    }

    var date = "";
    try { date = new URL(url, location.origin).searchParams.get("date") || ""; } catch (e) {}
    var sessions = [];
    db.orders.forEach(function (order) {
      if (sessions.indexOf(order.orderDate) === -1) sessions.push(order.orderDate);
    });
    sessions.sort();
    var orders = db.orders.filter(function (order) { return !date || order.orderDate === date; });
    return Promise.resolve(json({ selectedDate: date, sessions: sessions, orders: orders }));
  };
})();
