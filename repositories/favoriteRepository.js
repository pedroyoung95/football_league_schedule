(function () {
  "use strict";

  const storageKey = "footballScheduleFavorites";

  function readFavorites() {
    const rawFavorites = window.localStorage.getItem(storageKey);
    if (!rawFavorites) {
      return [];
    }

    try {
      const parsedFavorites = JSON.parse(rawFavorites);
      return Array.isArray(parsedFavorites) ? parsedFavorites : [];
    } catch (error) {
      console.error(error);
      return [];
    }
  }

  function saveFavorites(teamIds) {
    window.localStorage.setItem(storageKey, JSON.stringify(teamIds));
    return teamIds.slice();
  }

  window.favoriteRepository = {
    getFavorites: function () {
      return readFavorites();
    },
    saveFavorites: function (teamIds) {
      return saveFavorites(teamIds);
    }
  };
})();
