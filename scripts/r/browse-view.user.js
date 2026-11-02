// ==UserScript==
// @name         SEEDPOD · Browse View
// @namespace    https://github.com/DaMauu/SEEDPOD
// @version      1.0.0
// @description  在种子浏览页注入视图切换齿轮（封面 / 大图 / 列表 / 紧凑列表），配合 styles/r 主题使用
// @match        https://redacted.sh/torrents.php*
// @run-at       document-idle
// @grant        none
// @homepageURL  https://github.com/DaMauu/SEEDPOD
// ==/UserScript==

(function () {
  'use strict';

  var KEY = 'rBrowseView';
  var VIEWS = [
    ['cover', 'Cover view'],
    ['huge', 'Huge view'],
    ['list', 'List view'],
    ['compact', 'Compact list view']
  ];

  function apply(v) {
    document.documentElement.dataset.rview = v;
  }

  function build() {
    var host = document.querySelector('.filter_torrents .head');
    if (!host || host.querySelector('.rview-wrap')) return;

    var current = localStorage.getItem(KEY);
    if (!current || !VIEWS.some(function (v) { return v[0] === current; })) {
      current = 'list';
    }
    apply(current);

    var wrap = document.createElement('div');
    wrap.className = 'rview-wrap';

    var btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'rview-btn';
    btn.title = '视图切换';

    var menu = document.createElement('div');
    menu.className = 'rview-menu';

    VIEWS.forEach(function (v) {
      var label = document.createElement('label');
      var input = document.createElement('input');
      input.type = 'radio';
      input.name = 'rview';
      input.value = v[0];
      input.checked = v[0] === current;
      input.addEventListener('change', function () {
        localStorage.setItem(KEY, v[0]);
        apply(v[0]);
        menu.classList.remove('is-open');
      });
      label.appendChild(input);
      label.appendChild(document.createTextNode(v[1]));
      menu.appendChild(label);
    });

    btn.addEventListener('click', function (e) {
      e.stopPropagation();
      menu.classList.toggle('is-open');
    });

    document.addEventListener('click', function () {
      menu.classList.remove('is-open');
    });

    wrap.appendChild(btn);
    wrap.appendChild(menu);
    host.appendChild(wrap);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', build);
  } else {
    build();
  }
})();
