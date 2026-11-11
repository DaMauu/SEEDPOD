// ==UserScript==
// @name         PT数据自隐
// @namespace    融合成功感谢@三日
// @version      0.2
// @description  隐藏私人数据,让更偏执一些
// @author       OpenAIScripts
// @match        *://*/*
// @icon         https://pterclub.com/favicon.ico
// @grant        GM_addStyle
// ==/UserScript==

(function () {
  'use strict';

//   // Function to hide usernames in a certain table
//   function hideTableUsernames() {
//     const usernameElements = document.querySelectorAll('a.NexusMaster b');
//     for (let i = 0; i < usernameElements.length; i++) {
//       const username = usernameElements[i].innerText.trim();
//       if (/^[a-zA-Z0-9]+$/.test(username)) {
//         const span = document.createElement('span');
//         span.style.opacity = 0;
//         span.innerHTML = username;
//         const div = document.createElement('div');
//         div.style.display = 'inline-block';
//         div.style.position = 'relative';
//         div.innerHTML = usernameElements[i].outerHTML.replace(username, '');
//         div.appendChild(span);
//         usernameElements[i].parentNode.replaceChild(div, usernameElements[i]);
//         span.addEventListener('mouseover', function () {
//           this.style.opacity = 1;
//         });
//         span.addEventListener('mouseout', function () {
//           this.style.opacity = 0;
//         });
//       }
//     }
//   }

  // Add mouseover and mouseout event listeners to cells in a certain table
  function addTableCellEvents() {
    const keywords = ['邀请人', '当前IP', 'BT客户端'];

    const css = `
    tr[data-hidden] > td + td {
      opacity: 0;
      transition: opacity 0.2s;
    }
    tr[data-hidden]:hover > td + td {
      opacity: 1;
    }
  `;

    // Insert CSS style
    const style = document.createElement('style');
    style.textContent = css;
    document.head.appendChild(style);

    // Get cells containing specific text and their next cells
    function getTargetCells() {
      const cells = document.querySelectorAll("tr > td:first-child");
      const targetCells = Array.from(cells).filter((cell) => {
        const text = cell.textContent.trim();
        return keywords.includes(text);
      });
      return targetCells.map((cell) => {
        return [cell, cell.nextElementSibling];
      });
    }

    // Add default hide and mouse events to next cells of target cells
    function addHideAndShow(cell, nextCell) {
      const row = cell.parentNode;
      row.dataset.hidden = true;
      cell.addEventListener('mouseenter', () => {
        row.removeAttribute('data-hidden');
      });
      cell.addEventListener('mouseleave', () => {
        row.dataset.hidden = true;
      });
      nextCell.addEventListener('mouseenter', () => {
        row.removeAttribute('data-hidden');
      });
      nextCell.addEventListener('mouseleave', () => {
        row.dataset.hidden = true;
      });
    }

    const targetCells = getTargetCells();
    targetCells.forEach(([cell, nextCell]) => {
      addHideAndShow(cell, nextCell);
    });
  }

  function hideAndAddEventListenerForAnElement(element) {
		element.style.opacity = 0;
		element.addEventListener('mouseover', function (event) {
			console.log(event.target.innerHTML);
			this.style.opacity = 1;
			event.stopPropagation();
		}, false);
		element.addEventListener('mouseout', function (event) {
			this.style.opacity = 0;
			event.stopPropagation();
		}, false);
	}

	function hideTableUsernamesV2() {
		let usernameSet = new Set();
		const hrefElements = document.querySelectorAll("[href*='userdetails.php?id=']");
		for (const ele of hrefElements) {
			usernameSet.add(ele.innerText);
			hideAndAddEventListenerForAnElement(ele);
		}
		const usernameArray = Array.from(usernameSet);
		const h1Elements = document.querySelectorAll("h1");
		for (const ele of h1Elements) {
			if (usernameArray.indexOf(ele.innerText) !== -1) {
				hideAndAddEventListenerForAnElement(ele);
			}
		}
	}

  // Hide usernames in a certain table, add mouseover and mouseout events to cells and usernames
  hideTableUsernamesV2();
  addTableCellEvents();

})();
