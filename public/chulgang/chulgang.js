/* 출강잇다 — 강사잇다 안에서 각 강사의 Google 캘린더와 연결해 쓰는 화면.
 * 쓰는 법: chulgang-body.html 을 화면에 넣고 chulgang.css 를 불러온 뒤
 *   window.Chulgang.mount({ clientId: '<Google OAuth 클라이언트 ID>' })
 * 를 한 번 부르면 돼요. 화면 안의 모든 id 는 이 화면 전용이에요. */

/**
 * Google 캘린더 연결 (브라우저에서 바로 Google Calendar API 호출).
 * 화면 코드가 쓰는 watchTool / callTool / invalidate 를 그대로 흉내 내서, 화면 코드는 고치지 않아도 돼요.
 * 로그인 열쇠(토큰)는 이 브라우저 메모리에만 있고 서버로 보내지 않아요. 1시간쯤 지나면 다시 연결해야 해요.
 */
function createGoogleCalendar(clientId) {
  const SCOPE = 'https://www.googleapis.com/auth/calendar.events';
  const API = 'https://www.googleapis.com/calendar/v3';
  const TZ = (() => { try { return Intl.DateTimeFormat().resolvedOptions().timeZone || 'Asia/Seoul'; } catch (_) { return 'Asia/Seoul'; } })();
  let token = null, tokenExp = 0, tokenClient = null, gisPromise = null;
  const watchers = new Set();

  const loadGis = () => gisPromise || (gisPromise = new Promise((resolve, reject) => {
    if (window.google && google.accounts && google.accounts.oauth2) return resolve();
    const sc = document.createElement('script');
    sc.src = 'https://accounts.google.com/gsi/client'; sc.async = true;
    sc.onload = () => resolve(); sc.onerror = () => { gisPromise = null; reject(new Error('gis')); };
    document.head.appendChild(sc);
  }));

  async function connect() {
    if (!clientId) throw Object.assign(new Error('Google 클라이언트 ID가 설정되지 않았어요.'), { code: 'no_client_id' });
    await loadGis();
    return new Promise((resolve, reject) => {
      tokenClient = google.accounts.oauth2.initTokenClient({
        client_id: clientId, scope: SCOPE, prompt: '',
        callback: (r) => {
          if (r && r.access_token && google.accounts.oauth2.hasGrantedAllScopes(r, SCOPE)) {
            token = r.access_token; tokenExp = Date.now() + (Number(r.expires_in) || 3600) * 1000 - 60000; resolve();
          } else reject(Object.assign(new Error('denied'), { code: 'consent_required' }));
        },
        error_callback: (e) => reject(Object.assign(new Error((e && e.type) || 'error'), { code: e && e.type === 'popup_closed' ? 'popup_closed' : 'consent_required' })),
      });
      tokenClient.requestAccessToken();
    });
  }
  function disconnect() {
    if (token && window.google && google.accounts) { try { google.accounts.oauth2.revoke(token, () => {}); } catch (_) {} }
    token = null; tokenExp = 0; watchers.clear();
  }

  const fail = (code, message, extra) => Object.assign(new Error(message || code), { code, message: message || code }, extra || {});
  async function api(method, path, query, body) {
    if (!token || Date.now() > tokenExp) throw fail('needs_reauth');
    const qs = query ? '?' + new URLSearchParams(Object.entries(query).filter(([, v]) => v != null && v !== '')).toString() : '';
    let res;
    try {
      res = await fetch(API + path + qs, { method, headers: { Authorization: 'Bearer ' + token, ...(body ? { 'Content-Type': 'application/json' } : {}) }, body: body ? JSON.stringify(body) : undefined });
    } catch (_) { throw fail('server_unavailable', '네트워크 오류', { retryable: true }); }
    if (res.status === 204) return {};
    let data = null; try { data = await res.json(); } catch (_) { data = null; }
    if (res.ok) return data || {};
    const msg = (data && data.error && data.error.message) || ('HTTP ' + res.status);
    if (res.status === 401) { token = null; throw fail('needs_reauth', msg); }
    if (res.status === 403 && /insufficient|scope|permission/i.test(msg)) throw fail('consent_required', msg);
    if (res.status === 429 || res.status >= 500) throw fail('server_unavailable', msg, { retryable: true });
    throw fail('tool_error', msg);
  }

  const iso = (local) => new Date(local).toISOString(); // '2026-11-01T00:00:00' (이 컴퓨터 시간) → UTC
  const timeObj = (local, allDay) => (allDay ? { date: local.slice(0, 10), dateTime: null, timeZone: null } : { dateTime: local, timeZone: TZ, date: null });

  async function listEvents(input) {
    const cal = encodeURIComponent(input.calendarId || 'primary');
    let items = [], pageToken = null, pages = 0;
    do {
      const r = await api('GET', '/calendars/' + cal + '/events', {
        timeMin: iso(input.startTime), timeMax: iso(input.endTime), singleEvents: 'true', orderBy: 'startTime',
        maxResults: String(Math.min(input.pageSize || 250, 250)), q: input.fullText, pageToken,
      });
      items = items.concat(r.items || []);
      pageToken = r.nextPageToken; pages++;
    } while (pageToken && pages < 4);
    return { events: items };
  }

  async function callTool(_server, tool, a) {
    let payload;
    if (tool === 'list_events') payload = await listEvents(a);
    else if (tool === 'update_event') {
      const body = {};
      if ('description' in a) body.description = a.description;
      if ('summary' in a) body.summary = a.summary;
      if ('location' in a) body.location = a.location;
      if (a.startTime) { const allDay = a.allDay === true; body.start = timeObj(a.startTime, allDay); body.end = timeObj(a.endTime, allDay); }
      payload = await api('PATCH', '/calendars/primary/events/' + encodeURIComponent(a.eventId), { sendUpdates: 'none' }, body);
    } else if (tool === 'create_event') {
      const allDay = a.allDay === true;
      const clean = (o) => Object.fromEntries(Object.entries(o).filter(([, v]) => v != null));
      const body = { summary: a.summary, description: a.description, start: clean(timeObj(a.startTime, allDay)), end: clean(timeObj(a.endTime, allDay)) };
      if (a.location) body.location = a.location;
      payload = await api('POST', '/calendars/primary/events', { sendUpdates: 'none' }, body);
    } else if (tool === 'delete_event') {
      payload = await api('DELETE', '/calendars/primary/events/' + encodeURIComponent(a.eventId), { sendUpdates: 'none' });
    } else throw fail('bad_request', tool);
    return { payload };
  }

  function watchTool(_server, tool, input, handler) {
    const w = { input, handler, alive: true };
    w.run = () => listEvents(input).then((p) => { if (w.alive) handler({ type: 'data', result: { payload: p } }); }, (e) => { if (w.alive) handler({ type: 'error', error: e }); });
    watchers.add(w);
    Promise.resolve().then(w.run);
    return () => { w.alive = false; watchers.delete(w); };
  }
  async function invalidate() { watchers.forEach((w) => w.run()); }

  return { connect, disconnect, callTool, watchTool, invalidate, get connected() { return !!token && Date.now() < tokenExp; } };
}

window.Chulgang = {
  mount(opts) {
    opts = opts || {};
    const root = opts.root || document.getElementById('chulgang');
    if (!root || root.dataset.mounted) return;
    root.dataset.mounted = '1';

  const SERVER = 'Google Calendar';
  const HOLIDAY_CAL = 'ko.south_korea#holiday@group.v.calendar.google.com';
  const DAY = 86400000;
  const WD = ['일', '월', '화', '수', '목', '금', '토'];
  const KEY_RE = /^\s*(강사료|강의료|입금액|입금일|입금|기관|업체|강의주제|주제|공제|준비)\s*[:：]/;
  const PREP_RE = /^\s*준비\s*[:：]\s*(.*)$/;
  const isTodo = (t) => /^\s*\[?할\s*일\]?/.test(t || '');
  const DENY = ['needs_reauth', 'server_not_connected', 'blocked_by_policy', 'approval_required', 'not_in_manifest', 'selection_required', 'not_granted', 'capability_disabled', 'capability_removed', 'consent_required', 'server_not_found'];

  const $ = (s) => root.querySelector('#' + s);
  const h = (tag, props, ...kids) => {
    const el = document.createElement(tag);
    for (const [k, v] of Object.entries(props || {})) {
      if (v == null || v === false) continue;
      if (k === 'class') el.className = v;
      else if (k === 'text') el.textContent = v;
      else if (k.startsWith('on')) el.addEventListener(k.slice(2), v);
      else el.setAttribute(k, v === true ? '' : v);
    }
    for (const c of kids.flat()) { if (c == null || c === false) continue; el.append(c instanceof Node ? c : document.createTextNode(String(c))); }
    return el;
  };

  const kstNow = () => new Date(Date.now() + 9 * 3600e3);
  const iso = (d) => d.toISOString().slice(0, 10);
  const todayStr = () => iso(kstNow());
  const addDays = (s, n) => iso(new Date(Date.parse(s + 'T00:00:00Z') + n * DAY));
  const dowOf = (s) => new Date(s + 'T00:00:00Z').getUTCDay();
  const fmt = (n) => (n == null ? '' : Math.round(n).toLocaleString('ko-KR'));
  const won = (n) => (n == null ? '—' : fmt(n) + '원');
  const man = (n) => { if (n == null) return ''; if (n >= 10000) { const v = n / 10000; return (Number.isInteger(v) ? v : v.toFixed(1)) + '만'; } return fmt(n); };
  const label = (s) => { const d = new Date(s + 'T00:00:00Z'); return (d.getUTCMonth() + 1) + '월 ' + d.getUTCDate() + '일 (' + WD[d.getUTCDay()] + ')'; };
  const short = (s) => { const d = new Date(s + 'T00:00:00Z'); return (d.getUTCMonth() + 1) + '/' + d.getUTCDate() + ' (' + WD[d.getUTCDay()] + ')'; };

  const parseWon = (t) => {
    if (t == null) return null;
    const c = String(t).replace(/[,\s원₩]/g, '');
    if (!c) return null;
    let m = c.match(/^(\d+(?:\.\d+)?)만(?:(\d+)천)?/);
    if (m) return Math.round(Number(m[1]) * 10000 + (m[2] ? Number(m[2]) * 1000 : 0));
    m = c.match(/^(\d+(?:\.\d+)?)천/);
    if (m) return Math.round(Number(m[1]) * 1000);
    m = c.match(/^\d+/);
    return m ? Number(m[0]) : null;
  };
  const toText = (d) => String(d || '')
    .replace(/<br\s*\/?>/gi, '\n').replace(/<\/(p|div|li)>/gi, '\n').replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/g, ' ').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&amp;/g, '&');

  const net = (fee, tax) => {
    if (fee == null) return null;
    if (tax === '0') return fee;
    const it = tax === '8.8' ? Math.floor(fee * 0.4 * 0.2 / 10) * 10 : Math.floor(fee * 0.03 / 10) * 10;
    const lt = Math.floor(it * 0.1 / 10) * 10;
    return fee - it - lt;
  };

  function parseEvent(e) {
    const allDay = !(e.start && e.start.dateTime);
    let sd = '', ed = '', time = '', endTime = '';
    if (allDay) {
      sd = String((e.start && e.start.date) || '').slice(0, 10);
      const en = String((e.end && e.end.date) || '').slice(0, 10);
      ed = en && en > sd ? addDays(en, -1) : sd;
    } else {
      const s = new Date(Date.parse(e.start.dateTime) + 9 * 3600e3).toISOString();
      const en = e.end && e.end.dateTime ? new Date(Date.parse(e.end.dateTime) + 9 * 3600e3).toISOString() : s;
      sd = s.slice(0, 10); time = s.slice(11, 16); ed = en.slice(0, 10); endTime = en.slice(11, 16);
      if (ed > sd && endTime === '00:00') ed = addDays(ed, -1);
      if (ed < sd) ed = sd;
    }
    const text = toText(e.description);
    const f = (name) => { const m = text.match(new RegExp('(?:^|\\n)\\s*' + name + '\\s*[:：]\\s*([^\\n]*)')); return m ? m[1].trim() : null; };
    const feeRaw = f('강사료') !== null ? f('강사료') : f('강의료');
    const paidText = f('입금') || '';
    const dm = (paidText + ' ' + (f('입금일') || '')).match(/(\d{4})\s*[-./년]\s*(\d{1,2})\s*[-./월]\s*(\d{1,2})/);
    const paidOn = dm ? dm[1] + '-' + dm[2].padStart(2, '0') + '-' + dm[3].padStart(2, '0') : '';
    const paidAmount = parseWon(f('입금액'));
    const taxRaw = f('공제') || '';
    const tax = /8\.8/.test(taxRaw) ? '8.8' : (/없음|^0\s*%?$/.test(taxRaw) ? '0' : '3.3');
    const prep = text.split('\n').map((l) => l.match(PREP_RE)).filter((m) => m && m[1].trim()).map((m) => {
      let t = m[1].trim(); let done = false;
      if (/\s*(✓|✔|\(완료\))$/.test(t)) { done = true; t = t.replace(/\s*(✓|✔|\(완료\))$/, ''); }
      if (/^\[(x|X|v|V)\]\s*/.test(t)) { done = true; t = t.replace(/^\[(x|X|v|V)\]\s*/, ''); }
      t = t.replace(/^\[\s?\]\s*/, '');
      return { text: t, done };
    });
    const rest = text.split('\n').filter((l) => !KEY_RE.test(l)).join('\n').replace(/^\s+|\s+$/g, '');
    return {
      prep, rest,
      id: e.id, title: e.summary || '(제목 없음)', sd, ed, time, endTime, allDay, link: e.htmlLink || '', text,
      isLecture: feeRaw !== null, fee: parseWon(feeRaw), org: f('업체') || f('기관') || '', topic: f('강의주제') || f('주제') || '', location: (e.location || '').trim(), recurring: !!e.recurringEventId, paidOn, paidAmount, tax,
      paid: !!(paidOn || paidAmount != null || /완료|입금됨|받음/.test(paidText)),
    };
  }

  function statusOf(ev) {
    if (!ev.isLecture) return null;
    const exp = net(ev.fee, ev.tax);
    if (ev.paid) {
      if (ev.paidAmount != null && exp != null && Math.abs(ev.paidAmount - exp) > 10 && ev.paidAmount !== ev.fee) return { key: 'check', label: '금액 확인' };
      return { key: 'paid', label: '입금 완료' };
    }
    const t = todayStr();
    if (ev.sd >= t) return { key: 'plan', label: '예정' };
    const days = Math.round((Date.parse(t) - Date.parse(ev.sd)) / DAY);
    return days > 30 ? { key: 'late', label: '미입금 ' + days + '일', days } : { key: 'unpaid', label: '미입금', days };
  }
  const received = (ev) => (ev.paidAmount != null ? ev.paidAmount : net(ev.fee, ev.tax));

  function totals(list) {
    const t = { gross: 0, n: 0, paid: 0, paidN: 0, owed: 0, owedN: 0, plan: 0, planN: 0, late: 0 };
    list.forEach((ev) => {
      const s = statusOf(ev); if (!s) return;
      t.n++; t.gross += ev.fee || 0;
      if (s.key === 'paid' || s.key === 'check') { t.paidN++; t.paid += received(ev) || 0; }
      else if (s.key === 'plan') { t.planN++; t.plan += ev.fee || 0; }
      else { t.owedN++; t.owed += ev.fee || 0; if (s.key === 'late') t.late++; }
    });
    return t;
  }

  // ---------- state ----------
  const now = kstNow();
  const state = {
    y: now.getUTCFullYear(), m: now.getUTCMonth(), sel: todayStr(),
    month: { status: 'loading', events: [] }, hol: { status: 'loading', events: [] }, year: { status: 'loading', events: [] },
    upcoming: { status: 'loading', events: [] },
    editing: null, editPrep: [], mcp: undefined,
  };
  const unsubs = {};
  let yearKey = null;
  let upKey = null;

  const gridStart = () => { const first = state.y + '-' + String(state.m + 1).padStart(2, '0') + '-01'; return addDays(first, -dowOf(first)); };
  const monthPrefix = () => state.y + '-' + String(state.m + 1).padStart(2, '0');

  const monthEvents = () => state.month.events.map(parseEvent);
  const yearEvents = () => state.year.events.map(parseEvent);
  const upEvents = () => state.upcoming.events.map(parseEvent);
  const holidays = () => state.hol.events.map((e) => ({ ...parseEvent(e), official: /공휴일/.test(e.description || '') }));

  function watch(key, input) {
    if (unsubs[key]) unsubs[key]();
    state[key] = { status: state[key].events.length ? 'refreshing' : 'loading', events: state[key].events };
    unsubs[key] = state.mcp.watchTool(SERVER, 'list_events', input, (ev) => {
      if (ev.type === 'data') {
        let p = ev.result.payload;
        if (typeof p === 'string') { try { p = JSON.parse(p); } catch (_) { p = {}; } }
        state[key] = { status: 'ok', events: ((p && p.events) || []).filter((e) => e.status !== 'cancelled'), at: (ev.result.cache && ev.result.cache.storedAt) || Date.now() };
      } else {
        const code = ev.error && ev.error.code;
        if (code === 'user_changed') return;
        state[key] = { status: 'error', code, message: ev.error && ev.error.message, events: DENY.includes(code) ? [] : state[key].events };
      }
      render();
    }, { cache: { staleTime: 60000, gcTime: 86400000 } });
  }

  function load() {
    if (!state.mcp) { render(); return; }
    const gs = gridStart(), ge = addDays(gs, 42);
    const range = { startTime: gs + 'T00:00:00', endTime: ge + 'T00:00:00', orderBy: 'startTime', pageSize: 250 };
    watch('month', range);
    watch('hol', { ...range, calendarId: HOLIDAY_CAL });
    const t0 = todayStr();
    if (t0 !== upKey) {
      upKey = t0;
      watch('upcoming', { startTime: t0 + 'T00:00:00', endTime: addDays(t0, 15) + 'T00:00:00', orderBy: 'startTime', pageSize: 250 });
    }
    const yk = String(state.y);
    if (yk !== yearKey) {
      yearKey = yk;
      watch('year', { startTime: (state.y - 1) + '-01-01T00:00:00', endTime: (state.y + 1) + '-01-01T00:00:00', fullText: '강사료', orderBy: 'startTime', pageSize: 250 });
    }
    render();
  }

  // ---------- render ----------
  function errorCopy(code) {
    switch (code) {
      case 'needs_reauth': return 'Google 캘린더 연결 시간이 끝났어요. 위의 ‘Google 캘린더 연결’을 다시 눌러 주세요.';
      case 'not_in_manifest': case 'consent_required': return 'Google 캘린더 권한이 허용되지 않았어요. 연결할 때 ‘캘린더 일정 보기 및 수정’에 체크해 주세요.';
      case 'server_unavailable': case 'rate_limited': return 'Google 캘린더가 잠시 응답하지 않아요. 잠시 뒤 새로고침을 눌러 주세요.';
      default: return 'Google 캘린더를 불러오지 못했어요. 새로고침을 눌러 다시 시도해 주세요.';
    }
  }

  const waitMsg = () => (state.mcp ? '불러오는 중이에요.' : 'Google 캘린더를 연결하면 여기에 나와요.');

  function render() {
    $('monthLabel').textContent = state.y + '년 ' + (state.m + 1) + '월';
    renderBanner();
    renderGlance();
    renderSummary();
    renderGrid();
    renderDay();
    renderOwed();
    renderChart();
  }

  function renderBanner() {
    const b = $('banner');
    b.replaceChildren();
    if (!state.mcp || (state.month.status === 'error' && state.month.code === 'needs_reauth')) {
      b.className = 'banner connect'; b.hidden = false;
      const reauth = state.mcp && state.month.code === 'needs_reauth';
      b.append(
        h('p', {}, h('b', { text: reauth ? 'Google 캘린더 연결 시간이 끝났어요. ' : '내 Google 캘린더를 연결해 주세요. ' }),
          reauth ? '다시 연결하면 이어서 볼 수 있어요.' : '강의 일정과 강의료·입금 기록은 내 캘린더에만 저장되고, 강사잇다에는 남지 않아요.'),
        connectButton());
      return;
    }
    const err = ['upcoming', 'month', 'year'].map((k) => state[k]).find((s) => s.status === 'error');
    if (err) { b.className = 'banner err'; b.hidden = false; b.append(errorCopy(err.code)); return; }
    if (state.year.status === 'ok' && !yearEvents().some((e) => e.isLecture)) {
      b.className = 'banner'; b.hidden = false;
      b.append(h('b', { text: '시작하기: ' }), '달력에서 강의 일정을 눌러 강사료를 적어 보세요. 저장하면 그 일정이 강의로 잡히고, 입금 여부를 여기서 관리할 수 있어요.');
      return;
    }
    b.hidden = true;
  }

  const ddayOf = (s) => Math.round((Date.parse(s) - Date.parse(todayStr())) / DAY);
  const ddayEl = (s) => { const d = ddayOf(s); return h('span', { class: 'dday' + (d <= 0 ? ' d0' : d === 1 ? ' d1' : ''), text: d <= 0 ? '오늘' : d === 1 ? '내일' : 'D-' + d }); };
  const byStart = (a, b) => ((a.sd + (a.allDay ? '' : a.time)) < (b.sd + (b.allDay ? '' : b.time)) ? -1 : 1);
  const stat = (k, v, warn) => h('span', { class: 'stat' + (warn ? ' warn' : '') }, k + ' ', h('b', { text: v }));
  const progEl = (e) => {
    if (!e.prep.length) return h('span', { class: 'prog', text: '' });
    const done = e.prep.filter((p) => p.done).length;
    return h('span', { class: 'prog' + (done === e.prep.length ? ' done' : ''), text: '준비 ' + done + '/' + e.prep.length });
  };

  function rowBtn(e, upcoming) {
    const s = statusOf(e);
    const sub = h('span', { class: 'gs' });
    if (upcoming) sub.append(h('span', { text: short(e.sd) + ' · ' + (e.allDay ? '종일' : e.time) }));
    else if (!e.allDay && e.endTime && e.ed === e.sd) sub.append(h('span', { text: '~' + e.endTime }));
    if (s) sub.append(h('span', { class: 'pill ' + s.key, text: s.label }));
    if (e.topic) sub.append(h('span', { text: e.topic }));
    if (e.isLecture && e.fee != null) sub.append(h('span', { text: won(e.fee) }));
    return h('button', { type: 'button', class: 'grow' + (e.isLecture ? '' : ' other'), onclick: () => focusEvent(e) },
      upcoming ? ddayEl(e.sd) : h('span', { class: 'dday', text: e.allDay ? '종일' : e.time }),
      h('span', { class: 'gt', text: e.title }),
      progEl(e),
      sub.childNodes.length ? sub : null);
  }

  function renderGlance() {
    const t = todayStr();
    const d = new Date(t + 'T00:00:00Z');
    $('todayBig').textContent = (d.getUTCMonth() + 1) + '월 ' + d.getUTCDate() + '일';
    $('todayDow').textContent = WD[d.getUTCDay()] + '요일';
    const at = state.upcoming.at ? new Date(state.upcoming.at + 9 * 3600e3).toISOString().slice(11, 16) : '';
    $('todayFresh').textContent = at ? at + ' 기준' : '';
    const loading = state.upcoming.status === 'loading';
    const up = upEvents();

    const tl = $('todayList'); tl.replaceChildren();
    const todays = up.filter((e) => e.sd <= t && e.ed >= t).sort(byStart);
    if (loading) tl.append(h('li', { class: 'empty', text: waitMsg() }));
    else if (!todays.length) tl.append(h('li', { class: 'empty', text: '오늘은 일정이 없어요.' }));
    else todays.forEach((e) => tl.append(h('li', {}, rowBtn(e, false))));

    const st = $('todayStats'); st.replaceChildren();
    if (!loading) {
      const lecWeek = up.filter((e) => e.isLecture && e.sd >= t && e.sd < addDays(t, 7)).length;
      const prepOpen = up.filter((e) => e.ed >= t).reduce((n, e) => n + e.prep.filter((p) => !p.done).length, 0);
      st.append(stat('이번 주 강의', lecWeek + '건'), stat('준비 남음', prepOpen + '개', prepOpen > 0));
      if (state.year.status === 'ok') {
        const owed = yearEvents().filter((e) => { const s = statusOf(e); return s && (s.key === 'unpaid' || s.key === 'late'); }).length;
        st.append(stat('받을 돈', owed + '건', owed > 0));
      }
    }

    const ul = $('upList'); ul.replaceChildren();
    const ups = up.filter((e) => e.sd > t && !isTodo(e.title)).sort(byStart);
    if (loading) ul.append(h('li', { class: 'empty', text: waitMsg() }));
    else if (!ups.length) ul.append(h('li', { class: 'empty', text: '앞으로 2주 동안 일정이 없어요.' }));
    else ups.forEach((e) => ul.append(h('li', {}, rowBtn(e, true))));

    const pl = $('prepList'); pl.replaceChildren();
    if (loading) { pl.append(h('p', { class: 'empty', text: waitMsg() })); return; }
    const groups = up.filter((e) => !isTodo(e.title) && e.ed >= t && e.prep.length).sort(byStart);
    groups.forEach((e) => {
      const g = h('div', { class: 'prep-group' }, h('h3', {}, ddayEl(e.sd), h('span', { text: e.org || e.title })));
      e.prep.forEach((p, i) => {
        const id = 'pc-' + e.id + '-' + i;
        const cb = h('input', { type: 'checkbox', id });
        cb.checked = p.done;
        cb.addEventListener('change', () => togglePrep(e.id, i, cb.checked));
        g.append(h('label', { class: 'prep-item' + (p.done ? ' done' : ''), for: id }, cb, h('span', { text: p.text })));
      });
      pl.append(g);
    });
    const noPrep = up.filter((e) => e.isLecture && e.sd >= t && !e.prep.length).sort(byStart);
    if (noPrep.length) {
      const g = h('div', { class: 'prep-group' }, h('h3', { text: '준비물을 아직 안 적은 강의' }));
      noPrep.forEach((e) => g.append(h('button', { type: 'button', class: 'grow', onclick: () => focusEvent(e) }, ddayEl(e.sd), h('span', { class: 'gt', text: e.org || e.title }), h('span', { class: 'prog', text: '+ 적기' }))));
      pl.append(g);
    }
    const todos = up.filter((e) => isTodo(e.title) && e.sd >= t && e.sd < addDays(t, 8)).sort(byStart);
    if (todos.length) {
      const g = h('div', { class: 'prep-group' }, h('h3', { text: '캘린더 할 일 (7일 안)' }));
      todos.forEach((e) => g.append(h('a', { class: 'todo-link', href: e.link || 'https://calendar.google.com/', target: '_blank', rel: 'noopener' },
        h('span', { class: 'd', text: ddayOf(e.sd) <= 0 ? '오늘' : short(e.sd) }),
        h('span', { text: e.title.replace(/^\s*\[?할\s*일\]?\s*/, '') }))));
      pl.append(g);
    }
    const open = groups.reduce((n, e) => n + e.prep.filter((p) => !p.done).length, 0);
    $('prepNote').textContent = groups.length ? '남은 준비 ' + open + '개' : '2주 안의 강의 준비물과 할 일';
    if (!groups.length && !noPrep.length && !todos.length) pl.append(h('p', { class: 'empty', text: '2주 안에 준비할 것이 없어요. 일정을 눌러 준비물을 추가해 보세요.' }));
  }

  function focusEvent(e) {
    const y = Number(e.sd.slice(0, 4)), m = Number(e.sd.slice(5, 7)) - 1;
    state.sel = e.sd;
    if (y !== state.y || m !== state.m) { state.y = y; state.m = m; load(); } else render();
    openEditor(e, { scroll: true });
  }

  function setFig(id, text, loading) { const el = $(id); el.textContent = state.mcp ? text : '—'; el.classList.toggle('skel', !!loading && !!state.mcp); }

  function renderSummary() {
    const loading = state.month.status === 'loading';
    const mp = monthPrefix();
    const t = totals(monthEvents().filter((e) => e.sd.startsWith(mp)));
    $('sumLabel').textContent = (state.m + 1) + '월 강사료 (세전)';
    setFig('sTotal', won(t.gross), loading); $('sTotalN').textContent = '강의 ' + t.n + '건';
    setFig('sPaid', won(t.paid), loading); $('sPaidN').textContent = t.paidN + '건 입금 확인';
    setFig('sOwed', won(t.owed), loading); $('sOwedN').textContent = t.owedN + '건' + (t.late ? ' · 30일 넘은 건 ' + t.late + '건' : '');
    setFig('sPlan', won(t.plan), loading); $('sPlanN').textContent = t.planN + '건 남음';
    root.querySelector('.fig.owed').classList.toggle('owed', true);
    $('summary').classList.toggle('stale', state.month.status === 'refreshing');

    const yl = $('yearline');
    yl.replaceChildren();
    if (!state.mcp) { yl.textContent = 'Google 캘린더를 연결하면 올해 강의료 합계가 여기에 나와요.'; return; }
    if (state.year.status === 'loading') { yl.textContent = state.y + '년 누적을 불러오는 중이에요.'; return; }
    const yt = totals(yearEvents().filter((e) => e.sd.startsWith(String(state.y))));
    yl.append(state.y + '년 누적: 강사료 ', h('b', { text: won(yt.gross) }), ' (' + yt.n + '건) · 입금 ', h('b', { text: won(yt.paid) }), ' · 받을 돈 ', h('b', { text: won(yt.owed) }), ' · 예정 ', h('b', { text: won(yt.plan) }));
  }

  function eventsOn(day, list) { return list.filter((e) => e.sd <= day && e.ed >= day); }

  function renderGrid() {
    const grid = $('grid');
    const gs = gridStart();
    const today = todayStr();
    const mp = monthPrefix();
    const evs = monthEvents();
    const hols = holidays();
    grid.replaceChildren();
    grid.classList.toggle('stale', state.month.status === 'refreshing');
    for (let i = 0; i < 42; i++) {
      const day = addDays(gs, i);
      const dw = i % 7;
      const hol = eventsOn(day, hols);
      const official = hol.some((x) => x.official);
      const list = eventsOn(day, evs).sort((a, b) => (b.isLecture - a.isLecture) || ((a.allDay ? '' : a.time) < (b.allDay ? '' : b.time) ? -1 : 1));
      const cls = ['cell', day.startsWith(mp) ? '' : 'out', day === today ? 'today' : '', day === state.sel ? 'sel' : '', dw === 0 ? 'sun' : '', dw === 6 ? 'sat' : '', official ? 'hol' : ''].filter(Boolean).join(' ');
      const chips = h('div', { class: 'chips' });
      const MAX = 3;
      list.slice(0, MAX).forEach((ev) => {
        const s = statusOf(ev);
        const txt = ev.isLecture ? (ev.org || ev.title) + (ev.fee != null ? ' ' + man(ev.fee) : '') : ev.title;
        chips.append(h('button', {
          type: 'button', class: 'chip' + (s ? ' lec ' + s.key : ''), title: ev.title,
          'aria-label': label(day) + ' ' + ev.title + (s ? ', ' + s.label : ''),
          onclick: (e) => { e.stopPropagation(); state.sel = day; render(); openEditor(ev); },
        }, h('i', { class: 'dot ' + (s ? s.key : 'other') }), h('span', { text: txt })));
      });
      if (list.length > MAX) chips.append(h('span', { class: 'more', text: '+' + (list.length - MAX) + '개' }));
      const cell = h('div', { class: cls, role: 'gridcell', 'aria-selected': String(day === state.sel), onclick: () => { state.sel = day; render(); } },
        h('div', { class: 'num' },
          h('b', { text: String(Number(day.slice(8))) }),
          hol.length ? h('span', { class: 'hname', text: hol[0].title }) : null),
        chips);
      grid.append(cell);
    }
  }

  function renderDay() {
    const day = state.sel;
    $('dayTitle').textContent = label(day);
    const hol = eventsOn(day, holidays());
    $('dayHol').textContent = hol.map((x) => x.title).join(', ');
    const ul = $('dayList');
    ul.replaceChildren();
    if (state.month.status === 'loading') { ul.append(h('li', { class: 'empty', text: waitMsg() })); return; }
    const list = eventsOn(day, monthEvents()).sort((a, b) => ((a.allDay ? '' : a.time) < (b.allDay ? '' : b.time) ? -1 : 1));
    if (!list.length) { ul.append(h('li', { class: 'empty', text: '이날은 일정이 없어요.' })); return; }
    list.forEach((ev) => {
      const s = statusOf(ev);
      const meta = h('div', { class: 'meta' });
      if (s) {
        meta.append(h('span', { class: 'pill ' + s.key, text: s.label }));
        meta.append(h('span', { text: ev.fee != null ? '강사료 ' + won(ev.fee) : '강사료 금액 없음' }));
        if (ev.paid) meta.append(h('span', { text: '입금 ' + won(received(ev)) + (ev.paidOn ? ' · ' + short(ev.paidOn) : '') }));
      }
      if (ev.topic || (ev.org && ev.org !== ev.title)) meta.append(h('span', { text: [ev.org !== ev.title ? ev.org : '', ev.topic].filter(Boolean).join(' · ') }));
      if (ev.location) meta.append(h('span', { text: '장소 ' + ev.location }));
      if (ev.prep.length) meta.append(progEl(ev));
      ul.append(h('li', { class: 'ev' },
        h('span', { class: 't', text: ev.allDay ? '종일' : ev.time }),
        h('span', { class: 'ti', text: ev.title }),
        meta.childNodes.length ? meta : null,
        h('div', { class: 'act' }, h('button', { type: 'button', class: 'btn small', text: '수정·강의료 기입', onclick: () => openEditor(ev, { asLecture: !isTodo(ev.title), scroll: true }) }))));
    });
  }

  function renderOwed() {
    const tb = $('owedBody');
    tb.replaceChildren();
    if (state.year.status === 'loading') { tb.append(h('tr', {}, h('td', { colspan: '5', class: 'empty', text: waitMsg() }))); return; }
    const rows = yearEvents().map((e) => ({ e, s: statusOf(e) })).filter((r) => r.s && (r.s.key === 'unpaid' || r.s.key === 'late' || r.s.key === 'check')).sort((a, b) => (a.e.sd < b.e.sd ? -1 : 1));
    const sum = rows.filter((r) => r.s.key !== 'check').reduce((t, r) => t + (r.e.fee || 0), 0);
    $('owedNote').textContent = rows.length ? '모두 ' + won(sum) + ' · ' + rows.length + '건' : '강의가 끝났는데 입금이 확인되지 않은 건';
    if (!rows.length) { tb.append(h('tr', {}, h('td', { colspan: '5', class: 'empty', text: '받을 돈이 없어요. 끝난 강의는 모두 입금 확인됐어요.' }))); return; }
    rows.forEach(({ e, s }) => {
      tb.append(h('tr', {},
        h('td', { class: 'd', text: short(e.sd) }),
        h('td', { text: e.org || e.title }),
        h('td', { class: 'n', text: e.fee != null ? won(e.fee) : '금액 없음' }),
        h('td', {}, h('span', { class: 'pill ' + s.key, text: s.key === 'check' ? '금액 확인' : s.days + '일' })),
        h('td', { class: 'n' }, h('button', { type: 'button', class: 'btn small', text: s.key === 'check' ? '확인' : '입금 확인', onclick: () => { openEditor(e, { markPaid: s.key !== 'check' }); } }))));
    });
  }

  function renderChart() {
    const box = $('chart');
    box.replaceChildren();
    $('chartTitle').textContent = state.y + '년 월별 강사료';
    const yr = String(state.y);
    const months = Array.from({ length: 12 }, (_, i) => ({ i, paid: 0, owed: 0, plan: 0 }));
    yearEvents().filter((e) => e.sd.startsWith(yr)).forEach((e) => {
      const s = statusOf(e); if (!s) return;
      const m = months[Number(e.sd.slice(5, 7)) - 1];
      const k = s.key === 'plan' ? 'plan' : (s.key === 'paid' || s.key === 'check' ? 'paid' : 'owed');
      m[k] += e.fee || 0;
    });
    const W = 600, H = 210, L = 44, R = 6, T = 10, B = 26;
    const max = Math.max(...months.map((m) => m.paid + m.owed + m.plan), 0);
    const stepV = max <= 0 ? 500000 : [100000, 200000, 500000, 1000000, 2000000, 5000000, 10000000, 20000000].find((s) => max / s <= 4) || 50000000;
    const top = Math.max(stepV, Math.ceil(max / stepV) * stepV);
    const y = (v) => T + (H - T - B) * (1 - v / top);
    const bw = (W - L - R) / 12;
    const NS = 'http://www.w3.org/2000/svg';
    const s = (tag, attrs) => { const el = document.createElementNS(NS, tag); for (const k in attrs) el.setAttribute(k, attrs[k]); return el; };
    const svg = s('svg', { viewBox: `0 0 ${W} ${H}`, role: 'img', 'aria-label': state.y + '년 월별 강사료 막대 그래프' });
    for (let v = 0; v <= top; v += stepV) {
      svg.append(s('line', { x1: L, x2: W - R, y1: y(v), y2: y(v), stroke: 'var(--line-soft)', 'stroke-width': 1 }));
      const t = s('text', { x: L - 6, y: y(v), dy: '0.32em', 'text-anchor': 'end', 'font-size': 11, fill: 'var(--muted)' });
      t.textContent = v === 0 ? '0' : man(v); svg.append(t);
    }
    const colors = { paid: 'var(--paid)', owed: 'var(--unpaid)', plan: 'var(--plan)' };
    const readout = $('readout');
    const show = (m) => {
      readout.replaceChildren(h('b', { text: (m.i + 1) + '월 ' }), '입금 ' + won(m.paid) + ' · 미입금 ' + won(m.owed) + ' · 예정 ' + won(m.plan));
    };
    months.forEach((m) => {
      const x = L + m.i * bw;
      const w = Math.min(28, bw * 0.62);
      const x0 = x + (bw - w) / 2;
      let acc = 0;
      ['paid', 'owed', 'plan'].forEach((k) => {
        if (!m[k]) return;
        const y1 = y(acc + m[k]), y0 = y(acc);
        svg.append(s('rect', { x: x0, y: y1, width: w, height: Math.max(0, y0 - y1), fill: colors[k], rx: 2 }));
        acc += m[k];
      });
      const lab = s('text', { x: x + bw / 2, y: H - 8, 'text-anchor': 'middle', 'font-size': 11, fill: Number(monthPrefix().slice(5)) === m.i + 1 ? 'var(--ink)' : 'var(--muted)', 'font-weight': Number(monthPrefix().slice(5)) === m.i + 1 ? 700 : 400 });
      lab.textContent = (m.i + 1) + '월'; svg.append(lab);
      const hit = s('rect', { x, y: T, width: bw, height: H - T - B + 4, fill: 'transparent', tabindex: 0, style: 'cursor:pointer' });
      hit.addEventListener('pointerenter', () => show(m));
      hit.addEventListener('focus', () => show(m));
      hit.addEventListener('click', () => { show(m); state.m = m.i; load(); });
      svg.append(hit);
    });
    svg.append(s('line', { x1: L, x2: W - R, y1: y(0), y2: y(0), stroke: 'var(--muted)', 'stroke-width': 1 }));
    box.append(svg);
  }

  // ---------- editor ----------
  const form = $('editor');
  function newDraft(day) {
    return { id: null, title: '', sd: day, ed: day, time: '10:00', endTime: '12:00', allDay: false, location: '', recurring: false, link: '',
      text: '', rest: '', prep: [], isLecture: true, fee: null, org: '', topic: '', tax: '3.3', paid: false, paidOn: '', paidAmount: null };
  }
  function openEditor(ev, opts) {
    const creating = !ev.id;
    state.editing = ev;
    $('editorCard').hidden = false;
    $('formErr').hidden = true;
    $('editorHead').textContent = creating ? '새 강의 추가' : '일정·강의 수정';
    $('fSummary').value = ev.title === '(제목 없음)' ? '' : ev.title;
    $('fDate').value = ev.sd;
    $('fAllDay').checked = ev.allDay;
    $('fStart').value = ev.allDay ? '10:00' : ev.time;
    $('fEnd').value = ev.allDay ? '12:00' : (ev.endTime || ev.time);
    $('fLoc').value = ev.location || '';
    $('recurNote').hidden = !ev.recurring;
    $('openCal').hidden = creating;
    $('delRow').hidden = creating;
    $('delConfirm').hidden = true;
    $('delBtn').hidden = false;
    $('openCal').href = ev.link || 'https://calendar.google.com/';
    $('fLecture').checked = ev.isLecture || !!(opts && (opts.markPaid || opts.asLecture));
    $('fTopic').value = ev.topic || '';
    $('fOrg').value = ev.org || '';
    $('fFee').value = ev.fee != null ? fmt(ev.fee) : '';
    $('fTax').value = ev.tax || '3.3';
    const paid = ev.paid || !!(opts && opts.markPaid);
    $('fPaidYes').checked = paid; $('fPaidNo').checked = !paid;
    $('fPaidOn').value = ev.paidOn || (paid ? todayStr() : '');
    $('fPaidAmt').value = ev.paidAmount != null ? fmt(ev.paidAmount) : (paid && ev.fee != null ? fmt(net(ev.fee, ev.tax)) : '');
    $('saveBtn').disabled = false; $('saveBtn').textContent = creating ? '구글 캘린더에 추가' : '구글 캘린더에 저장';
    state.editPrep = ev.prep.map((p) => ({ ...p }));
    $('fPrepNew').value = '';
    renderPrepEdit();
    syncForm();
    const card = $('editorCard');
    const r = card.getBoundingClientRect();
    if ((opts && opts.scroll) || window.matchMedia('(max-width: 960px)').matches || r.top < 0 || r.top > window.innerHeight - 120) card.scrollIntoView({ block: 'start', behavior: 'smooth' });
    (creating ? $('fSummary') : (opts && opts.markPaid ? $('fPaidAmt') : $('fFee'))).focus({ preventScroll: true });
  }
  function closeEditor() { state.editing = null; $('editorCard').hidden = true; }

  function syncForm() {
    $('timeFields').hidden = $('fAllDay').checked;
    const fee = parseWon($('fFee').value);
    $('fFeeHint').textContent = fee != null ? '= ' + won(fee) : ' ';
    const paid = $('fPaidYes').checked;
    $('paidFields').hidden = !paid;
    const exp = net(fee, $('fTax').value);
    $('cExp').textContent = won(exp);
    const amt = parseWon($('fPaidAmt').value);
    const diff = paid && amt != null && exp != null ? amt - exp : 0;
    $('cDiffRow').hidden = !diff || Math.abs(diff) <= 10;
    $('cDiff').textContent = (diff > 0 ? '+' : '') + fmt(diff) + '원';
  }
  ['fLecture', 'fFee', 'fTax', 'fPaidAmt', 'fPaidYes', 'fPaidNo', 'fAllDay'].forEach((id) => { $(id).addEventListener('input', syncForm); $(id).addEventListener('change', syncForm); });
  $('fStart').addEventListener('change', () => {
    const st = $('fStart').value, en = $('fEnd').value;
    if (st && (!en || en <= st)) { const [hh, mm] = st.split(':').map(Number); const t = Math.min(23 * 60 + 55, hh * 60 + mm + 120); $('fEnd').value = String(Math.floor(t / 60)).padStart(2, '0') + ':' + String(t % 60).padStart(2, '0'); }
  });
  ['fFee', 'fTopic', 'fOrg'].forEach((id) => $(id).addEventListener('input', () => { if ($(id).value.trim()) { $('fLecture').checked = true; syncForm(); } }));
  $('fPaidYes').addEventListener('change', () => {
    $('fLecture').checked = true;
    if (!$('fPaidOn').value) $('fPaidOn').value = todayStr();
    if (!$('fPaidAmt').value) { const fee = parseWon($('fFee').value); if (fee != null) $('fPaidAmt').value = fmt(net(fee, $('fTax').value)); }
    syncForm();
  });
  $('fFee').addEventListener('blur', () => { const v = parseWon($('fFee').value); if (v != null) $('fFee').value = fmt(v); });
  $('fPaidAmt').addEventListener('blur', () => { const v = parseWon($('fPaidAmt').value); if (v != null) $('fPaidAmt').value = fmt(v); });
  $('cancelBtn').addEventListener('click', closeEditor);

  function renderPrepEdit() {
    const ul = $('prepEditList');
    ul.replaceChildren();
    state.editPrep.forEach((p, i) => {
      const cb = h('input', { type: 'checkbox', id: 'ep-' + i, 'aria-label': p.text + ' 완료' });
      cb.checked = p.done;
      cb.addEventListener('change', () => { p.done = cb.checked; });
      ul.append(h('li', {}, cb, h('span', { text: p.text }),
        h('button', { type: 'button', 'aria-label': p.text + ' 지우기', text: '×', onclick: () => { state.editPrep.splice(i, 1); renderPrepEdit(); } })));
    });
  }
  const addPrep = () => {
    const v = $('fPrepNew').value.replace(/\s+/g, ' ').trim();
    if (!v) return;
    state.editPrep.push({ text: v, done: false });
    $('fPrepNew').value = '';
    renderPrepEdit();
    $('fPrepNew').focus();
  };
  $('prepAddBtn').addEventListener('click', addPrep);
  $('fPrepNew').addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); addPrep(); } });

  function serialize(s) {
    const lines = [];
    if (s.isLecture) {
      if (s.topic) lines.push('강의주제: ' + s.topic);
      if (s.org) lines.push('업체: ' + s.org);
      lines.push('강사료: ' + (s.fee != null ? fmt(s.fee) : ''));
      lines.push('공제: ' + (s.tax === '0' ? '없음' : (s.tax || '3.3') + '%'));
      if (s.paid) {
        lines.push('입금: ' + (s.paidOn || '완료'));
        if (s.paidAmount != null) lines.push('입금액: ' + fmt(s.paidAmount));
      }
    }
    s.prep.forEach((p) => lines.push('준비: ' + p.text + (p.done ? ' ✓' : '')));
    return [lines.join('\n'), s.rest].filter(Boolean).join('\n\n');
  }
  const fromEvent = (ev) => ({ isLecture: ev.isLecture, fee: ev.fee, org: ev.org, topic: ev.topic, tax: ev.tax, paid: ev.paid, paidOn: ev.paidOn, paidAmount: ev.paidAmount, prep: ev.prep, rest: ev.rest });

  function buildDescription(ev) {
    addPrep();
    const on = $('fPaidOn').value;
    return serialize({
      isLecture: $('fLecture').checked, fee: parseWon($('fFee').value), org: $('fOrg').value.trim(), topic: $('fTopic').value.trim(), tax: $('fTax').value,
      paid: $('fPaidYes').checked, paidOn: on && $('fPaidOn').validity.valid ? on : '', paidAmount: parseWon($('fPaidAmt').value),
      prep: state.editPrep.filter((p) => p.text.trim()), rest: ev.rest,
    });
  }

  const queues = {};
  function togglePrep(id, i, done) {
    const raw = state.upcoming.events.find((e) => e.id === id) || state.month.events.find((e) => e.id === id);
    if (!raw || !state.mcp) return;
    const ev = parseEvent(raw);
    if (!ev.prep[i]) return;
    const before = raw.description;
    ev.prep[i].done = done;
    const description = serialize(fromEvent(ev));
    patchLocal(id, description, false);
    render();
    queues[id] = (queues[id] || Promise.resolve())
      .then(() => state.mcp.callTool(SERVER, 'update_event', { eventId: id, description: description || ' ', notificationLevel: 'NONE' }, { cache: false }))
      .then(() => toast(done ? '준비 완료로 표시했어요' : '준비 표시를 풀었어요'))
      .catch(() => { patchLocal(id, before, false); render(); toast('캘린더에 저장하지 못했어요. 다시 눌러 주세요.'); });
  }

  function patchRaw(id, fields, addToYear) {
    ['month', 'year', 'upcoming'].forEach((k) => {
      state[k].events = state[k].events.map((e) => (e.id === id ? { ...e, ...fields } : e));
    });
    if (addToYear && !state.year.events.some((e) => e.id === id)) {
      const src = state.month.events.find((e) => e.id === id) || state.upcoming.events.find((e) => e.id === id);
      if (src) state.year.events = state.year.events.concat([{ ...src, ...fields }]);
    }
  }
  const patchLocal = (id, description, addToYear) => patchRaw(id, { description }, addToYear);

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const ev = state.editing; if (!ev) return;
    const err = $('formErr'); err.hidden = true;
    const fail = (msg, el) => { err.textContent = msg; err.hidden = false; if (el) el.focus(); };
    const creating = !ev.id;
    const summary = $('fSummary').value.trim();
    const date = $('fDate').value;
    const allDay = $('fAllDay').checked;
    const st = $('fStart').value, en = $('fEnd').value;
    const loc = $('fLoc').value.trim();
    if (!summary) return fail('일정 이름을 적어 주세요.', $('fSummary'));
    if (!date || !$('fDate').validity.valid) return fail('날짜를 골라 주세요.', $('fDate'));
    const span = Math.max(0, Math.round((Date.parse(ev.ed) - Date.parse(ev.sd)) / DAY));
    const endDate = addDays(date, span);
    if (!allDay) {
      if (!st || !en) return fail('시작 시간과 종료 시간을 적어 주세요.', $('fStart'));
      if (endDate === date && en <= st) return fail('종료 시간이 시작 시간보다 늦어야 해요.', $('fEnd'));
    }
    if ($('fFee').value.trim() && parseWon($('fFee').value) == null) return fail('강의료를 숫자로 적어 주세요. 예: 300,000 또는 30만', $('fFee'));
    if (!state.mcp) return fail('구글 캘린더에 연결되어 있지 않아 저장할 수 없어요.');
    const description = buildDescription(ev);
    const startTime = allDay ? date + 'T00:00:00' : date + 'T' + st + ':00';
    const endTime = allDay ? addDays(endDate, 1) + 'T00:00:00' : endDate + 'T' + en + ':00';
    const timeChanged = date !== ev.sd || allDay !== ev.allDay || (!allDay && (st !== ev.time || en !== ev.endTime));
    let tool, args;
    if (creating) {
      tool = 'create_event';
      args = { summary, startTime, endTime, description, notificationLevel: 'NONE' };
      if (allDay) args.allDay = true;
      if (loc) args.location = loc;
    } else {
      tool = 'update_event';
      args = { eventId: ev.id, description: description || ' ', notificationLevel: 'NONE' };
      if (summary !== ev.title) args.summary = summary;
      if (loc !== (ev.location || '')) args.location = loc || ' ';
      if (timeChanged) { args.startTime = startTime; args.endTime = endTime; if (allDay || ev.allDay) args.allDay = allDay; }
    }
    const btn = $('saveBtn'); btn.disabled = true; btn.textContent = '저장 중…';
    try {
      const res = await state.mcp.callTool(SERVER, tool, args, { cache: false });
      const startObj = allDay ? { date } : { dateTime: startTime + '+09:00' };
      const endObj = allDay ? { date: addDays(endDate, 1) } : { dateTime: endTime + '+09:00' };
      if (creating) {
        let p = res && res.payload;
        if (typeof p === 'string') { try { p = JSON.parse(p); } catch (_) { p = null; } }
        const made = p && (p.event || p);
        if (made && made.id) {
          const raw = { ...made, summary, description, location: loc, start: made.start || startObj, end: made.end || endObj, status: 'confirmed' };
          state.month.events = state.month.events.concat([raw]);
          state.upcoming.events = state.upcoming.events.concat([raw]);
          if ($('fLecture').checked) state.year.events = state.year.events.concat([raw]);
        }
      } else {
        const fields = { description };
        if (args.summary) fields.summary = summary;
        if ('location' in args) fields.location = loc;
        if (timeChanged) { fields.start = startObj; fields.end = endObj; }
        patchRaw(ev.id, fields, $('fLecture').checked);
      }
      closeEditor();
      toast(creating ? '구글 캘린더에 추가했어요' : '구글 캘린더에 저장했어요');
      state.sel = date;
      const ny = Number(date.slice(0, 4)), nm = Number(date.slice(5, 7)) - 1;
      if (ny !== state.y || nm !== state.m) { state.y = ny; state.m = nm; load(); } else render();
      state.mcp.invalidate(SERVER, 'list_events').catch(() => {});
    } catch (x) {
      const code = x && x.code;
      if (code === 'server_unavailable' || code === 'upstream_error' || code === 'cancelled') fail(creating ? '추가됐는지 확인하지 못했어요. 새로고침을 눌러 달력에 생겼는지 본 뒤 다시 시도해 주세요. 바로 다시 누르면 두 번 생길 수 있어요.' : '저장됐는지 확인하지 못했어요. 새로고침을 눌러 캘린더에 반영됐는지 본 뒤 다시 저장해 주세요.');
      else if (code === 'tool_error') fail('구글 캘린더가 저장을 거절했어요: ' + (x.message || '알 수 없는 오류'));
      else fail(errorCopy(code));
      btn.disabled = false; btn.textContent = creating ? '구글 캘린더에 추가' : '구글 캘린더에 저장';
    }
  });

  $('delBtn').addEventListener('click', () => {
    const ev = state.editing; if (!ev || !ev.id) return;
    $('delName').textContent = '‘' + ev.title + '’';
    $('delRecur').hidden = !ev.recurring;
    $('delConfirm').hidden = false;
    $('delBtn').hidden = true;
    $('delYes').disabled = false; $('delYes').textContent = '삭제';
    $('delNo').focus();
  });
  $('delNo').addEventListener('click', () => { $('delConfirm').hidden = true; $('delBtn').hidden = false; $('delBtn').focus(); });
  $('delYes').addEventListener('click', async () => {
    const ev = state.editing; if (!ev || !ev.id) return;
    const err = $('formErr'); err.hidden = true;
    if (!state.mcp) { err.textContent = '구글 캘린더에 연결되어 있지 않아 삭제할 수 없어요.'; err.hidden = false; return; }
    const yes = $('delYes'); yes.disabled = true; yes.textContent = '삭제 중…';
    try {
      await state.mcp.callTool(SERVER, 'delete_event', { eventId: ev.id, notificationLevel: 'NONE' }, { cache: false });
      ['month', 'year', 'upcoming'].forEach((k) => { state[k].events = state[k].events.filter((e) => e.id !== ev.id); });
      closeEditor();
      toast('‘' + ev.title + '’ 일정을 삭제했어요');
      render();
      state.mcp.invalidate(SERVER, 'list_events').catch(() => {});
    } catch (x) {
      const code = x && x.code;
      if (code === 'server_unavailable' || code === 'upstream_error' || code === 'cancelled') err.textContent = '삭제됐는지 확인하지 못했어요. 새로고침을 눌러 달력에서 사라졌는지 확인해 주세요.';
      else if (code === 'tool_error') err.textContent = '구글 캘린더가 삭제를 거절했어요: ' + (x.message || '알 수 없는 오류');
      else err.textContent = errorCopy(code);
      err.hidden = false;
      yes.disabled = false; yes.textContent = '삭제';
    }
  });

  $('addBtn').addEventListener('click', () => openEditor(newDraft(state.sel < todayStr() ? todayStr() : state.sel), { scroll: true }));
  $('addDayBtn').addEventListener('click', () => openEditor(newDraft(state.sel), { scroll: true }));

  // ---------- chrome ----------
  let toastTimer;
  function toast(msg) { const t = $('toast'); t.textContent = msg; t.hidden = false; clearTimeout(toastTimer); toastTimer = setTimeout(() => { t.hidden = true; }, 2600); }
  const shift = (n) => { const d = new Date(Date.UTC(state.y, state.m + n, 1)); state.y = d.getUTCFullYear(); state.m = d.getUTCMonth(); state.sel = monthPrefix() + '-01'; if (todayStr().startsWith(monthPrefix())) state.sel = todayStr(); load(); };
  $('prev').addEventListener('click', () => shift(-1));
  $('next').addEventListener('click', () => shift(1));
  $('todayBtn').addEventListener('click', () => { const n = kstNow(); state.y = n.getUTCFullYear(); state.m = n.getUTCMonth(); state.sel = todayStr(); load(); });
  $('refresh').addEventListener('click', () => { if (state.mcp) { state.mcp.invalidate(SERVER, 'list_events').catch(() => {}); toast('캘린더를 다시 불러와요'); } });

  // ---------- Google 연결 ----------
  const gcal = createGoogleCalendar(opts.clientId);
  function connectButton() {
    const btn = h('button', { type: 'button', class: 'gbtn' });
    btn.innerHTML = '<svg viewBox="0 0 48 48" aria-hidden="true"><path fill="#EA4335" d="M24 9.5c3.5 0 6.6 1.2 9.1 3.6l6.8-6.8C35.8 2.4 30.3 0 24 0 14.6 0 6.6 5.4 2.7 13.3l7.9 6.1C12.5 13.6 17.8 9.5 24 9.5z"/><path fill="#4285F4" d="M46.5 24.5c0-1.6-.1-3.1-.4-4.5H24v9h12.7c-.6 3-2.3 5.5-4.8 7.2l7.7 6c4.5-4.2 6.9-10.3 6.9-17.7z"/><path fill="#FBBC05" d="M10.6 28.6A14.6 14.6 0 0 1 9.5 24c0-1.6.3-3.2.8-4.6l-7.9-6.1A24 24 0 0 0 0 24c0 3.9.9 7.5 2.7 10.7l7.9-6.1z"/><path fill="#34A853" d="M24 48c6.5 0 11.9-2.1 15.9-5.8l-7.7-6c-2.1 1.4-4.9 2.3-8.2 2.3-6.2 0-11.5-4.1-13.4-9.9l-7.9 6.1C6.6 42.6 14.6 48 24 48z"/></svg>';
    btn.append('Google 캘린더 연결');
    btn.addEventListener('click', async () => {
      btn.disabled = true;
      try {
        await gcal.connect();
        state.mcp = gcal;
        yearKey = null; upKey = null;
        state.month.code = null;
        $('disconnectBtn').hidden = false;
        load();
        toast('Google 캘린더를 연결했어요');
      } catch (x) {
        btn.disabled = false;
        toast(x && x.code === 'popup_closed' ? '연결 창이 닫혔어요. 다시 눌러 주세요.' : 'Google 캘린더를 연결하지 못했어요. 다시 눌러 주세요.');
      }
    });
    return btn;
  }
  $('disconnectBtn').addEventListener('click', () => {
    gcal.disconnect();
    state.mcp = null;
    ['month', 'hol', 'year', 'upcoming'].forEach((k) => { state[k] = { status: 'loading', events: [] }; });
    Object.keys(unsubs).forEach((k) => unsubs[k] && unsubs[k]());
    closeEditor();
    $('disconnectBtn').hidden = true;
    render();
    toast('연결을 해제했어요');
  });
  render();


  },
};
