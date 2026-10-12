var DEFAULT_MAP_QUERY = "장안대학교 정보통신관";
var DEFAULT_LOCATION_LABEL = "경기도 화성시 봉담읍 장안대학교 정보통신관";
var mapIframe = document.getElementById("map-iframe");
var searchForm = document.getElementById("map-search-form");
var searchInput = document.getElementById("map-search-input");
var resetBtn = document.getElementById("map-reset-btn");
var locationText = document.getElementById("map-location-text");

function showOnMap(query, label) {
  mapIframe.src = "https://maps.google.com/maps?q=" + encodeURIComponent(query) + "&output=embed";
  locationText.textContent = label;
}

searchForm.addEventListener("submit", function (e) {
  e.preventDefault();
  var query = searchInput.value.trim();
  if (query) showOnMap(query, query);
});

resetBtn.addEventListener("click", function () {
  searchInput.value = "";
  showOnMap(DEFAULT_MAP_QUERY, DEFAULT_LOCATION_LABEL);
});
