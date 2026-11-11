// ==UserScript==
// @name         Audiences Banner to Logo
// @namespace    http://tampermonkey.net/
// @version      2024-05-04
// @description  Close banner to enable logo
// @require      https://code.jquery.com/jquery-3.6.0.min.js
// @author       You
// @match        https://audiences.me/*
// @icon         https://audiences.me/favicon.ico
// @grant        none
// ==/UserScript==

(function() {
    'use strict';

    jQuery(".head").empty().append('<img src="https://audiences.me/pic/logos.png" alt="Replacement Image" width="300" height="81" style="margin-left: 30px; margin-top: 10px;">');

})();
