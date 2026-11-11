// ==UserScript==
// @name         PTC_徽章自隐
// @namespace    https://github.com/oiozi/Scripts/raw/main/PTScripts/PTC_BadgesHideMouseHover.user.js
// @version      0.1
// @description  用户页徽章鼠标悬停隐藏和显示功能
// @match        *://*/*
// @match        https://pterclub.com/userdetails.php*
// @match        https://pterclub.com/usercp.php*
// @icon         https://pterclub.com/favicon.ico
// @grant        none
// ==/UserScript==

(function() {
    'use strict';
    var rows = document.querySelectorAll('tr');
    for (var i = 0; i < rows.length; i++) {
        var row = rows[i];
        var cells = row.querySelectorAll('td');
        for (var j = 0; j < cells.length; j++) {
            var cell = cells[j];
            if (cell.textContent.trim() === '已拥有徽章') {
                var nextCell = cells[j+1];
                nextCell.style.width = nextCell.offsetWidth + 'px';
                nextCell.style.padding = '0';
                var images = nextCell.querySelectorAll('img');
                for (var k = 0; k < images.length; k++) {
                    images[k].style.display = 'none';
                    images[k].style.opacity = '0';
                    images[k].style.transition = 'opacity 0.3s ease-out';
                }
                nextCell.addEventListener('mouseover', function() {
                    for (var k = 0; k < images.length; k++) {
                        images[k].style.display = 'inline-block';
                        images[k].style.opacity = '1';
                    }
                    nextCell.style.width = 'auto';
                    nextCell.style.padding = '5px';
                });
                nextCell.addEventListener('mouseout', function() {
                    for (var k = 0; k < images.length; k++) {
                        images[k].style.opacity = '0';
                    }
                    nextCell.style.width = nextCell.offsetWidth + 'px';
                    nextCell.style.padding = '0';
                    for (var k = 0; k < images.length; k++) {
                        images[k].style.display = 'none';
                    }
                });
            }
        }
    }
})();
