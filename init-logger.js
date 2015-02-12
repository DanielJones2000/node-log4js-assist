var log4js = require('log4js');
var fs = require("fs");
var path = require("path");
var jsonObject = null;
var loggers = {};

/**
 * json书写方式，在意外层写入属性 ‘RegxAppenders’
 */
// {
//     "appenders": [{
//         "type": "console",
//         "level": "DEBUG",
//         "appender": {
//             "type": "console",
//             "layout": {
//                 "type": "pattern",
//                 "pattern": "%[[%r] [%5.10p] [%c] %m%]"
//             }
//         }
//     }],
//     "RegxAppenders": {
//         "includes": [{
//             "type": "dateFile",
//             "filename": "logs/link2-software",
//             "alwaysIncludePattern": true,
//             "pattern": "-yyyy-MM-dd.log",
//             "layout": {
//                 "type": "pattern",
//                 "pattern": "%r|%p|%c|%m"
//             },
//             "categoryRegx": "software-.*",
//             "level": "debug"
//         }, {
//             "type": "dateFile",
//             "filename": "logs/link2-hardware",
//             "alwaysIncludePattern": true,
//             "pattern": "-yyyy-MM-dd.log",
//             "layout": {
//                 "type": "pattern",
//                 "pattern": "%r|%p|%c|%m"
//             },
//             "categoryRegx": "hardware-.*",
//             "level": "error"
//         }],
//         "excludes": {
//             "type": "dateFile",
//             "filename": "logs/link2-other",
//             "alwaysIncludePattern": true,
//             "pattern": "-yyyy-MM-dd.log",
//             "layout": {
//                 "type": "pattern",
//                 "pattern": "%r|%p|%c|%m"
//             },
//             "level": "debug"
//         }
//     },
//     "levels": {
//         "lancet-link2": "debug"
//     },
//     "replaceConsole": false
// }

/**
 * 递归创建目录
 * @param sysPath
 * @param filePath
 */
function mkdirAllPath(sysPath,filePath){
    filePath = filePath.substring(0,filePath.lastIndexOf('/'));
    var arr = filePath.split('/');
    arr.forEach(function(path){
        sysPath = sysPath + '/' + path;
        if (!fs.existsSync(sysPath)) {
            fs.mkdirSync(sysPath);
        }
    });
}

/**
 * 初始化脚本
 * @param configPath
 */
exports.init = function (configPath, systemPath) {
    log4js.configure(configPath, {
        cwd: systemPath
    });
    jsonObject = JSON.parse(fs.readFileSync(configPath, 'utf8'));
    var RegxAppenders = jsonObject.RegxAppenders;
    if (typeof(RegxAppenders) != "undefined" && RegxAppenders != null) {
        var includes = RegxAppenders.includes;
        var excludes = RegxAppenders.excludes;
        if (typeof(includes) != "undefined" && includes != null) {
            var len = includes.length;
            for (var i = 0; i < len; i++) {
                var obj = includes[i];
                mkdirAllPath(systemPath,obj.filename);
                obj.filename = systemPath + "/" + obj.filename;
            }
        }
        if (typeof(excludes) != "undefined" && excludes != null) {
            mkdirAllPath(systemPath,excludes.filename);
            excludes.filename = systemPath + "/" + excludes.filename;
        }
    }
};

var log4js_logger = log4js.getLogger;

/**
 * 正则匹配方法
 * @param r
 * @param s
 * @returns {boolean}
 */
function regxMatch(r, s) {
    if (r === null || r === "") {
        return false;
    }
    var patrn = new RegExp(r);
    if (patrn.exec(s))
        return true;
    return false;
}

/**
 * 设置log4js自定义appender
 * @param appender
 */
function setAppender(config, category) {
    var type = config.type;
    if (typeof(type) != "undefined") {
        log4js.loadAppender(type);
        log4js.addAppender(log4js.appenderMakers[type](config), category);
    } else {
        console.log("log4js配置项中缺少type类型");
    }
}

/**
 * 获取appender的leve日志等级
 * @param obj
 * @param level
 * @returns {level|*|level|level|level|level}
 */
function getLevel(obj, level, category) {
    if (jsonObject.levels && jsonObject.levels[category]) {
        return jsonObject.levels[category];
    } else {
        return typeof(obj.level) != "undefined" ? obj.level : level;
    }
}

/**
 * 重写log4js的getLogger()方法
 * @param category
 * @returns {Logger}
 */
log4js.getLogger = function (category) {
    if (typeof(loggers[category]) != "undefined")
        return loggers[category];
    var regxAppenders = jsonObject.RegxAppenders; //获取配置项中RegxAppenders集合
    var includes = null; //包含的appenders集合
    var excludes = null; //不包含的appenders,不是集合，只限制所有没有在includes中做处理的日志输出在此处
    var level = null; //日志级别

    var config = null; //正则中匹配后的配置项
    //判断是否存在 RegxAppenders 正则匹配规则集合
    if (typeof(regxAppenders) != "undefined") {
        includes = typeof(regxAppenders.includes) != "undefined" ? regxAppenders.includes : null; //获取includes集合
        excludes = typeof(regxAppenders.excludes) != "undefined" ? regxAppenders.excludes : null; //获取excludes

        if (excludes !== null) {
            config = excludes;
            level = getLevel(excludes, level, category);
        }

        if (includes !== null) {
            var len = includes.length;
            for (var i = 0; i < len; i++) {
                var includesAppender = includes[i];
                var regxStr = includesAppender.categoryRegx;
                if (typeof(regxStr) === "undefined" || regxStr.trim().length === 0)
                    continue;
                if (regxMatch(regxStr, category)) {
                    config = includesAppender;
                    level = getLevel(includesAppender, level, category);
                    continue;
                }
            }
        }
        if (config !== null) {
            setAppender(config, category); //设置category对应的appender
        }
    }
    var logger = log4js_logger(category);
    if (level != null)
        logger.setLevel(level);
    loggers[category] = logger;
    return logger;
};