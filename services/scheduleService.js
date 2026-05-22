(function () {
  "use strict";

  const leagues = [
    {
      id: "eng.1",
      name: "eng.1",
      label: "프리미어리그",
      country: "England",
      displayName: "English Premier League",
      cupCompetitions: [
        { id: "eng.fa", name: "eng.fa", label: "FA컵" },
        { id: "eng.league_cup", name: "eng.league_cup", label: "카라바오컵" }
      ]
    },
    {
      id: "esp.1",
      name: "esp.1",
      label: "라리가",
      country: "Spain",
      displayName: "Spanish La Liga",
      cupCompetitions: [
        { id: "esp.copa_del_rey", name: "esp.copa_del_rey", label: "코파 델 레이" }
      ]
    },
    {
      id: "ger.1",
      name: "ger.1",
      label: "분데스리가",
      country: "Germany",
      displayName: "German Bundesliga",
      cupCompetitions: [
        { id: "ger.dfb_pokal", name: "ger.dfb_pokal", label: "DFB 포칼" }
      ]
    },
    {
      id: "fra.1",
      name: "fra.1",
      label: "리그1",
      country: "France",
      displayName: "French Ligue 1",
      cupCompetitions: [
        { id: "fra.coupe_de_france", name: "fra.coupe_de_france", label: "쿠프 드 프랑스" }
      ]
    },
    {
      id: "ita.1",
      name: "ita.1",
      label: "세리에A",
      country: "Italy",
      displayName: "Italian Serie A",
      cupCompetitions: [
        { id: "ita.coppa_italia", name: "ita.coppa_italia", label: "코파 이탈리아" }
      ]
    },
    {
      id: "tur.1",
      name: "tur.1",
      label: "터키 쉬페르리그",
      country: "Turkey",
      displayName: "Turkish Super Lig",
      cupCompetitions: []
    }
  ];

  const sharedCompetitions = [
    { id: "uefa.champions", name: "uefa.champions", label: "UEFA 챔피언스리그" },
    { id: "uefa.europa", name: "uefa.europa", label: "UEFA 유로파리그" },
    { id: "uefa.europa.conf", name: "uefa.europa.conf", label: "UEFA 컨퍼런스리그" },
    { id: "club.friendly", name: "club.friendly", label: "클럽 친선경기" }
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

  function normalizeEvent(apiEvent, competition, teamIdByEspnId) {
    const eventCompetition = apiEvent.competitions?.[0] || {};
    const competitors = eventCompetition.competitors || [];
    const home = competitors.find(function (competitor) {
      return competitor.homeAway === "home";
    }) || competitors[0] || {};
    const away = competitors.find(function (competitor) {
      return competitor.homeAway === "away";
    }) || competitors[1] || {};
    const status = eventCompetition.status?.type || apiEvent.status?.type || {};
    const homeTeam = home.team || {};
    const awayTeam = away.team || {};
    const homeEspnId = String(homeTeam.id || home.id || "");
    const awayEspnId = String(awayTeam.id || away.id || "");

    return {
      id: `${competition.id}:${apiEvent.id}`,
      date: formatLocalDateKey(apiEvent.date),
      time: formatLocalTime(apiEvent.date),
      competitionId: competition.id,
      competitionName: competition.label,
      leagueId: competition.parentLeagueId || competition.id,
      leagueName: competition.parentLeagueLabel || competition.label,
      homeTeamId: teamIdByEspnId.get(homeEspnId) || `${competition.id}:${homeEspnId}`,
      awayTeamId: teamIdByEspnId.get(awayEspnId) || `${competition.id}:${awayEspnId}`,
      homeEspnId: homeEspnId,
      awayEspnId: awayEspnId,
      homeTeam: homeTeam.displayName || homeTeam.name || apiEvent.name || "",
      awayTeam: awayTeam.displayName || awayTeam.name || "",
      venue: eventCompetition.venue?.fullName || apiEvent.venue?.displayName || "",
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

  function sortEvents(events) {
    return events.slice().sort(function (first, second) {
      return `${first.date}T${first.time || "00:00"}`.localeCompare(`${second.date}T${second.time || "00:00"}`);
    });
  }

  function getSelectedLeagues(selectedLeagueIds) {
    return leagues.filter(function (league) {
      return selectedLeagueIds.includes(league.id);
    });
  }

  function getCompetitionsForLeagues(selectedLeagueIds) {
    const selectedLeagues = getSelectedLeagues(selectedLeagueIds);
    const domesticCompetitions = selectedLeagues.flatMap(function (league) {
      return [
        {
          id: league.id,
          name: league.name,
          label: league.label,
          parentLeagueId: league.id,
          parentLeagueLabel: league.label
        }
      ].concat(league.cupCompetitions.map(function (cupCompetition) {
        return {
          id: cupCompetition.id,
          name: cupCompetition.name,
          label: cupCompetition.label,
          parentLeagueId: league.id,
          parentLeagueLabel: league.label
        };
      }));
    });
    return uniqueById(domesticCompetitions.concat(sharedCompetitions));
  }

  function getDomesticLeagueCompetitions(selectedLeagueIds) {
    return getSelectedLeagues(selectedLeagueIds).map(function (league) {
      return {
        id: league.id,
        name: league.name,
        label: league.label,
        parentLeagueId: league.id,
        parentLeagueLabel: league.label
      };
    });
  }

  function getTeamIdByEspnId(teams) {
    const map = new Map();
    teams.forEach(function (team) {
      map.set(String(team.espnId), team.id);
    });
    return map;
  }

  function eventIncludesSelectedTeam(event, teamIdByEspnId) {
    return teamIdByEspnId.has(event.homeEspnId) || teamIdByEspnId.has(event.awayEspnId);
  }

  function deriveTeamsFromEvents(events, selectedLeagues) {
    const selectedLeagueIds = new Set(selectedLeagues.map(function (league) {
      return league.id;
    }));
    const teams = [];
    events.forEach(function (event) {
      if (!selectedLeagueIds.has(event.competitionId)) {
        return;
      }
      teams.push({
        id: event.homeTeamId,
        espnId: event.homeEspnId,
        name: event.homeTeam,
        shortName: event.homeTeam,
        badge: event.homeEspnId ? `https://a.espncdn.com/i/teamlogos/soccer/500/${event.homeEspnId}.png` : "",
        leagueId: event.competitionId,
        leagueName: getLeagueLabel(event.competitionId),
        country: ""
      });
      teams.push({
        id: event.awayTeamId,
        espnId: event.awayEspnId,
        name: event.awayTeam,
        shortName: event.awayTeam,
        badge: event.awayEspnId ? `https://a.espncdn.com/i/teamlogos/soccer/500/${event.awayEspnId}.png` : "",
        leagueId: event.competitionId,
        leagueName: getLeagueLabel(event.competitionId),
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

  async function fetchTeamsForLeagues(selectedLeagueIds) {
    try {
      const selectedLeagues = getSelectedLeagues(selectedLeagueIds);
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

  async function fetchEventsForCompetitionList(competitions, visibleDate, teamIdByEspnId) {
    try {
      const dateRange = getMonthRange(visibleDate);
      const eventGroups = await Promise.all(competitions.map(async function (competition) {
        try {
          const events = await window.footballApiRepository.fetchScoreboardByMonth(competition.name, dateRange);
          return events.map(function (event) {
            return normalizeEvent(event, competition, teamIdByEspnId);
          });
        } catch (error) {
          console.error(error);
          return [];
        }
      }));
      return sortEvents(uniqueById(eventGroups.flat()));
    } catch (error) {
      console.error(error);
      throw new Error("경기 일정을 불러오지 못했습니다.");
    }
  }

  async function fetchEventsForCompetitions(selectedLeagueIds, visibleDate, teams) {
    try {
      const teamIdByEspnId = getTeamIdByEspnId(teams);
      const competitions = getCompetitionsForLeagues(selectedLeagueIds);
      const normalizedEvents = await fetchEventsForCompetitionList(competitions, visibleDate, teamIdByEspnId);
      const teamEvents = normalizedEvents.filter(function (event) {
        return eventIncludesSelectedTeam(event, teamIdByEspnId);
      });
      return sortEvents(teamEvents);
    } catch (error) {
      console.error(error);
      throw new Error("경기 일정을 불러오지 못했습니다.");
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
        const selectedLeagues = getSelectedLeagues(selectedLeagueIds);
        const leagueTeams = await fetchTeamsForLeagues(selectedLeagueIds);
        const domesticCompetitions = getDomesticLeagueCompetitions(selectedLeagueIds);
        const domesticEvents = await fetchEventsForCompetitionList(domesticCompetitions, visibleDate, new Map());
        const fallbackTeams = deriveTeamsFromEvents(domesticEvents, selectedLeagues);
        const teams = mergeTeams(leagueTeams, fallbackTeams);
        const events = await fetchEventsForCompetitions(selectedLeagueIds, visibleDate, teams);
        return {
          teams: teams,
          events: events,
          source: "ESPN"
        };
      } catch (error) {
        console.error(error);
        throw error;
      }
    },

    loadMonthEvents: async function (selectedLeagueIds, visibleDate, teams) {
      try {
        return await fetchEventsForCompetitions(selectedLeagueIds, visibleDate, teams);
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
