// ==UserScript==
// @name         PTC_自动刮刮乐
// @namespace    openai3.5
// @version      0.1
// @description  刮刮乐都没你乐,富人靠科技
// @author       OpenAIScripts
// @match        https://pterclub.com/lottery.php*
// @icon         https://pterclub.com/favicon.ico
// @grant        GM_xmlhttpRequest
// ==/UserScript==

(function() {
  'use strict';

  // Create a div element for logging
  const logdiv = document.createElement('div');
  logdiv.style.cssText = `
    position: fixed;
    top: 20px;
    left: 20px;
    max-height: 400px;
    overflow-y: auto;
    padding: 10px;
    background-color: rgba(255, 255, 255, 0.8);
    z-index: 100000;
    border-radius: 5px;
    box-shadow: 0px 0px 5px 0px rgba(0,0,0,0.75);
  `;

  // Append the logdiv to the body
  document.body.appendChild(logdiv);

  let logCount = 0; // Counter for logging

  const trArray = document.querySelectorAll('tbody tr');
  for (let i = 0; i < trArray.length; i++) {
    const tdArray = trArray[i].querySelectorAll('td');
    for (let j = 0; j < tdArray.length; j++) {
      if (tdArray[j].innerText.includes('徽 章 抽 取 处')) {
        const button = document.createElement('button');
        button.innerText = '自动抽取';
        button.style.marginLeft = '5px';
        tdArray[j].appendChild(button);

        let timerId = null; // ID of the timer for auto post requests

        button.addEventListener('click', function() {
          if (timerId) {
            clearInterval(timerId); // Stop the timer if already started
            logdiv.innerHTML += '自动抽取已停止<br>';
            button.innerText = '自动抽取';
            timerId = null;
          } else {
            logdiv.innerHTML += '自动抽取已开始<br>';
            button.innerText = '停止自动抽取';
            timerId = setInterval(sendPostRequest, 10000); // Start the timer to send post requests every 10 seconds
          }
        });

        function sendPostRequest() {
          const currentPage = window.location.href;
          const currentPageNum = currentPage.substr(-2);
          const postUrl = 'https://pterclub.com/dolottery.php?set=' + currentPageNum;

          GM_xmlhttpRequest({
            method: 'POST',
            url: postUrl,
            onload: function(response) {
              logdiv.innerHTML += 'POST请求已完成<br>';
              logCount++;
              if (logCount >= 20) {
                logdiv.innerHTML = '';
                logCount = 0;
              }
            }
          });
        }

        break;
      }
    }
  }
})();
