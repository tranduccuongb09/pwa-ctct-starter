/*************************************************
 * CTĐ, CTCT – APP.JS (không dùng Bộ đề thủ công)
 * - Tự trộn câu hỏi từ TẤT CẢ file trong 1 thư mục Drive
 * - Hỗ trợ Excel (.xlsx) + Google Sheets (tab "Câu hỏi")
 * - Gửi điểm + chi tiết về Google Sheets (Apps Script)
 **************************************************/

/***** CẤU HÌNH (THAY GIÁ TRỊ 2 DÒNG NÀY) *****/
const SHEET_API = 'https://script.google.com/macros/s/AKfycbx_rKQZR5QYRn_7uUkVl-KcohykyK6px7ztVRY-bpMAGPUmDuF0H3frwkPSH-JPA-Iy1Q/exec'; // URL /exec của Apps Script
const BANKS_FOLDER_ID = '1_-YhEHfYfF957yC6o-xyiPk06XRheKb6'; // Thư mục chứa Excel/Sheets ngân hàng câu hỏi

// Số câu / thời gian / số câu tối đa lấy từ mỗi file (0 = không giới hạn)
const TOTAL_QUESTIONS   = 30; // số câu cho mỗi đề
const DURATION_MINUTES  = 30; // thời gian làm bài (phút)
const MIX_PER_FILE_MAX  = 0;  // 0 = không giới hạn; >0 = tối đa lấy từ mỗi file

/***** TRẠNG THÁI *****/
let questions = [];
let selections = {};
let currentIndex = 0;
let timer, remainingSeconds;
let submitted = false;

/***** TIỆN ÍCH *****/
function shuffle(arr){ for(let i=arr.length-1;i>0;i--){ const j=Math.floor(Math.random()*(i+1)); [arr[i],arr[j]]=[arr[j],arr[i]];} return arr;}
function pad(n){ return n<10? '0'+n : ''+n; }
function classify(score, total){ const r=score/total; if(r>=0.9) return 'Giỏi'; if(r>=0.8) return 'Khá'; if(r>=0.6) return 'Đạt yêu cầu'; return 'Chưa đạt'; }

/***** LOAD CÂU HỎI – TRỘN TỪ TOÀN THƯ MỤC *****/
async function loadMixedQuestions(){
  const url = `${SHEET_API}?action=mixQuestions` +
              `&folderId=${encodeURIComponent(BANKS_FOLDER_ID)}` +
              `&limit=${TOTAL_QUESTIONS}` +
              `&perFile=${MIX_PER_FILE_MAX}` +
              `&tab=${encodeURIComponent('Câu hỏi')}`;
  const res = await fetch(url, { cache: 'no-store' });
  const data = await res.json();
  const bank = Array.isArray(data.questions) ? data.questions : [];
  if (!bank.length) throw new Error('Không lấy được câu hỏi từ thư mục ngân hàng.');
  questions = bank; // Server đã trộn & cắt limit
  const prog = document.getElementById('progress');
  if (prog) prog.textContent = `0/${questions.length}`;
}

/***** HIỂN THỊ *****/
function renderQuestion(){
  const q = questions[currentIndex];
  document.getElementById('qTitle').textContent = `Câu ${currentIndex+1}`;
  document.getElementById('qText').textContent  = q.question;

  const box = document.getElementById('options');
  box.innerHTML = '';
  // Radio nằm TRƯỚC nội dung, canh đều đẹp
  ['A','B','C','D'].forEach(k=>{
    const id = `opt_${currentIndex}_${k}`;
    const label = document.createElement('label');
    label.className = 'option';
    label.setAttribute('for', id);
    label.innerHTML = `
      <input type="radio" id="${id}" name="ans" value="${k}">
      <span class="opt-text"><b>${k}.</b> ${q.options[k] || ''}</span>
    `;
    box.appendChild(label);
  });

  // Khôi phục lựa chọn cũ nếu có
  if (selections[currentIndex]){
    const sel = document.querySelector(`input[name="ans"][value="${selections[currentIndex]}"]`);
    if (sel) sel.checked = true;
  }
  document.getElementById('progress').textContent = `${currentIndex+1}/${questions.length}`;
}

function startTimer(){
  remainingSeconds = DURATION_MINUTES * 60;
  const el = document.getElementById('time');
  const tick = () => {
    const m = Math.floor(remainingSeconds/60), s = remainingSeconds%60;
    el.textContent = `${pad(m)}:${pad(s)}`;
    remainingSeconds--;
    if (remainingSeconds < 0){
      clearInterval(timer);
      submitQuiz();
    }
  };
  tick();
  timer = setInterval(tick, 1000);
}

/***** MAIN – chỉ chạy ở quiz.html (tránh lỗi ở trang khác) *****/
window.addEventListener('DOMContentLoaded', () => {
  const isQuiz = document.getElementById('quizBox') && document.getElementById('startBtn');
  if (!isQuiz) return;

  const startBtn   = document.getElementById('startBtn');
  const startCard  = document.getElementById('startCard');
  const quizBox    = document.getElementById('quizBox');
  const resultCard = document.getElementById('resultCard');

  startBtn.addEventListener('click', async () => {
    const name     = document.getElementById('fullname').value.trim();
    const unit     = document.getElementById('unit').value.trim();
    const position = document.getElementById('position').value.trim();
    if (!name || !unit || !position){
      alert('Vui lòng nhập đầy đủ Họ tên, Đơn vị, Chức vụ.');
      return;
    }

    try{
      await loadMixedQuestions(); // ← trộn từ TOÀN THƯ MỤC
    }catch(e){
      alert(e.message || 'Lỗi tải câu hỏi. Kiểm tra SHEET_API / BANKS_FOLDER_ID.');
      return;
    }

    startCard.hidden = true;
    quizBox.hidden   = false;
    renderQuestion();
    startTimer();
  });

  document.getElementById('nextBtn').addEventListener('click', () => {
    const c = document.querySelector('input[name="ans"]:checked');
    if (c) selections[currentIndex] = c.value;
    if (currentIndex < questions.length - 1){
      currentIndex++;
      renderQuestion();
    }
  });

  document.getElementById('prevBtn').addEventListener('click', () => {
    const c = document.querySelector('input[name="ans"]:checked');
    if (c) selections[currentIndex] = c.value;
    if (currentIndex > 0){
      currentIndex--;
      renderQuestion();
    }
  });

  document.getElementById('submitBtn').addEventListener('click', submitQuiz);

  async function submitQuiz(){
    if (submitted) return; submitted = true;
    const btn = document.getElementById('submitBtn'); if (btn) btn.disabled = true;

    clearInterval(timer);
    const c = document.querySelector('input[name="ans"]:checked');
    if (c) selections[currentIndex] = c.value;

    // Tính điểm + chi tiết
    let score = 0;
    const details = questions.map((q, i) => {
      const chosen = selections[i] || '';
      const ok = chosen === q.answer;
      if (ok) score++;
      return {
        index: i+1,
        question: q.question,
        chosen,
        correct: q.answer,
        isCorrect: ok
      };
    });

    const total    = questions.length;
    const name     = document.getElementById('fullname').value.trim();
    const unit     = document.getElementById('unit').value.trim();
    const position = document.getElementById('position').value.trim();

    document.getElementById('resultText').textContent =
      `${name} - ${unit} (${position}): ${score}/${total} điểm`;
    document.getElementById('classification').textContent =
      'Xếp loại: ' + classify(score, total);

    document.getElementById('quizBox').hidden   = true;
    document.getElementById('resultCard').hidden = false;

    // Gửi Google Sheet qua Apps Script
    try{
    await fetch(SHEET_API, {
    method: 'POST',
    mode: 'no-cors',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      examCode: '',              // ← để trống: server tự sinh mã đề 4 chữ số, tránh trùng
      name, unit, position,
      score, total,
      details,
      timestamp: new Date().toISOString()
    })
    });
    }catch(_){
      // bỏ qua lỗi mạng/no-cors
    }
  }
});


