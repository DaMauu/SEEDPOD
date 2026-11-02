// ==UserScript==
// @name         PTC手隐徽章
// @namespace    openai3.5
// @version      0.1
// @description  用户页用户页徽章隐藏和显示功能
// @author       OpenAIScripts
// @match        *://*/*
// @match        https://pterclub.com/userdetails.php*
// @match        https://pterclub.com/usercp.php*
// @icon         https://pterclub.com/favicon.ico
// ==/UserScript==

(function() {
    'use strict';

    // 获取当前表单中所有的单元格
    const cells = document.querySelectorAll('table tbody tr td');

    // 遍历所有单元格
    for (let i = 0; i < cells.length; i++) {
        // 判断单元格的文本是否包含"已拥有徽章"
        if (cells[i].textContent === '已拥有徽章') {
            // 找到对应的单元格，这里假设它是第 i 个单元格
            const targetCell = cells[i];

            // 创建包含按钮的<div>元素
            const div = document.createElement('div');
            div.style.marginTop = '5px'; // 设置上边距以保证按钮在文字下方
            div.style.textAlign = 'center'; // 设置居中对齐
            const button = document.createElement('button');
            button.textContent = '隐藏';
            button.style.cursor = 'pointer';
            button.style.backgroundColor = 'var(--color-btn-bg)';
            button.style.color = 'var(--color-btn-text)';
            button.style.boxShadow = '0 1px 0 rgba(27,31,35,.04),0 1px 3px rgba(27,31,35,.12)';
            button.style.border = '1px solid rgba(27,31,35,.2)';
            button.style.borderRadius = '3px';
            div.appendChild(button);

            // 在目标单元格中添加包含按钮的<div>元素
            targetCell.appendChild(div);

            // 给按钮添加点击事件，隐藏/显示紧跟着"已拥有徽章"文本的<td>元素内部的所有<img>元素
            button.addEventListener('click', function() {
                const siblingCell = targetCell.nextElementSibling; // 找到紧跟着"已拥有徽章"文本的<td>元素
                const imgs = siblingCell.querySelectorAll('img'); // 获取该<td>元素内部所有的<img>元素
                if (button.textContent === '隐藏') {
                    button.textContent = '显示';
                    imgs.forEach(function(img) { // 遍历所有的<img>元素，设置其样式为 display: none;
                        img.style.display = 'none';
                    });
                } else {
                    button.textContent = '隐藏';
                    imgs.forEach(function(img) { // 遍历所有的<img>元素，设置其样式为 display: inline-block;
                        img.style.display = 'inline-block';
                    });
                }
            });
            break;
        }
    }

    //居中按钮
    const targetDiv = document.querySelector('div[style*="text-align: center"]');
    targetDiv.style.display = 'flex';
    targetDiv.style.justifyContent = 'center';

})();
