// ==UserScript==
// @name         PTC_Auto_Skip
// @namespace    http://tampermonkey.net/
// @version      1.2
// @description  Intercept link clicks on PTerClub and navigate directly to the target link without confirmation page
// @author       openai
// @match        *://*/*
// @grant        none
// ==/UserScript==

(function() {
    'use strict';

    // Intercept link clicks
    document.addEventListener('click', function(event) {
        const targetElement = event.target.closest('a');
        // Check if the clicked element is a link
        if (targetElement) {
            // If it's a link and contains "link.php", prevent default behavior and navigate directly
            if (targetElement.href && targetElement.href.includes('/link.php?')) {
                event.preventDefault();
                const urlParams = new URLSearchParams(new URL(targetElement.href).search);
                const targetUrl = urlParams.get('target');
                if (targetUrl) {
                    // Navigate to the target link
                    window.location.replace(decodeURIComponent(targetUrl));
                }
            }
        }
    }, false);
})();
