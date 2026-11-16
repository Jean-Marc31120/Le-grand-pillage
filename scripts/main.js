// Set up DB
function showFatal(msg) {
  var d = document.getElementById('fatal-error');
  if (!d) {
    d = document.createElement('div');
    d.id = 'fatal-error';
    d.style.cssText = 'background:#b3261e;color:#fff;padding:16px 24px;' +
      'margin:16px 0;border-radius:8px;font-size:16px;line-height:1.5';
    document.body.insertBefore(d, document.body.firstChild);
  }
  d.innerHTML = msg;
}

function loadData(dbFile) {
  if (!dbFile) { return; }

  if (location.protocol === 'file:') {
    showFatal('<strong>Impossible de charger la base de données.</strong> ' +
      'Vous avez ouvert le fichier directement. Les navigateurs interdisent ' +
      'alors le moteur SQL.<br><br>Démarrez un petit serveur local dans le ' +
      'dossier <code>sql-pillage</code>, puis ouvrez ' +
      '<strong>http://localhost:8471</strong> :<br><code>python -m http.server 8471</code>');
    return;
  }

  if (!window.Worker) {
    showFatal('<strong>Impossible de charger la base de données.</strong> ' +
      'Ce navigateur ne prend pas en charge les Web Workers. Essayez un ' +
      'navigateur récent (Chrome, Edge, Firefox).');
    return;
  }

  try {
    window.worker = new Worker("scripts/worker.sql.js");
  } catch (e) {
    showFatal('<strong>Impossible de démarrer le moteur SQL.</strong> ' +
      'Détail technique : ' + e.message);
    return;
  }

  var xhr = new XMLHttpRequest();
  xhr.open('GET', dbFile + '?v=' + Date.now(), true);
  xhr.responseType = 'arraybuffer';
  xhr.onerror = () => {
    showFatal('<strong>Impossible de télécharger la base de données</strong> ' +
      '(<code>' + dbFile + '</code>). Vérifiez que le serveur local est bien ' +
      'lancé dans le dossier <code>sql-pillage</code> et que vous ouvrez ' +
      '<strong>http://localhost:8471</strong>.');
  };
  xhr.onload = () => {
    if (xhr.status !== 200 || !xhr.response) { xhr.onerror(); return; }
    var uInt8Array = new Uint8Array(xhr.response);
    worker.onmessage = event => {
       if (event.data.ready) {
         query('SELECT 1', (e) => {
           console.log('DB initialization successful');
           window.dbReady = true;
           document.querySelectorAll("input.sql-exercise-submit").forEach(
             (button) => {button.disabled = false;});
         });
       } else {
         showFatal('<strong>La base de données n’a pas pu être ouverte.</strong> ' +
           'Rechargez la page ; si le problème persiste, régénérez ' +
           '<code>pillage.db</code> avec <code>tools/build_db.py</code>.');
       }
    }

    worker.postMessage({
      id:1,
      action:'open',
      buffer: uInt8Array,
    });
  }
  xhr.send();

  setTimeout(() => {
    var stillDisabled = Array.prototype.every.call(
      document.querySelectorAll("input.sql-exercise-submit"),
      (b) => b.disabled);
    if (stillDisabled && !document.getElementById('fatal-error')) {
      showFatal('<strong>La base de données tarde à démarrer.</strong> ' +
        'Rechargez la page (Ctrl+F5). Assurez-vous d’ouvrir ' +
        '<strong>http://localhost:8471</strong> et non le fichier HTML.');
    }
  }, 10000);
}

function query(sql, cb, err_cb) {
  if (err_cb) {
    worker.onerror = e => err_cb(e);
  } else {
    worker.onerror = e => { throw new Error(e.message); }
  }

  worker.onmessage = event => {
    cb(event.data.results);
  }
  worker.postMessage({
      id: 2,
      action: 'exec',
      sql: sql
  });
}

function datatable (data) {
  var tbl = document.createElement("table");
  tbl.className = 'datatable'

  var header_labels = data[0].columns;
  for (var idx in header_labels) {
    var col = document.createElement('col');
    col.className = header_labels[idx];
    tbl.appendChild(col);
  }

  // create header row
  var thead = tbl.createTHead();
  var row = thead.insertRow(0);
  for (var idx in header_labels) {
    var cell = row.insertCell(idx);
    cell.innerHTML = header_labels[idx];
  }

  // fill table body
  var tbody = document.createElement("tbody");
  for (var row_idx in data[0]['values']) {
    var body_row = tbody.insertRow();
    for (var header_idx in header_labels) {
      var body_cell = body_row.insertCell();
      body_cell.appendChild(document.createTextNode(data[0]['values'][row_idx][header_idx]));
    }
  }
  tbl.appendChild(tbody);
  return tbl;
}


//////////////////////////
// SQL Quiz Component
//////////////////////////

function setdiff(a, b) { // https://stackoverflow.com/a/36504668
  var seta = new Set(a);
  var setb = new Set(b);
  var res = new Set([...seta].filter(x => !setb.has(x)));
  return res
}

class sqlQuizOption extends HTMLElement {
  constructor() {
    super();
  }

  connectedCallback() {
    var value = this.getAttribute('data-value') || ''
    var statement = this.getAttribute('data-statement') || '';
    var dataCorrect = this.getAttribute('data-correct') || false;
    var hint = this.getAttribute('data-hint') || '';

    var quizoption = `
    <div class='sqlOption'>
      <label>
        <input type=checkbox name="input"
            data-correct=${dataCorrect}
            value=${value} />
          <div class="optionText">
            ${statement}
            <div class="hintSpan">${hint}</div>
          </div>
      </label>
    </div>
    `
    this.parentNode.querySelector('.sqlQuizOptions').insertAdjacentHTML("beforeend", quizoption);
  }
}

customElements.define('sql-quiz-option', sqlQuizOption);


class sqlQuiz extends HTMLElement {
  constructor() {
    super();
  }

  connectedCallback() {
    var title = this.getAttribute('data-title') || '';
    var description = this.getAttribute('data-description') || '';

    var homeDiv = document.createElement('div');
    homeDiv.className = 'sqlQuizHomeDiv';

    if (title) {
      var caption = `<div class="sqlQuizTitle">${title}</div>`;
      homeDiv.insertAdjacentHTML("beforeend", caption);
    }

    if (description) {
      var commentbox = `
      <div class="sqlQuizDescription">
        ${description}
      </div>
      `
      homeDiv.insertAdjacentHTML("beforeend", commentbox);
    }

    var form = document.createElement('form');

    // Input Area
    var inputArea = document.createElement('div');
    inputArea.className = 'sqlQuizInputArea';

    var options = document.createElement('div');
    options.className = 'sqlQuizOptions';
    inputArea.appendChild(options);

    var submitButton = document.createElement('input');
    submitButton.type = 'submit';
    submitButton.value = 'Vérifier les réponses';
    inputArea.appendChild(submitButton);

    var hintButton = document.createElement('input');
    hintButton.name = "hint";
    hintButton.type = "button";
    hintButton.value = "Show Explanations";
    hintButton.onclick = (e) => {
      document.querySelectorAll('.hintSpan').forEach(i => i.style.display = 'table-row');
    };
    inputArea.appendChild(hintButton);
    form.appendChild(inputArea);

    // Output Area
    var outputArea = document.createElement('div');
    outputArea.className = 'sqlQuizOutputArea';

    var outputBox = document.createElement('output');
    outputBox.name = 'output';
    outputArea.appendChild(outputBox);

    // Link everything together
    form.appendChild(outputArea);
    form['onsubmit'] = (e) => {
      e && e.preventDefault();
      var value = Array.prototype.filter.call(form.input, i => i.checked).map(i => i.value);
      var correct = Array.prototype.filter.call(form.input, i => i.dataset.correct === "true").map(i => i.value);
      var mistakes = setdiff(correct, value).size + setdiff(value, correct).size;
      var res = mistakes >= 2 ? mistakes + " erreurs" :
          mistakes == 1 ? "Une erreur" : "Tout est correct !"
      form.output.innerHTML = `<div class='returnOkay'>${res}</div>`;
    };

    homeDiv.append(form);
    this.append(homeDiv);
    }
}
customElements.define('sql-quiz', sqlQuiz);

//////////////////////////
// SQL Exercise Component
//////////////////////////

class sqlExercise extends HTMLElement {
  constructor() {
    super();
  }

  connectedCallback() {
    var question = this.getAttribute('data-question') || '';
    var comment = this.getAttribute('data-comment') || '';
    var defaultText = this.getAttribute('data-default-text') || '';
    var solution = this.getAttribute('data-solution') || '';
    var hideSolution = this.getAttribute('data-hide-solution') || false;
    var orderSensitive = this.getAttribute('data-orderSensitive') || false;

    var homeDiv = document.createElement('div');
    homeDiv.className = 'sqlExHomeDiv';

    if (question) {
      var caption = `<div class="sqlExQuestion">${question}</div>`;
      homeDiv.insertAdjacentHTML("beforeend", caption);
    }

    if (comment) {
      var commentbox = `<div class = 'sqlExComment'>${comment}</div>`;
      homeDiv.insertAdjacentHTML("beforeend", commentbox);
    }

    if (solution && hideSolution) {
      homeDiv.insertAdjacentHTML("beforeend",
        `<div class='sqlExSpoiler'>` +
        `<input type='button' class='sqlExSpoilerToggle' value='Voir la solution'>` +
        `<div class='sqlExSpoilerBody'><code></code></div></div>`);
    }

    var form = document.createElement('form');

    // Input Area
    var inputArea = document.createElement('div');
    inputArea.className = 'sqlExInputArea';

    var textArea = document.createElement('textarea');
    textArea.textContent = defaultText;
    textArea.name = 'input';
    inputArea.appendChild(textArea);

    var editor = CodeMirror.fromTextArea(textArea, {
      mode: 'text/x-sql',
      indentWithTabs: true,
      smartIndent: true,
      lineNumbers: true,
      textWrapping: false,
      autoRefresh: true,
      theme: 'neat',
      viewportMargin: Infinity
    });

    editor.setSize('100%', 'auto');
    editor.refresh();

    var runButton = `<input class="sql-exercise-submit" type="submit" value="Exécuter &#x21e9;" disabled>`;
    inputArea.insertAdjacentHTML("beforeend", runButton);
    if (window.dbReady) {
      inputArea.querySelector('.sql-exercise-submit').disabled = false;
    }

    form['onsubmit'] = (e) => {
      e && e.preventDefault();
      var result_div = document.createElement('div');

      var handleSubmit = (submission_data) => {
        result_div.className = 'returnOkay';

        if (solution) {
          var verdict_div = document.createElement('div');
          result_div.appendChild(verdict_div);

          query(solution, (solution_data) => {
            var submission_u = submission_data[0].values;
            var solution_u = solution_data[0].values;
            if (!orderSensitive) {
                submission_u.sort();
                solution_u.sort();
            }
            var verdict = arraysEqual(submission_u, solution_u) ? "Correct" : "Faux";
            // http://adripofjavascript.com/blog/drips/object-equality-in-javascript.html
            verdict_div.innerText = verdict;
          });
        }
        if (submission_data.length > 0) {
          result_div.appendChild(datatable(submission_data));
        } else {
          result_div.insertAdjacentHTML("beforeend", `Aucune donnée renvoyée`);
        }
      }

      var handleError = (e) => {
        result_div.className = 'returnError';
        result_div.innerText = e.message;
      }

      query(editor.getValue(), handleSubmit, handleError);
      outputBox.innerHTML = '';
      outputBox.appendChild(result_div);
    };

    form['onkeydown'] = (e) => {
      if (e.keyCode == 13 && e.shiftKey) {
        e.preventDefault();
        form.onsubmit();
      };
    };

    if (solution) {
      var solutionButton = document.createElement('input');
      solutionButton.name = 'solution';
      solutionButton.type = 'button';
      solutionButton.value = 'Voir la solution';
      if (hideSolution) {
        var sp = homeDiv.querySelector('.sqlExSpoiler');
        solutionButton.onclick = (e) => {
          sp.classList.add('open');
          sp.querySelector('code').textContent = solution;
        };
        inputArea.appendChild(solutionButton);
      } else {
        solutionButton.onclick = (e) => {
          var existingCode = editor.getValue();
          editor.setValue(existingCode + "\n/* " + solution);
        };
        inputArea.appendChild(solutionButton);
      }
    };

    var resetButton = document.createElement('input');
    resetButton.type = 'button';
    resetButton.value = 'Réinitialiser';
    resetButton.onclick = (e) => {
      editor.setValue(defaultText);
      outputBox.textContent = '';
    };
    inputArea.appendChild(resetButton);
    form.appendChild(inputArea);

    // Output Area
    var outputArea = document.createElement('div');
    outputArea.className = 'sqlExOutputArea';

    var outputBox = document.createElement('output');
    outputBox.name = 'output';
    outputArea.appendChild(outputBox);
    form.appendChild(outputArea);

    homeDiv.appendChild(form);
    this.appendChild(homeDiv);
  }
}

customElements.define('sql-exercise', sqlExercise);


//////////////////////////
// Utility functions
//////////////////////////

function arraysEqual(a,b) {
  /*
  https://stackoverflow.com/questions/3115982/how-to-check-if-two-arrays-are-equal-with-javascript
  Array-aware equality checker:
  Returns whether arguments a and b are == to each other;
  however if they are equal-lengthed arrays, returns whether their
  elements are pairwise == to each other recursively under this
  definition.
  */
  if (a instanceof Array && b instanceof Array) {
    if (a.length != b.length) { // assert same length
      return false;
    }
    for (var i=0; i<a.length; i++) { // assert each element equal
      if (!arraysEqual(a[i],b[i]))
        return false;
    }
    return true;
  } else {
    return a == b;  // if not both arrays, should be the same
  }
}
