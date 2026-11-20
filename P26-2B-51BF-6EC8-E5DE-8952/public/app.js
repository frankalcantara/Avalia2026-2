let me = null, book = null;
async function loadMe(){
  const r = await fetch('/api/status?action=me');
  if(r.ok){ me = await r.json(); showUser(); }
}
function showUser(){
  document.getElementById('login-btn').classList.add('hidden');
  document.getElementById('user-info').classList.remove('hidden');
  document.getElementById('user-avatar').src = me.avatar;
  document.getElementById('user-name').textContent = me.username;
  document.getElementById('progress-section').classList.remove('hidden');
  document.getElementById('enroll-btn').classList.remove('hidden');
}
async function loadBook(){
  const r = await fetch('/api/status?action=book');
  const d = await r.json();
  book = d.book;
  document.getElementById('book-title').textContent = book.title;
  document.getElementById('book-meta').textContent = `${book.author} • ${book.total_chapters} capítulos • ${book.total_pages} páginas`;
  const el = document.getElementById('avatars');
  el.innerHTML = '';
  (d.readers||[]).forEach(u=>{
    const pct = Math.min(100,(u.current_page/book.total_pages)*100);
    const img = document.createElement('img');
    img.src = u.avatar; img.title = `${u.username} — pág. ${u.current_page} / cap. ${u.current_chapter}`;
    img.className='track-avatar'; img.style.left=pct+'%';
    el.appendChild(img);
  });
}
document.getElementById('enroll-btn').onclick = async ()=>{
  const r = await fetch('/api/status?action=enroll',{method:'POST',headers:{'Content-Type':'application/json'},body:'{}'});
  alert(r.ok?'Inscrito!':'Faça login primeiro'); loadBook();
};
document.getElementById('save-progress').onclick = async ()=>{
  const body={book_id:book.id,current_chapter:+document.getElementById('chapter-input').value,current_page:+document.getElementById('page-input').value};
  const r = await fetch('/api/status?action=progress',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)});
  document.getElementById('progress-msg').textContent = r.ok?'Progresso salvo!':'Erro ao salvar. Verifique login e inscrição.';
  loadBook();
};
document.getElementById('load-forum').onclick = async ()=>{
  const ch=document.getElementById('forum-chapter').value;
  const r = await fetch(`/api/status?action=forum&book_id=${book.id}&chapter=${ch}`);
  const d = await r.json();
  document.getElementById('forum-msg').textContent = r.ok?'':(d.error||'Bloqueado por anti-spoiler');
  document.getElementById('forum-list').innerHTML=(d.messages||[]).map(m=>`<li><img src="${m.avatar}"><b>${m.username}</b> — cap. ${m.chapter}<br>${m.content}</li>`).join('');
};
document.getElementById('send-forum').onclick = async ()=>{
  const body={book_id:book.id,chapter:+document.getElementById('forum-chapter').value,content:document.getElementById('forum-input').value};
  const r = await fetch('/api/status?action=forum',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)});
  document.getElementById('forum-msg').textContent = r.ok?'Publicado!':'Bloqueado: avance até esse capítulo para comentar.';
  document.getElementById('load-forum').click();
};
loadMe(); loadBook();