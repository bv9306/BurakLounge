/* GitHub Pages cannot run the original /api server.
   Nicknames and orders live in one shared JSON document, so a change
   made in one browser shows up when someone else refreshes. */
(function () {
  var BIN = "https://api.npoint.io/ae9076226982cad420f5";
  var LOCAL_KEY = "house-bar-v1";
  var MERGED_KEY = "house-bar-v1-merged";
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
    ],
    rev: 1
  };

  var original = window.fetch.bind(window);
  var chain = Promise.resolve();

  function clone(value) {
    return JSON.parse(JSON.stringify(value));
  }

  function readLocal() {
    try {
      var raw = localStorage.getItem(LOCAL_KEY);
      if (raw) return JSON.parse(raw);
    } catch (e) {}
    return null;
  }

  function mergedAlready() {
    try { return localStorage.getItem(MERGED_KEY) === "1"; } catch (e) { return true; }
  }

  function markMerged() {
    try { localStorage.setItem(MERGED_KEY, "1"); } catch (e) {}
  }

  function normalize(doc) {
    if (!doc || typeof doc !== "object" || Array.isArray(doc)) doc = clone(seed);
    if (!doc.nicknames || typeof doc.nicknames !== "object" || Array.isArray(doc.nicknames)) doc.nicknames = {};
    if (!Array.isArray(doc.orders)) doc.orders = [];
    if (typeof doc.rev !== "number") doc.rev = 0;
    return doc;
  }

  function remoteGet() {
    return original(BIN + "?t=" + Date.now(), { cache: "no-store" }).then(function (res) {
      if (!res.ok) throw new Error("defter");
      return res.json();
    }).then(normalize);
  }

  function remotePut(doc) {
    var body = { nicknames: doc.nicknames, orders: doc.orders, rev: doc.rev };
    return original(BIN, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body)
    }).then(function (res) {
      if (!res.ok) throw new Error("defter");
      return res.json();
    }).then(normalize);
  }

  function absorbLocal(doc) {
    if (mergedAlready()) return false;
    var local = readLocal();
    if (!local) {
      markMerged();
      return false;
    }
    var nicks = local.nicknames || {};
    Object.keys(nicks).forEach(function (key) {
      if (nicks[key] && !doc.nicknames[key]) doc.nicknames[key] = nicks[key];
    });
    var seen = {};
    doc.orders.forEach(function (order) { if (order && order.id) seen[order.id] = true; });
    (local.orders || []).forEach(function (order) {
      if (order && order.id && !seen[order.id]) {
        doc.orders.push(order);
        seen[order.id] = true;
      }
    });
    return true;
  }

  function withDoc(mutator) {
    var run = function () {
      var attempt = function (n) {
        return remoteGet().then(function (doc) {
          var carryLocal = absorbLocal(doc);
          var before = JSON.stringify(doc);
          var result = mutator(doc) || {};
          var changed = JSON.stringify(doc) !== before;
          var finish = function (fresh) {
            if (carryLocal) markMerged();
            return { doc: fresh, result: result };
          };
          if (!changed) return finish(doc);
          doc.rev = (doc.rev || 0) + 1;
          return remotePut(doc).then(remoteGet).then(function (fresh) {
            if (result.expect && !result.expect(fresh)) {
              if (n >= 3) throw new Error("çakışma");
              return attempt(n + 1);
            }
            return finish(fresh);
          });
        }).catch(function (err) {
          if (n >= 3) throw err;
          return new Promise(function (resolve) { setTimeout(resolve, 250 * (n + 1)); }).then(function () {
            return attempt(n + 1);
          });
        });
      };
      return attempt(0);
    };
    var next = chain.then(run, run);
    chain = next.then(function () {}, function () {});
    return next;
  }

  function json(data, status) {
    return new Response(JSON.stringify(data), {
      status: status || 200,
      headers: { "content-type": "application/json" }
    });
  }

  function ordersView(doc, url) {
    var date = "";
    try { date = new URL(url, location.origin).searchParams.get("date") || ""; } catch (e) {}
    var sessions = [];
    doc.orders.forEach(function (order) {
      if (order.orderDate && sessions.indexOf(order.orderDate) === -1) sessions.push(order.orderDate);
    });
    sessions.sort();
    return {
      selectedDate: date,
      sessions: sessions,
      orders: doc.orders.filter(function (order) { return !date || order.orderDate === date; })
    };
  }

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

    if (isNicks && method === "PUT") {
      var nickname = String(body.nickname || "").trim();
      var drink = body.drinkName;
      return withDoc(function (doc) {
        if (nickname) doc.nicknames[drink] = nickname;
        else delete doc.nicknames[drink];
        return {
          expect: function (fresh) {
            var got = (fresh.nicknames && fresh.nicknames[drink]) || "";
            return nickname ? got === nickname : !got;
          }
        };
      }).then(function (out) {
        return json({ nicknames: out.doc.nicknames || {} });
      }).catch(function () {
        return json({ error: "Kaydedilemedi, tekrar dene." }, 503);
      });
    }

    if (isNicks) {
      return withDoc(function () { return {}; }).then(function (out) {
        return json({ nicknames: out.doc.nicknames || {} });
      }).catch(function () {
        return json({ error: "Lakap defteri şu an açılamıyor." }, 503);
      });
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
      return withDoc(function (doc) {
        if (!doc.orders.some(function (item) { return item.id === order.id; })) doc.orders.push(order);
        return {
          order: order,
          expect: function (fresh) {
            return fresh.orders.some(function (item) { return item.id === order.id; });
          }
        };
      }).then(function (out) {
        return json({ order: out.result.order });
      }).catch(function () {
        return json({ error: "Sipariş eklenemedi." }, 503);
      });
    }

    if (method === "PATCH") {
      return withDoc(function (doc) {
        doc.orders.forEach(function (order) {
          if (order.id === body.id && body.status) order.status = body.status;
        });
        return {
          expect: function (fresh) {
            if (!body.status) return true;
            var found = fresh.orders.filter(function (order) { return order.id === body.id; })[0];
            return !!(found && found.status === body.status);
          }
        };
      }).then(function () {
        return json({ ok: true });
      }).catch(function () {
        return json({ error: "Sipariş değiştirilemedi. Tekrar dene." }, 503);
      });
    }

    if (method === "DELETE") {
      return withDoc(function (doc) {
        doc.orders = doc.orders.filter(function (order) { return order.id !== body.id; });
        return {
          expect: function (fresh) {
            return !fresh.orders.some(function (order) { return order.id === body.id; });
          }
        };
      }).then(function () {
        return json({ ok: true });
      }).catch(function () {
        return json({ error: "Sipariş değiştirilemedi. Tekrar dene." }, 503);
      });
    }

    return withDoc(function () { return {}; }).then(function (out) {
      return json(ordersView(out.doc, url));
    }).catch(function () {
      return json({ error: "Siparişler yüklenemedi." }, 503);
    });
  };
})();
