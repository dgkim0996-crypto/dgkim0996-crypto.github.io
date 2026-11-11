// 움직이는 설명: 화면에 들어오면 한 번 재생하고, 끝나면 "다시 보기"를 보여 준다.
// 동작 줄이기 설정이면 움직이지 않고 마지막 상태만 보여 준다.
// (재생 엔진은 정건희 포트폴리오의 motion.js를 그대로 쓰고, 장면만 이 페이지 내용으로 바꿨다.)
(() => {
  const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  const scenes = {
    // FantaSteel: 검사 판정이 바뀌면 재고와 수주 예약을 다시 맞춘다 (inventory.onLotsEligibilityChanged)
    reserve: {
      reset(c) {
        c.clearNodes();
        c.req('a', '', '준비');
        c.req('b', '', '준비');
        c.out('avail', '0매');
        c.out('resv', '0 / 3매');
        c.cap('수주 품목 3매가 아직 확보되지 않은 상태에서 검사 판정이 들어온 경우입니다.');
      },
      steps: [
        [500, (c) => { c.req('a', 'run', '진행'); c.at(1, 'A'); c.cap('슬래브 3매가 합격 판정을 받았습니다. 히트 판정이면 하위 슬래브·코일까지 함께 봅니다.'); }],
        [1700, (c) => { c.at(2, 'A'); c.flash('avail', '3매'); c.cap('규격별 재고를 적격·가용 LOT 수로 다시 맞춥니다. 가용 재고가 3매가 됩니다.'); }],
        [2900, (c) => { c.at(3, 'A'); c.flash('resv', '3 / 3매'); c.cap('늘어난 매수 안에서, 그 LOT을 만든 계획의 수주 품목에 미확보 매수만큼 1매씩 자동 예약합니다.'); }],
        [4100, (c) => { c.at(4, 'A'); c.cap('시스템이 한 일로 작업 로그를 남기고, 검사 등록과 함께 커밋합니다.'); }],
        [5200, (c) => { c.req('a', 'ok', '커밋'); c.req('b', 'run', '진행'); c.at(1, 'B'); c.cap('나중에 측정값이 고쳐져 1매가 불합격으로 바뀌었습니다.'); }],
        [6400, (c) => { c.at(2, 'B'); c.flash('avail', '2매'); c.cap('재고를 다시 맞추면 가용은 2매입니다.'); }],
        [7600, (c) => { c.at(3, 'B'); c.flash('resv', '2 / 3매'); c.cap('그 LOT에 확정 배정이 있었다면 먼저 풀고, 가용을 넘는 예약 1매를 줄입니다.'); }],
        [8800, (c) => { c.at(4, 'B'); c.req('b', 'ok', '커밋'); c.cap('줄인 사유를 품질 불합격(QUALITY_FAILURE)으로 남깁니다.'); }],
        [10000, (c) => { c.clearNodes(); c.cap('같은 판정으로 여러 번 불러도 재고와 예약은 같은 값이 됩니다. 이 흐름을 검사 등록 API부터 끝까지 테스트로 고정했습니다.'); }],
      ],
    },

    // OPIc: 재학습한 후보 모델은 관문 세 개와 섀도 채점을 지나야 승격된다 (가상의 후보 두 개)
    gate: {
      reset(c) {
        c.clearNodes();
        c.req('a', '', '대기');
        c.req('b', '', '대기');
        c.out('live', 'v1');
        c.cap('가상의 재학습 후보 두 개가 관문을 지나는 경우입니다.');
      },
      steps: [
        [500, (c) => { c.req('a', 'run', '평가 중'); c.at(1, 'A'); c.cap('후보 A를 지금 모델과 같은 데이터로 다시 채점합니다. 독립 검증 세트에서 문항 MAE가 0.03 넘게 나빠지지 않았습니다.'); }],
        [1800, (c) => { c.at(2, 'A'); c.cap('학습에 쓰지 않은 실제 성적 세션에서도 MAE가 0.05 넘게 나빠지지 않았습니다.'); }],
        [3100, (c) => { c.at(3, 'A'); c.cap('외운 답변, 짧지만 잘한 답변 같은 유형별 편향이 ±0.5단계 안입니다.'); }],
        [4400, (c) => { c.at(4, 'A'); c.req('a', 'run', '섀도 채점'); c.cap('통과한 후보는 7일 동안 사용자에게 보이지 않게 함께 채점합니다.'); }],
        [5700, (c) => { c.at(5, 'A'); c.req('a', 'ok', '승격'); c.flash('live', 'v2'); c.cap('관리자가 승격하면 서비스 모델이 바뀝니다. 문제가 생기면 바로 이전 버전으로 되돌립니다.'); }],
        [7000, (c) => { c.req('b', 'run', '평가 중'); c.at(1, 'B'); c.cap('후보 B도 같은 순서로 평가합니다. 검증 세트 기준은 통과했습니다.'); }],
        [8100, (c) => { c.at(2, 'B'); c.cap('실제 성적 기준도 통과했습니다.'); }],
        [9200, (c) => { c.at(3, 'B', 'no'); c.req('b', 'no', '탈락'); c.cap('그런데 암기 템플릿 답변을 후하게 보는 편향이 ±0.5단계를 넘어 탈락합니다.'); }],
        [10700, (c) => { c.clearNodes(); c.cap('관문에서 떨어진 모델은 어떤 방법으로도 승격되지 않습니다. 서비스 모델은 v2 그대로입니다.'); }],
      ],
    },

    // 포스코증권: 응답이 사라져 같은 주문을 다시 보내도 한 번만 처리된다 (021_order_idempotency.sql)
    order: {
      reset(c) {
        c.clearNodes();
        c.req('a', '', '준비');
        c.req('b', '', '준비');
        c.out('cash', '1,000만원');
        c.out('orders', '0건');
        c.cap('70만원어치 매수 주문을 보냈는데 응답이 중간에 사라진 경우입니다.');
      },
      steps: [
        [500, (c) => { c.req('a', 'run', '진행'); c.at(1, 'A'); c.cap('첫 요청이 DB 함수 안에서 계좌 행을 FOR UPDATE로 잠급니다.'); }],
        [1700, (c) => { c.at(2, 'A'); c.cap('처음 보는 clientOrderId라 그대로 진행합니다.'); }],
        [2900, (c) => { c.at(3, 'A'); c.flash('cash', '930만원'); c.cap('주문가능금액에서 예약금 70만원을 뺍니다.'); }],
        [4100, (c) => { c.at(4, 'A'); c.flash('orders', '1건'); c.cap('주문과 접수 결과를 같은 트랜잭션에 저장하고 커밋합니다.'); }],
        [5300, (c) => { c.clearNodes(); c.req('a', 'ok', '커밋, 응답 유실'); c.cap('그런데 응답이 화면에 닿기 전에 연결이 끊겼습니다. 화면은 같은 ID로 다시 보냅니다.'); }],
        [6600, (c) => { c.req('b', 'run', '진행'); c.at(1, 'B'); c.cap('재전송도 같은 계좌 행을 잠급니다.'); }],
        [7800, (c) => { c.at(2, 'B'); c.req('b', 'ok', '저장된 결과'); c.cap('같은 clientOrderId의 접수 결과가 이미 있어, 차감과 저장을 건너뛰고 그 결과를 그대로 돌려줍니다.'); }],
        [9300, (c) => { c.clearNodes(); c.cap('결과: 주문은 1건, 예약금도 한 번만 빠집니다. 같은 ID로 주문 내용을 바꿔 보내면 409로 거부합니다.'); }],
      ],
    },
  };

  document.querySelectorAll('[data-sim]').forEach((root) => {
    const scene = scenes[root.dataset.sim];
    if (!scene) return;
    const capEl = root.querySelector('.sim-cap');
    const nodes = [...root.querySelectorAll('.node2[data-step]')];
    let timers = [];

    const c = {
      root,
      cap(text) { capEl.textContent = text; },
      out(name, value) {
        const el = root.querySelector(`[data-out="${name}"]`);
        if (el) el.textContent = value;
        return el;
      },
      flash(name, value) {
        const el = this.out(name, value);
        if (!el || reduce) return;
        el.classList.add('flash');
        timers.push(setTimeout(() => el.classList.remove('flash'), 900));
      },
      req(id, state, text) {
        const el = root.querySelector(`[data-req="${id}"]`);
        el.classList.remove('run', 'ok', 'no');
        if (state) el.classList.add(state);
        el.querySelector('.st').textContent = text;
      },
      clearNodes() {
        nodes.forEach((n) => { n.classList.remove('at', 'no'); delete n.dataset.who; });
      },
      at(step, who, state = 'at') {
        this.clearNodes();
        const n = nodes.find((x) => x.dataset.step === String(step));
        if (!n) return;
        n.classList.add(state);
        if (who) n.dataset.who = who;
      },
    };

    const finish = () => { root.classList.remove('playing'); root.classList.add('done'); };
    const play = () => {
      timers.forEach(clearTimeout);
      timers = [];
      root.classList.remove('done');
      scene.reset(c);
      if (reduce) {
        scene.steps.forEach(([, fn]) => fn(c));
        finish();
        return;
      }
      root.classList.add('playing');
      let end = 0;
      for (const [ms, fn] of scene.steps) {
        timers.push(setTimeout(() => fn(c), ms));
        end = Math.max(end, ms);
      }
      timers.push(setTimeout(finish, end + 400));
    };

    root.querySelector('.replay')?.addEventListener('click', play);
    const io = new IntersectionObserver(([entry]) => {
      if (!entry.isIntersecting) return;
      io.disconnect();
      play();
    }, { threshold: 0.35 });
    io.observe(root);
  });
})();
