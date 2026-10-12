var BGM_VIDEO_ID = "gdZLi9oWNZg"; /* BTS - Dynamite Official MV (공식 채널) */
var bgmDesiredOn = true;
var bgmPlayer = null;
var bgmReady = false;
var bgmToggleBtn = document.getElementById("bgm-toggle");

function updateBgmButton() {
  if (!bgmToggleBtn) return;
  bgmToggleBtn.textContent = bgmDesiredOn ? "🔊 배경음악 끄기" : "🔇 배경음악 켜기";
  bgmToggleBtn.setAttribute("aria-pressed", String(bgmDesiredOn));
}

/* YouTube iframe API가 로드되면 자동으로 호출되는 전역 함수 */
function onYouTubeIframeAPIReady() {
  bgmPlayer = new YT.Player("bgm-player", {
    height: "1",
    width: "1",
    videoId: BGM_VIDEO_ID,
    playerVars: {
      autoplay: 1,
      controls: 0,
      disablekb: 1,
      fs: 0,
      modestbranding: 1,
      playsinline: 1,
      loop: 1,
      playlist: BGM_VIDEO_ID
    },
    events: {
      onReady: function (e) {
        bgmReady = true;
        if (bgmDesiredOn) e.target.playVideo();
      }
    }
  });
}

if (bgmToggleBtn) {
  bgmToggleBtn.addEventListener("click", function () {
    bgmDesiredOn = !bgmDesiredOn;
    if (bgmReady) {
      if (bgmDesiredOn) bgmPlayer.playVideo();
      else bgmPlayer.pauseVideo();
    }
    updateBgmButton();
  });
}

/* 브라우저 자동재생 정책으로 막힐 경우, 첫 클릭/키입력 시 재생 시도 */
["click", "keydown", "touchstart"].forEach(function (evt) {
  document.addEventListener(evt, function tryStartBgm() {
    if (bgmReady && bgmDesiredOn && typeof bgmPlayer.getPlayerState === "function" && bgmPlayer.getPlayerState() !== 1) {
      bgmPlayer.playVideo();
    }
  }, { once: true });
});

updateBgmButton();
