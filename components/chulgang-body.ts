/*
 * 출강잇다 화면 본체 (받은 파일 chulgang-body.html 그대로). 우리가 만든 고정 HTML 이라 dangerouslySetInnerHTML 로 넣는다.
 * 안의 버튼·목록은 public/chulgang/chulgang.js 가 채우고 움직인다 (components/chulgang-app.tsx 참고).
 */
export const CHULGANG_BODY_HTML = `<div class="cg" id="chulgang">
<div class="wrap">
  <header class="top">
    <div class="brand">
      <h1>출강잇다</h1>
      <p>오늘 일정, 다가오는 강의, 준비할 것, 강사료 입금까지 내 구글 캘린더 하나로 한눈에 봐요.</p>
    </div>
    <div class="nav">
      <button class="btn icon" id="prev" type="button" aria-label="이전 달">‹</button>
      <div class="month" id="monthLabel" aria-live="polite">—</div>
      <button class="btn icon" id="next" type="button" aria-label="다음 달">›</button>
      <button class="btn" id="todayBtn" type="button">오늘</button>
      <button class="btn" id="refresh" type="button">새로고침</button>
      <button class="linkbtn" id="disconnectBtn" type="button" hidden>연결 해제</button>
      <button class="btn primary" id="addBtn" type="button">+ 강의 추가</button>
    </div>
  </header>

  <div id="banner" hidden></div>

  <div class="glance" aria-label="한눈에 보기">
    <section class="card today-card" aria-label="오늘">
      <div class="card-h"><h2>오늘</h2><span class="note" id="todayFresh"></span></div>
      <div class="today-date"><b id="todayBig">—</b><span id="todayDow"></span></div>
      <div class="chips-row" id="todayStats"></div>
      <ul class="glist" id="todayList"></ul>
    </section>
    <section class="card" aria-label="다가오는 일정">
      <div class="card-h"><h2>다가오는 일정</h2><span class="note">앞으로 2주 · 누르면 수정 창이 열려요</span></div>
      <ul class="glist" id="upList"></ul>
    </section>
    <section class="card" aria-label="준비할 것">
      <div class="card-h"><h2>준비할 것</h2><span class="note" id="prepNote">2주 안의 강의 준비물과 할 일</span></div>
      <div class="glist" id="prepList" style="display:block"></div>
    </section>
  </div>

  <section class="summary" id="summary" aria-label="이번 달 요약">
    <div class="fig"><span class="k" id="sumLabel">이번 달 강사료 (세전)</span><span class="v skel" id="sTotal">0,000,000원</span><span class="s" id="sTotalN">강의 0건</span></div>
    <div class="fig"><span class="k">입금 완료 (실수령)</span><span class="v skel" id="sPaid">0,000,000원</span><span class="s" id="sPaidN">0건</span></div>
    <div class="fig owed"><span class="k">미입금 (강의 끝남)</span><span class="v skel" id="sOwed">0,000,000원</span><span class="s" id="sOwedN">0건</span></div>
    <div class="fig"><span class="k">예정 (세전)</span><span class="v skel" id="sPlan">0,000,000원</span><span class="s" id="sPlanN">0건</span></div>
  </section>
  <p class="yearline" id="yearline">올해 누적을 불러오는 중이에요.</p>

  <div class="main">
    <section class="card" aria-label="달력">
      <div class="cal">
        <div class="legend">
          <span><i class="dot paid"></i>입금 완료</span>
          <span><i class="dot unpaid"></i>미입금</span>
          <span><i class="dot late"></i>30일 넘게 미입금</span>
          <span><i class="dot check"></i>금액 확인</span>
          <span><i class="dot plan"></i>예정 강의</span>
          <span><i class="dot other"></i>다른 일정</span>
        </div>
        <div class="wd"><div>일</div><div>월</div><div>화</div><div>수</div><div>목</div><div>금</div><div>토</div></div>
        <div class="grid" id="grid" role="grid" aria-label="월간 달력"></div>
      </div>
    </section>

    <aside class="side">
      <section class="card" id="dayCard" aria-live="polite">
        <div class="card-h"><h2 id="dayTitle">—</h2><span class="note" id="dayHol"></span></div>
        <ul class="day-list" id="dayList"></ul>
        <div style="padding:0 16px 16px"><button class="btn small" id="addDayBtn" type="button">+ 이날 강의 추가</button></div>
      </section>

      <section class="card" id="editorCard" hidden>
        <div class="card-h"><h2 id="editorHead">일정·강의 수정</h2></div>
        <form class="editor" id="editor" novalidate>
          <div class="fsec">
            <h3>일정</h3>
            <div class="field">
              <label for="fSummary">일정 이름</label>
              <input type="text" id="fSummary" autocomplete="off" placeholder="예: 신라공고 진로특강">
            </div>
            <div class="row2">
              <div class="field">
                <label for="fDate">날짜</label>
                <input type="date" id="fDate" min="2000-01-01" max="2099-12-31">
              </div>
              <div class="field">
                <span class="lab">&nbsp;</span>
                <label class="checkrow"><input type="checkbox" id="fAllDay"> 종일</label>
              </div>
            </div>
            <div class="row2" id="timeFields">
              <div class="field">
                <label for="fStart">시작</label>
                <input type="time" id="fStart" step="300">
              </div>
              <div class="field">
                <label for="fEnd">종료</label>
                <input type="time" id="fEnd" step="300">
              </div>
            </div>
            <div class="field">
              <label for="fLoc">장소 (선택)</label>
              <input type="text" id="fLoc" autocomplete="off" placeholder="예: 신라공고 본관 3층 시청각실">
            </div>
            <p class="note" id="recurNote" hidden>반복 일정이에요. 여기서 바꾸면 이 날짜 한 번만 바뀌어요.</p>
          </div>

          <div class="fsec">
            <h3>강의 정보</h3>
            <label class="checkrow"><input type="checkbox" id="fLecture"> 강의 일정으로 관리</label>
            <div class="field">
              <label for="fTopic">강의주제</label>
              <input type="text" id="fTopic" autocomplete="off" placeholder="예: AI 시대 직업 탐색">
            </div>
            <div class="field">
              <label for="fOrg">업체 (기관)</label>
              <input type="text" id="fOrg" autocomplete="off" placeholder="예: 신라공고, ○○교육센터">
            </div>
            <div class="row2">
              <div class="field">
                <label for="fFee">강의료 (세전)</label>
                <input type="text" id="fFee" inputmode="numeric" autocomplete="off" placeholder="300,000 또는 30만">
                <span class="hint" id="fFeeHint">&nbsp;</span>
              </div>
              <div class="field">
                <label for="fTax">원천징수</label>
                <select id="fTax">
                  <option value="3.3">3.3% (사업소득)</option>
                  <option value="8.8">8.8% (기타소득)</option>
                  <option value="0">공제 없음</option>
                </select>
              </div>
            </div>
          </div>

          <div class="fsec">
            <h3 id="paidLab">입금</h3>
            <div class="seg" role="radiogroup" aria-labelledby="paidLab">
              <input type="radio" name="paid" id="fPaidNo" value="no"><label for="fPaidNo">미입금</label>
              <input type="radio" name="paid" id="fPaidYes" value="yes"><label for="fPaidYes">입금 완료</label>
            </div>
            <div class="row2" id="paidFields">
              <div class="field">
                <label for="fPaidOn">입금일</label>
                <input type="date" id="fPaidOn" min="2000-01-01" max="2099-12-31">
              </div>
              <div class="field">
                <label for="fPaidAmt">입금액 (통장에 들어온 돈)</label>
                <input type="text" id="fPaidAmt" inputmode="numeric" autocomplete="off">
              </div>
            </div>
            <div class="calcbox" id="calcbox">
              <div><span>예상 실수령</span><b id="cExp">—</b></div>
              <div id="cDiffRow" hidden><span>입금액과 차이</span><b class="diff" id="cDiff">—</b></div>
            </div>
          </div>

          <div class="fsec prep-edit">
            <h3>준비할 것</h3>
            <ul id="prepEditList"></ul>
            <div class="prep-add">
              <input type="text" id="fPrepNew" autocomplete="off" placeholder="예: 활동지 30부 출력" aria-label="준비할 것 추가">
              <button type="button" class="btn small" id="prepAddBtn">추가</button>
            </div>
          </div>

          <p class="formerr" id="formErr" hidden></p>
          <div class="actions">
            <button type="submit" class="btn primary" id="saveBtn">구글 캘린더에 저장</button>
            <button type="button" class="btn" id="cancelBtn">닫기</button>
            <a id="openCal" href="#" target="_blank" rel="noopener">구글 캘린더에서 열기 ↗</a>
          </div>
          <div class="delrow" id="delRow">
            <button type="button" class="btn small danger" id="delBtn">이 일정 삭제</button>
            <div class="confirm" id="delConfirm" role="alertdialog" aria-labelledby="delMsg" hidden>
              <p id="delMsg"><b id="delName">—</b> 일정을 구글 캘린더에서 지울까요? 지우면 되돌릴 수 없어요.</p>
              <p class="note" id="delRecur" hidden>반복 일정이라 이 날짜 한 번만 지워져요.</p>
              <div class="actions">
                <button type="button" class="btn small danger-solid" id="delYes">삭제</button>
                <button type="button" class="btn small" id="delNo">취소</button>
              </div>
            </div>
          </div>
        </form>
      </section>
    </aside>
  </div>

  <div class="lower">
    <section class="card" aria-label="받을 돈">
      <div class="card-h"><h2>받을 돈</h2><span class="note" id="owedNote">강의가 끝났는데 입금이 확인되지 않은 건</span></div>
      <div class="tablebox">
        <table>
          <thead><tr><th>강의일</th><th>강의</th><th class="n">강사료</th><th>경과</th><th></th></tr></thead>
          <tbody id="owedBody"></tbody>
        </table>
      </div>
    </section>
    <section class="card" aria-label="월별 수입">
      <div class="card-h"><h2 id="chartTitle">월별 강사료</h2><span class="note">강의한 달 기준, 세전</span></div>
      <div class="chartbox">
        <div id="chart"></div>
        <div class="readout" id="readout">막대에 마우스를 올리거나 눌러 보세요.</div>
      </div>
      <p class="how">이 페이지에서 저장하면 일정 이름·날짜·시간·장소가 구글 캘린더에 바로 바뀌고, 설명란에는 <code>강의주제: …</code> <code>업체: …</code> <code>강사료: 300,000</code> <code>입금: 2026-11-20</code> 같은 줄이 적혀요. 휴대폰 캘린더 앱에서 직접 적어도 똑같이 반영돼요.</p>
    </section>
  </div>
</div>
<div class="toast" id="toast" role="status" hidden></div>
</div>`;
