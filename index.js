const usernameInput = document.getElementById('username-input');
  const searchBtn = document.getElementById('search-btn');
  const messageArea = document.getElementById('message-area');

  const profileSection = document.getElementById('profile-section');
  const langSection = document.getElementById('lang-section');
  const reposSection = document.getElementById('repos-section');

  const sortSelect = document.getElementById('sort-select');

  let currentRepos = [];

  const LANG_COLORS = {
    JavaScript: '#f1e05a', TypeScript: '#3178c6', Python: '#3572A5',
    HTML: '#e34c26', CSS: '#563d7c', Java: '#b07219', 'C++': '#f34b7d',
    C: '#555555', 'C#': '#178600', PHP: '#4F5D95', Ruby: '#701516',
    Go: '#00ADD8', Rust: '#dea584', Swift: '#F05138', Kotlin: '#A97BFF',
    Shell: '#89e051', Vue: '#41b883', Dart: '#00B4AB', Jupyter: '#DA5B0B',
    'Jupyter Notebook': '#DA5B0B', SCSS: '#c6538c', null: '#8b949e'
  };

  function langColor(lang) {
    return LANG_COLORS[lang] || '#8b949e';
  }

  function setMessage(html) {
    messageArea.innerHTML = html;
  }

  function clearMessage() {
    messageArea.innerHTML = '';
  }

  function showLoading() {
    setMessage('<div class="state-box">Loading profile…</div>');
  }

  function showNotFound(username) {
    profileSection.style.display = 'none';
    langSection.style.display = 'none';
    reposSection.style.display = 'none';
    setMessage(`<div class="state-box error">No GitHub user found for "${escapeHtml(username)}". Check the spelling and try again.</div>`);
  }

  function showRateLimit(res) {
    profileSection.style.display = 'none';
    langSection.style.display = 'none';
    reposSection.style.display = 'none';
    const resetUnix = res.headers.get('X-RateLimit-Reset');
    let resetMsg = '';
    if (resetUnix) {
      const resetTime = new Date(resetUnix * 1000).toLocaleTimeString();
      resetMsg = ` Try again after ${resetTime}.`;
    }
    setMessage(`<div class="state-box rate-limit">GitHub API rate limit reached.${resetMsg} Unauthenticated requests are limited to 60 per hour.</div>`);
  }

  function showError(err) {
    profileSection.style.display = 'none';
    langSection.style.display = 'none';
    reposSection.style.display = 'none';
    setMessage(`<div class="state-box error">Something went wrong: ${escapeHtml(err.message || 'network error')}.</div>`);
  }

  function escapeHtml(str) {
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
  }

  function formatDate(dateStr) {
    return new Date(dateStr).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });
  }

  async function loadProfile(username) {
    clearMessage();
    showLoading();
    searchBtn.disabled = true;

    try {
      const [userRes, reposRes] = await Promise.all([
        fetch(`https://api.github.com/users/${encodeURIComponent(username)}`),
        fetch(`https://api.github.com/users/${encodeURIComponent(username)}/repos?per_page=100&sort=updated`)
      ]);

      if (userRes.status === 404) {
        showNotFound(username);
        return;
      }

      if (userRes.status === 403) {
        showRateLimit(userRes);
        return;
      }

      if (!userRes.ok) {
        throw new Error(`GitHub API returned status ${userRes.status}`);
      }

      const user = await userRes.json();

      let repos = [];
      if (reposRes.ok) {
        repos = await reposRes.json();
      } else if (reposRes.status === 403) {
        showRateLimit(reposRes);
        return;
      }

      clearMessage();
      renderProfile(user);
      renderLanguageBreakdown(repos);
      renderRepos(repos);

    } catch (err) {
      showError(err);
    } finally {
      searchBtn.disabled = false;
    }
  }

  function renderProfile(user) {
    document.getElementById('avatar').src = user.avatar_url;
    document.getElementById('avatar').alt = user.login;
    document.getElementById('name').textContent = user.name || user.login;
    document.getElementById('login').textContent = '@' + user.login;
    document.getElementById('bio').textContent = user.bio || '';
    document.getElementById('bio').style.display = user.bio ? 'block' : 'none';
    document.getElementById('profile-link').href = user.html_url;

    const meta = document.getElementById('meta');
    meta.innerHTML = '';
    if (user.location) {
      meta.innerHTML += `<span>📍 ${escapeHtml(user.location)}</span>`;
    }
    if (user.company) {
      meta.innerHTML += `<span>🏢 ${escapeHtml(user.company)}</span>`;
    }
    if (user.blog) {
      const href = user.blog.startsWith('http') ? user.blog : 'https://' + user.blog;
      meta.innerHTML += `<span>🔗 <a href="${href}" target="_blank" rel="noopener" style="color:inherit;">${escapeHtml(user.blog)}</a></span>`;
    }

    const stats = document.getElementById('stats');
    stats.innerHTML = `
      <div class="stat"><strong>${user.followers}</strong>Followers</div>
      <div class="stat"><strong>${user.following}</strong>Following</div>
      <div class="stat"><strong>${user.public_repos}</strong>Public repos</div>
    `;

    profileSection.style.display = 'block';
  }

  function renderLanguageBreakdown(repos) {
    const counts = {};
    let total = 0;
    repos.forEach(r => {
      if (r.language) {
        counts[r.language] = (counts[r.language] || 0) + 1;
        total++;
      }
    });

    const langBar = document.getElementById('lang-bar');
    const langList = document.getElementById('lang-list');
    langBar.innerHTML = '';
    langList.innerHTML = '';

    if (total === 0) {
      langSection.style.display = 'none';
      return;
    }

    const sorted = Object.entries(counts).sort((a, b) => b[1] - a[1]);

    sorted.forEach(([lang, count]) => {
      const pct = (count / total) * 100;
      const segment = document.createElement('span');
      segment.style.width = pct + '%';
      segment.style.background = langColor(lang);
      langBar.appendChild(segment);

      const item = document.createElement('div');
      item.className = 'lang-item';
      item.innerHTML = `<span class="lang-dot" style="background:${langColor(lang)}"></span>${escapeHtml(lang)} ${pct.toFixed(0)}%`;
      langList.appendChild(item);
    });

    langSection.style.display = 'block';
  }

  function renderRepos(repos) {
    currentRepos = repos;
    document.getElementById('repo-count-heading').textContent = `Repositories (${repos.length})`;

    if (repos.length === 0) {
      reposSection.style.display = 'none';
      return;
    }

    reposSection.style.display = 'block';
    sortAndRenderRepos();
  }

  function sortAndRenderRepos() {
    const sortBy = sortSelect.value;
    let sorted = [...currentRepos];

    if (sortBy === 'stars') {
      sorted.sort((a, b) => b.stargazers_count - a.stargazers_count);
    } else if (sortBy === 'name') {
      sorted.sort((a, b) => a.name.localeCompare(b.name));
    } else {
      sorted.sort((a, b) => new Date(b.updated_at) - new Date(a.updated_at));
    }

    const grid = document.getElementById('repo-grid');
    grid.innerHTML = '';

    sorted.forEach(repo => {
      const card = document.createElement('div');
      card.className = 'repo-card';
      card.innerHTML = `
        <a href="${repo.html_url}" target="_blank" rel="noopener">${escapeHtml(repo.name)}</a>
        <p class="repo-desc">${repo.description ? escapeHtml(repo.description) : 'No description provided.'}</p>
        <div class="repo-meta">
          ${repo.language ? `<span><span class="lang-swatch" style="background:${langColor(repo.language)}"></span>${escapeHtml(repo.language)}</span>` : ''}
          <span>⭐ ${repo.stargazers_count}</span>
          <span>🍴 ${repo.forks_count}</span>
          <span>Updated ${formatDate(repo.updated_at)}</span>
        </div>
      `;
      grid.appendChild(card);
    });
  }

  searchBtn.addEventListener('click', () => {
    const username = usernameInput.value.trim();
    if (!username) {
      setMessage('<div class="state-box error">Please enter a username.</div>');
      return;
    }
    loadProfile(username);
  });

  usernameInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      searchBtn.click();
    }
  });

  sortSelect.addEventListener('change', sortAndRenderRepos);