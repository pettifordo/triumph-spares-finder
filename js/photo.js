/* Photo panel.
 *
 * Two paths, in order of usefulness:
 *   1. POST the picture to /api/identify, which asks Claude what the part is
 *      and turns the answer into a search. Needs ANTHROPIC_API_KEY set on the
 *      deployment; if it isn't there, the endpoint says so cleanly.
 *   2. Fall back to reverse-image search links. Those need you to upload the
 *      picture again at the far end — we can't push a local file into them —
 *      so the wording says that rather than pretending otherwise.
 */

(function () {
  const $ = (id) => document.getElementById(id);
  const dropzone = $('dropzone');
  const dropzoneText = $('dropzoneText');
  const fileInput = $('fileInput');
  const identifyBtn = $('identifyBtn');
  const clearBtn = $('clearPhotoBtn');
  const hint = $('photoHint');
  const reverseRow = $('reverseSearches');

  let current = null; // { dataUrl, mediaType, base64 }

  /* --------------------------------------------------- reverse searches */

  REVERSE_IMAGE_SEARCHES.forEach((s) => {
    const a = document.createElement('a');
    a.href = s.url;
    a.target = '_blank';
    a.rel = 'noopener noreferrer';
    a.className = 'ghost';
    a.style.textDecoration = 'none';
    a.textContent = s.label;
    reverseRow.appendChild(a);
  });

  /* ------------------------------------------------------- file handling */

  /* Phone photos are far bigger than any vision model needs. Downscaling in
   * the browser keeps the upload small and the request fast. */
  function downscale(file, maxEdge = 1400) {
    return new Promise((resolve, reject) => {
      const img = new Image();
      const url = URL.createObjectURL(file);
      img.onload = () => {
        URL.revokeObjectURL(url);
        const scale = Math.min(1, maxEdge / Math.max(img.width, img.height));
        const canvas = document.createElement('canvas');
        canvas.width = Math.round(img.width * scale);
        canvas.height = Math.round(img.height * scale);
        canvas.getContext('2d').drawImage(img, 0, 0, canvas.width, canvas.height);
        const dataUrl = canvas.toDataURL('image/jpeg', 0.85);
        resolve({
          dataUrl,
          mediaType: 'image/jpeg',
          base64: dataUrl.split(',')[1],
        });
      };
      img.onerror = () => { URL.revokeObjectURL(url); reject(new Error('That file could not be read as an image.')); };
      img.src = url;
    });
  }

  async function accept(file) {
    if (!file || !file.type.startsWith('image/')) {
      setHint('That doesn’t look like an image file.', true);
      return;
    }
    try {
      current = await downscale(file);
      dropzone.innerHTML = '';
      const img = document.createElement('img');
      img.src = current.dataUrl;
      img.alt = 'The part you uploaded';
      dropzone.appendChild(img);
      identifyBtn.disabled = false;
      clearBtn.disabled = false;
      setHint('Photo ready. “Identify this part” reads it and fills in the search box; the reverse-image links below are the manual route.');
    } catch (err) {
      setHint(err.message, true);
    }
  }

  function clearPhoto() {
    current = null;
    dropzone.innerHTML = '';
    const span = document.createElement('span');
    span.id = 'dropzoneText';
    span.textContent = 'Drop a photo here, or click to choose one';
    dropzone.appendChild(span);
    identifyBtn.disabled = true;
    clearBtn.disabled = true;
    fileInput.value = '';
    setHint('If the part identifier is switched on, the photo is read and turned into a search — model, area of the car and likely part name. Otherwise you can send it to a reverse-image search and copy back what it finds.');
  }

  function setHint(text, isWarning) {
    hint.textContent = text;
    hint.className = isWarning ? 'hint warn' : 'hint';
  }

  /* ----------------------------------------------------------- identify */

  async function identify() {
    if (!current) return;
    identifyBtn.disabled = true;
    const original = identifyBtn.textContent;
    identifyBtn.textContent = 'Looking at the photo…';
    setHint('Reading the photo…');

    try {
      const res = await fetch('/api/identify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ image: current.base64, mediaType: current.mediaType }),
      });

      if (res.status === 404) {
        setHint(
          'The part identifier isn’t running here — it only exists on the deployed site, and it needs an ' +
          'ANTHROPIC_API_KEY set. Use a reverse-image search below in the meantime, or describe the part in the search box.',
          true
        );
        return;
      }

      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        setHint(data.error || `The identifier returned an error (${res.status}).`, true);
        return;
      }

      applyIdentification(data);
    } catch (err) {
      setHint(
        'Couldn’t reach the part identifier. If you’re running this from a local file rather than a server, ' +
        'that’s expected — the reverse-image links below still work.',
        true
      );
    } finally {
      identifyBtn.textContent = original;
      identifyBtn.disabled = false;
    }
  }

  function applyIdentification(data) {
    const bits = [];
    if (data.model) bits.push(data.model);
    if (data.part) bits.push(data.part);
    const query = bits.join(' ').trim() || (data.keywords || []).join(' ');

    if (!query) {
      setHint('The photo was read but nothing specific came back. Try a clearer shot, or one with more of the surrounding car in frame.', true);
      return;
    }

    const confidence = typeof data.confidence === 'number' ? Math.round(data.confidence * 100) : null;
    const parts = [`Read as: ${query}.`];
    if (confidence !== null) parts.push(`Confidence ${confidence}%.`);
    if (data.reasoning) parts.push(data.reasoning);
    if (confidence !== null && confidence < 55) {
      parts.push('That’s a low-confidence read — check it against the part in your hand before ordering.');
    }
    setHint(parts.join(' '), confidence !== null && confidence < 55);

    if (window.TSF) window.TSF.setQuery(query);
  }

  /* ------------------------------------------------------------- events */

  dropzone.addEventListener('click', () => fileInput.click());
  dropzone.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); fileInput.click(); }
  });
  fileInput.addEventListener('change', () => accept(fileInput.files[0]));

  ['dragenter', 'dragover'].forEach((evt) =>
    dropzone.addEventListener(evt, (e) => { e.preventDefault(); dropzone.classList.add('dragging'); })
  );
  ['dragleave', 'drop'].forEach((evt) =>
    dropzone.addEventListener(evt, (e) => { e.preventDefault(); dropzone.classList.remove('dragging'); })
  );
  dropzone.addEventListener('drop', (e) => {
    const file = e.dataTransfer && e.dataTransfer.files[0];
    if (file) accept(file);
  });

  /* Paste a screenshot straight onto the page. */
  document.addEventListener('paste', (e) => {
    const item = [...(e.clipboardData?.items || [])].find((i) => i.type.startsWith('image/'));
    if (item) accept(item.getAsFile());
  });

  identifyBtn.addEventListener('click', identify);
  clearBtn.addEventListener('click', clearPhoto);
})();
