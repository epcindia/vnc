const apiBase = '';

async function fetchJson(path, opts) {
  const res = await fetch(path, opts);
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

function el(tag, inner = '') { const e = document.createElement(tag); if (inner) e.innerHTML = inner; return e; }

async function loadCategories(container) {
  container.innerHTML = '';
  const list = await fetchJson('/api/categories');
  const ul = el('ul');
  list.forEach(c => {
    const li = el('li', `<strong>${c.name}</strong> (order: ${c.order}) <button data-id='${c.id}' class='edit'>Edit</button> <button data-id='${c.id}' class='del'>Delete</button>`);
    ul.appendChild(li);
  });
  container.appendChild(ul);

  const form = el('div');
  form.innerHTML = `<h3>Add Category</h3>
    <input id='cat-name' placeholder='Name' />
    <input id='cat-order' placeholder='Order' type='number' />
    <button id='add-cat'>Add</button>`;
  container.appendChild(form);

  container.querySelector('#add-cat').onclick = async () => {
    const name = container.querySelector('#cat-name').value;
    const order = parseInt(container.querySelector('#cat-order').value || '0');
    await fetchJson('/api/categories', { method: 'POST', headers: {'Content-Type':'application/json'}, body: JSON.stringify({ name, order}) });
    loadCategories(container);
  };

  container.querySelectorAll('.del').forEach(btn => btn.onclick = async (e) => {
    const id = e.target.getAttribute('data-id');
    await fetch(`/api/categories/${id}`, { method: 'DELETE' });
    loadCategories(container);
  });

  // Edit buttons
  container.querySelectorAll('.edit').forEach(btn => btn.onclick = async (e) => {
    const id = e.target.getAttribute('data-id');
    const c = list.find(x => x.id === id);
    const formHtml = `<h3>Edit Category</h3>
      <input id='edit-cat-name' value='${c.name}' />
      <input id='edit-cat-order' type='number' value='${c.order}' />
      <button id='save-cat'>Save</button>`;
    container.innerHTML = formHtml;
    container.querySelector('#save-cat').onclick = async () => {
      const name = container.querySelector('#edit-cat-name').value;
      const order = parseInt(container.querySelector('#edit-cat-order').value || '0');
      await fetchJson(`/api/categories/${id}`, { method: 'PUT', headers: {'Content-Type':'application/json'}, body: JSON.stringify({ name, order }) });
      loadCategories(container);
    };
  });
}

async function loadArticles(container) {
  container.innerHTML = '';
  const cats = await fetchJson('/api/categories');
  // form to add
  const form = el('div');
  form.innerHTML = `<h3>Add Article</h3>
    <input id='a-title' placeholder='Title' />
    <input id='a-desc' placeholder='Description' />
  <input id='a-img' placeholder='Image URL' />
  <input type='file' id='a-img-file' accept='image/*' />
    <input id='a-author' placeholder='Author' />
    <input id='a-source' placeholder='Source URL' />
    <select id='a-cat'>${cats.map(c => `<option value='${c.id}'>${c.name}</option>`).join('')}</select>
    <textarea id='a-content' placeholder='Content'></textarea>
    <button id='add-article'>Add</button>`;
  container.appendChild(form);

  container.querySelector('#add-article').onclick = async () => {
    const title = container.querySelector('#a-title').value;
    const description = container.querySelector('#a-desc').value;
    let imageUrl = container.querySelector('#a-img').value;
    const fileInput = container.querySelector('#a-img-file');
    if (fileInput.files.length > 0) {
      const formData = new FormData();
      formData.append('image', fileInput.files[0]);
      const res = await fetch('/api/upload', { method: 'POST', body: formData });
      if (res.ok) {
        const data = await res.json();
        imageUrl = data.url;
      } else {
        alert('Image upload failed');
        return;
      }
    }
    const author = container.querySelector('#a-author').value;
    const sourceUrl = container.querySelector('#a-source').value;
    const categoryId = container.querySelector('#a-cat').value;
    const content = container.querySelector('#a-content').value;
    await fetchJson('/api/articles', { method: 'POST', headers: {'Content-Type':'application/json'}, body: JSON.stringify({ title, description, imageUrl, author, sourceUrl, categoryId, content }) });
    loadArticles(container);
  };

  // list all articles
  const list = await fetchJson('/api/categories');
  const articlesDiv = el('div');
  for (const c of list) {
    const arts = await fetchJson(`/api/categories/${c.id}/articles`);
    const h = el('h4', `${c.name}`);
    articlesDiv.appendChild(h);
    if (arts.length === 0) {
      articlesDiv.appendChild(el('div', '<em>No articles</em>'));
    } else {
      arts.forEach(a => {
        const row = el('div', `<strong>${a.title}</strong> <button data-id='${a.id}' class='edit-article'>Edit</button> <button data-id='${a.id}' class='del-article'>Delete</button>`);
        articlesDiv.appendChild(row);
      });
    }
  }
  container.appendChild(articlesDiv);

  container.querySelectorAll('.del-article').forEach(btn => btn.onclick = async (e) => {
    const id = e.target.getAttribute('data-id');
    await fetch(`/api/articles/${id}`, { method: 'DELETE' });
    loadArticles(container);
  });

  // Edit article
  container.querySelectorAll('.edit-article').forEach(btn => btn.onclick = async (e) => {
    const id = e.target.getAttribute('data-id');
    const art = await fetchJson(`/api/articles/${id}`);
    const formHtml = `<h3>Edit Article</h3>
      <input id='edit-title' value='${art.title}' />
      <input id='edit-desc' value='${art.description}' />
      <input id='edit-img' value='${art.imageUrl}' />
      <input id='edit-author' value='${art.author}' />
      <input id='edit-source' value='${art.sourceUrl}' />
      <select id='edit-cat'>${cats.map(c => `<option value='${c.id}' ${c.id===art.categoryId?'selected':''}>${c.name}</option>`).join('')}</select>
      <textarea id='edit-content'>${art.content}</textarea>
      <button id='save-article'>Save</button>`;
    container.innerHTML = formHtml;
    container.querySelector('#save-article').onclick = async () => {
      const title = container.querySelector('#edit-title').value;
      const description = container.querySelector('#edit-desc').value;
      const imageUrl = container.querySelector('#edit-img').value;
      const author = container.querySelector('#edit-author').value;
      const sourceUrl = container.querySelector('#edit-source').value;
      const categoryId = container.querySelector('#edit-cat').value;
      const content = container.querySelector('#edit-content').value;
      await fetchJson(`/api/articles/${id}`, { method: 'PUT', headers: {'Content-Type':'application/json'}, body: JSON.stringify({ title, description, content, imageUrl, author, categoryId, sourceUrl }) });
      loadArticles(container);
    };
  });
}

async function loadAds(container) {
  container.innerHTML = '';
  const ads = await fetchJson('/api/ads');
  const div = el('div');
  ads.forEach(a => div.appendChild(el('div', `<img src='${a.imageUrl}' alt='ad' style='max-width:200px'/> <div>${a.placement} - ${a.type} <button data-id='${a.id}' class='edit-ad'>Edit</button> <button data-id='${a.id}' class='del-ad'>Delete</button></div>`)));
  container.appendChild(div);

  const form = el('div');
  form.innerHTML = `<h3>Add Ad</h3>
    <input id='ad-type' placeholder='type (banner/interstitial)' />
    <input id='ad-placement' placeholder='placement (top/bottom/interstitial)' />
  <input id='ad-img' placeholder='imageUrl' />
  <input type='file' id='ad-img-file' accept='image/*' />
    <input id='ad-click' placeholder='clickUrl' />
    <button id='add-ad'>Add</button>`;
  container.appendChild(form);

  container.querySelector('#add-ad').onclick = async () => {
    const type = container.querySelector('#ad-type').value;
    const placement = container.querySelector('#ad-placement').value;
    let imageUrl = container.querySelector('#ad-img').value;
    const fileInput = container.querySelector('#ad-img-file');
    if (fileInput.files.length > 0) {
      const formData = new FormData();
      formData.append('image', fileInput.files[0]);
      const res = await fetch('/api/upload', { method: 'POST', body: formData });
      if (res.ok) {
        const data = await res.json();
        imageUrl = data.url;
      } else {
        alert('Image upload failed');
        return;
      }
    }
    const clickUrl = container.querySelector('#ad-click').value;
    await fetchJson('/api/ads', { method: 'POST', headers: {'Content-Type':'application/json'}, body: JSON.stringify({ type, placement, imageUrl, clickUrl }) });
    loadAds(container);
  };

  container.querySelectorAll('.del-ad').forEach(btn => btn.onclick = async (e) => {
    const id = e.target.getAttribute('data-id');
    await fetch(`/api/ads/${id}`, { method: 'DELETE' });
    loadAds(container);
  });

  // Edit ad
  container.querySelectorAll('.edit-ad').forEach(btn => btn.onclick = async (e) => {
    const id = e.target.getAttribute('data-id');
    const ad = (await fetchJson('/api/ads')).find(x => x.id === id);
    const formHtml = `<h3>Edit Ad</h3>
      <input id='edit-ad-type' value='${ad.type}' />
      <input id='edit-ad-placement' value='${ad.placement}' />
      <input id='edit-ad-img' value='${ad.imageUrl}' />
      <input id='edit-ad-click' value='${ad.clickUrl}' />
      <button id='save-ad'>Save</button>`;
    container.innerHTML = formHtml;
    container.querySelector('#save-ad').onclick = async () => {
      const type = container.querySelector('#edit-ad-type').value;
      const placement = container.querySelector('#edit-ad-placement').value;
      const imageUrl = container.querySelector('#edit-ad-img').value;
      const clickUrl = container.querySelector('#edit-ad-click').value;
      await fetchJson(`/api/ads/${id}`, { method: 'PUT', headers: {'Content-Type':'application/json'}, body: JSON.stringify({ type, placement, imageUrl, clickUrl }) });
      loadAds(container);
    };
  });

  // Edit ads
  container.querySelectorAll('.del-ad').forEach(() => {});
}

document.getElementById('tab-categories').onclick = () => loadCategories(document.getElementById('content'));
document.getElementById('tab-articles').onclick = () => loadArticles(document.getElementById('content'));
document.getElementById('tab-ads').onclick = () => loadAds(document.getElementById('content'));

// login/logout
document.getElementById('btn-login').onclick = async () => {
  const pass = document.getElementById('admin-pass').value;
  try {
    await fetchJson('/admin/login', { method: 'POST', headers: {'Content-Type':'application/json'}, body: JSON.stringify({ password: pass }) });
    document.getElementById('btn-login').style.display = 'none';
    document.getElementById('btn-logout').style.display = 'inline-block';
    alert('Logged in');
  } catch (e) { alert('Login failed'); }
};

document.getElementById('btn-logout').onclick = async () => {
  await fetchJson('/admin/logout', { method: 'POST' });
  document.getElementById('btn-login').style.display = 'inline-block';
  document.getElementById('btn-logout').style.display = 'none';
};

// default view
loadCategories(document.getElementById('content'));
