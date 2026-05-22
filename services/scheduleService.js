(function () {
  "use strict";

  const leagues = [
    { id: "eng.1", name: "eng.1", label: "프리미어리그", country: "England", displayName: "English Premier League" },
    { id: "esp.1", name: "esp.1", label: "라리가", country: "Spain", displayName: "Spanish La Liga" },
    { id: "ger.1", name: "ger.1", label: "분데스리가", country: "Germany", displayName: "German Bundesliga" },
    { id: "fra.1", name: "fra.1", label: "리그1", country: "France", displayName: "French Ligue 1" },
    { id: "ita.1", name: "ita.1", label: "세리에A", country: "Italy", displayName: "Italian Serie A" },
    { id: "tur.1", name: "tur.1", label: "터키 쉬페르리그", country: "Turkey", displayName: "Turkish Super Lig" }
  ];

  function getLeagueLabel(leagueId) {
    const league = leagues.find(function (item) {
      return item.id === leagueId;
    });
    return league ? league.label : leagueId;
  }

  function getMonthRange(date) {
    const year = date.getFullYear();
    const month = date.getMonth();
    const firstDate = new Date(year, month, 1);
    const lastDate = new Date(year, month + 1, 0);
    return `${formatEspnDate(firstDate)}-${formatEspnDate(lastDate)}`;
  }

  function formatEspnDate(date) {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const day = String(date.getDate()).padStart(2, "0");
    return `${year}${month}${day}`;
  }

  function formatLocalDateKey(isoDate) {
    const date = new Date(isoDate);
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const day = String(date.getDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
  }

  function formatLocalTime(isoDate) {
    const date = new Date(isoDate);
    return new Intl.DateTimeFormat("ko-KR", {
      hour: "2-digit",
      minute: "2-digit",
      hour12: false
    }).format(date);
  }

  function normalizeTeam(apiTeamWrapper, league) {
    const apiTeam = apiTeamWrapper.team || apiTeamWrapper;
    const logo = apiTeam.logos?.[0]?.href || apiTeam.logo || "";
    return {
      id: `${league.id}:${apiTeam.id}`,
      espnId: apiTeam.id,
      name: apiTeam.displayName || apiTeam.name || apiTeam.shortDisplayName,
      shortName: apiTeam.shortDisplayName || apiTeam.name || apiTeam.displayName,
      badge: logo,
      leagueId: league.id,
      leagueName: league.label,
      country: league.country
    };
  }

  function normalizeEvent(apiEvent, league) {
    const competition = apiEvent.competitions?.[0] || {};
    const competitors = competition.competitors || [];
    const home = competitors.find(function (competitor) {
      return competitor.homeAway === "home";
    }) || competitors[0] || {};
    const away = competitors.find(function (competitor) {
      return competitor.homeAway === "away";
    }) || competitors[1] || {};
    const status = competition.status?.type || apiEvent.status?.type || {};
    const homeTeam = home.team || {};
    const awayTeam = away.team || {};

    return {
      id: `${league.id}:${apiEvent.id}`,
      date: formatLocalDateKey(apiEvent.date),
      time: formatLocalTime(apiEvent.date),
      leagueId: league.id,
      leagueName: league.label,
      homeTeamId: `${league.id}:${homeTeam.id || home.id || ""}`,
      awayTeamId: `${league.id}:${awayTeam.id || away.id || ""}`,
      homeTeam: homeTeam.displayName || homeTeam.name || apiEvent.name || "",
      awayTeam: awayTeam.displayName || awayTeam.name || "",
      venue: competition.venue?.fullName || apiEvent.venue?.displayName || "",
      status: status.shortDetail || status.description || "",
      score: home.score && away.score ? `${home.score} - ${away.score}` : "",
      source: "ESPN"
    };
  }

  function uniqueById(items) {
    const map = new Map();
    items.forEach(function (item) {
      if (item.id) {
        map.set(item.id, item);
      }
    });
    return Array.from(map.values());
  }

  function deriveTeamsFromEvents(events) {
    const teams = [];
    events.forEach(function (event) {
      const homeEspnId = event.homeTeamId.split(":")[1];
      const awayEspnId = event.awayTeamId.split(":")[1];
      teams.push({
        id: event.homeTeamId,
        espnId: homeEspnId,
        name: event.homeTeam,
        shortName: event.homeTeam,
        badge: homeEspnId ? `https://a.espncdn.com/i/teamlogos/soccer/500/${homeEspnId}.png` : "",
        leagueId: event.leagueId,
        leagueName: getLeagueLabel(event.leagueId),
        country: ""
      });
      teams.push({
        id: event.awayTeamId,
        espnId: awayEspnId,
        name: event.awayTeam,
        shortName: event.awayTeam,
        badge: awayEspnId ? `https://a.espncdn.com/i/teamlogos/soccer/500/${awayEspnId}.png` : "",
        leagueId: event.leagueId,
        leagueName: getLeagueLabel(event.leagueId),
        country: ""
      });
    });
    return uniqueById(teams).filter(function (team) {
      return team.id && team.name;
    });
  }

  function mergeTeams(apiTeams, eventTeams) {
    return uniqueById(apiTeams.concat(eventTeams)).sort(function (first, second) {
      return first.name.localeCompare(second.name);
    });
  }

  function sortEvents(events) {
    return events.slice().sort(function (first, second) {
      return `${first.date}T${first.time || "00:00"}`.localeCompare(`${second.date}T${second.time || "00:00"}`);
    });
  }

  async function fetchTeamsForLeagues(selectedLeagueIds) {
    try {
      const selectedLeagues = leagues.filter(function (league) {
        return selectedLeagueIds.includes(league.id);
      });
      const teamGroups = await Promise.all(selectedLeagues.map(async function (league) {
        try {
          const teams = await window.footballApiRepository.fetchTeamsByLeague(league.name);
          return teams.map(function (team) {
            return normalizeTeam(team, league);
          });
        } catch (error) {
          console.error(error);
          return [];
        }
      }));
      return teamGroups.flat().sort(function (first, second) {
        return first.name.localeCompare(second.name);
      });
    } catch (error) {
      console.error(error);
      throw new Error("팀 목록을 불러오지 못했습니다.");
    }
  }

  async function fetchEventsForLeagues(selectedLeagueIds, visibleDate) {
    try {
      const dateRange = getMonthRange(visibleDate);
      const selectedLeagues = leagues.filter(function (league) {
        return selectedLeagueIds.includes(league.id);
      });
      const eventGroups = await Promise.all(selectedLeagues.map(async function (league) {
        try {
          const events = await window.footballApiRepository.fetchScoreboardByMonth(league.name, dateRange);
          return events.map(function (event) {
            return normalizeEvent(event, league);
          });
        } catch (error) {
          console.error(error);
          return [];
        }
      }));
      return sortEvents(uniqueById(eventGroups.flat()));
    } catch (error) {
      console.error(error);
      throw new Error("리그 경기 일정을 불러오지 못했습니다.");
    }
  }

  window.scheduleService = {
    getLeagues: function () {
      return leagues.slice();
    },

    getFavoriteTeamIds: function () {
      return window.favoriteRepository.getFavorites();
    },

    saveFavoriteTeamIds: function (teamIds) {
      return window.favoriteRepository.saveFavorites(teamIds);
    },

    loadLeagueData: async function (selectedLeagueIds, visibleDate) {
      try {
        const results = await Promise.all([
          fetchTeamsForLeagues(selectedLeagueIds),
          fetchEventsForLeagues(selectedLeagueIds, visibleDate)
        ]);
        const eventTeams = deriveTeamsFromEvents(results[1]);
        return {
          teams: mergeTeams(results[0], eventTeams),
          events: results[1],
          source: "ESPN"
        };
      } catch (error) {
        console.error(error);
        throw error;
      }
    },

    loadMonthEvents: async function (selectedLeagueIds, visibleDate) {
      try {
        return await fetchEventsForLeagues(selectedLeagueIds, visibleDate);
      } catch (error) {
        console.error(error);
        throw error;
      }
    },

    getLeagueLabel: function (leagueId) {
      return getLeagueLabel(leagueId);
    }
  };
})();
