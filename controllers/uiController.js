(function () {
  "use strict";

  const today = new Date();
  const state = {
    leagues: window.scheduleService.getLeagues(),
    selectedLeagueIds: window.scheduleService.getLeagues().map(function (league) {
      return league.id;
    }),
    teams: [],
    events: [],
    favoriteTeamIds: window.scheduleService.getFavoriteTeamIds(),
    selectedTeamId: "all",
    showFavoritesOnly: false,
    selectedDate: formatDateKey(today),
    visibleDate: new Date(today.getFullYear(), today.getMonth(), 1),
    searchText: "",
    isLoading: false,
    statusText: "",
    toastTimer: null
  };

  const elements = {
    leagueFilter: document.getElementById("leagueFilter"),
    allTeamsButton: document.getElementById("allTeamsButton"),
    favoritesOnlyButton: document.getElementById("favoritesOnlyButton"),
    teamSearchInput: document.getElementById("teamSearchInput"),
    teamList: document.getElementById("teamList"),
    refreshButton: document.getElementById("refreshButton"),
    prevMonthButton: document.getElementById("prevMonthButton"),
    nextMonthButton: document.getElementById("nextMonthButton"),
    calendarTitle: document.getElementById("calendarTitle"),
    calendarGrid: document.getElementById("calendarGrid"),
    matchListTitle: document.getElementById("matchListTitle"),
    matchList: document.getElementById("matchList"),
    summaryStrip: document.getElementById("summaryStrip"),
    statusBanner: document.getElementById("statusBanner"),
    toast: document.getElementById("toast")
  };

  function formatDateKey(date) {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const day = String(date.getDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
  }

  function getKoreanDateLabel(dateKey) {
    const date = new Date(`${dateKey}T00:00:00`);
    return new Intl.DateTimeFormat("ko-KR", {
      year: "numeric",
      month: "long",
      day: "numeric",
      weekday: "short"
    }).format(date);
  }

  function getSelectedTeamIds() {
    if (state.showFavoritesOnly) {
      return state.favoriteTeamIds.slice();
    }
    if (state.selectedTeamId !== "all") {
      return [state.selectedTeamId];
    }
    return state.teams.map(function (team) {
      return team.id;
    });
  }

  function eventMatchesCurrentScope(event) {
    const selectedTeamIds = getSelectedTeamIds();
    const selectedTeamSet = new Set(selectedTeamIds);
    return selectedTeamSet.has(event.homeTeamId) || selectedTeamSet.has(event.awayTeamId);
  }

  function getVisibleEvents() {
    return state.events.filter(eventMatchesCurrentScope);
  }

  function getMonthEvents() {
    const year = state.visibleDate.getFullYear();
    const month = state.visibleDate.getMonth();
    return getVisibleEvents().filter(function (event) {
      const eventDate = new Date(`${event.date}T00:00:00`);
      return eventDate.getFullYear() === year && eventDate.getMonth() === month;
    });
  }

  function getSelectedDateEvents() {
    return getVisibleEvents().filter(function (event) {
      return event.date === state.selectedDate;
    });
  }

  function moveToNearestEventDate() {
    const events = getVisibleEvents();
    if (!events.length) {
      return;
    }
    const todayKey = formatDateKey(new Date());
    const upcomingEvent = events.find(function (event) {
      return event.date >= todayKey;
    });
    const targetEvent = upcomingEvent || events[events.length - 1];
    const targetDate = new Date(`${targetEvent.date}T00:00:00`);
    state.selectedDate = targetEvent.date;
    state.visibleDate = new Date(targetDate.getFullYear(), targetDate.getMonth(), 1);
  }

  function selectFirstEventInVisibleMonth() {
    const monthEvents = getMonthEvents();
    if (!monthEvents.length) {
      return;
    }
    state.selectedDate = monthEvents[0].date;
  }

  function groupEventsByDate(events) {
    return events.reduce(function (grouped, event) {
      grouped[event.date] = grouped[event.date] || [];
      grouped[event.date].push(event);
      return grouped;
    }, {});
  }

  function getEventTypeClass(event) {
    if (event.eventType === "cup") {
      return "is-cup";
    }
    if (event.eventType === "europe") {
      return "is-europe";
    }
    if (event.eventType === "friendly") {
      return "is-friendly";
    }
    return "is-league";
  }

  function showToast(message) {
    elements.toast.textContent = message;
    elements.toast.classList.add("is-visible");
    window.clearTimeout(state.toastTimer);
    state.toastTimer = window.setTimeout(function () {
      elements.toast.classList.remove("is-visible");
    }, 2400);
  }

  function setStatus(message) {
    state.statusText = message;
    elements.statusBanner.textContent = message;
    elements.statusBanner.hidden = !message;
  }

  function renderLeagues() {
    elements.leagueFilter.innerHTML = "";
    const allLabel = document.createElement("label");
    const allCheckbox = document.createElement("input");
    const allText = document.createElement("span");
    const allSelected = state.selectedLeagueIds.length === state.leagues.length;

    allLabel.className = "league-toggle league-toggle-all";
    allCheckbox.type = "checkbox";
    allCheckbox.value = "__all_leagues";
    allCheckbox.checked = allSelected;
    allCheckbox.indeterminate = state.selectedLeagueIds.length > 0 && !allSelected;
    allText.textContent = "전체 리그";

    allLabel.append(allCheckbox, allText);
    elements.leagueFilter.appendChild(allLabel);

    state.leagues.forEach(function (league) {
      const label = document.createElement("label");
      const checkbox = document.createElement("input");
      const text = document.createElement("span");

      label.className = "league-toggle";
      checkbox.type = "checkbox";
      checkbox.value = league.id;
      checkbox.checked = state.selectedLeagueIds.includes(league.id);
      text.textContent = league.label;

      label.append(checkbox, text);
      elements.leagueFilter.appendChild(label);
    });
  }

  function renderTeamList() {
    const query = state.searchText.toLowerCase();
    const filteredTeams = state.teams.filter(function (team) {
      const leagueSelected = state.selectedLeagueIds.includes(team.leagueId);
      const favoriteSelected = !state.showFavoritesOnly || state.favoriteTeamIds.includes(team.id);
      const queryMatches = !query || team.name.toLowerCase().includes(query) || team.leagueName.toLowerCase().includes(query);
      return leagueSelected && favoriteSelected && queryMatches;
    });

    elements.teamList.innerHTML = "";
    elements.allTeamsButton.classList.toggle("is-active", !state.showFavoritesOnly && state.selectedTeamId === "all");
    elements.favoritesOnlyButton.classList.toggle("is-active", state.showFavoritesOnly);

    const allButton = document.createElement("button");
    allButton.className = `team-row ${state.selectedTeamId === "all" && !state.showFavoritesOnly ? "is-selected" : ""}`;
    allButton.type = "button";
    allButton.dataset.teamId = "all";
    allButton.textContent = state.showFavoritesOnly ? "즐겨찾기 전체 일정" : "선택 리그 전체 일정";
    elements.teamList.appendChild(allButton);

    if (!filteredTeams.length) {
      const empty = document.createElement("div");
      empty.className = "empty-state";
      empty.textContent = "조건에 맞는 팀이 없습니다.";
      elements.teamList.appendChild(empty);
      return;
    }

    filteredTeams.forEach(function (team) {
      const row = document.createElement("div");
      const teamButton = document.createElement("button");
      const badge = document.createElement("img");
      const info = document.createElement("span");
      const name = document.createElement("strong");
      const league = document.createElement("small");
      const favoriteButton = document.createElement("button");
      const isFavorite = state.favoriteTeamIds.includes(team.id);

      row.className = `team-item ${state.selectedTeamId === team.id && !state.showFavoritesOnly ? "is-selected" : ""}`;
      teamButton.className = "team-button";
      teamButton.type = "button";
      teamButton.dataset.teamId = team.id;
      badge.className = "team-badge";
      badge.alt = "";
      badge.loading = "lazy";
      badge.src = team.badge || "";
      name.textContent = team.name;
      league.textContent = team.leagueName;
      favoriteButton.className = `favorite-button ${isFavorite ? "is-favorite" : ""}`;
      favoriteButton.type = "button";
      favoriteButton.dataset.favoriteId = team.id;
      favoriteButton.title = isFavorite ? "즐겨찾기 해제" : "즐겨찾기 추가";
      favoriteButton.setAttribute("aria-label", favoriteButton.title);
      favoriteButton.textContent = isFavorite ? "★" : "☆";

      info.append(name, league);
      teamButton.append(badge, info);
      row.append(teamButton, favoriteButton);
      elements.teamList.appendChild(row);
    });
  }

  function renderSummary() {
    const monthEvents = getMonthEvents();
    const selectedDateEvents = getSelectedDateEvents();
    const favoriteCount = state.favoriteTeamIds.length;
    const sourceText = "ESPN 일정";

    elements.summaryStrip.innerHTML = "";
    [
      { label: "이번 달 경기", value: monthEvents.length },
      { label: "선택한 날짜 경기", value: selectedDateEvents.length },
      { label: `${sourceText} · 즐겨찾기 ${favoriteCount}팀`, value: state.teams.length }
    ].forEach(function (item) {
      const node = document.createElement("div");
      const value = document.createElement("strong");
      const label = document.createElement("span");
      node.className = "summary-item";
      value.textContent = item.value;
      label.textContent = item.label;
      node.append(value, label);
      elements.summaryStrip.appendChild(node);
    });
  }

  function renderCalendar() {
    const year = state.visibleDate.getFullYear();
    const month = state.visibleDate.getMonth();
    const firstDay = new Date(year, month, 1);
    const startDate = new Date(year, month, 1 - firstDay.getDay());
    const groupedEvents = groupEventsByDate(getVisibleEvents());
    const todayKey = formatDateKey(new Date());

    elements.calendarTitle.textContent = `${year}년 ${month + 1}월`;
    elements.calendarGrid.innerHTML = "";

    for (let index = 0; index < 42; index += 1) {
      const cellDate = new Date(startDate);
      cellDate.setDate(startDate.getDate() + index);
      const dateKey = formatDateKey(cellDate);
      const dayEvents = groupedEvents[dateKey] || [];
      const cell = document.createElement("button");
      const number = document.createElement("span");
      const count = document.createElement("span");
      const matchWrap = document.createElement("span");

      cell.type = "button";
      cell.className = "day-cell";
      cell.dataset.date = dateKey;
      if (cellDate.getMonth() !== month) {
        cell.classList.add("is-muted");
      }
      if (dateKey === todayKey) {
        cell.classList.add("is-today");
      }
      if (dateKey === state.selectedDate) {
        cell.classList.add("is-selected");
      }

      number.className = "day-number";
      number.textContent = cellDate.getDate();
      cell.appendChild(number);

      if (dayEvents.length) {
        count.className = "match-count";
        count.textContent = dayEvents.length;
        cell.appendChild(count);
      }

      matchWrap.className = "day-matches";
      dayEvents.slice(0, 3).forEach(function (event) {
        const chip = document.createElement("span");
        chip.className = `match-chip ${getEventTypeClass(event)}`;
        chip.textContent = `${event.time || "시간 미정"} ${event.homeTeam} vs ${event.awayTeam}`;
        chip.title = chip.textContent;
        matchWrap.appendChild(chip);
      });
      cell.appendChild(matchWrap);
      elements.calendarGrid.appendChild(cell);
    }

    renderSummary();
    renderMatchList();
  }

  function renderMatchList() {
    const selectedDateEvents = getSelectedDateEvents();
    elements.matchListTitle.textContent = getKoreanDateLabel(state.selectedDate);
    elements.matchList.innerHTML = "";

    if (!selectedDateEvents.length) {
      const empty = document.createElement("div");
      empty.className = "empty-state";
      empty.textContent = "선택한 날짜에 가져온 경기 일정이 없습니다.";
      elements.matchList.appendChild(empty);
      return;
    }

    selectedDateEvents.forEach(function (event) {
      const card = document.createElement("article");
      const header = document.createElement("div");
      const titleWrap = document.createElement("div");
      const title = document.createElement("strong");
      const result = document.createElement("span");
      const meta = document.createElement("div");
      const detail = document.createElement("p");

      card.className = `match-card ${getEventTypeClass(event)}`;
      header.className = "match-card-header";
      titleWrap.className = "match-card-title";
      title.textContent = `${event.homeTeam} vs ${event.awayTeam}`;
      result.className = "result-badge";
      result.textContent = event.isCompleted && event.score ? `${event.score} ${event.status || "FT"}` : "";
      result.hidden = !result.textContent;
      meta.className = "match-meta";
      meta.textContent = `${event.time || "시간 미정"} · ${event.competitionName || event.leagueName || "대회 정보 없음"}`;
      detail.className = "memo";
      detail.textContent = `${event.venue || "경기장 정보 없음"} · 출처: ${event.source}`;

      titleWrap.append(title, meta);
      header.append(titleWrap, result);
      card.append(header, detail);
      elements.matchList.appendChild(card);
    });
  }

  function render() {
    renderLeagues();
    renderTeamList();
    renderCalendar();
  }

  async function loadLeagueData() {
    try {
      state.isLoading = true;
      setStatus("인터넷에서 팀과 경기 일정을 가져오는 중입니다.");
      render();
      const data = await window.scheduleService.loadLeagueData(state.selectedLeagueIds, state.visibleDate);
      state.teams = data.teams;
      state.events = data.events;
      state.favoriteTeamIds = state.favoriteTeamIds.filter(function (teamId) {
        return teamId.includes(":");
      });
      window.scheduleService.saveFavoriteTeamIds(state.favoriteTeamIds);
      moveToNearestEventDate();
      state.statusText = "";
      setStatus(`${data.source}에서 선택 리그 소속 팀들의 리그/컵/유럽대항전/친선경기 일정을 가져왔습니다.`);
      render();
    } catch (error) {
      setStatus("데이터를 가져오지 못했습니다. 네트워크 또는 공개 API 응답을 확인하세요.");
      showToast(error.message);
      render();
    } finally {
      state.isLoading = false;
    }
  }

  async function loadVisibleMonthEvents() {
    try {
      setStatus("선택한 월의 인터넷 일정을 가져오는 중입니다.");
      state.events = await window.scheduleService.loadMonthEvents(state.selectedLeagueIds, state.visibleDate, state.teams);
      selectFirstEventInVisibleMonth();
      setStatus("ESPN에서 선택 월의 팀별 전체 대회 일정을 가져왔습니다.");
      render();
    } catch (error) {
      setStatus("선택한 월의 경기 일정을 가져오지 못했습니다.");
      showToast(error.message);
      render();
    }
  }

  async function handleLeagueChange(event) {
    try {
      const checkbox = event.target.closest("input[type='checkbox']");
      if (!checkbox) {
        return;
      }
      if (checkbox.value === "__all_leagues") {
        state.selectedLeagueIds = checkbox.checked ? state.leagues.map(function (league) {
          return league.id;
        }) : [];
        state.selectedTeamId = "all";
        state.showFavoritesOnly = false;
        await loadLeagueData();
        return;
      }
      const checkedLeagueIds = Array.from(elements.leagueFilter.querySelectorAll("input:checked")).map(function (input) {
        return input.value;
      }).filter(function (value) {
        return value !== "__all_leagues";
      });
      state.selectedLeagueIds = checkedLeagueIds;
      state.selectedTeamId = "all";
      await loadLeagueData();
    } catch (error) {
      showToast(error.message);
    }
  }

  async function handleTeamClick(event) {
    try {
      const favoriteButton = event.target.closest("[data-favorite-id]");
      const teamButton = event.target.closest("[data-team-id]");
      if (favoriteButton) {
        const teamId = favoriteButton.dataset.favoriteId;
        if (state.favoriteTeamIds.includes(teamId)) {
          state.favoriteTeamIds = state.favoriteTeamIds.filter(function (id) {
            return id !== teamId;
          });
        } else {
          state.favoriteTeamIds = state.favoriteTeamIds.concat(teamId);
        }
        window.scheduleService.saveFavoriteTeamIds(state.favoriteTeamIds);
        render();
        return;
      }
      if (!teamButton) {
        return;
      }
      state.selectedTeamId = teamButton.dataset.teamId;
      state.showFavoritesOnly = false;
      render();
    } catch (error) {
      showToast(error.message);
    }
  }

  async function handleFavoritesOnly() {
    try {
      state.showFavoritesOnly = true;
      state.selectedTeamId = "all";
      render();
    } catch (error) {
      showToast(error.message);
    }
  }

  async function handleAllTeams() {
    try {
      state.showFavoritesOnly = false;
      state.selectedTeamId = "all";
      render();
    } catch (error) {
      showToast(error.message);
    }
  }

  async function handleRefresh() {
    try {
      await loadLeagueData();
    } catch (error) {
      showToast(error.message);
    }
  }

  async function handleMonthChange(monthOffset) {
    try {
      state.visibleDate = new Date(state.visibleDate.getFullYear(), state.visibleDate.getMonth() + monthOffset, 1);
      state.selectedDate = formatDateKey(state.visibleDate);
      renderCalendar();
      await loadVisibleMonthEvents();
    } catch (error) {
      showToast(error.message);
    }
  }

  function handleCalendarClick(event) {
    const cell = event.target.closest("[data-date]");
    if (!cell) {
      return;
    }
    state.selectedDate = cell.dataset.date;
    const selectedDate = new Date(`${state.selectedDate}T00:00:00`);
    state.visibleDate = new Date(selectedDate.getFullYear(), selectedDate.getMonth(), 1);
    renderCalendar();
  }

  function bindEvents() {
    elements.leagueFilter.addEventListener("change", handleLeagueChange);
    elements.teamList.addEventListener("click", handleTeamClick);
    elements.favoritesOnlyButton.addEventListener("click", handleFavoritesOnly);
    elements.allTeamsButton.addEventListener("click", handleAllTeams);
    elements.refreshButton.addEventListener("click", handleRefresh);
    elements.teamSearchInput.addEventListener("input", function (event) {
      state.searchText = event.target.value.trim();
      renderTeamList();
    });
    elements.calendarGrid.addEventListener("click", handleCalendarClick);
    elements.prevMonthButton.addEventListener("click", function () {
      handleMonthChange(-1);
    });
    elements.nextMonthButton.addEventListener("click", function () {
      handleMonthChange(1);
    });
  }

  bindEvents();
  loadLeagueData();
})();
