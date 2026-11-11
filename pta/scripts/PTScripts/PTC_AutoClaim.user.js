// ==UserScript==
// @name         PTC_自动认领
// @namespace    http://tampermonkey.net/
// @version      0.1
// @description  用户页自动认领所有种子
// @author       albao
// @match        https://pterclub.com/userdetails.php*
// @icon         data:image/gif;base64,R0lGODlhAQABAAAAACH5BAEKAAEALAAAAAABAAEAAAICTAEAOw==
// @grant        none
// @license MIT
// ==/UserScript==

(function() {
    'use strict';
    // Your code here...
    var button = document.createElement('button');
    button.id = 'auto-confirm';
    button.textContent = '认领';
    button.style.height = '20px';
    button.style.width = '60px';
    button.style.fontsize = '3px';
    button.onclick = function (){
        var httpRequest = new XMLHttpRequest();
        var tbl = document.getElementById('ka1');
        var l = tbl.getElementsByClassName('claim-confirm');
        for (var i = 0; i < l.length; i++) {
            var url = 'https://pterclub.com/' + l[i].getAttribute('data-url');
            httpRequest.open('GET', url, true);
            httpRequest.send();
        }
        alert('完成');
        location.reload();
    }
    var x = document.getElementById('row_current_seeding').parentElement;
    x.prepend(button);
})();
