(function () {
  "use strict";

  const apiBaseUrl = "https://site.api.espn.com/apis/site/v2/sports/soccer";

  async function getJson(path) {
    try {
      const response = await fetch(`${apiBaseUrl}/${path}`);
      if (!response.ok) {
        throw new Error(`API 요청 실패: ${response.status}`);
      }
      return await response.json();
    } catch (error) {
      console.error(error);
      throw new Error("인터넷 경기 일정을 가져오지 못했습니다.");
    }
  }

  window.footballApiRepository = {
    fetchTeamsByLeague: async function (leagueSlug) {
      try {
        const data = await getJson(`${encodeURIComponent(leagueSlug)}/teams`);
        return data.sports?.[0]?.leagues?.[0]?.teams || data.teams || [];
      } catch (error) {
        console.error(error);
        throw error;
      }
    },

    fetchScoreboardByMonth: async function (leagueSlug, dateRange) {
      try {
        const params = new URLSearchParams({
          limit: "200",
          dates: dateRange,
          league: leagueSlug
        });
        const data = await getJson(`${encodeURIComponent(leagueSlug)}/scoreboard?${params.toString()}`);
        return Array.isArray(data.events) ? data.events : [];
      } catch (error) {
        console.error(error);
        throw error;
      }
    }
  };
})();
