/* 홈: 슬라이드 배너, 나눔 수치, 긴급 요청, 혈액 보유 대시보드, 새소식 */
(function () {
  /* ── 슬라이드 배너: 자동 넘김(6초) + 이전/다음/멈춤. 움직임 줄이기 설정이면 자동 넘김 없이 시작 ── */
  var slides = document.querySelectorAll(".slide");
  var countEl = document.getElementById("slide-count");
  var pauseBtn = document.getElementById("slide-pause");
  var current = 0;
  var timer = null;
  var reduce = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  var playing = !reduce;

  function show(i) {
    current = (i + slides.length) % slides.length;
    slides.forEach(function (s, idx) {
      s.classList.toggle("is-active", idx === current);
      s.setAttribute("aria-hidden", String(idx !== current));
    });
    countEl.innerHTML = "<b>" + pad2(current + 1) + "</b> / " + pad2(slides.length);
  }
  function stop() { clearInterval(timer); timer = null; }
  function start() { stop(); if (playing) timer = setInterval(function () { show(current + 1); }, 6000); }
  function updatePauseBtn() {
    pauseBtn.textContent = playing ? "❚❚" : "▶";
    pauseBtn.setAttribute("aria-label", playing ? "배너 자동 넘김 멈춤" : "배너 자동 넘김 재생");
  }

  document.getElementById("slide-prev").addEventListener("click", function () { show(current - 1); start(); });
  document.getElementById("slide-next").addEventListener("click", function () { show(current + 1); start(); });
  pauseBtn.addEventListener("click", function () { playing = !playing; updatePauseBtn(); start(); });
  show(0);
  updatePauseBtn();
  start();

  /* ── 나눔 수치 / 긴급 요청 / 혈액 보유 / 게시판 새 글: 전부 DB의 실제 데이터 (로그인 없이도 보인다) ── */
  var urgentEl = document.getElementById("urgent-list");
  var stockEl = document.getElementById("stock-dash");
  var newsEl = document.getElementById("notice-list");
  var EMPTY = function (text) { return '<div class="empty" style="grid-column:1/-1">' + escapeHtml(text) + "</div>"; };

  var unavailable = authUnavailableMessage();
  if (unavailable) {
    urgentEl.innerHTML = EMPTY(unavailable);
    stockEl.innerHTML = EMPTY(unavailable);
    newsEl.innerHTML = '<li class="empty">' + escapeHtml(unavailable) + "</li>";
    return;
  }

  dbListOpenRequests().then(function (requests) {
    var open = 0, done = 0, got = 0;
    requests.forEach(function (r) {
      var g = Math.min(r.got, r.need);
      got += g;
      if (g >= r.need) done++; else open++;
    });
    document.getElementById("hs-open").textContent = open;
    document.getElementById("hs-got").textContent = got;
    document.getElementById("hs-done").textContent = done;

    var urgent = requests.filter(function (r) { return r.urgent && r.got < r.need; })
      .sort(function (a, b) { return (a.need - a.got) - (b.need - b.got); })
      .slice(0, 3);
    urgentEl.innerHTML = urgent.length
      ? urgent.map(function (r) { return requestCardHtml(r, "link"); }).join("")
      : EMPTY("지금은 긴급 기부 요청이 없어요.");
  }).catch(function (err) { urgentEl.innerHTML = EMPTY(dbErrorText(err)); });

  dbLatestStock().then(function (stock) {
    renderStockDash(stockEl, stock);
  }).catch(function (err) { stockEl.innerHTML = EMPTY(dbErrorText(err)); });

  dbListPosts({ category: "", q: "", page: 1, size: 5 }).then(function (res) {
    newsEl.innerHTML = res.posts.length ? res.posts.map(function (p) {
      return '<li><span class="tag">' + escapeHtml(categoryLabel(p.category)) + '</span>' +
        '<a class="title" href="post.html?id=' + encodeURIComponent(p.id) + '">' + escapeHtml(p.title) + "</a>" +
        '<span class="date">' + toDateStr(new Date(p.createdAt)) + "</span></li>";
    }).join("") : '<li class="empty">아직 글이 없어요. <a href="write.html">첫 글을 남겨 보세요.</a></li>';
  }).catch(function (err) { newsEl.innerHTML = '<li class="empty">' + escapeHtml(dbErrorText(err)) + "</li>"; });
})();
