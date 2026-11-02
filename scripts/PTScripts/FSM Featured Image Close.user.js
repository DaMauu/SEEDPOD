// ==UserScript==
// @name         FSM Featured Image Close
// @namespace    http://tampermonkey.net/
// @version      2024-05-04
// @description  Take care of yourself to keep everyone out of harm's way.
// @author       You
// @match        https://fsm.name/Recommend
// @icon         https://fsm.name/img/icons/favicon-32x32.png
// @grant        GM_xmlhttpRequest
// @license      MIT
// ==/UserScript==
//使用了 window.addEventListener('load', ...)，它也是在页面加载完成后触发的，但是相对于 window.onload，它具有更好的兼容性和扩展性。使用事件监听器的方式可以允许多个事件处理函数同时存在，而不会相互覆盖。此外，使用事件监听器可以更方便地在未来添加其他操作，而不必修改原始代码。
(function() {
    'use strict';

    window.addEventListener('load', function() {
        // 等待页面加载完毕后执行操作
        var elementToHide = document.querySelector('.el-card.is-always-shadow.margin-top-8');
        if (elementToHide) {
            elementToHide.style.display = 'none';
        }
    });
})();
