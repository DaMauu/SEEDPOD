// ==UserScript==
// @name         PTC_自动摇摇乐
// @namespace    openai3.5
// @version      0.1
// @description  摇摇乐都没你乐,快速成为欧皇和非酋
// @author       OpenAIScripts
// @match        https://pterclub.com/slot*
// @icon         https://pterclub.com/favicon.ico
// @grant        GM_log
// ==/UserScript==

(function() {
    'use strict';

    // 创建介绍文字模块
    let introWindow = document.createElement('div');
    introWindow.style = 'position: fixed; top: 50px; left: 0; width: 300px; background-color: rgba(0, 0, 0, 0.3); border: 1px solid white; overflow: auto; z-index: 9999; color: white; padding: 10px; border-radius: 5px;';
    introWindow.innerHTML = '<div style="text-align:center;font-size:16px;">点击开始按钮启动脚本<br>点击停止按钮停止脚本<br>每十秒运行一次</div>';
    document.body.appendChild(introWindow);

    // 创建按钮模块
    let buttonWindow = document.createElement('div');
    buttonWindow.style = 'position: fixed; top: 150px; left: 0; width: 300px; background-color: rgba(0, 0, 0, 0.3); border: 1px solid white; overflow: auto; z-index: 9999; color: white; padding: 10px; border-radius: 5px; text-align: center;';
    let toggleBtn = document.createElement('button');
    toggleBtn.innerHTML = '开始';
    toggleBtn.style = 'background-color: red; color: white; font-size: 16px; border: 2px solid white; padding: 10px; cursor: pointer; border-radius: 5px; margin-top: 10px;';
    buttonWindow.appendChild(toggleBtn);
    document.body.appendChild(buttonWindow);

    // 创建日志输出模块
    let logWindow = document.createElement('div');
    logWindow.style = 'position: fixed; top: 250px; left: 0; width: 300px; height: calc(100vh - 250px); background-color: rgba(0, 0, 0, 0.3); border: 1px solid white; overflow: auto; z-index: 9999; color: white; padding: 10px; border-radius: 5px;';
    document.body.appendChild(logWindow);

    let logCount = 0; // 记录日志数量
    const LOG_LIMIT = 10; // 日志输出数量限制
    let intervalId; // 保存计时器ID

    // 定义日志输出函数
    function log(msg) {
        GM_log(msg);
        logCount++;
        logWindow.innerHTML += msg + '<br>';
        logWindow.scrollTop = logWindow.scrollHeight;
        if (logCount >= LOG_LIMIT) {
            logWindow.innerHTML = '';
            logCount = 0;
        }
    }

    // 定义解析结果并显示中文描述的函数
    function parseResult(responseText) {
        let result;
        try {
            result = JSON.parse(responseText);
        } catch (e) {
            log('无法解析响应: ' + responseText);
            clearInterval(intervalId);
            toggleBtn.innerHTML = '开始';
            toggleBtn.style.backgroundColor = 'red';
            return;
        }

        let displayMessage = '';
        if (result.prize) {
            switch (result.prize.type) {
                case 'medal_unlucky':
                    displayMessage = '小非酋*' + result.prize.content;
                    break;
                case 'uploaded':
                    displayMessage = '上传量*' + result.prize.content;
                    break;
                case 'nothing':
                    displayMessage = '谢谢参与';
                    break;
                case 'seedbonus':
                    displayMessage = '猫粮增加*' + result.prize.content;
                    break;
                default:
                    displayMessage = '未知奖励类型: ' + JSON.stringify(result.prize);
            }
        } else {
            displayMessage = '未知响应格式: ' + responseText;
        }

        log(displayMessage);
    }

    // 刷新特定网页的函数
    function refreshPage() {
        let xhr = new XMLHttpRequest();
        xhr.open('GET', 'https://pterclub.com/slot.php?get=result', true);
        xhr.onreadystatechange = function() {
            if (xhr.readyState == 4 && xhr.status == 200) {
                parseResult(xhr.responseText);
            }
        };
        xhr.send();
    }

    // 按钮点击事件
    toggleBtn.onclick = function() {
        if (toggleBtn.innerHTML === '开始') {
            intervalId = setInterval(refreshPage, 10000);
            toggleBtn.innerHTML = '停止';
            toggleBtn.style.backgroundColor = 'green';
        } else {
            clearInterval(intervalId);
            toggleBtn.innerHTML = '开始';
            toggleBtn.style.backgroundColor = 'red';
        }
    };
})();
