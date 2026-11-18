/* 게시글 보기 + 댓글: 누구나 읽을 수 있고, 글쓴이에게만 수정·삭제 버튼이 보인다.
   댓글은 회원만 쓰고, 쓴 사람만 고치고, 쓴 사람(또는 관리자)만 지운다 (진짜 권한 검사는 DB의 RLS) */
var postId = new URLSearchParams(location.search).get("id") || "";
var currentPost = null;
var comments = [];
var me = null;
var meIsAdmin = false;

var gateEl = document.getElementById("post-gate");
var boxEl = document.getElementById("post-box");
var ownerEl = document.getElementById("post-owner");
var commentsEl = document.getElementById("comments");
var commentListEl = document.getElementById("comment-list");
var commentGateEl = document.getElementById("comment-gate");
var commentForm = document.getElementById("comment-form");
var commentInput = document.getElementById("cm-content");
var commentBtn = document.getElementById("cm-submit");
var commentMsg = document.getElementById("cm-msg");

var BACK_LINK = '<p style="margin-top:1rem"><a class="btn btn-outline" href="board.html">목록으로</a></p>';

function showProblem(text) {
  gateEl.innerHTML = noticeHtml(text) + BACK_LINK;
}

function renderOwner() {
  var mine = currentPost && me && me.id === currentPost.userId;
  if (!currentPost || !(mine || meIsAdmin)) { ownerEl.innerHTML = ""; return; }
  ownerEl.innerHTML = (mine ? '<a class="btn btn-outline" href="write.html?id=' + encodeURIComponent(currentPost.id) + '">수정</a>' : "") +
    '<button type="button" class="btn" id="post-delete">삭제</button>';
}

function renderPost(post) {
  currentPost = post;
  document.title = post.title + " - 헌혈나눔";
  document.getElementById("post-cat").textContent = categoryLabel(post.category);
  document.getElementById("post-title").textContent = post.title;
  var edited = new Date(post.updatedAt) - new Date(post.createdAt) > 1000;
  document.getElementById("post-meta").textContent = post.author + " · " + toDateStr(new Date(post.createdAt)) +
    (edited ? " (수정 " + toDateStr(new Date(post.updatedAt)) + ")" : "");
  document.getElementById("post-body").textContent = post.content;   /* textContent: 글 내용의 HTML 은 실행되지 않는다 */
  boxEl.hidden = false;
}

/* ── 댓글 ── */
function commentTime(iso) {
  var d = new Date(iso);
  return toDateStr(d) + " " + pad2(d.getHours()) + ":" + pad2(d.getMinutes());
}
var editingId = null;   /* 지금 고치고 있는 댓글 id */
function renderComments() {
  document.getElementById("comment-count").textContent = comments.length;
  commentListEl.innerHTML = comments.length ? comments.map(function (c) {
    var mine = me && me.id === c.userId;
    var canDelete = me && (mine || meIsAdmin);
    var editing = mine && c.id === editingId;
    var tools = (mine && !editing ? '<button type="button" class="comment-tool" data-edit="' + c.id + '">수정</button>' : "") +
      (canDelete && !editing ? '<button type="button" class="comment-tool" data-del="' + c.id + '">삭제</button>' : "");
    var body = editing
      ? '<div class="comment-edit"><textarea maxlength="1000" rows="3" aria-label="댓글 수정">' + escapeHtml(c.content) + "</textarea>" +
        '<div class="comment-edit-actions"><button type="button" class="btn btn-small" data-save="' + c.id + '">저장</button>' +
        '<button type="button" class="btn btn-outline btn-small" data-cancel-edit>취소</button></div>' +
        '<p class="form-msg error comment-edit-msg" role="alert"></p></div>'
      : '<div class="comment-body">' + escapeHtml(c.content) + "</div>";
    return '<li class="comment"><div class="comment-head"><strong>' + escapeHtml(c.author) + "</strong>" +
      (currentPost && c.userId === currentPost.userId ? '<span class="badge">글쓴이</span>' : "") +
      '<span class="comment-date">' + commentTime(c.createdAt) + (c.updatedAt ? " (수정됨)" : "") + "</span>" +
      (tools ? '<span class="comment-tools">' + tools + "</span>" : "") + "</div>" + body + "</li>";
  }).join("") : '<li class="empty">아직 댓글이 없어요. 첫 댓글을 남겨 보세요.</li>';
  var box = commentListEl.querySelector(".comment-edit textarea");
  if (box) { box.focus(); box.setSelectionRange(box.value.length, box.value.length); }
}
function renderCommentForm() {
  commentGateEl.innerHTML = me ? "" : loginNoticeHtml("댓글을 쓰려면");
  commentForm.hidden = !me;
}

function loadPost() {
  boxEl.hidden = true;
  commentsEl.hidden = true;
  currentPost = null;
  gateEl.innerHTML = "";
  if (!postId) { showProblem("잘못된 주소예요."); return; }
  var unavailable = authUnavailableMessage();
  if (unavailable) { showProblem(unavailable); return; }

  Promise.all([dbGetPost(postId), currentUser()]).then(function (res) {
    if (!res[0]) { showProblem("글을 찾을 수 없어요. 삭제됐거나 주소가 잘못됐어요."); return; }
    me = res[1];
    renderPost(res[0]);
    return Promise.all([dbListComments(postId), me ? dbIsAdmin() : false]).then(function (more) {
      comments = more[0];
      meIsAdmin = more[1];
      renderOwner();
      renderComments();
      renderCommentForm();
      commentsEl.hidden = false;
    });
  }).catch(function (err) {
    showProblem(dbErrorText(err));
  });
}

ownerEl.addEventListener("click", function (e) {
  var btn = e.target.closest("#post-delete");
  if (!btn || !confirm("이 글을 삭제할까요? 댓글도 함께 지워지고 되돌릴 수 없어요.")) return;
  btn.disabled = true;
  dbDeletePost(currentPost.id).then(function () {
    location.href = "board.html";
  }).catch(function (err) {
    btn.disabled = false;
    showToast(dbErrorText(err));
  });
});

commentForm.addEventListener("submit", function (e) {
  e.preventDefault();
  if (!me) return;
  var content = commentInput.value.trim();
  commentMsg.textContent = "";
  if (!content) { commentMsg.textContent = "댓글 내용을 입력해 주세요."; commentInput.focus(); return; }
  if (content.length > 1000) { commentMsg.textContent = "댓글은 1000자 이내로 써 주세요."; return; }
  commentBtn.disabled = true;
  dbAddComment(postId, content).then(function (c) {
    comments.push(c);
    commentInput.value = "";
    renderComments();
  }).catch(function (err) {
    commentMsg.textContent = dbErrorText(err);
  }).then(function () {
    commentBtn.disabled = false;
  });
});

commentListEl.addEventListener("click", function (e) {
  var edit = e.target.closest("[data-edit]");
  if (edit) { editingId = edit.getAttribute("data-edit"); renderComments(); return; }
  if (e.target.closest("[data-cancel-edit]")) { editingId = null; renderComments(); return; }

  var save = e.target.closest("[data-save]");
  if (save) {
    var li = save.closest(".comment");
    var content = li.querySelector("textarea").value.trim();
    var msg = li.querySelector(".comment-edit-msg");
    if (!content) { msg.textContent = "댓글 내용을 입력해 주세요."; return; }
    if (content.length > 1000) { msg.textContent = "댓글은 1000자 이내로 써 주세요."; return; }
    save.disabled = true;
    dbUpdateComment(save.getAttribute("data-save"), content).then(function (updated) {
      comments = comments.map(function (c) { return c.id === updated.id ? updated : c; });
      editingId = null;
      renderComments();
    }).catch(function (err) {
      save.disabled = false;
      msg.textContent = dbErrorText(err);
    });
    return;
  }

  var btn = e.target.closest("[data-del]");
  if (!btn || !confirm("이 댓글을 삭제할까요?")) return;
  var id = btn.getAttribute("data-del");
  btn.disabled = true;
  dbDeleteComment(id).then(function () {
    comments = comments.filter(function (c) { return c.id !== id; });
    renderComments();
  }).catch(function (err) {
    btn.disabled = false;
    showToast(dbErrorText(err));
  });
});

document.addEventListener("hn:signout", function () {
  me = null;
  editingId = null;
  meIsAdmin = false;
  renderOwner();
  renderComments();
  renderCommentForm();
});
loadPost();
