// ==UserScript==
// @name         PT公告自隐
// @namespace    PTNoticeHide
// @version      1.0
// @description  支持UNIT3D、Gazelle、NexusPHP的公告自隐脚本
// @match        *://*/*
// @exclude      *://*/*aboutnexus.php
// @exclude      *://*/*attendance.php*
// @exclude      *://*/*badges.php*
// @exclude      *://*/*cheaters.php*
// @exclude      *://*/*contactstaff.php*
// @exclude      *://*/*donate.php*
// @exclude      *://*/*downloadnotice.php*
// @exclude      *://*/*faq.php*
// @exclude      *://*/*forums.php*
// @exclude      *://*/*friends.php*
// @exclude      *://*/*getrss.php*
// @exclude      *://*/*hnr_bonus.php*
// @exclude      *://*/*hnr_details.php*
// @exclude      *://*/*hr.php*
// @exclude      *://*/*invite.php*
// @exclude      *://*/*log.php*
// @exclude      *://*/*offers.php*
// @exclude      *://*/*report.php*
// @exclude      *://*/*rules.php*
// @exclude      *://*/*seedbox.php*
// @exclude      *://*/*seek.php*
// @exclude      *://*/*sendmessage.php*
// @exclude      *://*/*signup.php
// @exclude      *://*/*staff.php*
// @exclude      *://*/*staffbox.php?*
// @exclude      *://*/*stats.php*
// @exclude      *://*/*ticket.php*
// @exclude      *://*/*topten.php*
// @exclude      *://*/*torrents.php*
// @exclude      *://*/*upload.php*
// @exclude      *://*/*user.php*
// @exclude      *://*/*userdetails.php*
// @exclude      *://*/*viewrequests.php*
// @grant        none

// ==/UserScript==

//  开始UNIT3D
function unit3d() {
    // U3D通用版
    var announcements = document.querySelectorAll('.panel-heading');

    announcements.forEach(function (announcement) {
        var parentElement = announcement.parentElement;
        var contentElement = parentElement.querySelector('.panel-body');

        contentElement.style.display = 'none';

        announcement.addEventListener('mouseenter', function () {
            contentElement.style.display = 'block';
        });

        parentElement.addEventListener('mouseleave', function (event) {
            if (!contentElement.contains(event.relatedTarget)) {
                contentElement.style.display = 'none';
            }
        });
    });

    // U3D特殊版
    var title = document.querySelector('.inner_content .accordion-toggle');
    var contentFrame = document.querySelector('.panel-body');

    if (title && contentFrame) {
        var isContentVisible = false;

        function handleMouseEnter() {
            contentFrame.style.display = 'block';
            isContentVisible = true;
        }

        function handleMouseLeave(event) {
            if (!isContentVisible) {
                contentFrame.style.display = 'none';
            }
        }

        title.addEventListener('mouseenter', handleMouseEnter);
        title.addEventListener('mouseleave', handleMouseLeave);

        contentFrame.addEventListener('mouseenter', function () {
            isContentVisible = true;
        });

        contentFrame.addEventListener('mouseleave', function (event) {
            if (!title.contains(event.relatedTarget)) {
                isContentVisible = false;
                contentFrame.style.display = 'none';
            }
        });

        contentFrame.addEventListener('mousemove', function (event) {
            event.stopPropagation();
        });

        title.click();
        contentFrame.style.display = 'none';
    }
}
//  结束UNIT3D

//  开始Gazelle
function gazelle() {
    // 正则表达式匹配公告元素和子公告元素
    const announcementPattern = /<div id="news\d+/g;
    const subAnnouncementPattern = /<div id="newsbody\d+/g;

    // 获取所有公告元素
    const announcements = document.body.innerHTML.match(announcementPattern);

    // 添加CSS样式
    const customStyles = `
            div[id^="news"] {
                background-color: #8BC6EC;
                background-image: linear-gradient(120deg, #fdfbfb 0%, #ebedee 100%);
                border: 1px solid #ccc;
                padding: 0px;
                border-radius: 5px;
                box-shadow: 0 2px 2px rgba(0, 0, 0, 0.1);
                transition: background-color 0.3s ease-in-out;
            }
        `;

    const additionalStyles = `
            div[id^="news"]:hover {
                background-color: #6CAFD9;
            }
        `;

    const finalStyles = customStyles + additionalStyles;

    const styleElement = document.createElement('style');
    styleElement.type = 'text/css';
    styleElement.appendChild(document.createTextNode(finalStyles));
    document.head.appendChild(styleElement);

    // 遍历公告元素
    announcements.forEach(announcement => {
        const announcementId = announcement.match(/\d+/)[0];
        const announcementElement = document.querySelector(`div[id="news${announcementId}"]`);
        const relatedSubAnnouncement = document.querySelector(`div[id="newsbody${announcementId}"]`);

        // 默认隐藏子公告元素
        if (relatedSubAnnouncement) {
            relatedSubAnnouncement.style.display = 'none';
        }

        // 添加鼠标移入事件监听器
        announcementElement.addEventListener('mouseenter', () => {
            if (relatedSubAnnouncement) {
                relatedSubAnnouncement.style.display = 'block';
            }
        });

        // 添加鼠标移出事件监听器
        announcementElement.addEventListener('mouseleave', () => {
            if (relatedSubAnnouncement) {
                setTimeout(() => {
                    relatedSubAnnouncement.style.display = 'none';
                }, 500);
            }
        });

        // 添加复制事件监听器
        document.addEventListener('copy', () => {
            if (relatedSubAnnouncement) {
                setTimeout(() => {
                    relatedSubAnnouncement.style.display = 'none';
                }, 100);
            }
        });
    });
}
//  结束Gazelle

//  开始NexusPHP
function nexusPHP() {
    const noticeText = document.querySelector('h2 + table');
    const noticeTitle = document.querySelector('h2');

    noticeText.style.display = 'none';

    function handleVisibility(displayValue) {
        return () => {
            clearTimeout(hideTimeout);
            noticeText.style.display = displayValue;
        };
    }

    let hideTimeout;

    noticeTitle.addEventListener('mouseenter', handleVisibility(''));
    noticeText.addEventListener('mouseleave', handleVisibility('none'));
}
//  结束NexusPHP

//  开始架构判断
(function () {
    'use strict';

    // 定义关键点数组
    var ptArchitectures = ['UNIT3D', 'Gazelle', 'NexusPHP'];

    // 检测关键点并输出日志
    function detectPTArchitecture() {
        var sourceCode = document.documentElement.innerHTML;

        for (var i = 0; i < ptArchitectures.length; i++) {
            var architecture = ptArchitectures[i];
            if (sourceCode.includes(architecture)) {
                console.log('This site is using ' + architecture + '.');
                return architecture; // 找到关键点后返回 architecture，结束函数执行
            }
        }

        return undefined; // 如果未找到匹配关键点，则返回 undefined
    }

    // 迭代进行检测，最多循环两次
    var foundArchitecture; // 标志变量用于标记是否找到匹配关键点
    var iteration = 0;
    while (iteration < 12 && !foundArchitecture) {
        foundArchitecture = detectPTArchitecture();
        iteration++;
    }

    switch (foundArchitecture) {
        case 'UNIT3D':
            unit3d();
            break;
        case 'Gazelle':
            gazelle();
            break;
        case 'NexusPHP':
            nexusPHP();
            break;
    }
    //  结束架构判断
})();
