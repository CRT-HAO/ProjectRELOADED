/*
 *   Copyright (c) 2021 CRT_HAO 張皓鈞
 *   All rights reserved.
 *   CISH Robotics Team
 */

var { shell, dialog } = require('electron');
window.$ = window.jQuery = require('jquery');
jsrender = require('jsrender');
var path = require('path');

const loading_template = jsrender.templates('./src/template/loading.jsrender');
const project_card_template = jsrender.templates('./src/template/project_card.jsrender');
const project_dialog_template = jsrender.templates('./src/template/project_dialog.jsrender');
const project_files_list_template = jsrender.templates('./src/template/files_list.jsrender');
const project_backups_list_template = jsrender.templates('./src/template/backups_list.jsrender');

$(window).on('error', (e) => {
    mdui.snackbar({
        message: "發生錯誤！(" + e.originalEvent.error.code + ")",
        buttonText: "詳情",
        onButtonClick: function(){
            mdui.alert(e.originalEvent.error);
        },
        timeout: 0,
        closeOnButtonClick: false,
        closeOnOutsideClick: false
    });
    console.log(e);
});

$(document).on('ready', refreshProjects);
$('#refresh-projects').on('click', refreshProjects);

function refreshProjects() {
    loadProjects((projects) => {
        updateProjectCards(projects);
    });
}

function updateProjectCards(projects) {
    clearProjectsCardContainer();
    clearProjectsDialogContainer();
    const loading_bar = loading_template({id: "projects-loading"});
    $('#content').prepend(loading_bar);
    projects.forEach((project, index) => {
        addProjectCard(project);
        if(index === projects.length-1) $('#projects-loading').remove();
    });
}

function clearProjectsCardContainer() {
    $('#projects-card-container').empty();
}

function clearProjectsDialogContainer() {
    $('#projects-dialog-container').empty();
}

function addProjectCard(project) {
    card_data = Object.assign({}, project);
    card_data.lastBackup = getDateDiff(new Date(project.lastBackup));
    const card = project_card_template(card_data);
    $('#projects-card-container').append(card);
    if(project.invalid) {
        dialog = addProjectDialog(project);
        $('.project-card[project-id=' + project.uuid + '] .project-dialog-button').on('click', (e) => {
            console.log("打開專案窗口" + project.uuid);
            dialog.open();
        });
        $('.project-card[project-id=' + project.uuid + '] .open-project-folder-button').on('click', (e) => {
            shell.openPath(project.path);
        });
        $('.project-card[project-id=' + project.uuid + '] .backup-project-button').on('click', (e) => {
            let originalButton;
            backupProjectDialog(project, () => {
                originalButton = $(e.currentTarget).html();
                $(e.currentTarget).html('<i class="mdui-icon material-icons spin">settings_backup_restore</i> 備份中...');
                $(e.currentTarget).attr('disabled', '');
            }, () => {
                $(e.currentTarget).html(originalButton);
                $(e.currentTarget).removeAttr('disabled');

            });
        });
    }
}

function addProjectDialog(project) {
    const dialog_html = project_dialog_template(project);
    $('#projects-dialog-container').append(dialog_html);
    dialogElement = $('.project-dialog[project-id=' + project.uuid + ']');
    dialog = new mdui.Dialog(dialogElement);
    const tabElement = $('[project-id=' + project.uuid + '] .projects-dialog-tab');
    const tab = new mdui.Tab(tabElement);
    dialogElement.on('open.mdui.dialog', function () {
        tab.handleUpdate();
        tab.show(0);
    });
    $('.project-dialog[project-id=' + project.uuid + '] .open-project-folder-button').on('click', (e) => {
        shell.openPath(project.path);
    });
    $('.project-dialog[project-id=' + project.uuid + '] .backup-project-button').on('click', (e) => {
        card_backup_button = $('.project-card[project-id=' + project.uuid + '] .backup-project-button');
        let originalButton;
        dialog.close();
        backupProjectDialog(project, () => {
            originalButton = card_backup_button.html();
            card_backup_button.html('<i class="mdui-icon material-icons spin">settings_backup_restore</i> 備份中...');
            card_backup_button.attr('disabled', '');
        }, () => {
            card_backup_button.html(originalButton);
            card_backup_button.removeAttr('disabled');

        });
    });
    $('.project-dialog[project-id=' + project.uuid + '] [refresh-files-list]').on('click', (e) => {
        updateFilesList($('.project-dialog[project-id=' + project.uuid + '] #projects-dialog-tab-files'), readProjectFiles(project.path));
    });
    $('.project-dialog[project-id=' + project.uuid + '] [refresh-backups-list]').on('click', (e) => {
        readProjectAllBackupsInfo(project.path, (backupsList) => {
            updateBackupsList($('.project-dialog[project-id=' + project.uuid + '] #projects-dialog-tab-backups'), backupsList);
        });
    });
    return dialog;
}

function updateFilesList(selector, files) {
    selector.empty();
    const files_list_html = project_files_list_template({files: files});
    selector.append(files_list_html);
    selector.find('li[file-path]:not([disabled])').on('click', (e) => {
        console.log("打開文件" + $(e.currentTarget).attr('file-path'));
        shell.showItemInFolder($(e.currentTarget).attr('file-path'));
    });
}

function updateBackupsList(selector, backups) {
    selector.empty();
    console.log(backups);
    const files_list_html = project_backups_list_template({backups: backups});
    selector.append(files_list_html);
}

function backupProjectDialog(project, start, success) {
    const now = new Date();
    mdui.prompt('備份名稱', '請輸入備份名稱',
    function (value) {
        showNotification("開始備份專案", project.name);
        if(start) start();
        backupProject(project.path, value, () => {
            if(success) success();
            mdui.snackbar({
                message: '備份已完成'
            });
            showNotification("備份已完成", project.name);
            refreshProjects();
        });
    },
    undefined,
    options = {
        defaultValue: now.getFullYear() + "/" + now.getMonth() + "/" + now.getDay() + "_" + now.getHours() + ":" + now.getMinutes() + ":" + now.getSeconds(),
        confirmText: "備份",
        cancelText: "取消",
        closeOnCancel: true,
        confirmOnEnter: true
    }
  );
}

function getDateDiff(dateTimeStamp) {
    var timestamp = new Date(dateTimeStamp).getTime();
    var minute = 1000 * 60;
    var hour = minute * 60;
    var day = hour * 24;
    var halfamonth = day * 15;
    var month = day * 30;
    var year = day * 365;
    var now = new Date().getTime();
    var diffValue = now - timestamp;
    var result;
    if (diffValue < 0) {
        return;
    }
    var yearC = diffValue / year;
    var monthC = diffValue / month;
    var weekC = diffValue / (7 * day);
    var dayC = diffValue / day;
    var hourC = diffValue / hour;
    var minC = diffValue / minute;
    if (yearC >= 1) {
        result = "" + parseInt(yearC) + "年前";
    } else if (monthC >= 1) {
        result = "" + parseInt(monthC) + "月前";
    } else if (weekC >= 1) {
        result = "" + parseInt(weekC) + "周前";
    } else if (dayC >= 1) {
        result = "" + parseInt(dayC) + "天前";
    } else if (hourC >= 1) {
        result = "" + parseInt(hourC) + "小時前";
    } else if (minC >= 1) {
        result = "" + parseInt(minC) + "分鐘前";
    } else
        result = "剛剛";
    return result;
}

function showNotification(title, content) {
    new Notification(title, {body: content });
}