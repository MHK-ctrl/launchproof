(function () {
  var search = document.getElementById('search');
  var noResults = document.getElementById('no-results');
  var filters = Array.prototype.slice.call(document.querySelectorAll('.filter'));
  var cards = Array.prototype.slice.call(document.querySelectorAll('.finding'));
  var active = 'all';
  function apply() {
    var query = (search && search.value ? search.value : '').toLowerCase().trim();
    var visible = 0;
    cards.forEach(function (card) {
      var matchesSeverity = active === 'all' || card.getAttribute('data-severity') === active;
      var haystack = card.getAttribute('data-search') || '';
      var matchesQuery = query.length === 0 || haystack.indexOf(query) !== -1;
      var show = matchesSeverity && matchesQuery;
      card.hidden = !show;
      if (show) visible++;
    });
    if (noResults) noResults.hidden = visible !== 0 || cards.length === 0;
  }
  filters.forEach(function (button) {
    button.addEventListener('click', function () {
      active = button.getAttribute('data-filter') || 'all';
      filters.forEach(function (other) {
        other.setAttribute('aria-pressed', String(other === button));
      });
      apply();
    });
  });
  if (search) search.addEventListener('input', apply);
})();
