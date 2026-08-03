console.log("MAIN BUILD NULL DEBUG 2026-07-10-A");

window.addEventListener("error", function (event) {
    console.error("[GLOBAL ERROR]", {
        message: event.message,
        filename: event.filename,
        lineno: event.lineno,
        colno: event.colno,
        error: event.error,
        stack: event.error?.stack
    });
});

window.addEventListener("unhandledrejection", function (event) {
    console.error("[UNHANDLED PROMISE]", event.reason);
});

const config = {

    type: Phaser.AUTO,

    width: 960,

    height: 640,

    pixelArt: true,
    roundPixels: true,
    physics: {
        default: "arcade",
        arcade: {
            debug:  false
        }
    },

    scene: {
        preload,
        create,
        update
    }

};

installPhaserNullDebugHooks();

function safeText(value) {
    if (value === null || value === undefined) return "";
    return String(value);
}

function safeArray(value) {
    return Array.isArray(value) ? value : [];
}

let currentLanguage = "ja";
let localeBasePath =
    `assets/locales/${currentLanguage}`;
let localizationData = {};

function t(path, variables = {}, fallback = "") {
    const keys = String(path).split(".");
    let value = localizationData;

    for (const key of keys) {
        value = value && value[key];
    }

    if (typeof value !== "string") {
        console.warn("[Localization] Missing text key:", path);
        return fallback || path;
    }

    return value.replace(/\{(\w+)\}/g, (_, key) => {
        return variables[key] !== undefined
            ? String(variables[key])
            : `{${key}}`;
    });
}

function getRuntimeDebugContext(extra) {
    const context = extra || {};
    let mapValue = "";
    try {
        mapValue = currentMapKey;
    } catch (error) {
        mapValue = "";
    }
    return {
        functionName: safeText(context.functionName),
        currentMap: safeText(mapValue),
        fragmentId: safeText(context.fragmentId),
        pageId: safeText(context.pageId),
        mediaKey: safeText(context.mediaKey),
        title: safeText(context.title),
        text: safeText(context.text),
        time: new Date().toISOString()
    };
}

function logNullPhaserArgument(methodName, argsLike, extra) {
    console.error("[PHASER NULL ARG] " + JSON.stringify({
        method: methodName,
        args: Array.prototype.slice.call(argsLike),
        context: getRuntimeDebugContext(extra)
    }));
    console.trace("[PHASER NULL ARG TRACE] " + methodName);
}

function installPhaserNullDebugHooks() {
    if (!window.Phaser) {
        console.error("[NULL DEBUG] Phaser is not available when installing hooks");
        return;
    }

    const textProto = Phaser.GameObjects && Phaser.GameObjects.Text && Phaser.GameObjects.Text.prototype;
    if (textProto && !textProto.__nullDebugSetText) {
        textProto.__nullDebugSetText = textProto.setText;
        textProto.setText = function (value) {
            if (value === null || value === undefined) {
                logNullPhaserArgument(
                    "Phaser.GameObjects.Text.prototype.setText",
                    arguments,
                    { text: value }
                );
                value = "";
            }
            return textProto.__nullDebugSetText.call(this, value);
        };
    }

    const factoryProto =
        Phaser.GameObjects &&
        Phaser.GameObjects.GameObjectFactory &&
        Phaser.GameObjects.GameObjectFactory.prototype;
    if (factoryProto && !factoryProto.__nullDebugText) {
        factoryProto.__nullDebugText = factoryProto.text;
        factoryProto.text = function (x, y, text, style) {
            if (text === null || text === undefined) {
                logNullPhaserArgument(
                    "Phaser.GameObjects.GameObjectFactory.prototype.text",
                    arguments,
                    { text: text }
                );
                text = "";
            }
            return factoryProto.__nullDebugText.call(this, x, y, text, style);
        };
    }

    const soundProto =
        Phaser.Sound &&
        Phaser.Sound.BaseSoundManager &&
        Phaser.Sound.BaseSoundManager.prototype;
    if (soundProto && !soundProto.__nullDebugAdd) {
        soundProto.__nullDebugAdd = soundProto.add;
        soundProto.add = function (key, config) {
            if (key === null || key === undefined) {
                logNullPhaserArgument(
                    "Phaser.Sound.BaseSoundManager.prototype.add",
                    arguments,
                    { mediaKey: key }
                );
                return null;
            }
            return soundProto.__nullDebugAdd.call(this, key, config);
        };
    }

    const videoProto =
        Phaser.GameObjects &&
        Phaser.GameObjects.Video &&
        Phaser.GameObjects.Video.prototype;
    if (videoProto && !videoProto.__nullDebugPlay) {
        videoProto.__nullDebugPlay = videoProto.play;
        videoProto.play = function () {
            const args = Array.prototype.slice.call(arguments);
            if (args.some(arg => arg === null || arg === undefined)) {
                logNullPhaserArgument(
                    "Phaser.GameObjects.Video.prototype.play",
                    arguments,
                    { mediaKey: args[0] }
                );
                return this;
            }
            return videoProto.__nullDebugPlay.apply(this, arguments);
        };
    }
}

//===== Map Registry =====
// 每张地图的资源与参数，warp 时通过 key 查找
const MAPS = {

    harie_outside: {
        imageKey: "map",
        jsonKey: "mapData",
        width: 960,
        height: 640,
        mapScale: 1,
        investigationLayers: ["Investigation", "Investigate"],
        defaultStartX: 800,
        defaultStartY: 570
    },

    harie_room: {
        imageKey: "room_map",
        jsonKey: "roomMapData",
        width: 622,
        height: 510,
        mapScale: 2,
        investigationLayers: ["Investigate", "Investigation"],
        // defaultStartX/Y 已预乘 mapScale，warp 时直接使用
        defaultStartX: 235 * 2,   // 470
        defaultStartY: 415 * 2    // 830
    },

    harie_community_center: {
        imageKey: "community_map",
        jsonKey: "communityMapData",
        width: 960,
        height: 640,
        mapScale: 1,
        investigationLayers: ["Investigation"],
        defaultStartX: 295,
        defaultStartY: 295
    }

};

//===== Existing variables =====
let player;
let cursors;
let wasdKeys;

let collisionGroup;

let fieldAreas = [];

let fieldSound;

let isInField = false;

//===== Ambient Sound (Single Source + Multiple SoundArea) =====
let soundAreas = [];          // {x, y, width, height, soundKey, radius, maxVolume}
let ambientSounds = {};       // soundKey → Phaser.Sound.BaseSound (单实例)
let soundAreaConfigs = {};    // soundKey → {radius, maxVolume} 缓存（避免每帧 find）
let warnedSoundKeys = new Set(); // 已警告过的缺失音频 key（避免每帧 warn）

//===== BGM (Background Music) =====
let bgmIntro = null;          // Intro 音效对象（播放一次）
let bgmLoop = null;           // Loop 音效对象（循环播放）
let bgmStarted = false;       // BGM 是否已初始化（防止 warp 重启时重复播放）
let currentBgmVolume = 0.28;  // 当前 BGM 目标音量
let bgmVolumeTween = null;    // 当前活跃的 BGM 音量 tween（防止堆叠）

let lastDirection = "down";

let isMoving = false;

//===== NPC variables =====
let npcGroup;
let currentNpc = null;

//===== Foreground variables =====
let foregroundGroup;

//===== Dialog variables =====
let dialogBox;
let dialogText;
let portraitImage;
let dialogContinuePrompt = null;

let keyE;
let keySpace;
let keyF;
let keyEsc;

let isDialogOpen = false;

//===== Story System =====
let storyStage = 0;               // 剧情阶段（0=序幕前, 1=序幕完成, 2=第一环完成）
let storyData = null;             // story.json 数据
let currentDialogGroup = null;    // 当前对白组（用于对话结束后处理 nextStoryStage 等）

let prologuePlayed = false;         // 序幕是否已播放
let isProloguePlaying = false;      // 序幕正在播放
let prologueDialogLines = [];       // 序幕独白台词
let prologueDialogIndex = 0;        // 序幕当前台词索引
let isEndingPlaying = false;         // 终幕播放中（锁定全部地图输入）
let endingCGImage = null;
let endingNarrationOverlay = null;
let endingNarrationLines = [];
let endingNarrationIndex = 0;
let isEndingNarrationPlaying = false;
let isEndingNarrationTransitioning = false;
let endingNarrationContinuePrompt = null;
const ENDING_NARRATION_FADE_IN = 400;
const ENDING_NARRATION_FADE_OUT = 500;

//===== Author Ending（社区中心 npc6 彩蛋とは独立）=====
let AUTHOR_DISPLAY_NAME = "";
let SPECIAL_THANKS_TEXT = "";
let authorDialogLines = [];
let authorDialogIndex = 0;
let isAuthorEndingPromptVisible = false;
let isAuthorEndingPlaying = false;
let authorEndingPrompt = null;
let authorEndingOverlay = null;
let authorEndingPortrait = null;
let authorEndingDialogBox = null;
let authorEndingDialogText = null;
let authorEndingNameBackground = null;
let authorEndingNameText = null;
let authorEndingContinuePrompt = null;

//===== NPC Talk Notification System =====
let storyEventsData = null;                         // story_events.json 数据
const pendingNpcTalkNotifications = [];              // 待显示的 NPC 对话通知队列
const notifiedStoryEvents = new Set();               // 已通知的剧情事件（防止重复）

// NPC 显示名映射
let NPC_DISPLAY_NAMES = {};

//===== Story Hint System（屏幕正上方当前线索）=====
let storyHintsData = null;               // story_hints.json 数据
let currentStoryHintId = null;           // 当前显示的线索 id
let storyHintText = null;                // 线索文字对象
let storyHintBackground = null;          // 线索背景矩形（已废弃，保留 null）
let manualStoryHint = null;              // dialogGroup.setStoryHint 设置的临时线索 { id, text }
const npcNewTalkIds = new Set();         // 有新对话待看的 NPC id 列表

//===== 已认识 NPC 状态 =====
const metNpcIds = new Set();             // 已完成首次对话的 NPC id 列表
const triggeredStoryEvents = new Set();  // 已触发的剧情事件（如 free_exploration_complete）
let isMonologuePlaying = false;          // 内心独白播放中（阻止 NPC 检测覆盖 currentNpc）

//===== 对话框姓名显示 =====
let dialogNameText = null;               // 对话框人物姓名文字
let dialogNameBackground = null;         // 姓名底框

//===== NPC 主动询问菜单（仅 npc1～npc5）=====
let isNpcMenuOpen = false;
let npcMenuItems = [];
let npcMenuIndex = 0;
let npcMenuTexts = [];
let npcMenuBackground = null;
let npcMenuCurrentNpc = null;
let npcQuestionMode = false;
let npcQuestionPage = 0;
const NPC_QUESTIONS_PER_PAGE = 3;
let npcQuestionTotalPages = 1;
let npcQuestionAllGroups = [];
let npcQuestionVisibleGroups = [];

//===== Speaker → 显示名映射 =====
let SPEAKER_DISPLAY_NAMES = {};

//===== Notebook UI =====
let notebookClosedIcon;
let notebookOpenImage;
let isNotebookOpen = false;

//===== Notebook System (v2: 调查笔记，每个 fragment 一页) =====
let notebookPageIndex = 0;          // 当前页码（解锁 fragment 列表中的下标，0=第一页）
let notebookPages    = [];          // 来自 notebook.json.pages（保留，用于人物页数据）
let fragments        = [];          // 来自 fragments.json
let fragmentsLoadLogged = false;    // fragments.json 版本确认日志（首次一次）
const REMOVED_INVESTIGATION_IDS = new Set([
    "community_bus",
    "community_bench",
    "ladle"
]);
let notebookTexts    = [];          // 当前页绘制的 Phaser 对象池（用于清理）
let notebookTitleText = null;       // 当前页大标题（人物 / 碎片）
let notebookHintText  = null;       // 底部操作提示
let notebookProgressLabel = "Collected";
let notebookFeedbackTween = null;
let notebookFeedbackBaseAlpha = 1;
let pendingInvestigationFeedback = false;
let investigationFeedbackMark = null;

// 新增花卉调查点的实际素材位置（同时供调查界面与笔记本使用）
const FLOWER_INVESTIGATION_IMAGE_PATHS = {
    flower1: "assets/investigation/images/flower1.jpg",
    flower2: "assets/portraits/flower2.jpg"
};

//===== Notebook 布局常量（Fragments 目录页）=====
const NOTEBOOK_LIST_START_X   = 150;  // 目录项起始 X
const NOTEBOOK_LIST_START_Y   = 150;  // 目录项起始 Y（标题下方）
const NOTEBOOK_LIST_SPACING   = 40;   // 每项上下间距

//===== しおり目录页分页常量 =====
const FRAGMENT_ITEMS_PER_PAGE = 20;   // 每页最多显示条数
const FRAGMENT_COLUMN_SIZE    = 10;   // 每列最多显示条数
const FRAGMENT_COL_LEFT_X     = 170;  // 左列 X
const FRAGMENT_COL_RIGHT_X    = 500;  // 右列 X
const FRAGMENT_LIST_START_Y   = 105;   // 目录项起始 Y（下移55px）
const FRAGMENT_LIST_SPACING   = 24;   // 每项上下间距（缩减50%）

//===== 语言与 UI 布局参数 =====
const UI_LAYOUT_BY_LANGUAGE = {
    ja: { notebookBodyOffsetY: 0, notebookBodyLineSpacing: 6 },
    zh: { notebookBodyOffsetY: 0, notebookBodyLineSpacing: 6 },
    en: { notebookBodyOffsetY: 0, notebookBodyLineSpacing: 2 }
};
const NOTEBOOK_EN_LAYOUT = {
    peopleBodyOffsetY: -35,
    peopleNameBodySpacing: 20,
    peopleBodyWrapWidthLeft: 220,
    peopleBodyWrapWidthRight: 240,
    peopleBodyFontSize: "14px",
    peopleBodyLineSpacing: 2,
    investigationTitleOffsetY: -50,
    investigationTitleBodySpacing: 30,
    investigationBodyWrapWidth: 320,
    investigationBodyFontSize: "18px",
    investigationBodyLineSpacing: 2
};
const NOTEBOOK_PROGRESS_CENTER_X = 480;
const NOTEBOOK_PROGRESS_LABEL_Y = 42;
const NOTEBOOK_PROGRESS_COUNT_Y = 61;
const NOTEBOOK_PROGRESS_BAR_Y = 80;
const NOTEBOOK_TUTORIAL_HINT_OFFSET_Y = -45;
const SETTINGS_SOUND_LABEL_GAP = 30;
const SETTINGS_CONTENT_OFFSET_X = 30;

let fragmentListSubPage = 0;          // しおり目录页当前子页（0 = 第一页）

let interactDistance = 20;

let currentDialogIndex = 0;

//===== Investigation variables =====
let investigationGroup;
let currentInvestigation = null;
let lastWarpDebugSignature = "";
let investigationNoticeContainer = null;  // 调查提示容器（右上角弹出）
let pendingInvestigationNotice = null;    // 待显示的调查提示（关闭调查界面时弹出）

//===== Tutorial System（新手引导轻提示）=====
let tutorialFKeyHint = null;              // Phase 1: Notebook 图标旁常驻 F 键提示
let tutorialNotebookShown = false;        // Phase 2: 首次调查后提示（只出现一次）
let tutorialPageShown = false;            // Phase 3: 首次打开 Notebook 翻页提示（只出现一次）

//===== Move Tutorial（移动按键引导）=====
let moveTutorialTexts = [];               // 箭头文本池（↑ ← ↓ →）
let tutorialMoveDone = false;             // 移动引导是否已完成（只出现一次）

let currentMapKey = "harie_outside";

// 当前地图的缩放比，update() 里需要用
let currentMapScale = 1;

let isWarping = false;

let warpCooldown = 0;

//===== FPS 调试 =====
let fpsText = null;
let fpsAccum = 0;

//===== Interaction prompt =====
let interactPrompt;

//===== Investigation display (type=image / type=video) =====
let isInvestigationOpen = false;
let invOverlay;
let invImage;
let invVideo;
let invAudio;   // 视频同步音频
let invTitle;
let invText;

//===== Start / Pause / Settings Menu =====
let DEFAULT_MENU_CONFIG = null;
let menuConfig = null;
let menuMode = "start";       // "start" | "pause" | "settings" | null
let previousMenuMode = "start";
let gameStarted = false;
let isPaused = false;
let menuTransitioning = false;
let menuContainer = null;
let bgmVolume = 0.5;
let seVolume = 0.5;
const LANGUAGE_OPTIONS = [
    { code: "ja", label: "日本語" },
    { code: "zh", label: "简体中文" },
    { code: "en", label: "English" }
];
let settingsLanguageAtOpen = "ja";
let settingsLanguageIndex = 0;
let settingsLanguageValueText = null;
let pendingLanguageProgressState = null;

function queueLocalizedJsonFiles(scene, basePath) {
    scene.load.json("localizationCommon", `${basePath}/common.json`);
    scene.load.json("menuManagerConfig", `${basePath}/MenuManager.json`);
    for (let i = 1; i <= 6; i++) {
        scene.load.json("dialog_npc" + i, `${basePath}/npc${i}.json`);
    }
    scene.load.json("endingAuthorData", `${basePath}/ending_author.json`);
    scene.load.json("notebookData", `${basePath}/notebook.json`);
    scene.load.json("fragmentsData", `${basePath}/fragments.json`);
    scene.load.json("storyData", `${basePath}/story.json`);
    scene.load.json("storyEventsData", `${basePath}/story_events.json`);
    scene.load.json("storyHintsData", `${basePath}/story_hints.json`);
}

function preload() {

    // 语言相关 JSON 统一从当前语言目录加载。
    // 加载失败时 create() 会使用 DEFAULT_MENU_CONFIG。
    queueLocalizedJsonFiles(this, localeBasePath);

    this.load.image(
        "ending_cg",
        "assets/cg/ending_cg.png"
    );

    //--------------------------------
    // NPC 精灵（数据驱动，自动加载 npc1~npc6）
    // 有全身像的 NPC 放 npcX.png 到 assets/npc/
    // 无全身像的 NPC 可不放图片，create() 中自动创建不可见触发点
    //--------------------------------

    for (let i = 1; i <= 6; i++) {
        this.load.image(
            "npc" + i,
            "assets/npc/npc" + i + ".png"
        );
    }

    //--------------------------------
    // 人物头像（透明背景 PNG）
    // speaker 属性自动对应 portrait_XXXX
    //--------------------------------

    const portraitNames = [
        "machi",
        "ishizu",
        "oldman",
        "koi",
        "child1",
        "child2",
        "ziqi"
    ];

    safeArray(portraitNames).forEach(name => {
        this.load.image(
            "portrait_" + name,
            "assets/portraits/" + name + ".png"
        );
    });

    //--------------------------------
    // 外部对话 JSON（自动加载 dialog_npc1~dialog_npc5）
    // 新增 NPC 对话 JSON 放入当前语言目录。
    //--------------------------------

    // 作者感言使用独立数据与立绘，不读取 dialog_npc6 / portrait_ziqi。
    this.load.image(
        "author_ziqi",
        "assets/ending/author_ziqi.png"
    );

    //--------------------------------
    // 地图 — 室外
    //--------------------------------

    this.load.image(
        "map",
        "assets/maps/harie_map.png"
    );

    //--------------------------------
    // 地图 — 室内（NEW）
    //--------------------------------

    this.load.image(
        "room_map",
        "assets/maps/harie_room_map.png"
    );

    //--------------------------------
    // 地图 — 公民館（NEW）
    //--------------------------------

    this.load.image(
        "community_map",
        "assets/maps/harie_community_center_map.png"
    );

    //--------------------------------
    // 前景遮挡
    //--------------------------------

    this.load.image(
        "bus_stop",
        "assets/foreground/bus_stop.png"
    );

    //--------------------------------
    // 笔记本 UI
    //--------------------------------

    this.load.image(
        "notebook_close",
        "assets/notebook/notebook_close.png"
    );

    this.load.image(
        "notebook_open",
        "assets/notebook/notebook_open.png"
    );

    //--------------------------------
    // 笔记本数据（页面结构 + 碎片库）
    //--------------------------------

    //--------------------------------
    // 剧情配置数据
    //--------------------------------

    //--------------------------------
    // 调查→NPC通知映射数据
    //--------------------------------

    //--------------------------------
    // 调查线索数据（屏幕正上方当前线索）
    //--------------------------------

    //--------------------------------
    // 调查提示 UI + 音效
    //--------------------------------

    this.load.image(
        "fragment_notice",
        "assets/ui/fragments.png"
    );

    this.load.audio(
        "hint",
        "assets/audio/hint.mp3"
    );

    //--------------------------------
    // BGM（背景音乐）
    //  Intro: 开场曲（播放一次）→ Loop: 循环曲
    //--------------------------------

    this.load.audio(
        "bgm_intro",
        "assets/audio/harie_BGM_intro.mp3"
    );

    this.load.audio(
        "bgm_loop",
        "assets/audio/harie_bgm_loop.mp3"
    );

    //--------------------------------
    // 玩家
    //--------------------------------

    this.load.spritesheet(
        "player",
        "assets/player/player.png",
        {
            frameWidth: 32,
            frameHeight: 32
        }
    );

    //--------------------------------
    // Tiled JSON
    //--------------------------------

    this.load.json(
        "mapData",
        "assets/maps/harie_map.json"
    );

    this.load.json(
        "roomMapData",
        "assets/maps/harie_room_map.json"
    );

    this.load.json(
        "communityMapData",
        "assets/maps/harie_community_center_map.json"
    );

    //--------------------------------
    // 农田声音
    //--------------------------------

    this.load.audio(
        "fieldSound",
        "assets/investigation/audios/field.mp3"
    );

    //--------------------------------
    // 环境音（SoundArea 系统，单声源）
    //--------------------------------

    this.load.audio(
        "river",
        "assets/investigation/audios/river.mp3"
    );

    this.load.audio(
        "cicada",
        "assets/audio/cicada.mp3"
    );

    //--------------------------------
    // 视频同步音频（weeding / potato_sorting）
    //--------------------------------

    this.load.audio(
        "inv_weeding",
        "assets/investigation/audios/weeding.aac"
    );
    this.load.audio(
        "inv_potato_sorting",
        "assets/investigation/audios/potato_sorting.aac"
    );

    //--------------------------------
    // 调查点素材 — 数据驱动加载
    // 不再在此硬编码素材列表。
    // 所有调查素材在 create() 中根据 fragments.json 动态加载：
    //   image → assets/investigation/images/<image>  (key: inv_<filename>)
    //   video → assets/investigation/videos/<video>  (key: inv_<filename>)
    //   audio → assets/audio/<audio>                  (key: inv_<filename>)
    //--------------------------------

}

function initializeLocalizedConstants() {
    AUTHOR_DISPLAY_NAME = t(
        "ending.authorName",
        {},
        "Ziqi"
    );
    SPECIAL_THANKS_TEXT = t(
        "specialThanks.credits",
        {},
        "特別感謝\n\n" +
        "作者：Ziqi\n" +
        "協力作者：西岡莉々子 ChatGPT\n" +
        "イラストサポーター：小太陽(友人A)\n" +
        "BGM制作：Lil $pider(幼馴染)\n" +
        "プログラミングツール：VS Code Codex WorkBuddy\n" +
        "ペイントツール：Photoshop、Tiled\n" +
        "現地協力：石津大輔"
    );
    NPC_DISPLAY_NAMES = {
        npc1: t("characters.ishizu", {}, "石津"),
        npc2: t("characters.oldMan", {}, "おじさん"),
        npc3: t("characters.koi", {}, "鯉"),
        npc4: t("characters.childA", {}, "子供A"),
        npc5: t("characters.childB", {}, "子供B")
    };
    SPEAKER_DISPLAY_NAMES = {
        machi: t("characters.machi", {}, "マチちゃん"),
        ishizu: t("characters.ishizu", {}, "石津"),
        oldman: t("characters.oldMan", {}, "おじさん"),
        koi: t("characters.koi", {}, "鯉"),
        child1: t("characters.childA", {}, "子供A"),
        child2: t("characters.childB", {}, "子供B")
    };
    DEFAULT_MENU_CONFIG = {
        title: t("menu.title", {}, "針江さんぽ"),
        overlayAlpha: 0.5,
        defaultBgmVolume: 50,
        defaultSeVolume: 50,
        fadeDuration: 500,
        startMenu: {
            mainButton: t("menu.newGame", {}, "新ゲーム"),
            settingsButton: t("menu.settingsButton", {}, "設定"),
            browserZoomHint: ""
        },
        pauseMenu: {
            mainButton: t("menu.continue", {}, "続ける"),
            settingsButton: t("menu.settingsButton", {}, "設定")
        },
        settingsMenu: {
            title: t("menu.settingsTitle", {}, "設定"),
            bgmLabel: t("menu.bgmLabel", {}, "音楽"),
            seLabel: t("menu.seLabel", {}, "効果音"),
            languageLabel: t("menu.languageLabel", {}, "言語"),
            backButton: t("menu.back", {}, "戻る")
        }
    };
}

function create(data) {

    localizationData =
        this.cache.json.get("localizationCommon") || {};
    initializeLocalizedConstants();
    menuConfig = getMenuConfig(this);
    const restoreMenuAfterLanguageReload =
        data && data.restoreMenuAfterLanguageReload;

    // 后续可由外部剧情数据直接调用，不经过 NPC 对话框。
    this.playEndingNarration = () => showEndingNarration(this);

    if (!gameStarted) {
        bgmVolume = clampVolume(menuConfig.defaultBgmVolume);
        seVolume = clampVolume(menuConfig.defaultSeVolume);
        menuMode = "start";
        previousMenuMode = "start";
        isPaused = false;
        menuTransitioning = false;
    } else {
        // 地图切换会 restart 当前 Scene；菜单状态不能随地图重建。
        menuMode = null;
        isPaused = false;
        menuTransitioning = false;
    }
    menuContainer = null;

    //--------------------------------
    // 确定当前地图
    //--------------------------------

    currentMapKey =
        (data && data.mapKey) || "harie_outside";

    const mapConfig = MAPS[currentMapKey];

    // 当前地图缩放比，供 update() 和 warpToMap() 使用
    currentMapScale = mapConfig.mapScale || 1;

    // NPC 触发距离：20px（约 0.6 格），随地图缩放同步放大
    interactDistance = 20 * currentMapScale;

    const startX =
        (data && data.startX) || mapConfig.defaultStartX;

    const startY =
        (data && data.startY) || mapConfig.defaultStartY;

    //--------------------------------
    // 重置状态（scene.restart 时全局变量会残留）
    //--------------------------------

    isWarping = false;
    isDialogOpen = false;
    isInvestigationOpen = false;
    isProloguePlaying = false;
    isMonologuePlaying = false;
    isNpcMenuOpen = false;
    npcMenuItems = [];
    npcMenuTexts = [];
    npcMenuBackground = null;
    npcMenuCurrentNpc = null;
    npcQuestionMode = false;
    npcQuestionPage = 0;
    npcQuestionTotalPages = 1;
    npcQuestionAllGroups = [];
    npcQuestionVisibleGroups = [];
    currentDialogIndex = 0;
    currentNpc = null;
    currentInvestigation = null;
    fieldAreas = [];
    isInField = false;
    soundAreas = [];           // 重置 SoundArea
    soundAreaConfigs = {};     // 重置缓存配置
    warnedSoundKeys.clear();   // 重置警告记录
    lastDirection = "down";
    warpCooldown = Date.now() + 500;

    //--------------------------------
    // 移动引导：清空旧引用（scene.restart 会销毁旧对象）
    //--------------------------------

    moveTutorialTexts = [];

    //--------------------------------
    // FPS 文本：清空旧引用（scene.restart 会销毁旧对象）
    //--------------------------------

    fpsText = null;
    fpsAccum = 0;

    //--------------------------------
    // 线索 UI 引用清空（scene.restart 会销毁旧对象）
    //--------------------------------

    storyHintText = null;
    storyHintBackground = null;

    //--------------------------------
    // 对话框姓名引用清空（scene.restart 会销毁旧对象）
    //--------------------------------

    dialogNameText = null;
    dialogNameBackground = null;

    //--------------------------------
    // BGM 初始化（仅首次游戏时播放，warp 重启不重复）
    //--------------------------------

    if (!bgmStarted) {

        bgmIntro = this.sound.add(
            "bgm_intro",
            {
                volume: bgmVolume,
                loop: false
            }
        );

        bgmLoop = this.sound.add(
            "bgm_loop",
            {
                volume: bgmVolume,
                loop: true
            }
        );

        bgmIntro.play();

        //--------------------------------
        // Intro 播放结束后自动切入 Loop
        //--------------------------------

        bgmIntro.once(
            "complete",
            () => {
                if (bgmLoop && !bgmLoop.isPlaying) {
                    bgmLoop.play();
                }
            }
        );

        bgmStarted = true;

    } else {

        //--------------------------------
        // Warp 重启：恢复用户设置的 BGM 音量。
        //--------------------------------

        setBGMVolume(this, bgmVolume, 500);

    }

    //--------------------------------
    // 按键
    //--------------------------------

    keyE = this.input.keyboard.addKey(
        Phaser.Input.Keyboard.KeyCodes.E
    );

    keySpace = this.input.keyboard.addKey(
        Phaser.Input.Keyboard.KeyCodes.SPACE
    );

    keyF = this.input.keyboard.addKey(
        Phaser.Input.Keyboard.KeyCodes.F
    );

    keyEsc = this.input.keyboard.addKey(
        Phaser.Input.Keyboard.KeyCodes.ESC
    );

    cursors =
        this.input.keyboard.createCursorKeys();

    wasdKeys = this.input.keyboard.addKeys({
        W: "W",
        A: "A",
        S: "S",
        D: "D",
        SHIFT: Phaser.Input.Keyboard.KeyCodes.SHIFT
    });

    //--------------------------------
    // 对话框
    //--------------------------------

    dialogBox =
        this.add.rectangle(
            480,
            560,
            900,
            120,
            0x000000,
            0.8
        ).setDepth(3000);

    dialogBox.setVisible(false);

    //--------------------------------
    // 对话文字（x 右移至 160，换行宽度 760）
    //--------------------------------

    dialogText =
        this.add.text(
            160,
            520,
            safeText(""),
            {
                fontSize: "24px",
                color: "#ffffff",
                wordWrap: {
                    width: 760
                }
            }
        ).setDepth(3200);

    dialogText.setVisible(false);

    //--------------------------------
    // 头像（VN 风格，位于对话框后方）
    // 透明背景 PNG，512×768 等比缩放至 180×280 范围
    //--------------------------------

    portraitImage =
        this.add.image(
            120,
            410,
            "portrait_ishizu"
        );

    portraitImage.setDepth(3100);
    portraitImage.setScrollFactor(0);
    portraitImage.setAlpha(0);
    portraitImage.setVisible(false);

    //--------------------------------
    // 对话框姓名（位于对话框上方左侧，靠近头像）
    //--------------------------------

    dialogNameBackground =
        this.add.rectangle(
            170, 478,
            140, 34,
            0x381f0e,
            0.75
        );
    dialogNameBackground.setOrigin(0.5, 0.5);
    dialogNameBackground.setScrollFactor(0);
    dialogNameBackground.setDepth(3190);
    dialogNameBackground.setVisible(false);

    dialogNameText =
        this.add.text(
            170, 470,
            "",
            {
                fontFamily: "Noto Sans JP, sans-serif",
                fontSize: "22px",
                color: "#ffffff",
                fontStyle: "bold",
                stroke: "#381f0e",
                strokeThickness: 4,
                align: "center"
            }
        );
    dialogNameText.setOrigin(0.5, 0);
    dialogNameText.setScrollFactor(0);
    dialogNameText.setDepth(3200);
    dialogNameText.setVisible(false);

    //--------------------------------
    // 调查展示 UI（图片 + 标题 + 文本）
    // 全部 scrollFactor(0) 固定在屏幕上
    //--------------------------------

    invOverlay =
        this.add.rectangle(
            480, 320,
            960, 640,
            0x000000, 0.8
        )
        .setDepth(200)
        .setScrollFactor(0);

    invOverlay.setVisible(false);

    invImage =
        this.add.image(
            480, 230,
            "fragment_notice"
        )
        .setDepth(201)
        .setScrollFactor(0);

    invImage.setVisible(false);

    invTitle =
        this.add.text(
            480, 475,
            safeText(""),
            {
                fontSize: "28px",
                color: "#ffff00",
                fontStyle: "bold"
            }
        )
        .setOrigin(0.5)
        .setDepth(202)
        .setScrollFactor(0);

    invTitle.setVisible(false);

    invText =
        this.add.text(
            480, 520,
            safeText(""),
            {
                fontSize: "20px",
                color: "#ffffff",
                align: "center",
                wordWrap: { width: 700 }
            }
        )
        .setOrigin(0.5, 0)
        .setDepth(202)
        .setScrollFactor(0);

    invText.setVisible(false);

    //--------------------------------
    // 调查展示 — 视频对象（type=video）
    // 创建一次，复用 loadURL 切换视频源
    //--------------------------------
    invVideo = this.add.video(480, 220);
    invVideo.setOrigin(0.5)
            .setDepth(1000)
            .setScrollFactor(0)
            .setVisible(false);

    //--------------------------------
    // 交互提示（靠近 NPC / 调查点时显示 "E"）
    //--------------------------------

    interactPrompt =
        this.add.text(
            0,
            0,
            safeText(
                t("system.interactPrompt", {}, "E")
            ),
            {
                fontSize: "18px",
                color: "#ffff00",
                backgroundColor: "rgba(0,0,0,0.7)",
                padding: { x: 6, y: 3 }
            }
        ).setDepth(200);

    interactPrompt.setVisible(false);

    //--------------------------------
    // 笔记本 UI
    // 左上角常驻关闭状态图标 + 全屏打开状态图片
    //--------------------------------

    notebookClosedIcon =
        this.add.image(
            24,
            24,
            "notebook_close"
        )
        .setOrigin(0.5)
        .setScrollFactor(0)
        .setDepth(3000);

    notebookFeedbackTween = null;
    notebookFeedbackBaseAlpha = notebookClosedIcon.alpha;
    pendingInvestigationFeedback = false;
    investigationFeedbackMark = null;

    notebookOpenImage =
        this.add.image(
            480,
            330,
            "notebook_open"
        )
        .setOrigin(0.5)
        .setScrollFactor(0)
        .setDepth(3001)
        .setVisible(false);

    //--------------------------------
    // Tutorial Phase 1: Notebook 图标旁常驻 F 键提示
    //--------------------------------

    tutorialFKeyHint = this.add.text(
        48, 30,
        safeText(
            t("tutorial.notebook", {}, "F：メモ")
        ),
        {
            fontFamily: "Noto Sans JP, sans-serif",
            fontSize: "18px",
            color: "#ffffff",
            fontStyle: "bold"
        }
    )
    .setOrigin(0, 0.5)
    .setScrollFactor(0)
    .setDepth(3001)
    .setAlpha(0.6);

    //--------------------------------
    // 笔记本数据初始化
    //  - pages：页面元数据（来自 notebook.json）
    //  - fragments：碎片库（来自 fragments.json）
    //  - pages 中 items 的 unlocked 字段若存在 fragment 引用，
    //    会被 fragments 中对应条目的 unlocked 状态覆盖
    //--------------------------------

    const nbData     = this.cache.json.get("notebookData");
    const fragData   = this.cache.json.get("fragmentsData");

    notebookPages = safeArray(nbData && nbData.pages);
    notebookProgressLabel = safeText(
        nbData &&
        nbData.progress &&
        nbData.progress.collectedLabel
    ) || "Collected";
    fragments     = safeArray(fragData);

    if (!fragmentsLoadLogged) {
        fragmentsLoadLogged = true;
        console.log("[Fragments Loaded]", {
            count: safeArray(fragments).length,
            ids: safeArray(fragments)
                .map(item => item && item.id)
                .filter(Boolean)
        });
    }

    //--------------------------------
    // 剧情数据初始化（仅首次加载，warp 不重置 storyStage）
    //--------------------------------

    if (!storyData) {
        storyData = this.cache.json.get("storyData") || {};
        if (storyData.initialStoryStage !== undefined) {
            storyStage = storyData.initialStoryStage;
        }
    }

    //--------------------------------
    // 调查→NPC通知映射数据初始化（仅首次加载）
    //--------------------------------

    if (!storyEventsData) {
        storyEventsData = this.cache.json.get("storyEventsData") || {};
    }

    //--------------------------------
    // 调查线索数据初始化（仅首次加载）
    //--------------------------------

    if (!storyHintsData) {
        storyHintsData = this.cache.json.get("storyHintsData") || [];
    }

    restoreLanguageProgressState(this);

    // 同步人物页 items 的 unlocked（fragment 引用型）
    safeArray(notebookPages).forEach(page => {
        safeArray(page && page.items).forEach(it => {
            if (!it) return;
            if (it.fragmentRef) {
                const f = safeArray(fragments).find(x => x && x.id === it.fragmentRef);
                it.unlocked = !!(f && f.unlocked);
            }
        });
    });

    //--------------------------------
    // 动态加载 fragment 图片（JSON 驱动，新增 fragment 无需改代码）
    // 原图：assets/investigation/images/<image>
    //   纹理 key: notebook_<filename>（okawa.jpg → notebook_okawa）
    //--------------------------------

    safeArray(fragments).forEach(f => {
        if (!f) return;
        if (f.image) {
            const imageName = safeText(f.image);
            const imagePath =
                FLOWER_INVESTIGATION_IMAGE_PATHS[f.id] ||
                "assets/investigation/images/" + imageName;
            const imgKey =
                "notebook_" + imageName.replace(/\.[^.]+$/, "");
            if (!this.textures.exists(imgKey)) {
                this.load.image(
                    imgKey,
                    imagePath
                );
            }
        }
    });

    //--------------------------------
    // 动态加载调查展示素材（JSON 驱动）
    // image → assets/investigation/images/<image>  (key: inv_<filename>)
    // video → assets/investigation/videos/<video>  (key: inv_<filename>)
    // audio → assets/audio/<audio>                  (key: inv_<filename>)
    //--------------------------------

    safeArray(fragments).forEach(f => {
        if (!f) return;

        if (f.type === "image" && f.image) {
            const imageName = safeText(f.image);
            const imagePath =
                FLOWER_INVESTIGATION_IMAGE_PATHS[f.id] ||
                "assets/investigation/images/" + imageName;
            const key =
                "inv_" + imageName.replace(/\.[^.]+$/, "");
            if (!this.textures.exists(key)) {
                this.load.image(
                    key,
                    imagePath
                );
            }
        }

        if (f.type === "video" && f.video) {
            const videoName = safeText(f.video);
            const key =
                "inv_" + videoName.replace(/\.[^.]+$/, "");
            if (!this.cache.video.exists(key)) {
                this.load.video(
                    key,
                    "assets/investigation/videos/" + videoName,
                    true,   // asBlob
                    true    // noAudio
                );
            }
        }

        if (f.type === "audio" && f.audio) {
            const audioName = safeText(f.audio);
            const key =
                "inv_" + audioName.replace(/\.[^.]+$/, "");
            if (!this.cache.audio.exists(key)) {
                this.load.audio(
                    key,
                    "assets/audio/" + audioName
                );
            }
        }

    });

    if (this.load.list.size > 0) {
        this.load.start();
    }

    // 初始页索引合法化（当前 notebookPageIndex 对应解锁 fragment 列表下标）
    notebookPageIndex = 0;
    fragmentListSubPage = 0;

    //--------------------------------
    // JSON
    //--------------------------------

    const mapData =
        this.cache.json.get(mapConfig.jsonKey) || { layers: [] };

    const mapLayers = safeArray(mapData.layers);

    //--------------------------------
    // 地图图片（读取 Tiled imagelayer 的 offset）
    //--------------------------------

    const imageLayer =
        mapLayers.find(
            l => l.type === "imagelayer"
        );

    const offsetX =
        (imageLayer && imageLayer.offsetx) || 0;

    const offsetY =
        (imageLayer && imageLayer.offsety) || 0;

    const mapImage =
        this.add.image(
            offsetX * currentMapScale,
            offsetY * currentMapScale,
            mapConfig.imageKey
        );

    mapImage.setOrigin(0);
    mapImage.setScale(currentMapScale);
    mapImage.setDepth(0);

    //--------------------------------
    // 世界边界 & 摄像机边界（基于实际图片尺寸 × scale）
    //--------------------------------

    const worldW = mapImage.width * currentMapScale;
    const worldH = mapImage.height * currentMapScale;

    this.physics.world.setBounds(0, 0, worldW, worldH);
    this.cameras.main.setBounds(0, 0, worldW, worldH);
    // 摄像机跟随放到 player 创建之后（避免访问未定义）

    //--------------------------------
    // Collision
    //--------------------------------

    collisionGroup =
        this.physics.add.staticGroup();

    const collisionLayer =
        mapLayers.find(
            layer =>
                layer.name === "Collision"
        );

    if (collisionLayer) {

        safeArray(collisionLayer.objects).forEach(obj => {
            if (!obj) return;

            const s = currentMapScale;
            const wall =
                this.add.zone(
                    (obj.x + obj.width / 2) * s,
                    (obj.y + obj.height / 2) * s,
                    obj.width * s,
                    obj.height * s
                );

            this.physics.add.existing(
                wall,
                true
            );

            collisionGroup.add(wall);

        });

    }

    //--------------------------------
    // 农田区域
    //--------------------------------

    const fieldLayer =
        mapLayers.find(
            layer =>
                layer.name === "FieldArea"
        );

    if (fieldLayer) {

        const s = currentMapScale;
        safeArray(fieldLayer.objects).forEach(obj => {
            if (!obj) return;

            fieldAreas.push({

                x: obj.x * s,
                y: obj.y * s,
                width: obj.width * s,
                height: obj.height * s

            });

        });

    }

    //--------------------------------
    // SoundArea — 环境音区域
    // 多个矩形共享同一个 Sound 实例（单声源）
    //--------------------------------

    const soundAreaLayer =
        mapLayers.find(
            layer =>
                layer.name === "SoundArea"
        );

    if (soundAreaLayer) {

        const s = currentMapScale;
        safeArray(soundAreaLayer.objects).forEach(obj => {

            if (!obj.properties) return;

            const soundProp = getPropValue(obj, "sound");
            const radiusProp = getPropValue(obj, "radius");
            const maxVolProp = getPropValue(obj, "maxVolume");

            if (!soundProp) return;

            soundAreas.push({

                x: obj.x * s,
                y: obj.y * s,
                width: obj.width * s,
                height: obj.height * s,

                soundKey: soundProp,
                radius: (radiusProp || 96) * s,
                maxVolume: maxVolProp != null ? maxVolProp : 0.5

            });

            // 为该 soundKey 创建唯一 Sound 实例（如尚未创建）
            // 安全检查：音频未加载时跳过，不中断游戏
            if (!ambientSounds[soundProp]) {

                if (!this.cache.audio.exists(soundProp)) {
                    console.warn("[SoundArea] 音频不存在:", soundProp);
                } else {
                    ambientSounds[soundProp] =
                        this.sound.add(
                            soundProp,
                            { loop: true, volume: 0 }
                        );
                }

            }

        });

        //--------------------------------
        // 缓存每个 soundKey 的配置（避免 update 中每帧 find）
        //--------------------------------

        safeArray(soundAreas).forEach(area => {
            if (!soundAreaConfigs[area.soundKey]) {
                soundAreaConfigs[area.soundKey] = {
                    radius: area.radius,
                    maxVolume: area.maxVolume
                };
            }
        });

    }
    //--------------------------------

    npcGroup =
        this.add.group();

    const npcLayer =
        mapLayers.find(
            layer =>
                layer.name === "NPC"
        );

    if (npcLayer) {

        const s = currentMapScale;
        safeArray(npcLayer.objects).forEach(obj => {

            if (!obj.properties) return;

            //--------------------------------
            // 数据驱动：读取 key 属性决定精灵贴图
            // key=npc3 → 使用 npc3.png
            // 不写死任何 if 判断，支持无限 NPC
            //--------------------------------

            const npcKey =
                getPropValue(obj, "key") ||
                obj.name ||
                "npc1";

            //--------------------------------
            // 贴图存在 → 正常创建可见 image
            // 贴图不存在 → 创建不可见占位对象
            //   （无全身像 NPC：仅用于距离检测 + 对话触发）
            //--------------------------------

            let npc;

            if (this.textures.exists(npcKey)) {

                npc = this.add.image(
                    (obj.x + obj.width / 2) * s,
                    (obj.y + obj.height / 2) * s,
                    npcKey
                );

            } else {

                console.warn(
                    "[NPC] 无全身像贴图，创建不可见触发点:",
                    npcKey
                );

                //--------------------------------
                // 用任意已加载贴图创建后隐藏
                // 保持 Image 类型接口一致
                //--------------------------------

                npc = this.add.image(
                    (obj.x + obj.width / 2) * s,
                    (obj.y + obj.height / 2) * s,
                    "npc1"
                );

                npc.setVisible(false);

            }

            //--------------------------------
            // 读取 dialog 属性 → 对应 JSON key
            // dialog=npc3 → dialogKey = "dialog_npc3"
            //--------------------------------

            const dialogProp =
                getPropValue(obj, "dialog");

            npc.dialogKey =
                dialogProp
                    ? "dialog_" + dialogProp
                    : null;

            //--------------------------------
            // 人物 ID：用于 Notebook 人物解锁
            // 优先读 Tiled "person" 属性，没有则回退到 "dialog" 属性
            //--------------------------------

            npc.personId =
                getPropValue(obj, "person") || dialogProp;

            npcGroup.add(npc);
            npc.setDepth(10);

        });

    }

    //--------------------------------
    // Investigation 组 — 使用 physics staticGroup
    // 玩家身体进入对象层矩形即触发 overlap，不再用距离检测
    //--------------------------------

    investigationGroup =
        this.physics.add.staticGroup();

    safeArray(mapConfig.investigationLayers).forEach(
        layerName => {

            const layer =
                mapLayers.find(
                    l => l.name === layerName
                );

            if (!layer) return;

            const s = currentMapScale;
            safeArray(layer.objects).forEach(obj => {

                if (!obj.properties) return;

                //--------------------------------
                // 数据驱动：优先检查 fragment 属性
                // 其次检查 type=warp（地图切换）
                // 向后兼容：如果没有 fragment 但有 id，
                //   且 id 存在于 fragments.json，则使用 id 作为 fragmentId
                // 其他所有调查数据从 fragments.json 读取
                //--------------------------------

                const fragmentProp =
                    obj.properties.find(
                        p => p.name === "fragment"
                    );

                const typeProp =
                    obj.properties.find(
                        p => p.name === "type"
                    );

                const isWarp =
                    typeProp && typeProp.value === "warp";

                //--------------------------------
                // 解析 fragmentId（fragment 优先，id 兼容）
                //--------------------------------

                let resolvedFragmentId = "";

                if (fragmentProp) {

                    resolvedFragmentId = fragmentProp.value;

                    // Tiled 旧数据兼容：fragment 与有效 id 冲突时，
                    // 以 fragments.json 中实际存在的对象 id 为准。
                    const idProp = obj.properties.find(
                        p => p.name === "id"
                    );
                    const idIsFragment = idProp && safeArray(fragments).some(
                        f => f && f.id === idProp.value
                    );
                    if (idIsFragment && idProp.value !== resolvedFragmentId) {
                        console.warn("[Investigation Fragment Mismatch]", {
                            tiledObjectId: obj.id,
                            tiledFragment: resolvedFragmentId,
                            tiledId: idProp.value,
                            resolvedFragmentId: idProp.value
                        });
                        resolvedFragmentId = idProp.value;
                    }

                } else if (!isWarp) {

                    const idProp =
                        obj.properties.find(
                            p => p.name === "id"
                        );

                    if (idProp && safeArray(fragments).some(f => f && f.id === idProp.value)) {
                        resolvedFragmentId = idProp.value;
                    }

                }

                // 已删除的调查点可能仍作为装饰对象保留在旧 Tiled 地图中。
                // 只忽略其调查交互，不影响同一对象层中的 Warp 或碰撞。
                if (!isWarp && REMOVED_INVESTIGATION_IDS.has(resolvedFragmentId)) {
                    return;
                }

                if (currentMapKey === "harie_community_center" && resolvedFragmentId) {
                    console.log("[Investigation Zone Created]", {
                        currentMapKey,
                        tiledObjectId: obj.id,
                        tiledObjectName: obj.name,
                        resolvedFragmentId,
                        tiledFragment: getPropValue(obj, "fragment"),
                        tiledId: getPropValue(obj, "id")
                    });
                }

                // 必须有 fragmentId 或 type=warp 才创建 zone
                if (!resolvedFragmentId && !isWarp) return;

                const resolvedFragment = !isWarp
                    ? safeArray(fragments).find(
                        f => f && f.id === resolvedFragmentId
                    )
                    : null;

                if (resolvedFragmentId === "okawa") {
                    console.log("[OKAWA STATUS]", {
                        storyStage,
                        fragmentExists: !!resolvedFragment,
                        fragmentUnlocked: resolvedFragment && resolvedFragment.unlocked,
                        requiredStage: resolvedFragment && resolvedFragment.requiredStage,
                        type: resolvedFragment && resolvedFragment.type
                    });
                }

                // dialogue 碎片只由 NPC 对话解锁，不创建普通媒体调查区。
                if (resolvedFragment && resolvedFragment.type === "dialogue") {
                    return;
                }

                //--------------------------------
                // 创建 zone，添加静态物理体
                //--------------------------------

                const zone =
                    this.add.zone(
                        (obj.x + obj.width / 2) * s,
                        (obj.y + obj.height / 2) * s,
                        obj.width * s,
                        obj.height * s
                    );

                this.physics.add.existing(zone, true);

                zone.invName = obj.name;

                if (isWarp) {

                    //--------------------------------
                    // Warp zone：保留原有逻辑
                    // 支持 requiredStage 属性（从 Tiled properties 读取）
                    //--------------------------------

                    zone.invType = "warp";
                    zone.target      = getPropValue(obj, "target");
                    zone.targetXRaw = getPropValue(obj, "x") || 0;
                    zone.targetYRaw = getPropValue(obj, "y") || 0;
                    zone.fragmentId = "";
                    zone.storyRequirements =
                        storyData && storyData.warpRequirements
                            ? storyData.warpRequirements[zone.target] || null
                            : null;

                    //--------------------------------
                    // 宿入口属于 Stage2，社区中心入口属于 Stage3
                    // 其他 warp 默认 requiredStage = 0
                    //--------------------------------

                    const configuredStage =
                        zone.storyRequirements &&
                        zone.storyRequirements.storyStageMin !== undefined
                            ? Number(zone.storyRequirements.storyStageMin)
                            : null;

                    if (Number.isFinite(configuredStage)) {
                        zone.requiredStage = configuredStage;
                    } else if (zone.target === "harie_room") {
                        zone.requiredStage = 2;
                    } else if (zone.target === "harie_community_center") {
                        zone.requiredStage = 2;
                    } else {
                        zone.requiredStage = 0;
                    }

                    if (zone.target === "harie_community_center") {
                        console.log("[Warp Created]", {
                            currentMapKey,
                            target: zone.target,
                            requiredStage: zone.requiredStage,
                            storyRequirements: zone.storyRequirements
                        });
                    }

                } else {

                    //--------------------------------
                    // 调查点：数据驱动
                    // 只保存 fragmentId，其余数据从 fragments.json 读取
                    //--------------------------------

                    zone.invType = "fragment";
                    zone.fragmentId = resolvedFragmentId;
                    zone.target = null;
                    zone.targetXRaw = 0;
                    zone.targetYRaw = 0;

                    //--------------------------------
                    // requiredStage：从 fragments.json 读取
                    // currentStoryStage >= requiredStage 时才显示 E
                    //--------------------------------

                    const fragReq =
                        safeArray(fragments).find(
                            f => f && f.id === resolvedFragmentId
                        );
                    zone.requiredStage =
                        (fragReq && fragReq.requiredStage !== undefined)
                            ? fragReq.requiredStage
                            : 0;

                    // Stage5 只开放 story.json 明确列出的终幕调查点。
                    if (isEndingFragment(resolvedFragmentId)) {
                        zone.requiredStage = 5;
                    }

                    //--------------------------------
                    // 兜底数据：从 Tiled 读取 invTitle / invText
                    // fragment 找不到时使用这些值显示
                    //--------------------------------
                    zone.invTitle =
                        getPropValue(obj, "invTitle") ||
                        obj.name || "";
                    zone.invText =
                        getPropValue(obj, "invText") || "";

                }

                investigationGroup.add(zone);

            });

        }
    );

    //--------------------------------
    // Foreground 前景遮挡
    // 读取 Tiled Foreground 对象层，
    // 创建图片并设在玩家上方（depth=100）
    //--------------------------------

    foregroundGroup =
        this.add.group();

    const foregroundLayer =
        mapLayers.find(
            l => l.name === "Foreground"
        );

    if (foregroundLayer) {

        const s = currentMapScale;

        safeArray(foregroundLayer.objects).forEach(obj => {
            if (!obj) return;

            // obj.name 对应图片 key（如 "bus_stop"）
            const key = obj.name;

            // 确认图片已加载再创建
            if (!this.textures.exists(key)) {
                console.warn(
                    "[Foreground] 图片未加载，跳过:",
                    key
                );
                return;
            }

            const fg = this.add.image(
                obj.x * s,
                obj.y * s,
                key
            );

            fg.setOrigin(0, 0);
            fg.setScale(s);
            fg.setDepth(100);

            foregroundGroup.add(fg);

        });

    }

    //--------------------------------
    // 玩家
    //--------------------------------


    player =
        this.physics.add.sprite(
            startX,
            startY,
            "player",
            7
        );

    player.setCollideWorldBounds(
        true
    );

    player.body.setSize(
        16,
        12
    );

    player.body.setOffset(
        8,
        20
    );

    //--------------------------------
    // 室内地图：玩家放大 1.3 倍
    //--------------------------------

    if (currentMapKey === "harie_room") {
        player.setScale(1.3);
    }

    player.setDepth(10);

    //--------------------------------
    // 移动引导（仅首次游戏开始时出现）
    //--------------------------------

    if (!tutorialMoveDone) {
        createMoveTutorial(this);
    }

    //--------------------------------
    // 玩家碰撞
    //--------------------------------

    this.physics.add.collider(
        player,
        collisionGroup
    );

    //--------------------------------
    // 玩家 ↔ NPC 碰撞（NPC 为 immovable）
    //--------------------------------

    this.physics.add.collider(
        player,
        npcGroup
    );

    //--------------------------------
    // 摄像机跟随玩家（必须在 player 创建之后）
    //--------------------------------

    this.cameras.main.startFollow(player, true, 0.1, 0.1);

    //--------------------------------
    // 调查点 overlap：身体进入矩形即触发
    //--------------------------------

    this.physics.add.overlap(
        player,
        investigationGroup,
        (player, zone) => {
            currentInvestigation = zone;
        }
    );

    //--------------------------------
    // 声音（缺少音频文件时跳过，避免 create() 中断）
    //--------------------------------

    if (this.cache.audio.exists("fieldSound")) {
        fieldSound =
            this.sound.add(
                "fieldSound",
                {
                    loop: true,
                    volume: seVolume
                }
            );
    } else {
        console.warn("[音频] 缺失 fieldSound，已跳过");
    }

    //--------------------------------
    // 动画（防止 scene.restart 重复创建）
    //--------------------------------

    if (!this.textures.exists("player")) {

        console.warn("[Animation] 玩家贴图不存在，跳过行走动画");

    } else if (!this.anims.get("walk_up")) {

        this.anims.create({

            key: "walk_up",

            frames:
                this.anims.generateFrameNumbers(
                    "player",
                    {
                        frames: [0, 1, 2, 1]
                    }
                ),

            frameRate: 8,

            repeat: -1

        });

    }

    if (this.textures.exists("player") && !this.anims.get("walk_side")) {

        this.anims.create({

            key: "walk_side",

            frames:
                this.anims.generateFrameNumbers(
                    "player",
                    {
                        frames: [5, 4, 3, 4]
                    }
                ),

            frameRate: 8,

            repeat: -1

        });

    }

    if (this.textures.exists("player") && !this.anims.get("walk_down")) {

        this.anims.create({

            key: "walk_down",

            frames:
                this.anims.generateFrameNumbers(
                    "player",
                    {
                        frames: [6, 7, 8, 7]
                    }
                ),

            frameRate: 8,

            repeat: -1

        });

    }

    //--------------------------------
    // 淡入（warp 切换时的过渡效果）
    //--------------------------------

    this.cameras.main.fadeIn(300, 0, 0, 0);

    //--------------------------------
    // FPS 调试显示（左下角，每秒刷新一次）
    //--------------------------------

    fpsText = this.add.text(
        10, 610, safeText(""),
        {
            fontFamily: "monospace",
            fontSize: "14px",
            color: "#ffff00",
            stroke: "#000000",
            strokeThickness: 3
        }
    ).setScrollFactor(0).setDepth(9999);

    fpsAccum = 0;

    //--------------------------------
    // 调查线索 UI（屏幕正上方当前线索）
    //--------------------------------

    createStoryHintUI(this);

    // 地图 restart 完成后立即按新 currentMapKey 重新评估提示。
    updateStoryHint(this);

    //--------------------------------
    // 序幕自动播放（仅首次加载，Stage 0 且未播放过）
    //--------------------------------

    if (
        storyStage === 0 &&
        !prologuePlayed &&
        storyData &&
        storyData.prologue
    ) {
        this.time.delayedCall(500, () => {
            startPrologue(this);
        });
    } else {
        //--------------------------------
        // 非序幕开场（warp 完成 / 已完成序幕）
        // 延迟更新线索，确保 UI 就绪
        //--------------------------------
        this.time.delayedCall(800, () => {
            updateStoryHint(this);
        });
    }

    if (!gameStarted) {
        showMainMenu(this, "start");
        freezeGameForMenu(this);
    } else if (restoreMenuAfterLanguageReload === "pause") {
        isPaused = true;
        freezeGameForMenu(this);
        showMainMenu(this, "pause");
    }

}

function getMenuConfig(scene) {
    let loaded = null;
    try {
        loaded = scene.cache.json.exists("menuManagerConfig")
            ? scene.cache.json.get("menuManagerConfig")
            : null;
    } catch (error) {
        console.warn("[Menu] 配置读取失败，使用安全默认值", error);
    }
    if (!loaded || typeof loaded !== "object") {
        console.warn("[Menu] MenuManager.json 不可用，使用安全默认值");
        return {
            ...DEFAULT_MENU_CONFIG,
            startMenu: { ...DEFAULT_MENU_CONFIG.startMenu },
            pauseMenu: { ...DEFAULT_MENU_CONFIG.pauseMenu },
            settingsMenu: { ...DEFAULT_MENU_CONFIG.settingsMenu }
        };
    }
    return {
        ...DEFAULT_MENU_CONFIG,
        ...loaded,
        startMenu: { ...DEFAULT_MENU_CONFIG.startMenu, ...(loaded.startMenu || {}) },
        pauseMenu: { ...DEFAULT_MENU_CONFIG.pauseMenu, ...(loaded.pauseMenu || {}) },
        settingsMenu: {
            ...DEFAULT_MENU_CONFIG.settingsMenu,
            ...(loaded.settingsMenu || {})
        }
    };
}

function clampVolume(percent) {
    const numeric = Number(percent);
    return Phaser.Math.Clamp(Number.isFinite(numeric) ? numeric / 100 : 0.5, 0, 1);
}

function stopPlayerMotion() {
    if (!player) return;
    player.setVelocity(0);
    if (player.anims) player.anims.stop();
}

function freezeGameForMenu(scene) {
    stopPlayerMotion();
    if (interactPrompt) interactPrompt.setVisible(false);
    if (scene.physics && scene.physics.world && !scene.physics.world.isPaused) {
        scene.physics.world.pause();
    }
    // Clock 单独暂停，不影响 Scene update、菜单交互和音频播放。
    scene.time.paused = true;
    if (gameStarted && scene.tweens) scene.tweens.pauseAll();
}

function resumeGameFromMenu(scene) {
    stopPlayerMotion();
    scene.time.paused = false;
    if (scene.tweens) scene.tweens.resumeAll();
    if (scene.physics && scene.physics.world && scene.physics.world.isPaused) {
        scene.physics.world.resume();
    }
}

function destroyMenu() {
    if (menuContainer) {
        menuContainer.destroy(true);
        menuContainer = null;
    }
    settingsLanguageValueText = null;
}

function makeMenuButton(scene, container, x, y, label, onClick) {
    const hit = scene.add.rectangle(x, y, 300, 54, 0xffffff, 0.001)
        .setInteractive({ useHandCursor: true });
    const text = scene.add.text(x, y, safeText(label), {
        fontFamily: '"Hiragino Kaku Gothic ProN", "Yu Gothic", sans-serif',
        fontSize: "30px",
        color: "#ffffff",
        stroke: "#000000",
        strokeThickness: 3
    }).setOrigin(0.5);
    hit.on("pointerover", () => {
        if (!menuTransitioning) text.setColor("#ffe8a3");
    });
    hit.on("pointerout", () => text.setColor("#ffffff"));
    hit.on("pointerdown", pointer => {
        if (pointer && pointer.event) pointer.event.stopPropagation();
        if (!menuTransitioning) onClick();
    });
    container.add([hit, text]);
}

function createMenuShell(scene) {
    destroyMenu();
    const camera = scene.cameras.main;
    const width = camera.width || scene.scale.width || 960;
    const height = camera.height || scene.scale.height || 640;
    const centerX = width / 2;
    const centerY = height / 2;
    const configuredAlpha = Number(menuConfig.overlayAlpha);
    const overlayAlpha = Phaser.Math.Clamp(
        Number.isFinite(configuredAlpha)
            ? configuredAlpha
            : DEFAULT_MENU_CONFIG.overlayAlpha,
        0,
        1
    );
    menuContainer = scene.add.container(0, 0)
        .setScrollFactor(0)
        .setDepth(20000);
    const overlay = scene.add.rectangle(
        centerX, centerY, width, height, 0x000000, overlayAlpha
    ).setInteractive();
    overlay.on("pointerdown", pointer => {
        if (pointer && pointer.event) pointer.event.stopPropagation();
    });
    menuContainer.add(overlay);
    return { container: menuContainer, width, height, centerX, centerY };
}

function showMainMenu(scene, mode) {
    menuMode = mode;
    previousMenuMode = mode;
    menuTransitioning = false;
    const shell = createMenuShell(scene);
    const labels = mode === "pause" ? menuConfig.pauseMenu : menuConfig.startMenu;
    if (mode === "start" && labels.browserZoomHint) {
        const browserZoomHint = scene.add.text(
            shell.centerX,
            82,
            safeText(labels.browserZoomHint),
            {
                fontFamily: '"Hiragino Kaku Gothic ProN", "Yu Gothic", sans-serif',
                fontSize: "18px",
                color: "#ffffff",
                align: "center",
                backgroundColor: "rgba(0, 0, 0, 0.45)",
                padding: { x: 10, y: 5 }
            }
        )
            .setOrigin(0.5)
            .setScrollFactor(0);
        shell.container.add(browserZoomHint);
    }
    const title = scene.add.text(shell.centerX, shell.centerY - 155, menuConfig.title, {
        fontFamily: '"Hiragino Mincho ProN", "Yu Mincho", serif',
        fontSize: "54px",
        color: "#ffffff",
        stroke: "#000000",
        strokeThickness: 5
    }).setOrigin(0.5);
    shell.container.add(title);
    makeMenuButton(
        scene,
        shell.container,
        shell.centerX,
        shell.centerY - 25,
        labels.mainButton,
        () => mode === "start" ? startGameFromMenu(scene) : closePauseMenu(scene)
    );
    makeMenuButton(
        scene,
        shell.container,
        shell.centerX,
        shell.centerY + 55,
        labels.settingsButton,
        () => showSettingsMenu(scene, mode)
    );
}

function startGameFromMenu(scene) {
    if (menuMode !== "start" || menuTransitioning) return;
    menuTransitioning = true;
    const duration = Math.max(0, Number(menuConfig.fadeDuration) || 500);
    scene.tweens.add({
        targets: menuContainer,
        alpha: 0,
        duration,
        ease: "Sine.easeOut",
        onComplete: () => {
            destroyMenu();
            menuMode = null;
            gameStarted = true;
            menuTransitioning = false;
            resumeGameFromMenu(scene);
        }
    });
}

function canOpenPauseMenu() {
    // 这些流程拥有独占 UI/输入；中途叠加暂停会破坏其推进或返回语义。
    return gameStarted &&
        !menuMode &&
        !isEndingPlaying &&
        !isWarping &&
        !isProloguePlaying &&
        !isDialogOpen &&
        !isInvestigationOpen &&
        !isNotebookOpen &&
        !isNpcMenuOpen &&
        !isMonologuePlaying &&
        !isAuthorEndingPlaying &&
        !isEndingNarrationPlaying;
}

function openPauseMenu(scene) {
    if (!canOpenPauseMenu() || menuTransitioning) return;
    isPaused = true;
    freezeGameForMenu(scene);
    showMainMenu(scene, "pause");
}

function closePauseMenu(scene) {
    if (menuMode !== "pause" || menuTransitioning) return;
    menuTransitioning = true;
    destroyMenu();
    menuMode = null;
    isPaused = false;
    menuTransitioning = false;
    resumeGameFromMenu(scene);
}

function showSettingsMenu(scene, returnMode) {
    if (menuTransitioning) return;
    previousMenuMode = returnMode;
    menuMode = "settings";
    settingsLanguageAtOpen = currentLanguage;
    settingsLanguageIndex = Math.max(
        0,
        LANGUAGE_OPTIONS.findIndex(option => option.code === currentLanguage)
    );
    const shell = createMenuShell(scene);
    const settings = menuConfig.settingsMenu;
    const title = scene.add.text(shell.centerX, shell.centerY - 185, settings.title, {
        fontFamily: '"Hiragino Kaku Gothic ProN", "Yu Gothic", sans-serif',
        fontSize: "44px",
        color: "#ffffff",
        stroke: "#000000",
        strokeThickness: 4
    }).setOrigin(0.5);
    shell.container.add(title);
    createVolumeSlider(
        scene, shell.container,
        shell.centerX + SETTINGS_CONTENT_OFFSET_X,
        shell.centerY - 70,
        settings.bgmLabel, bgmVolume,
        value => {
            bgmVolume = value;
            applyBgmVolume();
        }
    );
    createVolumeSlider(
        scene, shell.container,
        shell.centerX + SETTINGS_CONTENT_OFFSET_X,
        shell.centerY + 20,
        settings.seLabel, seVolume,
        value => {
            seVolume = value;
            applySeVolume();
        },
        { alignLabelBeforeTrack: true }
    );
    createLanguageSetting(
        scene,
        shell.container,
        shell.centerX + SETTINGS_CONTENT_OFFSET_X,
        shell.centerY + 100
    );
    makeMenuButton(
        scene, shell.container, shell.centerX, shell.centerY + 180,
        settings.backButton, () => returnFromSettings(scene)
    );
}

function createLanguageSetting(scene, container, centerX, y) {
    const labelText = scene.add.text(
        centerX - 245,
        y,
        safeText(menuConfig.settingsMenu.languageLabel),
        {
            fontFamily: '"Hiragino Kaku Gothic ProN", "Yu Gothic", sans-serif',
            fontSize: "26px",
            color: "#ffffff"
        }
    ).setOrigin(0, 0.5);
    settingsLanguageValueText = scene.add.text(
        centerX + 15,
        y,
        "",
        {
            fontFamily: '"Hiragino Kaku Gothic ProN", "Yu Gothic", sans-serif',
            fontSize: "24px",
            color: "#ffffff"
        }
    ).setOrigin(0.5, 0.5);
    const leftHitArea = scene.add.rectangle(
        centerX - 50, y, 54, 44, 0xffffff, 0.001
    ).setInteractive({ useHandCursor: true });
    const rightHitArea = scene.add.rectangle(
        centerX + 80, y, 54, 44, 0xffffff, 0.001
    ).setInteractive({ useHandCursor: true });
    leftHitArea.on("pointerdown", () => changeSettingsLanguage(-1));
    rightHitArea.on("pointerdown", () => changeSettingsLanguage(1));
    container.add([
        labelText,
        settingsLanguageValueText,
        leftHitArea,
        rightHitArea
    ]);
    updateLanguageSettingText();
}

function updateLanguageSettingText() {
    if (!settingsLanguageValueText) return;
    const option = LANGUAGE_OPTIONS[settingsLanguageIndex];
    settingsLanguageValueText.setText(
        "←  " + safeText(option && option.label) + "  →"
    );
}

function changeSettingsLanguage(direction) {
    if (menuMode !== "settings" || menuTransitioning) return;
    const count = LANGUAGE_OPTIONS.length;
    settingsLanguageIndex =
        (settingsLanguageIndex + direction + count) % count;
    currentLanguage = LANGUAGE_OPTIONS[settingsLanguageIndex].code;
    localeBasePath = `assets/locales/${currentLanguage}`;
    updateLanguageSettingText();
}

function captureLanguageProgressState(scene) {
    const fragmentIds = new Set(
        safeArray(fragments)
            .filter(fragment => fragment && fragment.unlocked)
            .map(fragment => fragment.id)
    );
    const personIds = new Set();
    safeArray(notebookPages).forEach(page => {
        safeArray(page && page.items).forEach(item => {
            if (item && item.unlocked && item.id) personIds.add(item.id);
        });
    });
    const playedDialogGroups = {};
    for (let i = 1; i <= 6; i++) {
        const cacheKey = "dialog_npc" + i;
        const dialogData = scene.cache.json.get(cacheKey);
        playedDialogGroups[cacheKey] = new Set(
            safeArray(dialogData && dialogData.dialogGroups)
                .filter(group => group && group.played === true && group.id)
                .map(group => group.id)
        );
    }
    const progressState = {
        storyStage,
        fragmentIds,
        personIds,
        playedDialogGroups,
        manualStoryHintId: manualStoryHint && manualStoryHint.id
    };
    console.log("[Language Progress Capture]", {
        currentLanguage,
        storyStage,
        unlockedFragmentIds: Array.from(fragmentIds),
        playedDialogGroups: Object.fromEntries(
            Object.entries(playedDialogGroups).map(
                ([key, ids]) => [key, Array.from(ids)]
            )
        ),
        metNpcIds: Array.from(metNpcIds)
    });
    return progressState;
}

function restoreLanguageProgressState(scene) {
    if (!pendingLanguageProgressState) return;
    const state = pendingLanguageProgressState;
    if (
        state.storyStage !== undefined &&
        state.storyStage !== null &&
        Number.isFinite(state.storyStage)
    ) {
        storyStage = state.storyStage;
    }
    safeArray(fragments).forEach(fragment => {
        if (fragment && state.fragmentIds.has(fragment.id)) {
            fragment.unlocked = true;
        }
    });
    safeArray(notebookPages).forEach(page => {
        safeArray(page && page.items).forEach(item => {
            if (item && state.personIds.has(item.id)) item.unlocked = true;
        });
    });
    for (let i = 1; i <= 6; i++) {
        const cacheKey = "dialog_npc" + i;
        const playedIds = state.playedDialogGroups[cacheKey] || new Set();
        const dialogData = scene.cache.json.get(cacheKey);
        safeArray(dialogData && dialogData.dialogGroups).forEach(group => {
            if (!group || !playedIds.has(group.id)) return;
            group.played = true;
            safeArray(group.updateNotebook).forEach(update => {
                if (!update || !update.fragmentId) return;
                const fragment = safeArray(fragments).find(
                    item => item && item.id === update.fragmentId
                );
                if (!fragment) return;
                if (update.memo !== undefined) fragment.memo = update.memo;
                if (update.quote !== undefined) fragment.quote = update.quote;
                if (update.speaker !== undefined) fragment.speaker = update.speaker;
            });
        });
    }
    if (state.manualStoryHintId) {
        for (let i = 1; i <= 6; i++) {
            const dialogData = scene.cache.json.get("dialog_npc" + i);
            const group = safeArray(dialogData && dialogData.dialogGroups).find(
                item =>
                    item &&
                    item.setStoryHint &&
                    item.setStoryHint.id === state.manualStoryHintId
            );
            if (group) {
                manualStoryHint = {
                    id: group.setStoryHint.id,
                    text: group.setStoryHint.text,
                    clearOnInvestigated:
                        group.setStoryHint.clearOnInvestigated || null
                };
                break;
            }
        }
    }
    console.log("[Language Progress Restore]", {
        currentLanguage,
        restoredStoryStage: storyStage,
        unlockedFragmentIds: safeArray(fragments)
            .filter(fragment => fragment && fragment.unlocked)
            .map(fragment => fragment.id),
        metNpcIds: Array.from(metNpcIds)
    });
    pendingLanguageProgressState = null;
}

function reloadSceneForLanguage(scene, returnMode) {
    if (!scene || menuTransitioning) return;
    menuTransitioning = true;
    pendingLanguageProgressState = captureLanguageProgressState(scene);
    const restartData = {
        mapKey: currentMapKey,
        startX: player ? player.x : undefined,
        startY: player ? player.y : undefined,
        restoreMenuAfterLanguageReload:
            returnMode === "pause" ? "pause" : null
    };
    const localizedCacheKeys = [
        "localizationCommon",
        "menuManagerConfig",
        "endingAuthorData",
        "notebookData",
        "fragmentsData",
        "storyData",
        "storyEventsData",
        "storyHintsData"
    ];
    for (let i = 1; i <= 6; i++) {
        localizedCacheKeys.push("dialog_npc" + i);
    }
    localizedCacheKeys.forEach(key => scene.cache.json.remove(key));
    queueLocalizedJsonFiles(scene, localeBasePath);
    scene.load.once("complete", () => {
        storyData = null;
        storyEventsData = null;
        storyHintsData = null;
        destroyMenu();
        scene.scene.restart(restartData);
    });
    scene.load.start();
}

function createVolumeSlider(
    scene,
    container,
    centerX,
    y,
    label,
    initialValue,
    onChange,
    labelLayout = null
) {
    const trackX = centerX - 35;
    const trackWidth = 260;
    const labelText = scene.add.text(centerX - 245, y, safeText(label), {
        fontFamily: '"Hiragino Kaku Gothic ProN", "Yu Gothic", sans-serif',
        fontSize: "26px",
        color: "#ffffff"
    }).setOrigin(0, 0.5);
    if (labelLayout && labelLayout.alignLabelBeforeTrack) {
        labelText
            .setOrigin(1, 0.5)
            .setX(
                trackX -
                trackWidth / 2 -
                SETTINGS_SOUND_LABEL_GAP
            );
    }
    const track = scene.add.rectangle(trackX, y, trackWidth, 8, 0xc8c8c8, 1)
        .setInteractive(new Phaser.Geom.Rectangle(
            -trackWidth / 2, -18, trackWidth, 36
        ), Phaser.Geom.Rectangle.Contains);
    const knob = scene.add.circle(
        trackX - trackWidth / 2 + initialValue * trackWidth, y, 14, 0xffffff
    ).setInteractive({ draggable: true, useHandCursor: true });
    scene.input.setDraggable(knob);
    const percentText = scene.add.text(centerX + 125, y, "", {
        fontFamily: "monospace",
        fontSize: "24px",
        color: "#ffffff"
    }).setOrigin(0, 0.5);
    const setFromX = pointerX => {
        const left = trackX - trackWidth / 2;
        const x = Phaser.Math.Clamp(pointerX, left, left + trackWidth);
        const value = Phaser.Math.Clamp((x - left) / trackWidth, 0, 1);
        knob.x = x;
        percentText.setText(t(
            "system.percentage",
            { value: Math.round(value * 100) },
            Math.round(value * 100) + "%"
        ));
        onChange(value);
    };
    percentText.setText(t(
        "system.percentage",
        { value: Math.round(initialValue * 100) },
        Math.round(initialValue * 100) + "%"
    ));
    track.on("pointerdown", pointer => setFromX(pointer.x));
    knob.on("drag", (pointer, dragX) => setFromX(dragX));
    container.add([labelText, track, knob, percentText]);
}

function returnFromSettings(scene) {
    if (menuMode !== "settings" || menuTransitioning) return;
    if (currentLanguage !== settingsLanguageAtOpen) {
        reloadSceneForLanguage(scene, previousMenuMode);
        return;
    }
    showMainMenu(scene, previousMenuMode === "pause" ? "pause" : "start");
}

function applyBgmVolume() {
    if (bgmVolumeTween) {
        bgmVolumeTween.stop();
        bgmVolumeTween = null;
    }
    [bgmIntro, bgmLoop].forEach(sound => {
        if (sound && sound.setVolume) sound.setVolume(bgmVolume);
    });
    currentBgmVolume = bgmVolume;
}

function menuBgmLevel(legacyVolume) {
    // v0.93 以 0.28 为正常混音基准；保留剧情淡入淡出比例并乘用户设置。
    return Phaser.Math.Clamp(bgmVolume * (legacyVolume / 0.28), 0, 1);
}

function applySeVolume() {
    if (fieldSound && fieldSound.setVolume) fieldSound.setVolume(seVolume);
    if (invAudio && invAudio.setVolume) invAudio.setVolume(seVolume);
}

function handleMenuInput(scene) {
    if (menuMode) {
        stopPlayerMotion();
        if (menuMode === "settings") {
            if (Phaser.Input.Keyboard.JustDown(cursors.left)) {
                changeSettingsLanguage(-1);
                return true;
            }
            if (Phaser.Input.Keyboard.JustDown(cursors.right)) {
                changeSettingsLanguage(1);
                return true;
            }
        }
        if (!Phaser.Input.Keyboard.JustDown(keyEsc)) return true;
        if (menuMode === "pause") {
            closePauseMenu(scene);
        } else if (menuMode === "settings") {
            returnFromSettings(scene);
        }
        // start 模式明确吞掉 ESC，不能绕过“新ゲーム”。
        return true;
    }
    if (Phaser.Input.Keyboard.JustDown(keyEsc) && canOpenPauseMenu()) {
        openPauseMenu(scene);
        return true;
    }
    return false;
}

function update(time, delta) {

    if (handleMenuInput(this)) return;

    //--------------------------------
    // FPS 调试（每秒刷新一次）
    //--------------------------------

    if (fpsText && delta > 0) {
        fpsAccum += delta;
        if (fpsAccum >= 1000) {
            fpsText.setText(safeText("FPS: " + Math.round(this.game.loop.actualFps)));
            fpsAccum = 0;
        }
    }

    //--------------------------------
    // 终幕或 warp 进行中：锁定一切
    //--------------------------------

    if (isEndingPlaying) {
        if (
            isAuthorEndingPromptVisible &&
            Phaser.Input.Keyboard.JustDown(keyE)
        ) {
            startAuthorEnding(this);
        } else if (
            isAuthorEndingPlaying &&
            (
                Phaser.Input.Keyboard.JustDown(keyE) ||
                Phaser.Input.Keyboard.JustDown(keySpace)
            )
        ) {
            advanceAuthorEnding(this);
        } else if (
            isEndingNarrationPlaying &&
            !isEndingNarrationTransitioning &&
            Phaser.Input.Keyboard.JustDown(keyE)
        ) {
            advanceEndingNarration(this);
        }
        return;
    }
    if (isWarping) return;

    //--------------------------------
    // 序幕播放中：锁定一切，仅响应 E 键推进
    //--------------------------------

    if (isProloguePlaying) {
        if (Phaser.Input.Keyboard.JustDown(keyE)) {
            advancePrologue(this);
        }
        if (player) {
            player.setVelocity(0);
            player.anims.stop();
        }
        return;
    }

    //--------------------------------
    // NPC 菜单：独占方向键与确认键，并锁定地图交互
    //--------------------------------

    if (isNpcMenuOpen) {
        const currentMenuItem = npcMenuItems[npcMenuIndex];
        if (Phaser.Input.Keyboard.JustDown(cursors.up)) {
            npcMenuIndex = Math.max(0, npcMenuIndex - 1);
            renderNpcMenu();
        } else if (Phaser.Input.Keyboard.JustDown(cursors.down)) {
            npcMenuIndex = Math.min(npcMenuItems.length - 1, npcMenuIndex + 1);
            renderNpcMenu();
        } else if (
            npcQuestionMode && currentMenuItem?.type === "pager" &&
            Phaser.Input.Keyboard.JustDown(cursors.left)
        ) {
            changeNpcQuestionPage(-1);
        } else if (
            npcQuestionMode && currentMenuItem?.type === "pager" &&
            Phaser.Input.Keyboard.JustDown(cursors.right)
        ) {
            changeNpcQuestionPage(1);
        } else if (
            Phaser.Input.Keyboard.JustDown(keyE) ||
            Phaser.Input.Keyboard.JustDown(keySpace)
        ) {
            confirmNpcMenuSelection(this);
        } else if (Phaser.Input.Keyboard.JustDown(keyEsc)) {
            if (npcQuestionMode) {
                openNpcMainMenu(this, npcMenuCurrentNpc);
            } else {
                closeNpcMenu(this);
            }
        }

        interactPrompt.setVisible(false);
        player.setVelocity(0);
        player.anims.stop();
        return;
    }

    //--------------------------------
    // 移动引导：UI 打开时隐藏，否则跟随玩家位置
    //--------------------------------

    if (safeArray(moveTutorialTexts).length > 0) {
        if (isNotebookOpen || isDialogOpen || isInvestigationOpen || isNpcMenuOpen) {
            safeArray(moveTutorialTexts).forEach(t => t.setVisible(false));
        } else if (!tutorialMoveDone) {
            safeArray(moveTutorialTexts).forEach(t => t.setVisible(true));
            updateMoveTutorialPosition();
        }
    }

    //--------------------------------
    // 笔记本 UI：F 键开关 / ESC 关闭 / 左右方向键翻页
    //--------------------------------

    if (Phaser.Input.Keyboard.JustDown(keyF)) {

        if (isNotebookOpen) {

            //--------------------------------
            // 笔记本打开中 → F 关闭
            //--------------------------------

            closeNotebook(this);

        } else if (!isDialogOpen && !isInvestigationOpen) {

            //--------------------------------
            // 笔记本关闭中 → F 打开
            //（对话或调查展示进行时不允许打开）
            //--------------------------------

            openNotebook(this);

        }

    }

    if (
        Phaser.Input.Keyboard.JustDown(keyEsc)
        && isNotebookOpen
    ) {

        closeNotebook(this);

    }

    //--------------------------------
    // 笔记本打开中：方向键翻页 + 锁定一切交互
    //--------------------------------

    if (isNotebookOpen) {

        if (Phaser.Input.Keyboard.JustDown(cursors.left)) {

            if (notebookPageIndex === 1) {
                //--------------------------------
                // しおり目录页：子页翻页
                //--------------------------------
                if (fragmentListSubPage > 0) {
                    fragmentListSubPage--;
                    renderNotebookPage(this);
                } else {
                    // 子页第一页 → 返回人物页
                    notebookPageIndex = 0;
                    renderNotebookPage(this);
                }
            } else if (notebookPageIndex > 0) {
                notebookPageIndex--;
                // 从详情页回到しおり页 → 定位到最后一页
                if (notebookPageIndex === 1) {
                    const cnt = safeArray(getUnlockedFragments()).length;
                    const spc = Math.max(1, Math.ceil(cnt / FRAGMENT_ITEMS_PER_PAGE));
                    fragmentListSubPage = spc - 1;
                }
                renderNotebookPage(this);
            }

        } else if (Phaser.Input.Keyboard.JustDown(cursors.right)) {

            if (notebookPageIndex === 1) {
                //--------------------------------
                // しおり目录页：子页翻页
                //--------------------------------
                const cnt = safeArray(getUnlockedFragments()).length;
                const spc = Math.max(1, Math.ceil(cnt / FRAGMENT_ITEMS_PER_PAGE));

                if (fragmentListSubPage < spc - 1) {
                    fragmentListSubPage++;
                    renderNotebookPage(this);
                } else if (cnt > 0) {
                    // 子页最后一页 → 进入第一个碎片详情页
                    notebookPageIndex = 2;
                    renderNotebookPage(this);
                }
            } else {
                const totalPages = getNotebookPageCount();
                if (notebookPageIndex < totalPages - 1) {
                    notebookPageIndex++;
                    // 从人物页进入しおり页 → 定位到第一页
                    if (notebookPageIndex === 1) {
                        fragmentListSubPage = 0;
                    }
                    renderNotebookPage(this);
                }
            }

        }

        player.setVelocity(0);
        return;

    }

    //--------------------------------
    // Investigation 检测 — 由 physics overlap 处理
    // currentInvestigation 在 physics 步中自动赋值
    //--------------------------------

    //--------------------------------
    // NPC 距离检测（内心独白中跳过，防止覆盖 currentNpc）
    //--------------------------------

    if (!isMonologuePlaying) {

    currentNpc = null;

    {
        let nearestDist = Infinity;

        safeArray(npcGroup.getChildren()).forEach(npc => {

            const dist =
                Phaser.Math.Distance.Between(
                    player.x, player.y,
                    npc.x, npc.y
                );

            if (dist < nearestDist) {
                nearestDist = dist;
            }

            if (dist <= interactDistance) {
                currentNpc = npc;
            }

        });

    }

    } // end if (!isMonologuePlaying)

    //--------------------------------
    // 交互提示
    // 调查点：检查 requiredStage，不满足则隐藏 E
    //--------------------------------

    {
        let invAvailable = false;
        if (currentInvestigation && !isInvestigationOpen) {
            const reqStage = currentInvestigation.requiredStage || 0;
            const requirementsPassed =
                evaluateRequirements(currentInvestigation.storyRequirements);
            invAvailable =
                (storyStage >= reqStage) &&
                requirementsPassed;

            if (currentInvestigation.invType === "warp") {
                const signature = JSON.stringify({
                    target: currentInvestigation.target,
                    storyStage,
                    requiredStage: currentInvestigation.requiredStage,
                    requirementsPassed
                });
                if (signature !== lastWarpDebugSignature) {
                    lastWarpDebugSignature = signature;
                    console.log("[Warp Check]", {
                        target: currentInvestigation.target,
                        storyStage,
                        requiredStage: currentInvestigation.requiredStage,
                        stagePassed: storyStage >= reqStage,
                        requirementsPassed,
                        storyRequirements: currentInvestigation.storyRequirements
                    });
                }
            }
        }
        const npcAvailable =
            !!currentNpc && !isInvestigationOpen;

        if (invAvailable || npcAvailable) {

            const target =
                invAvailable
                    ? currentInvestigation
                    : currentNpc;

            if (target) {
                interactPrompt.setPosition(
                    target.x - 8,
                    target.y - 40
                );
                interactPrompt.setVisible(true);
            }

        } else {

            interactPrompt.setVisible(false);

        }
    }

    //--------------------------------
    // E键：调查 / 对话 / 下一句 / 关闭
    //--------------------------------

    if (Phaser.Input.Keyboard.JustDown(keyE)) {

        if (isInvestigationOpen) {

            //--------------------------------
            // 调查展示中：E 键关闭
            //--------------------------------

            closeInvestigation(this);

        } else if (!isDialogOpen) {

            //--------------------------------
            // 对话未打开：选择最近的交互对象
            // 调查点需 requiredStage 检查通过才可用
            //--------------------------------

            let invAvailable = false;
            if (currentInvestigation) {
                const reqStage =
                    currentInvestigation.requiredStage || 0;
                invAvailable =
                    (storyStage >= reqStage) &&
                    evaluateRequirements(currentInvestigation.storyRequirements);
            }

            if (invAvailable && currentNpc) {

                // NPC 和调查点都在范围内：取更近的
                const invDist =
                    Phaser.Math.Distance.Between(
                        player.x, player.y,
                        currentInvestigation.x,
                        currentInvestigation.y
                    );

                const npcDist =
                    Phaser.Math.Distance.Between(
                        player.x, player.y,
                        currentNpc.x,
                        currentNpc.y
                    );

                if (invDist <= npcDist) {

                    handleInvestigation(
                        this,
                        currentInvestigation
                    );

                } else {

                    startDialog(this);

                }

            } else if (invAvailable) {

                handleInvestigation(
                    this,
                    currentInvestigation
                );

            } else if (currentNpc) {

                startDialog(this);

            }

        } else if (currentNpc) {

            //--------------------------------
            // 对话进行中：下一句 / 关闭
            //--------------------------------

            currentDialogIndex++;

            if (
                Array.isArray(currentNpc.dialogLines) &&
                currentDialogIndex <
                safeArray(currentNpc.dialogLines).length
            ) {

                showDialogLine(this);

            } else {

                processDialogAfter(this);
                closeDialog(this);

            }

        }

    }

    //--------------------------------
    // 对话中锁定移动
    //--------------------------------

    if (isDialogOpen || isInvestigationOpen) {
        return;
    }

    //--------------------------------
    // 初始化
    //--------------------------------

    isMoving = false;

    //--------------------------------
    // 判断是否进入农田
    //--------------------------------

    const px = player.x;
    const py = player.y;

    let insideField = false;

    safeArray(fieldAreas).forEach(area => {

        if (
            px > area.x &&
            px < area.x + area.width &&
            py > area.y &&
            py < area.y + area.height
        ) {
            insideField = true;
        }

    });

    isInField = insideField;

    //--------------------------------
    // 农田动画减速
    //--------------------------------

    if (isInField) {

        player.anims.timeScale = 0.25;

    } else {

        player.anims.timeScale = 1;

    }

    //--------------------------------
    // 移动速度
    //--------------------------------

    const leftDown = cursors.left.isDown || wasdKeys.A.isDown;
    const rightDown = cursors.right.isDown || wasdKeys.D.isDown;
    const upDown = cursors.up.isDown || wasdKeys.W.isDown;
    const downDown = cursors.down.isDown || wasdKeys.S.isDown;

    const moveX = (rightDown ? 1 : 0) - (leftDown ? 1 : 0);
    const moveY = (downDown ? 1 : 0) - (upDown ? 1 : 0);
    const moving = moveX !== 0 || moveY !== 0;
    const sprinting = wasdKeys.SHIFT.isDown && moving;

    let speed;

    if (isInField) {
        speed = sprinting ? 65 : 40;
    } else {
        speed = sprinting ? 160 : 125;
    }

    //--------------------------------
    // 重置速度
    //--------------------------------

    player.setVelocity(0);

    //--------------------------------
    // 左
    //--------------------------------

    if (moving) {

        isMoving = true;

        player.setVelocity(moveX, moveY);
        player.body.velocity.setLength(speed);

        if (Math.abs(moveX) >= Math.abs(moveY) && moveX < 0) {

            player.play(
                "walk_side",
                true
            );

            player.setFlipX(false);

            lastDirection = "left";

        } else if (Math.abs(moveX) >= Math.abs(moveY) && moveX > 0) {

            player.play(
                "walk_side",
                true
            );

            player.setFlipX(true);

            lastDirection = "right";

        } else if (moveY < 0) {

            player.play(
                "walk_up",
                true
            );

            player.setFlipX(false);

            lastDirection = "up";

        } else {

            player.play(
                "walk_down",
                true
            );

            player.setFlipX(false);

            lastDirection = "down";
        }
    }

    //--------------------------------
    // 停止
    //--------------------------------

    else {

        player.anims.stop();

        switch (lastDirection) {

            case "up":
                player.setFrame(1);
                break;

            case "down":
                player.setFrame(7);
                break;

            case "left":
                player.setFrame(4);
                player.setFlipX(false);
                break;

            case "right":
                player.setFrame(4);
                player.setFlipX(true);
                break;
        }

    }

    //--------------------------------
    // 移动引导：首次移动后触发淡出
    //--------------------------------

    if (isMoving && !tutorialMoveDone) {
        hideMoveTutorial(this);
    }

    //--------------------------------
    // 农田声音
    //--------------------------------

    if (fieldSound) {

        if (isInField && isMoving) {

            if (!fieldSound.isPlaying) {
                fieldSound.play();
            }

        } else {

            if (fieldSound.isPlaying) {
                fieldSound.stop();
            }

        }

    }

    //--------------------------------
    // 环境音 — Single Source + Multiple SoundArea
    // 每个 soundKey 只有一个 Sound 实例
    // 多个同名区域取最近距离 → 计算音量
    //--------------------------------

    updateSoundAreas(this);

    //--------------------------------
    // 每帧末重置 Investigation
    //（下一帧由 physics overlap 重新赋值）
    //--------------------------------

    currentInvestigation = null;

}

function updateSoundAreas(scene) {

    const ambientPx = player.x;
    const ambientPy = player.y;

    // 按 soundKey 分组，记录每个 key 的最近距离
    const nearestBySound = {};

    safeArray(soundAreas).forEach(area => {

        // 玩家到矩形最近点的距离
        const nearestX =
            Math.max(area.x, Math.min(ambientPx, area.x + area.width));
        const nearestY =
            Math.max(area.y, Math.min(ambientPy, area.y + area.height));

        const dx = ambientPx - nearestX;
        const dy = ambientPy - nearestY;
        const dist = Math.sqrt(dx * dx + dy * dy);

        if (nearestBySound[area.soundKey] == null
            || dist < nearestBySound[area.soundKey]) {

            nearestBySound[area.soundKey] = dist;

        }

    });

    // 遍历每个声源，根据最近距离设置音量
    safeArray(Object.keys(ambientSounds)).forEach(soundKey => {

        const sound = ambientSounds[soundKey];
        if (!sound) return;

        const nearestDist = nearestBySound[soundKey];

        // 该声源没有任何区域（理论上不会发生）
        if (nearestDist == null) {

            if (sound.isPlaying) sound.stop();
            return;

        }

        // 使用缓存的配置（避免每帧 find）
        const areaCfg = soundAreaConfigs[soundKey];

        if (!areaCfg) {

            if (sound.isPlaying) sound.stop();
            return;

        }

        const radius = areaCfg.radius;
        const maxVol = areaCfg.maxVolume;

        let volume;

        if (nearestDist < radius) {

            volume = maxVol * seVolume * (1 - nearestDist / radius);

        } else {

            volume = 0;

        }

        // 播放 / 停止
        if (volume > 0) {

            if (!sound.isPlaying) {
                if (scene.cache.audio.exists(soundKey)) {
                    sound.play();
                } else if (!warnedSoundKeys.has(soundKey)) {
                    warnedSoundKeys.add(soundKey);
                    console.warn("[SoundArea] 音频不存在:", soundKey);
                }
            }

            sound.setVolume(volume);

        } else {

            if (sound.isPlaying) {
                sound.stop();
            }

        }

    });

}

//--------------------------------
// Helper: 读取 Tiled 对象属性值
//--------------------------------

function getPropValue(obj, name) {

    if (!obj || !Array.isArray(obj.properties)) return null;

    const prop =
        safeArray(obj.properties).find(
            p => p.name === name
        );

    return prop ? prop.value : null;

}

//--------------------------------
// 序幕系统：自动播放独白
// - startPrologue：开始播放
// - showPrologueLine：显示当前台词
// - advancePrologue：推进到下一句
// - endPrologue：结束序幕
//--------------------------------

function startPrologue(scene) {

    if (!storyData || !storyData.prologue) return;
    if (!Array.isArray(storyData.prologue.dialogs)) return;

    prologueDialogLines = storyData.prologue.dialogs;
    prologueDialogIndex = 0;
    isProloguePlaying = true;
    isDialogOpen = true;

    //--------------------------------
    // BGM 混音：序幕中 → 0.15
    //--------------------------------

    setBGMVolume(scene, menuBgmLevel(0.15), 500);

    //--------------------------------
    // 序幕开始时隐藏线索 UI
    //--------------------------------

    updateStoryHint(scene);

    //--------------------------------
    // 显示对话框（无头像）
    //--------------------------------

    dialogBox.setVisible(true);
    dialogText.setVisible(true);
    portraitImage.setVisible(false);

    //--------------------------------
    // 玩家停步
    //--------------------------------

    if (player) {
        player.setVelocity(0);
        player.anims.stop();
    }

    showPrologueLine(scene);

}

function showPrologueLine(scene) {

    if (!Array.isArray(prologueDialogLines)) return;

    const line = prologueDialogLines[prologueDialogIndex];

    if (!line) return;

    showDialogLine(scene, line);

}

function advancePrologue(scene) {

    prologueDialogIndex++;

    if (prologueDialogIndex < safeArray(prologueDialogLines).length) {
        showPrologueLine(scene);
    } else {
        endPrologue(scene);
    }

}

function endPrologue(scene) {

    isProloguePlaying = false;
    isDialogOpen = false;
    prologuePlayed = true;

    dialogBox.setVisible(false);
    dialogText.setVisible(false);
    hideDialogContinuePrompt(scene);

    //--------------------------------
    // 隐藏姓名
    //--------------------------------

    if (dialogNameText) dialogNameText.setVisible(false);
    if (dialogNameBackground) dialogNameBackground.setVisible(false);

    //--------------------------------
    // BGM 混音：序幕结束 → 恢复 0.28
    //--------------------------------

    setBGMVolume(scene, bgmVolume, 500);

    //--------------------------------
    // 开场最后一句的半身像使用普通对话相同的淡出效果
    //--------------------------------

    scene.tweens.killTweensOf(portraitImage);

    if (portraitImage.visible) {
        scene.tweens.add({
            targets: portraitImage,
            alpha: 0,
            duration: 200,
            ease: "Linear",
            onComplete: () => {
                portraitImage.setVisible(false);
                portraitImage.setAlpha(1);
            }
        });
    }

    //--------------------------------
    // 序幕结束后更新线索
    //--------------------------------

    updateStoryHint(scene);

}

//--------------------------------
// 剧情系统：评估 dialogGroup 的 requirements
// 返回 true = 该组对白可以使用
//--------------------------------

function evaluateRequirements(req) {

    if (!req) return true;

    if (req.currentMap !== undefined && currentMapKey !== req.currentMap) {
        return false;
    }

    if (Array.isArray(req.currentMapIn) &&
        !req.currentMapIn.includes(currentMapKey)) {
        return false;
    }

    //--------------------------------
    // storyStage 范围检查
    //--------------------------------

    if (req.storyStageMin !== undefined &&
        storyStage < req.storyStageMin) {
        return false;
    }

    if (req.storyStageMax !== undefined &&
        storyStage > req.storyStageMax) {
        return false;
    }

    if (req.endingFragmentsComplete !== undefined &&
        areEndingFragmentsComplete() !== req.endingFragmentsComplete) {
        return false;
    }

    //--------------------------------
    // investigated：列出的 fragment 必须全部已解锁
    //--------------------------------

    const conflictingInvestigationIds = Array.isArray(req.investigated) &&
        Array.isArray(req.notInvestigated)
        ? req.investigated.filter(fid => req.notInvestigated.includes(fid))
        : [];

    // npc4 的旧数据把 okawa 同时列入 investigated / notInvestigated。
    // 该组实际意图是：调查 water_grass 后、okawa 尚未解锁时播放。
    if (conflictingInvestigationIds.includes("okawa")) {
        const waterGrass = safeArray(fragments).find(
            x => x && x.id === "water_grass"
        );
        if (!waterGrass || !waterGrass.unlocked) return false;
    }

    if (Array.isArray(req.investigated)) {
        for (let i = 0; i < req.investigated.length; i++) {
            const fid = req.investigated[i];
            if (conflictingInvestigationIds.includes(fid)) continue;
            const f = safeArray(fragments).find(x => x && x.id === fid);
            if (!f || !f.unlocked) return false;
        }
    }

    //--------------------------------
    // notInvestigated：列出的 fragment 必须全部未解锁
    //--------------------------------

    if (Array.isArray(req.notInvestigated)) {
        for (let i = 0; i < req.notInvestigated.length; i++) {
            const fid = req.notInvestigated[i];
            const f = safeArray(fragments).find(x => x && x.id === fid);
            if (f && f.unlocked) return false;
        }
    }

    //--------------------------------
    // metNpcs：列出的 NPC 必须全部已认识
    //--------------------------------

    if (Array.isArray(req.metNpcs)) {
        for (let i = 0; i < req.metNpcs.length; i++) {
            if (!metNpcIds.has(req.metNpcs[i])) return false;
        }
    }

    //--------------------------------
    // playedDialogGroups：指定 NPC 的对白节点必须已经完成
    //--------------------------------

    if (Array.isArray(req.playedDialogGroups)) {
        const scene = currentScene();
        for (let i = 0; i < req.playedDialogGroups.length; i++) {
            const condition = req.playedDialogGroups[i];
            if (!condition || !condition.npcId || !condition.groupId || !scene) {
                return false;
            }
            const dialogKey = "dialog_" + condition.npcId;
            if (!scene.cache.json.exists(dialogKey)) return false;
            const dialogData = scene.cache.json.get(dialogKey);
            const group = dialogData && Array.isArray(dialogData.dialogGroups)
                ? dialogData.dialogGroups.find(item => item && item.id === condition.groupId)
                : null;
            if (!group || group.played !== true) return false;
        }
    }

    //--------------------------------
    // notPlayedDialogGroups：指定 NPC 的对白节点必须尚未完成
    //--------------------------------

    if (Array.isArray(req.notPlayedDialogGroups)) {
        const scene = currentScene();
        for (let i = 0; i < req.notPlayedDialogGroups.length; i++) {
            const condition = req.notPlayedDialogGroups[i];
            if (!condition || !condition.npcId || !condition.groupId || !scene) {
                return false;
            }
            const dialogKey = "dialog_" + condition.npcId;
            if (!scene.cache.json.exists(dialogKey)) return false;
            const dialogData = scene.cache.json.get(dialogKey);
            const group = dialogData && Array.isArray(dialogData.dialogGroups)
                ? dialogData.dialogGroups.find(item => item && item.id === condition.groupId)
                : null;
            if (group && group.played === true) return false;
        }
    }

    return true;

}

//--------------------------------
// 剧情系统：对话结束后处理 afterDialog
// - setStoryStage：更新剧情阶段
// - unlockFragments：直接解锁碎片
// - unlockInvestigations：记录可调查点（数据层，未来扩展）
// - updateNotebook：更新 fragment 的 memo/quote/speaker
//--------------------------------

function processDialogAfter(scene) {

    //--------------------------------
    // 内心独白结束后处理（currentDialogGroup = null）
    // 如自由探索完成后的 machi 独白
    //--------------------------------

    if (!currentDialogGroup) {

        if (currentNpc && !currentNpc.dialogKey) {
            //--------------------------------
            // 独白结束：恢复 currentNpc，触发后续引导
            //--------------------------------

            currentNpc = null;
            isMonologuePlaying = false;

        }

        return;
    }

    //--------------------------------
    // 新格式：字段直接在 group 上
    // nextStoryStage / unlockFragments / unlockInvestigations / updateNotebook
    //--------------------------------

    const group = currentDialogGroup;
    const completedGroupId = group.id;

    //--------------------------------
    // 清除引用（防止重复执行）
    //--------------------------------

    currentDialogGroup = null;

    //--------------------------------
    // once=true → 对话结束后才标记 played=true
    // （不在对话开始前设置，避免中断时节点永久丢失）
    //--------------------------------

    if (group.once === true) {
        group.played = true;
    }

    //--------------------------------
    // nextStoryStage
    //--------------------------------

    if (
        group.nextStoryStage !== undefined &&
        group.nextStoryStage !== null
    ) {
        const previousStage = storyStage;
        storyStage = group.nextStoryStage;
        console.log("[Story Stage Changed By Dialog]", {
            groupId: group.id,
            previousStage,
            nextStage: group.nextStoryStage
        });
    }

    //--------------------------------
    // unlockFragments
    //--------------------------------

    if (Array.isArray(group.unlockFragments)) {
        group.unlockFragments.forEach(fid => {
            if (!fid) return;
            unlockFragment(fid);
            if (fid === "okawa") {
                const fragment = safeArray(fragments).find(
                    item => item && item.id === fid
                );
                console.log("[OKAWA STATUS]", {
                    storyStage,
                    fragmentExists: !!fragment,
                    fragmentUnlocked: fragment && fragment.unlocked,
                    requiredStage: fragment && fragment.requiredStage,
                    type: fragment && fragment.type
                });
            }
        });
    }

    //--------------------------------
    // notifyNpcIds：对白解锁碎片后通知指定 NPC（同组同 NPC 仅一次）
    //--------------------------------

    if (Array.isArray(group.notifyNpcIds)) {
        group.notifyNpcIds.forEach(npcId => {
            if (!npcId || npcId === "npc6") return;
            if (!hasAvailableNewDialog(npcId)) return;
            const eventId = "dialog_" + safeText(group.id) + "_notify_" + npcId;
            if (notifiedStoryEvents.has(eventId)) return;
            notifiedStoryEvents.add(eventId);
            queueNpcTalkNotification(scene, npcId, eventId);
            npcNewTalkIds.add(npcId);
        });
    }

    //--------------------------------
    // updateNotebook：更新 fragment 的 memo/quote/speaker
    // 不覆盖 text（调查文本保持不变）
    //--------------------------------

    if (Array.isArray(group.updateNotebook)) {
        group.updateNotebook.forEach(update => {
            if (!update || !update.fragmentId) return;
            const f = safeArray(fragments).find(
                x => x && x.id === update.fragmentId
            );
            if (!f) return;
            if (update.memo !== undefined) f.memo = update.memo;
            if (update.quote !== undefined) f.quote = update.quote;
            if (update.speaker !== undefined) f.speaker = update.speaker;
        });

        //--------------------------------
        // 有 notebook 更新 → 设置待显示通知
        //--------------------------------

        if (group.updateNotebook.length > 0) {
            pendingInvestigationNotice = {
                message: t(
                    "system.memoUpdated",
                    {},
                    "メモ更新済み"
                ),
                playSound: true
            };
        }
    }

    //--------------------------------
    // 笔记本打开中 → 立即刷新
    //--------------------------------

    if (isNotebookOpen && scene) {
        renderNotebookPage(scene);
    }

    //--------------------------------
    // setStoryHint：dialogGroup 可设置临时线索
    //--------------------------------

    if (group.setStoryHint && group.setStoryHint.id) {
        setStoryHint(
            scene,
            group.setStoryHint.id,
            group.setStoryHint.text,
            group.setStoryHint.clearOnInvestigated || null
        );
    }

    //--------------------------------
    // NPC 新对话线索：对话播放后清除该 NPC 的待对话状态
    // 同时标记 NPC 为已认识
    //--------------------------------

    if (currentNpc && currentNpc.dialogKey) {
        const npcIdMatch = currentNpc.dialogKey.match(/dialog_(npc\d+)/);
        if (npcIdMatch && npcIdMatch[1] !== "npc6") {
            const npcId = npcIdMatch[1];
            const wasJustMet = !hasMetNpc(npcId);
            markNpcAsMet(npcId);
            if (hasAvailableNewDialog(npcId)) {
                npcNewTalkIds.add(npcId);
            } else {
                npcNewTalkIds.delete(npcId);
            }

            //--------------------------------
            // 刚认识的 NPC：检查是否有之前因未认识而跳过的更新通知
            // 如果有可用新对话，重新加入通知队列
            //--------------------------------

            if (wasJustMet && hasAvailableNewDialog(npcId)) {
                const eventId = npcId + "_late_notify";
                if (!notifiedStoryEvents.has(eventId)) {
                    notifiedStoryEvents.add(eventId);
                    queueNpcTalkNotification(scene, npcId, eventId);
                    npcNewTalkIds.add(npcId);
                }
            }

            //--------------------------------
            // 自由探索完成检测：
            // 每次 NPC 首次对话结束后检查
            //--------------------------------

            checkFreeExplorationComplete(scene);
        }
    }

    //--------------------------------
    // storyStage 变化或对话结束后更新线索
    //--------------------------------

    updateStoryHint(scene);

    // 最终对白关闭后进入 Stage6，并自动开始结局 CG。
    if (completedGroupId === "final_dialog" && storyStage === 6) {
        scene.time.delayedCall(250, () => showEndingCG(scene));
    }

}

//--------------------------------
// 剧情系统：调查触发器
// 在 unlockFragment 中调用，检查 story.json 的 investigationTriggers
//--------------------------------

function checkStoryTriggers(fragmentId) {

    if (!storyData || !Array.isArray(storyData.investigationTriggers)) {
        return;
    }

    for (let i = 0; i < storyData.investigationTriggers.length; i++) {

        const trigger = storyData.investigationTriggers[i];
        if (!trigger || trigger.fragmentId !== fragmentId) continue;

        if (!evaluateRequirements(trigger.requirements)) continue;

        if (trigger.setStoryStage !== undefined) {
            storyStage = trigger.setStoryStage;
        }

    }

}

//--------------------------------
// 开始 NPC 对话
// 从 JSON 缓存加载对话数据
//--------------------------------

function getNpcDialogData(scene, npc) {
    if (!scene || !npc || !npc.dialogKey ||
        !scene.cache.json.exists(npc.dialogKey)) return null;
    const data = scene.cache.json.get(npc.dialogKey);
    return data && Array.isArray(data.dialogGroups) ? data : null;
}

function getDialogGroupRole(group) {
    if (!group) return "";
    if (group.role) return group.role;
    const id = safeText(group.id).toLowerCase();
    if (id === "first_meeting") return "first_meeting";
    if (id.includes("default") || id.includes("repeat")) return "default";
    return group.askable === true ? "askable" : "";
}

function getFirstMeetingGroup(scene, npc) {
    const data = getNpcDialogData(scene, npc);
    if (!data) return null;
    return data.dialogGroups.find(group =>
        getDialogGroupRole(group) === "first_meeting" &&
        !(group.once === true && group.played === true)
    ) || null;
}

function getStoryDialogGroup(scene, npc) {
    const data = getNpcDialogData(scene, npc);
    if (!data) return null;

    return data.dialogGroups
        .map((group, jsonIndex) => ({ group, jsonIndex }))
        .filter(item =>
            item.group &&
            getDialogGroupRole(item.group) === "story"
        )
        .map(item => {
            const requirementsPassed =
                evaluateRequirements(item.group.requirements);
            if (item.group.id === "stage4_boat_memory") {
                console.log("[NPC4 BOAT DIALOG CHECK]", {
                    groupId: "stage4_boat_memory",
                    requirementsPassed,
                    played: item.group.played,
                    role: getDialogGroupRole(item.group)
                });
            }
            console.log("[Story Dialog Check]", {
                npcId: getNpcId(npc),
                storyStage,
                metNpcIds: Array.from(metNpcIds),
                groupId: item.group.id,
                requirementsPassed,
                played: item.group.played
            });
            return {
                group: item.group,
                jsonIndex: item.jsonIndex,
                requirementsPassed
            };
        })
        .filter(item =>
            !(item.group.once === true && item.group.played === true)
        )
        .filter(item => item.requirementsPassed)
        .sort((a, b) =>
            ((b.group.priority || 0) - (a.group.priority || 0)) ||
            (a.jsonIndex - b.jsonIndex)
        )[0]?.group || null;
}

function getAvailableAskableGroups(scene, npc) {
    const npcId = getNpcId(npc);
    const data = getNpcDialogData(scene, npc);
    if (!npcId || !hasMetNpc(npcId) || !data) return [];

    return data.dialogGroups
        .map((group, jsonIndex) => ({ group, jsonIndex }))
        .filter(item => item.group && item.group.askable === true)
        .filter(item => getDialogGroupRole(item.group) !== "first_meeting")
        .filter(item => item.group.once === true && item.group.played !== true)
        .filter(item => evaluateRequirements(item.group.requirements))
        .sort((a, b) =>
            ((b.group.priority || 0) - (a.group.priority || 0)) ||
            (a.jsonIndex - b.jsonIndex)
        )
        .map(item => item.group);
}

function getDefaultDialogGroup(scene, npc) {
    const data = getNpcDialogData(scene, npc);
    if (!data) return null;
    return data.dialogGroups
        .filter(group => getDialogGroupRole(group) === "default")
        .filter(group => group.askable !== true)
        .filter(group => evaluateRequirements(group.requirements))
        .sort((a, b) => (b.priority || 0) - (a.priority || 0))[0] || null;
}

function startDialogGroup(scene, npc, group) {
    if (!scene || !npc) return;

    closeNpcMenu(scene, false);
    currentNpc = npc;
    currentDialogGroup = group || null;
    currentNpc.dialogLines = group && Array.isArray(group.dialogs)
        ? group.dialogs
        : [{
            speaker: "machi",
            text: t(
                "dialog.fallback.noticeSomething",
                {},
                "また何か気づいたら、話してください。"
            )
        }];

    // 上一次 closeDialog 的 fade-out 不得继续影响新对话头像。
    scene.tweens.killTweensOf(portraitImage);
    portraitImage.clearTint();
    portraitImage.setAlpha(1);
    portraitImage.setVisible(false);

    if (currentNpc.personId) unlockPerson(currentNpc.personId, scene);
    isDialogOpen = true;
    currentDialogIndex = 0;
    dialogBox.setVisible(true);
    dialogText.setVisible(true);
    setBGMVolume(scene, menuBgmLevel(0.20), 300);
    showDialogLine(scene);
    updateStoryHint(scene);
}

function createNpcMenuBackground(scene) {
    if (npcMenuBackground) npcMenuBackground.destroy();
    const height = npcQuestionMode ? 250 : Math.max(230, npcMenuItems.length * 42 + 40);
    npcMenuBackground = scene.add.rectangle(560, 420, 360, height, 0x1b120b, 0.92)
        .setStrokeStyle(3, 0x8b6843, 1)
        .setScrollFactor(0)
        .setDepth(5100);
}

function renderNpcMenu() {
    safeArray(npcMenuTexts).forEach(text => text.destroy());
    npcMenuTexts = [];
    if (!isNpcMenuOpen || !npcMenuBackground) return;

    npcMenuItems.forEach((item, index) => {
        const selected = index === npcMenuIndex;
        const safeLabel = safeText(item.label);
        const label = selected
            ? t(
                "npcMenu.selectedItem",
                { label: safeLabel },
                "▶ " + safeLabel
            )
            : "  " + safeLabel;
        const row = npcQuestionMode ? item.row : index;
        const startY = npcQuestionMode
            ? 336
            : 420 - ((npcMenuItems.length - 1) * 21);
        const text = npcMenuBackground.scene.add.text(
            410, startY + row * 42, label,
            {
                fontFamily: "Noto Sans JP, sans-serif",
                fontSize: "22px",
                color: selected ? "#ffe08a" : "#ffffff",
                stroke: "#381f0e",
                strokeThickness: 4
            }
        ).setScrollFactor(0).setDepth(5101);
        npcMenuTexts.push(text);
    });
}

function openNpcMainMenu(scene, npc) {
    if (!scene || !npc || !getNpcId(npc)) return;
    isNpcMenuOpen = true;
    npcQuestionMode = false;
    npcMenuCurrentNpc = npc;
    npcMenuIndex = 0;
    npcMenuItems = [{
        type: "talk",
        label: t("npcMenu.talk", {}, "話す")
    }];
    if (getAvailableAskableGroups(scene, npc).length > 0) {
        npcMenuItems.push({
            type: "questions",
            label: t(
                "npcMenu.askInvestigation",
                {},
                "調査について聞く"
            )
        });
    }
    npcMenuItems.push({
        type: "close",
        label: t("npcMenu.later", {}, "またあとで")
    });
    createNpcMenuBackground(scene);
    renderNpcMenu();
    interactPrompt.setVisible(false);
    setBGMVolume(scene, menuBgmLevel(0.20), 300);
    updateStoryHint(scene);
}

function openNpcQuestionMenu(scene, npc) {
    isNpcMenuOpen = true;
    npcQuestionMode = true;
    npcMenuCurrentNpc = npc;
    npcQuestionPage = 0;
    rebuildNpcQuestionPage(scene, false);
}

function rebuildNpcQuestionPage(scene, keepPagerSelected) {
    npcQuestionAllGroups = getAvailableAskableGroups(scene, npcMenuCurrentNpc);
    npcQuestionTotalPages = Math.max(
        1,
        Math.ceil(npcQuestionAllGroups.length / NPC_QUESTIONS_PER_PAGE)
    );
    npcQuestionPage = Phaser.Math.Clamp(
        npcQuestionPage,
        0,
        npcQuestionTotalPages - 1
    );

    const start = npcQuestionPage * NPC_QUESTIONS_PER_PAGE;
    npcQuestionVisibleGroups = npcQuestionAllGroups.slice(
        start,
        start + NPC_QUESTIONS_PER_PAGE
    );
    npcMenuItems = npcQuestionVisibleGroups.map((group, index) => ({
        type: "question",
        label: group.questionTitle || t(
            "npcMenu.investigationFallback",
            {},
            "調査について"
        ),
        group,
        row: index
    }));
    npcMenuItems.push({
        type: "back",
        label: t("npcMenu.back", {}, "もどる"),
        row: 3
    });
    npcMenuItems.push({
        type: "pager",
        label: t(
            "npcMenu.pageIndicator",
            {
                current: npcQuestionPage + 1,
                total: npcQuestionTotalPages
            },
            "◀ " + (npcQuestionPage + 1) +
            " / " + npcQuestionTotalPages + " ▶"
        ),
        row: 4
    });
    npcMenuIndex = keepPagerSelected ? npcMenuItems.length - 1 : 0;
    createNpcMenuBackground(scene);
    renderNpcMenu();
}

function changeNpcQuestionPage(direction) {
    const nextPage = Phaser.Math.Clamp(
        npcQuestionPage + direction,
        0,
        npcQuestionTotalPages - 1
    );
    if (nextPage === npcQuestionPage) return;
    npcQuestionPage = nextPage;
    rebuildNpcQuestionPage(npcMenuBackground.scene, true);
}

function confirmNpcMenuSelection(scene) {
    const item = npcMenuItems[npcMenuIndex];
    const npc = npcMenuCurrentNpc;
    if (!item || !npc) return;
    if (item.type === "talk") {
        const data = getNpcDialogData(scene, npc);
        const fallback = data && Array.isArray(data.fallbackDialogs)
            ? { dialogs: data.fallbackDialogs }
            : null;
        startDialogGroup(scene, npc, getDefaultDialogGroup(scene, npc) || fallback);
    } else if (item.type === "questions") {
        openNpcQuestionMenu(scene, npc);
    } else if (item.type === "question") {
        startDialogGroup(scene, npc, item.group);
    } else if (item.type === "back") {
        openNpcMainMenu(scene, npc);
    } else if (item.type === "pager") {
        return;
    } else {
        closeNpcMenu(scene);
    }
}

function closeNpcMenu(scene, restoreBgm = true) {
    safeArray(npcMenuTexts).forEach(text => text.destroy());
    npcMenuTexts = [];
    if (npcMenuBackground) npcMenuBackground.destroy();
    npcMenuBackground = null;
    npcMenuItems = [];
    npcMenuIndex = 0;
    npcMenuCurrentNpc = null;
    npcQuestionMode = false;
    npcQuestionPage = 0;
    npcQuestionTotalPages = 1;
    npcQuestionAllGroups = [];
    npcQuestionVisibleGroups = [];
    isNpcMenuOpen = false;
    if (restoreBgm && scene) setBGMVolume(scene, bgmVolume, 300);
    if (scene) updateStoryHint(scene);
}

function startDialog(scene) {

    if (!currentNpc) return;

    //--------------------------------
    // NPC6 保护：彩蛋 NPC，使用原有静态对白逻辑
    // 不读取 story requirements
    // 不写入 played
    // 不调用 unlockFragment / updateNotebook
    // 不加入 notifyNpcIds
    //--------------------------------

    const isNpc6 =
        currentNpc.dialogKey === "dialog_npc6";

    currentDialogGroup = null;

    const npcId = getNpcId(currentNpc);
    const structuredData = !isNpc6 ? getNpcDialogData(scene, currentNpc) : null;
    if (npcId && structuredData) {
        if (!hasMetNpc(npcId)) {
            startDialogGroup(scene, currentNpc, getFirstMeetingGroup(scene, currentNpc));
        } else {
            const storyGroup = getStoryDialogGroup(scene, currentNpc);
            if (storyGroup) {
                startDialogGroup(scene, currentNpc, storyGroup);
            } else {
                openNpcMainMenu(scene, currentNpc);
            }
        }
        return;
    }

    if (
        currentNpc.dialogKey &&
        scene.cache.json.exists(currentNpc.dialogKey)
    ) {

        const dialogData =
            scene.cache.json.get(currentNpc.dialogKey);

        if (!isNpc6 && dialogData && Array.isArray(dialogData.dialogGroups)) {

            //--------------------------------
            // 新格式：dialogGroups
            // 1. 过滤：requirements 满足 + (非 once 或 未 played)
            // 2. 排序：once=true且played=false 优先，然后 priority 从高到低
            // 3. 取第一个作为本次对话
            // 4. played 延迟到对话结束后设置（防止中断丢失节点）
            //
            // ★ 初次见面优先：
            //   如果玩家尚未认识该 NPC（!hasMetNpc），
            //   必须优先播放 first_meeting 节点，
            //   即使已有满足条件的更新节点。
            //--------------------------------

            const npcIdMatch = currentNpc.dialogKey.match(/dialog_(npc\d+)/);
            const npcId = npcIdMatch ? npcIdMatch[1] : null;
            const notYetMet = npcId && !hasMetNpc(npcId);

            let matchedGroup = null;

            if (notYetMet) {
                //--------------------------------
                // 未认识：强制选择 first_meeting
                //--------------------------------

                matchedGroup = dialogData.dialogGroups.find(
                    g => g && g.id === "first_meeting" &&
                         !(g.once === true && g.played === true)
                ) || null;
            }

            if (!matchedGroup && !notYetMet) {
                //--------------------------------
                // 正常选择逻辑
                //--------------------------------

                matchedGroup = dialogData.dialogGroups
                    .filter(group => getDialogGroupRole(group) === "default")
                    .filter(group => group.askable !== true)
                    .filter(group => evaluateRequirements(group.requirements))
                    .sort((a, b) => (b.priority || 0) - (a.priority || 0))[0] || null;
            }

            if (matchedGroup && Array.isArray(matchedGroup.dialogs)) {
                currentNpc.dialogLines = matchedGroup.dialogs;
                currentDialogGroup = matchedGroup;
            } else {
                currentNpc.dialogLines = [
                    {
                        speaker: "ishizu",
                        text: t("dialog.fallback.ellipsis", {}, "…")
                    }
                ];
            }

        } else if (isNpc6 && Array.isArray(dialogData)) {

            //--------------------------------
            // NPC6 旧格式：纯数组（直接使用，不参与剧情系统）
            //--------------------------------

            currentNpc.dialogLines = dialogData;

        } else if (!isNpc6 && Array.isArray(dialogData)) {

            //--------------------------------
            // 旧格式：纯数组（向后兼容）
            //--------------------------------

            currentNpc.dialogLines = dialogData;

        } else {

            currentNpc.dialogLines = [
                {
                    speaker: "ishizu",
                    text: t("dialog.fallback.hello", {}, "こんにちは")
                }
            ];

        }

    } else {

        //--------------------------------
        // JSON 缺失时使用默认对话
        //--------------------------------

        console.warn(
            "[Dialog] 对话 JSON 未找到:",
            currentNpc.dialogKey,
            "→ 使用默认对话"
        );

        currentNpc.dialogLines = [
            {
                speaker: "ishizu",
                text: t("dialog.fallback.hello", {}, "こんにちは")
            }
        ];

    }

    //--------------------------------
    // 第一次对话 → 解锁对应人物
    // unlockPerson 内部会检查是否已解锁，已解锁则跳过
    //--------------------------------

    if (currentNpc.personId) {
        unlockPerson(currentNpc.personId, scene);
    }

    isDialogOpen = true;
    currentDialogIndex = 0;

    dialogBox.setVisible(true);
    dialogText.setVisible(true);

    //--------------------------------
    // BGM 混音：NPC 对话中 → 0.20
    //--------------------------------

    setBGMVolume(scene, menuBgmLevel(0.20), 300);

    showDialogLine(scene);

    //--------------------------------
    // 对话开始时隐藏线索 UI
    //--------------------------------

    updateStoryHint(scene);

    //--------------------------------
    // 头像渐显（alpha 0→1, 200ms）
    //--------------------------------

    scene.tweens.killTweensOf(portraitImage);

    if (portraitImage.visible) {

        portraitImage.setAlpha(0);

        scene.tweens.add({
            targets: portraitImage,
            alpha: 1,
            duration: 200,
            ease: "Linear"
        });

    }

    player.setVelocity(0);
    player.anims.stop();

}

//--------------------------------
// 显示当前台词
// 从 dialogLines[currentDialogIndex] 读取
// { speaker:"ishizu", text:"お疲れ様です" }
//--------------------------------

function showDialogLine(scene, lineOverride) {

    if (!lineOverride && (!currentNpc || !Array.isArray(currentNpc.dialogLines))) {
        console.warn("[Dialog] dialogLines 不是数组");
        if (currentNpc) closeDialog(scene);
        return;
    }

    const dialogLines = currentNpc ? safeArray(currentNpc.dialogLines) : [];
    const line = lineOverride || dialogLines[currentDialogIndex];

    if (!line) return;

    const speaker = safeText(line.speaker || "");
    const text    = safeText(line.text);

    //--------------------------------
    // 姓名显示：speaker → 显示名映射
    // narrator 或空 speaker → 隐藏姓名
    //--------------------------------

    if (dialogNameText && dialogNameBackground) {

        if (speaker && speaker !== "narrator" && speaker !== "system") {

            const displayName =
                SPEAKER_DISPLAY_NAMES[speaker] ||
                speaker;

            dialogNameText.setText(safeText(displayName));
            dialogNameText.setVisible(true);
            dialogNameBackground.setVisible(true);

        } else {

            dialogNameText.setVisible(false);
            dialogNameBackground.setVisible(false);

        }

    }

    //--------------------------------
    // 切换头像
    //--------------------------------

    const portraitKey =
        "portrait_" + speaker;

    // 每一句都恢复统一的头像显示状态，避免上一位 speaker 或 fade tween 残留。
    scene.tweens.killTweensOf(portraitImage);
    portraitImage.clearTint();
    portraitImage.setAlpha(1);
    portraitImage.setPosition(120, 410);
    portraitImage.setFlipX(false);
    portraitImage.setDepth(3100);

    if (
        speaker !== "narrator" && speaker !== "system" &&
        scene &&
        scene.textures &&
        scene.textures.exists(portraitKey)
    ) {

        portraitImage.setTexture(portraitKey);

        //--------------------------------
        // 等比缩放：在 180×280 范围内保持原始宽高比
        //--------------------------------

        const tex = portraitImage.texture;

        if (tex && tex.source && tex.source[0]) {

            const scale = Math.min(
                180 / tex.source[0].width,
                280 / tex.source[0].height
            );

            portraitImage.setScale(scale);

        }

        portraitImage.setVisible(true);

    } else {
        if (speaker && speaker !== "narrator" && speaker !== "system") {
            console.warn("[Dialog] portrait missing:", portraitKey);
        }
        portraitImage.setVisible(false);

    }

    dialogText.setText(safeText(text));
    showDialogContinuePrompt(scene);

}

//--------------------------------
// 对话正文第一行左侧 E 键继续提示
// 与调查点 interactPrompt 共用文字来源与视觉样式
//--------------------------------

function createDialogContinuePrompt(scene, depth, bodyText) {

    if (!scene || !bodyText) return null;

    const prompt = scene.add.text(
        bodyText.x - 28,
        bodyText.y + 28,
        safeText(
            t("system.interactPrompt", {}, "E")
        ),
        {
            fontSize: "18px",
            color: "#ffff00",
            backgroundColor: "rgba(0,0,0,0.7)",
            padding: { x: 6, y: 3 }
        }
    )
        .setOrigin(1, 1)
        .setScrollFactor(0)
        .setDepth(depth);

    scene.tweens.add({
        targets: prompt,
        alpha: 0.4,
        duration: 350,
        ease: "Linear",
        yoyo: true,
        repeat: -1
    });

    return prompt;

}

function destroyDialogContinuePrompt(scene, prompt) {

    if (!prompt) return;

    if (scene && scene.tweens) {
        scene.tweens.killTweensOf(prompt);
    }

    prompt.destroy();

}

function showDialogContinuePrompt(scene) {

    if (dialogContinuePrompt && dialogContinuePrompt.active) return;

    dialogContinuePrompt =
        createDialogContinuePrompt(scene, 3201, dialogText);

}

function hideDialogContinuePrompt(scene) {

    destroyDialogContinuePrompt(scene, dialogContinuePrompt);
    dialogContinuePrompt = null;

}

//--------------------------------
// 关闭对话框
//--------------------------------

function closeDialog(scene) {

    isDialogOpen = false;

    dialogBox.setVisible(false);
    dialogText.setVisible(false);
    hideDialogContinuePrompt(scene);

    //--------------------------------
    // 隐藏姓名
    //--------------------------------

    if (dialogNameText) dialogNameText.setVisible(false);
    if (dialogNameBackground) dialogNameBackground.setVisible(false);

    //--------------------------------
    // BGM 混音：关闭对话 → 恢复 0.28
    //--------------------------------

    setBGMVolume(scene, bgmVolume, 300);

    //--------------------------------
    // 头像渐隐（alpha 1→0, 200ms）
    //--------------------------------

    scene.tweens.killTweensOf(portraitImage);

    if (portraitImage.visible) {

        scene.tweens.add({
            targets: portraitImage,
            alpha: 0,
            duration: 200,
            ease: "Linear",
            onComplete: () => {
                portraitImage.setVisible(false);
                portraitImage.setAlpha(1);
            }
        });

    }

    //--------------------------------
    // 对话结束后：显示待处理通知（如 メモ更新済み）
    //--------------------------------

    if (pendingInvestigationNotice) {
        scene.time.delayedCall(300, () => {
            if (pendingInvestigationNotice) {
                showInvestigationNotice(
                    scene,
                    pendingInvestigationNotice.message,
                    pendingInvestigationNotice.playSound
                );
                pendingInvestigationNotice = null;
            }
        });
    }

    //--------------------------------
    // 对话结束后：显示待处理的 NPC 对话通知
    // （调查完成后通知玩家某 NPC 有新对白）
    //--------------------------------

    scene.time.delayedCall(600, () => {
        showNextNpcTalkNotification(scene);
    });

    //--------------------------------
    // 对话结束后更新线索
    //--------------------------------

    updateStoryHint(scene);

}

//--------------------------------
// 调查点处理：根据 type 分发
//--------------------------------

//--------------------------------
// 辅助：根据 fragment 生成调查展示素材 key
//   image → inv_<image_filename_without_ext>
//   video → inv_<video_filename_without_ext>
//   audio → inv_<audio_filename_without_ext>
//--------------------------------

function getFragmentMediaKey(fragment) {

    if (!fragment) return null;

    switch (safeText(fragment.type)) {

        case "image":
            return fragment.image
                ? "inv_" + safeText(fragment.image).replace(/\.[^.]+$/, "")
                : null;

        case "video":
            return fragment.video
                ? "inv_" + safeText(fragment.video).replace(/\.[^.]+$/, "")
                : null;

        case "audio":
            return fragment.audio
                ? "inv_" + safeText(fragment.audio).replace(/\.[^.]+$/, "")
                : null;

        default:
            return null;

    }

}

//--------------------------------
// 辅助：根据 fragment 获取媒体文件 URL（用于 video loadURL fallback）
//--------------------------------

function getFragmentMediaURL(fragment) {

    if (!fragment) return null;

    switch (safeText(fragment.type)) {

        case "video":
            return fragment.video
                ? "assets/investigation/videos/" + safeText(fragment.video)
                : null;

        default:
            return null;

    }

}

function handleInvestigation(scene, inv) {

    if (!inv) {
        console.warn("[Investigation] 调查对象为空，跳过");
        return;
    }

    //--------------------------------
    // 安全检查：UI 对象必须存在（场景重启期间可能为 null）
    //--------------------------------
    if (!invOverlay || !invImage || !invTitle || !invText) {
        console.warn("[Investigation] UI 对象未初始化，跳过");
        return;
    }

    //--------------------------------
    // Warp：地图切换（不查 fragments.json）
    //--------------------------------

    if (inv.invType === "warp") {

        warpToMap(
            scene,
            inv.target,
            inv.targetXRaw,
            inv.targetYRaw
        );
        return;

    }

    //--------------------------------
    // 调查开始时隐藏线索 UI
    //--------------------------------

    updateStoryHint(scene);

    //--------------------------------
    // 数据驱动：从 fragments.json 查找调查数据
    //--------------------------------

    const fragmentId = safeText(inv && inv.fragmentId);
    console.log("[Fragment Lookup]", {
        currentMapKey,
        fragmentId,
        invType: inv && inv.invType,
        loadedFragmentCount: safeArray(fragments).length,
        loadedFragmentIds: safeArray(fragments)
            .map(item => item && item.id)
            .filter(Boolean),
        found: safeArray(fragments).some(
            item => item && item.id === fragmentId
        )
    });
    const fragment =
        safeArray(fragments).find(f => f && f.id === fragmentId);

    if (!fragment) {

        console.warn(
            "[Investigation] fragments.json 中未找到 id =",
            fragmentId
        );

        //--------------------------------
        // fragment 找不到：使用 Tiled 兜底数据显示调查
        // 不允许崩溃
        //--------------------------------
        const fallbackTitle = safeText(inv.invTitle || inv.invName);
        const fallbackText  = safeText(inv.invText || inv.text || inv.media);

        isInvestigationOpen = true;
        setBGMVolume(scene, menuBgmLevel(0.18), 300);

        invTitle.setText(safeText(fallbackTitle));
        invText.setText(safeText(
            fallbackText ||
            t("investigation.noData", {}, "データなし")
        ));
        invOverlay.setVisible(true);
        invImage.setVisible(false);
        invTitle.setVisible(true);
        invText.setVisible(true);
        if (invVideo) invVideo.setVisible(false);
        interactPrompt.setVisible(false);

        player.setVelocity(0);
        player.anims.stop();

        pendingInvestigationNotice = {
            message: t(
                "investigation.alreadyInvestigated",
                {},
                "再調査です"
            ),
            playSound: false
        };

        return;

    }

    //--------------------------------
    // 统一解锁碎片
    //--------------------------------

    const unlockedNow = unlockFragment(fragmentId);

    if (unlockedNow) {
        pendingInvestigationFeedback = true;
        pendingInvestigationNotice = {
            message: t(
                "system.memoUpdated",
                {},
                "メモ更新済み"
            ),
            playSound: true
        };

        //--------------------------------
        // 首次解锁：检查 story_events.json
        // 通知相关 NPC 有新对白
        //--------------------------------

        triggerNpcNotifications(scene, fragmentId);

    } else {
        pendingInvestigationNotice = {
            message: t(
                "investigation.alreadyInvestigated",
                {},
                "再調査です"
            ),
            playSound: false
        };
    }

    //--------------------------------
    // 根据 fragment.type 分发展示
    //--------------------------------

    const safeType = safeText(fragment.type || "investigation");
    const mediaKey = getFragmentMediaKey(fragment);
    const mediaURL = getFragmentMediaURL(fragment);

    //--------------------------------
    // 安全兜底：所有 fragment 字段先提取
    // 防止 null / undefined 导致崩溃
    //--------------------------------
    const fragTitle = safeText(fragment.title || inv.invTitle);
    const fragText  = safeText(fragment.text  || inv.invText);

    switch (safeType) {

        case "image":
            //--------------------------------
            // 图片调查：展示 image + title + text
            //--------------------------------

            if (mediaKey && scene.textures.exists(mediaKey)) {

                isInvestigationOpen = true;
                setBGMVolume(scene, menuBgmLevel(0.18), 300);

                invImage.setTexture(mediaKey);

                const maxW = 600;
                const maxH = 450;
                const tex = invImage.texture;
                const scaleX = maxW / tex.source[0].width;
                const scaleY = maxH / tex.source[0].height;
                const scale = Math.min(scaleX, scaleY, 1);

                invImage.setScale(scale);
                invImage.setPosition(480, 230);

                invTitle.setText(safeText(fragTitle));
                invText.setText(safeText(fragText));
                invOverlay.setVisible(true);
                invImage.setVisible(true);
                invTitle.setVisible(true);
                invText.setVisible(true);
                if (invVideo) invVideo.setVisible(false);
                interactPrompt.setVisible(false);

                player.setVelocity(0);
                player.anims.stop();

            } else {

                //--------------------------------
                // 图片缺失：仍展示 overlay + 标题/正文 + 写真なし
                //--------------------------------

                isInvestigationOpen = true;
                setBGMVolume(scene, menuBgmLevel(0.18), 300);

                invTitle.setText(safeText(fragTitle));
                invText.setText(
                    safeText(
                        fragText + "\n\n" +
                        t("investigation.missingPhoto", {}, "写真なし")
                    )
                );
                invOverlay.setVisible(true);
                invImage.setVisible(false);
                invTitle.setVisible(true);
                invText.setVisible(true);
                if (invVideo) invVideo.setVisible(false);
                interactPrompt.setVisible(false);

                player.setVelocity(0);
                player.anims.stop();

                console.warn(
                    "[Investigation] 图片素材缺失:",
                    mediaKey
                );

            }
            break;

        case "video":
            //--------------------------------
            // 视频调查：动态创建 → 加载 → created → 播放
            //--------------------------------
            {
                const hasCache =
                    mediaKey && scene.cache.video.exists(mediaKey);
                const hasURL = mediaURL != null;

                if (!hasCache && !hasURL) {

                    //--------------------------------
                    // 视频缺失：展示 overlay + 标题/正文 + 動画なし
                    //--------------------------------

                    isInvestigationOpen = true;
                    setBGMVolume(scene, menuBgmLevel(0.18), 300);

                    invTitle.setText(safeText(fragTitle));
                    invText.setText(
                        safeText(
                            fragText + "\n\n" +
                            t("investigation.missingVideo", {}, "動画なし")
                        )
                    );
                    invOverlay.setVisible(true);
                    invImage.setVisible(false);
                    invTitle.setVisible(true);
                    invText.setVisible(true);
                    if (invVideo) invVideo.setVisible(false);
                    interactPrompt.setVisible(false);

                    player.setVelocity(0);
                    player.anims.stop();

                    console.warn(
                        "[Investigation] 视频素材缺失: key=%s",
                        mediaKey
                    );
                    break;
                }

                isInvestigationOpen = true;
                setBGMVolume(scene, menuBgmLevel(0.18), 300);

                //--------------------------------
                // 安全检查：invVideo 不存在时回退为文字展示
                //--------------------------------
                if (!invVideo) {

                    invTitle.setText(safeText(fragTitle));
                    invText.setText(safeText(
                        fragText + "\n\n" +
                        t("investigation.missingVideo", {}, "動画なし")
                    ));
                    invOverlay.setVisible(true);
                    invImage.setVisible(false);
                    invTitle.setVisible(true);
                    invText.setVisible(true);
                    interactPrompt.setVisible(false);

                    player.setVelocity(0);
                    player.anims.stop();

                    console.warn(
                        "[Investigation] invVideo 对象不存在"
                    );
                    break;
                }

                // 1. 停止当前播放（不销毁，复用 invVideo）
                invVideo.stop();

                // 2. 移除旧监听器
                invVideo.off("created");
                invVideo.off("complete");

                // 3. 加载新视频源（loadURL 复用浏览器缓存）
                if (!mediaURL) {
                    console.warn("[Investigation] 视频 URL 缺失:", mediaKey);
                    invTitle.setText(safeText(fragTitle));
                    invText.setText(safeText(
                        fragText + "\n\n" +
                        t("investigation.missingVideo", {}, "動画なし")
                    ));
                    invOverlay.setVisible(true);
                    invImage.setVisible(false);
                    invTitle.setVisible(true);
                    invText.setVisible(true);
                    interactPrompt.setVisible(false);
                    break;
                }

                invVideo.loadURL(safeText(mediaURL), true);

                invVideo.setVisible(true);

                // 4. 创建成功后播放
                let createdFired = false;
                invVideo.once("created", () => {
                    createdFired = true;
                    if (!invVideo) return;
                    invVideo.play(true);

                    playVideoAudio(scene, mediaKey);

                    const vMaxW = 600, vMaxH = 400;
                    const vidW = invVideo.width  || vMaxW;
                    const vidH = invVideo.height || vMaxH;
                    const vScale = Math.min(vMaxW / vidW, vMaxH / vidH, 1);
                    invVideo.setScale(vScale).setPosition(480, 220);

                });

                // 安全网：500ms 后仍未 created 则强制播放
                scene.time.delayedCall(500, () => {
                    if (!createdFired && invVideo && invVideo.active) {
                        invVideo.play(true);

                        playVideoAudio(scene, mediaKey);

                        const vMaxW = 600, vMaxH = 400;
                        const vidW = invVideo.width  || vMaxW;
                        const vidH = invVideo.height || vMaxH;
                        const vScale = Math.min(vMaxW / vidW, vMaxH / vidH, 1);
                        invVideo.setScale(vScale).setPosition(480, 220);
                    }
                });

                // 5. 播放完毕自动关闭
                invVideo.once("complete", () => {
                    closeInvestigation(scene);
                });

                // 5. 展示 UI
                invTitle.setText(safeText(fragTitle));
                invText.setText(safeText(fragText));
                invOverlay.setVisible(true);
                invImage.setVisible(false);
                invTitle.setVisible(true);
                invText.setVisible(true);
                interactPrompt.setVisible(false);

                player.setVelocity(0);
                player.anims.stop();

            }
            break;

        case "audio":
            //--------------------------------
            // 音频调查：播放音频 + 展示标题/正文
            //--------------------------------

            isInvestigationOpen = true;
            setBGMVolume(scene, menuBgmLevel(0.18), 300);

            // 停止旧音频
            if (invAudio) {
                invAudio.stop();
                invAudio.destroy();
                invAudio = null;
            }

            if (mediaKey && scene.cache.audio.exists(mediaKey)) {

                invAudio = scene.sound.add(
                    mediaKey,
                    { loop: false, volume: seVolume }
                );
                invAudio.play();

            } else {

                console.warn(
                    "[Investigation] 音声素材缺失:",
                    mediaKey
                );

            }

            // 展示 overlay（无图片/视频，只有标题和正文）
            invTitle.setText(safeText(fragTitle));
            invText.setText(
                safeText(
                    fragText +
                (mediaKey && scene.cache.audio.exists(mediaKey)
                    ? "" : "\n\n" +
                        t("investigation.missingAudio", {}, "音声なし"))
                )
            );
            invOverlay.setVisible(true);
            invImage.setVisible(false);
            invTitle.setVisible(true);
            invText.setVisible(true);
            if (invVideo) invVideo.setVisible(false);
            interactPrompt.setVisible(false);

            player.setVelocity(0);
            player.anims.stop();
            break;

        default:
            //--------------------------------
            // investigation 类型：无媒体展示
            // 只解锁碎片，弹出提示
            //--------------------------------

            break;

    }

    //--------------------------------
    // 无 overlay 的调查类型
    // 没有调查窗口可关闭，直接弹出待显示提示
    //--------------------------------

    if (!isInvestigationOpen && pendingInvestigationNotice) {
        showInvestigationNotice(
            scene,
            pendingInvestigationNotice.message,
            pendingInvestigationNotice.playSound
        );
        pendingInvestigationNotice = null;
        flushInvestigationFeedback(scene);
    }

}

//--------------------------------
// 播放视频同步音频
//--------------------------------

function playVideoAudio(scene, mediaKey) {

    //--------------------------------
    // 安全检查：scene / mediaKey 为空时直接返回
    // 缺失同步音频是正常情况（如 water_grass 无音频）
    //--------------------------------
    if (!scene || !mediaKey) {
        return;
    }

    // 先停掉旧音频
    if (invAudio) {
        invAudio.stop();
        invAudio.destroy();
        invAudio = null;
    }

    if (!scene.cache.audio.exists(mediaKey)) {
        console.warn("[Audio] 未找到同步音频: %s", mediaKey);
        return;
    }

    invAudio = scene.sound.add(
        mediaKey,
        { loop: false, volume: seVolume }
    );
    invAudio.play();
}

//--------------------------------
// 关闭调查展示
//--------------------------------

function closeInvestigation(scene) {

    isInvestigationOpen = false;

    if (invOverlay) invOverlay.setVisible(false);
    if (invImage) invImage.setVisible(false);
    if (invTitle) invTitle.setVisible(false);
    if (invText) invText.setVisible(false);

    // 停止同步音频
    if (invAudio) {
        invAudio.stop();
        invAudio.destroy();
        invAudio = null;
    }

    // 停止并隐藏视频对象（复用模式，不销毁）
    if (invVideo) {
        invVideo.stop();
        invVideo.setVisible(false);
        invVideo.off("created");
        invVideo.off("complete");
    }

    //--------------------------------
    // BGM 混音：关闭调查展示 → 恢复 0.28
    //--------------------------------

    setBGMVolume(scene, bgmVolume, 300);

    //--------------------------------
    // 关闭调查界面时弹出待显示提示
    //--------------------------------

    if (pendingInvestigationNotice) {
        if (!scene) scene = currentScene();
        showInvestigationNotice(
            scene,
            pendingInvestigationNotice.message,
            pendingInvestigationNotice.playSound
        );
        pendingInvestigationNotice = null;
    }

    flushInvestigationFeedback(scene);

    //--------------------------------
    // 关闭调查界面后：显示待处理的 NPC 对话通知
    //--------------------------------

    scene.time.delayedCall(600, () => {
        showNextNpcTalkNotification(scene);
    });

    //--------------------------------
    // 第一环调查完成检测
    //--------------------------------

    checkFreeExplorationComplete(scene);

    //--------------------------------
    // 关闭调查后更新线索
    //--------------------------------

    updateStoryHint(scene);

}

//--------------------------------
// Notebook System v2
//  调查笔记：每个解锁的 fragment 单独一页
//  - openNotebook(scene)  : 打开笔记本 + 渲染当前页
//  - closeNotebook()      : 关闭笔记本 + 清理对象池
//  - renderNotebookPage   : 根据 notebookPageIndex 渲染当前 fragment 页
//  - renderFragmentPage   : 渲染单个 fragment 页（标题 / 图片 / 正文 / 引用 / 地点 / 日期）
//  - clearNotebookTexts     : 清理 notebookTexts 池中的所有对象
//  - unlockFragment(id)   : 解锁碎片（人物页同步逻辑保留）
//--------------------------------

function openNotebook(scene) {

    isNotebookOpen = true;

    notebookClosedIcon.setVisible(false);
    notebookOpenImage.setVisible(true);

    // 隐藏常驻 F 键提示
    if (tutorialFKeyHint) tutorialFKeyHint.setVisible(false);

    interactPrompt.setVisible(false);

    //--------------------------------
    // 隐藏调查线索 UI
    //--------------------------------

    if (storyHintText) storyHintText.setVisible(false);

    // 玩家停步
    if (player) {
        player.setVelocity(0);
        player.anims.stop();
    }

    //--------------------------------
    // BGM 混音：打开 Notebook → 0.16
    //--------------------------------

    setBGMVolume(scene, menuBgmLevel(0.16), 300);

    // 打开时确保页索引合法
    const totalPages = getNotebookPageCount();
    if (notebookPageIndex >= totalPages) {
        notebookPageIndex = 0;
    }

    renderNotebookPage(scene);

    //--------------------------------
    // Tutorial Phase 3: 首次打开 Notebook → 显示翻页提示
    //--------------------------------

    if (!tutorialPageShown) {
        tutorialPageShown = true;
        showTutorialPageHint(scene);
    }

}

function closeNotebook(scene) {

    isNotebookOpen = false;

    notebookClosedIcon.setVisible(true);
    notebookOpenImage.setVisible(false);

    // 恢复常驻 F 键提示
    if (tutorialFKeyHint) tutorialFKeyHint.setVisible(true);

    // 清理本页所有动态对象
    clearNotebookTexts();

    if (player) {
        player.setVelocity(0);
    }

    //--------------------------------
    // BGM 混音：关闭 Notebook → 恢复 0.28（仅无对话/调查时）
    //--------------------------------

    if (!isDialogOpen && !isInvestigationOpen) {
        setBGMVolume(scene, bgmVolume, 300);
    }

    //--------------------------------
    // 关闭 Notebook 后恢复线索
    //--------------------------------

    updateStoryHint(scene);

}

function clearNotebookTexts() {

    safeArray(notebookTexts).forEach(t => {
        if (t && t.destroy) t.destroy();
    });
    notebookTexts = [];

    if (notebookTitleText) {
        notebookTitleText.destroy();
        notebookTitleText = null;
    }

    if (notebookHintText) {
        notebookHintText.destroy();
        notebookHintText = null;
    }

}

//--------------------------------
// 辅助：返回当前已解锁 fragment 列表
//--------------------------------

function getUnlockedFragments() {
    return safeArray(fragments).filter(f => f && f.unlocked);
}

function getInvestigationProgress() {
    const validFragments = safeArray(fragments).filter(fragment => {
        const fragmentId = safeText(fragment && fragment.id);
        return fragmentId &&
            !REMOVED_INVESTIGATION_IDS.has(fragmentId);
    });
    const totalCount = validFragments.length;
    const collectedCount = Math.min(
        totalCount,
        validFragments.filter(fragment => fragment.unlocked).length
    );
    const totalSegments = 10;
    let filledSegments = 0;

    if (totalCount > 0) {
        filledSegments = collectedCount >= totalCount
            ? totalSegments
            : Math.floor(
                collectedCount / totalCount * totalSegments
            );
    }

    return {
        collectedCount,
        totalCount,
        filledSegments,
        progressBar:
            "■".repeat(filledSegments) +
            "□".repeat(totalSegments - filledSegments)
    };
}

function renderNotebookProgress(scene) {
    if (!scene) return;

    const progress = getInvestigationProgress();
    const labelText = scene.add.text(
        NOTEBOOK_PROGRESS_CENTER_X,
        NOTEBOOK_PROGRESS_LABEL_Y,
        safeText(notebookProgressLabel),
        {
            fontFamily: "Noto Sans JP, sans-serif",
            fontSize: "15px",
            color: "#5a2f0a"
        }
    ).setOrigin(0.5, 0).setScrollFactor(0).setDepth(3002);

    const countText = scene.add.text(
        NOTEBOOK_PROGRESS_CENTER_X,
        NOTEBOOK_PROGRESS_COUNT_Y,
        safeText(
            progress.collectedCount +
            " / " +
            progress.totalCount
        ),
        {
            fontFamily: "Noto Sans JP, sans-serif",
            fontSize: "15px",
            color: "#5a2f0a"
        }
    ).setOrigin(0.5, 0).setScrollFactor(0).setDepth(3002);

    const progressBarText = scene.add.text(
        NOTEBOOK_PROGRESS_CENTER_X,
        NOTEBOOK_PROGRESS_BAR_Y,
        safeText(progress.progressBar),
        {
            fontFamily: "Noto Sans JP, sans-serif",
            fontSize: "17px",
            color: "#5a2f0a",
            letterSpacing: 1
        }
    ).setOrigin(0.5, 0).setScrollFactor(0).setDepth(3002);

    notebookTexts.push(labelText, countText, progressBarText);
}

function playInvestigationFeedback(scene) {
    if (!scene || !player || !player.active) return;

    if (notebookFeedbackTween) {
        notebookFeedbackTween.stop();
        notebookFeedbackTween.remove();
        notebookFeedbackTween = null;
    }

    if (notebookClosedIcon && notebookClosedIcon.active) {
        notebookClosedIcon.setAlpha(notebookFeedbackBaseAlpha);

        if (notebookClosedIcon.visible) {
            const feedbackTween = scene.tweens.add({
                targets: notebookClosedIcon,
                alpha: 0.55,
                duration: 90,
                ease: "Sine.easeInOut",
                yoyo: true,
                repeat: 1,
                onComplete: () => {
                    if (notebookClosedIcon && notebookClosedIcon.active) {
                        notebookClosedIcon.setAlpha(
                            notebookFeedbackBaseAlpha
                        );
                    }
                    if (notebookFeedbackTween === feedbackTween) {
                        notebookFeedbackTween = null;
                    }
                }
            });
            notebookFeedbackTween = feedbackTween;
        }
    }

    if (investigationFeedbackMark &&
        investigationFeedbackMark.active) {
        scene.tweens.killTweensOf(investigationFeedbackMark);
        investigationFeedbackMark.destroy();
    }

    const playerHeight = Number(player.displayHeight) || 32;
    investigationFeedbackMark = scene.add.text(
        player.x,
        player.y - Math.max(16, playerHeight * 0.6),
        "!",
        {
            fontFamily: "Noto Sans JP, sans-serif",
            fontSize: "18px",
            color: "#ffff66",
            fontStyle: "bold",
            stroke: "#3a1f0a",
            strokeThickness: 3
        }
    ).setOrigin(0.5, 1).setDepth(201);

    const feedbackMark = investigationFeedbackMark;
    scene.tweens.add({
        targets: feedbackMark,
        y: feedbackMark.y - 6,
        alpha: 0,
        duration: 300,
        ease: "Sine.easeOut",
        onComplete: () => {
            if (feedbackMark && feedbackMark.active) {
                feedbackMark.destroy();
            }
            if (investigationFeedbackMark === feedbackMark) {
                investigationFeedbackMark = null;
            }
        }
    });
}

function flushInvestigationFeedback(scene) {
    if (!pendingInvestigationFeedback) return;
    pendingInvestigationFeedback = false;
    playInvestigationFeedback(scene || currentScene());
}

//--------------------------------
// 辅助：日文/中文自动换行
// 每 maxCharsPerLine 个字符插入 \n
//--------------------------------

function wrapJapaneseText(text, maxCharsPerLine) {
    text = safeText(text);

    if (!maxCharsPerLine || maxCharsPerLine <= 0) {
        return text;
    }

    let result = "";

    for (let i = 0; i < text.length; i += maxCharsPerLine) {
        result += text.slice(i, i + maxCharsPerLine);

        if (i + maxCharsPerLine < text.length) {
            result += "\n";
        }
    }

    return result;
}

// 英文由 Phaser 按实际像素宽度换行，保留原文中的明确换行。
// 日文与中文继续使用原有的定长字符换行。
function prepareNotebookBodyText(text, maxCharsPerLine) {
    return currentLanguage === "en"
        ? safeText(text)
        : wrapJapaneseText(text, maxCharsPerLine);
}

function getEnglishNotebookWordWrap(width) {
    return {
        width: width,
        useAdvancedWrap: true
    };
}

//--------------------------------
// 辅助：Notebook 总页数
// page 0 = 人物页
// page 1 = Fragments 目录页
// page 2+ = 已解锁 fragment 详情页
//--------------------------------

function getNotebookPageCount() {
    return 2 + safeArray(getUnlockedFragments()).length;
}

function reportNotebookRenderError(functionName, error, context) {
    console.error("[Notebook] render failed", {
        functionName: safeText(functionName),
        fragmentId: safeText(context && context.fragmentId),
        pageId: safeText(context && context.pageId),
        textValue: safeText(context && context.textValue)
    }, error);
    console.error("[FUNCTION ERROR]", functionName, error, error && error.stack);
    throw error;
}

function renderNotebookPage(scene) {

    if (!scene) return;

    // 先清理旧对象
    clearNotebookTexts();

    const totalPages = getNotebookPageCount();

    //--------------------------------
    // 索引合法化
    //--------------------------------

    if (notebookPageIndex < 0) notebookPageIndex = 0;
    if (notebookPageIndex >= totalPages) {
        notebookPageIndex = totalPages - 1;
    }

    //--------------------------------
    // 页面分发
    // page 0 → 人物页
    // page 1 → Fragments 目录页
    // page 2+ → fragment 详情页
    //--------------------------------

    if (notebookPageIndex === 0) {

        try {
            renderPeoplePage(scene);
        } catch (error) {
            reportNotebookRenderError("renderPeoplePage", error, {
                pageId: "people"
            });
        }

    } else if (notebookPageIndex === 1) {

        try {
            renderFragmentsListPage(scene);
        } catch (error) {
            reportNotebookRenderError("renderFragmentsListPage", error, {
                pageId: "fragments"
            });
        }

    } else {

        const unlocked = getUnlockedFragments();
        const fragment = unlocked[notebookPageIndex - 2];

        if (fragment) {
            try {
                renderFragmentPage(scene, fragment);
            } catch (error) {
                reportNotebookRenderError("renderFragmentPage", error, {
                    fragmentId: fragment && fragment.id,
                    pageId: notebookPageIndex,
                    textValue: fragment && fragment.text
                });
            }
        } else {
            notebookPageIndex = 0;
            try {
                renderPeoplePage(scene);
            } catch (error) {
                reportNotebookRenderError("renderPeoplePage", error, {
                    pageId: "people"
                });
            }
        }

    }

    renderNotebookProgress(scene);

    //--------------------------------
    // 页码指示（右上角）
    // しおり目录页（index=1）跳过全局页码，
    // 子页码由 renderFragmentsListPage 自行渲染
    //--------------------------------

    if (notebookPageIndex !== 1) {

        const pageIndicator = scene.add.text(
            820, 55,
            safeText(t(
                "notebook.pageIndicator",
                {
                    current: notebookPageIndex + 1,
                    total: totalPages
                },
                (notebookPageIndex + 1) + " / " + totalPages
            )),
            {
                fontSize: "16px",
                color: "#ffffff"
            }
        ).setOrigin(0.5, 0).setScrollFactor(0).setDepth(3002);
        notebookTexts.push(pageIndicator);

    }

    //--------------------------------
    // 底部操作提示
    //--------------------------------

    const leftAvail  = notebookPageIndex > 0;
    const rightAvail = notebookPageIndex < totalPages - 1;

    const hintStr =
        t(
            "notebook.navigation",
            {},
            "←/→ 翻页   F / ESC 关闭"
        ) +
        (leftAvail ? "" : t(
            "notebook.firstPageStatus",
            {},
            "   (已是第一页)"
        )) +
        (rightAvail ? "" : t(
            "notebook.lastPageStatus",
            {},
            "   (已是最后一页)"
        ));

    notebookHintText = scene.add.text(
        480, 615,
        safeText(hintStr),
        {
            fontSize: "14px",
            color: "#5a2f0a"
        }
    ).setOrigin(0.5).setScrollFactor(0).setDepth(3002);

}

//--------------------------------
// 渲染人物页
// 读取 notebook.json people items
// unlocked=false 时名字显示原名、介绍显示？？？、头像半透明
//--------------------------------

function renderPeoplePage(scene) {

    const peoplePage =
        safeArray(notebookPages).find(p => p && p.id === "people");

    const items = safeArray(peoplePage && peoplePage.items);

    if (safeArray(items).length === 0) {

        const empty = scene.add.text(
            250, 330,
            safeText(t(
                "notebook.peopleDataMissing",
                {},
                "（人物データなし）"
            )),
            {
                fontFamily: "serif",
                fontSize: "18px",
                color: "#7a4a1a"
            }
        ).setOrigin(0.5).setScrollFactor(0).setDepth(3002);
        notebookTexts.push(empty);
        return;

    }

    //--------------------------------
    // 页面标题
    //--------------------------------

    notebookTitleText = scene.add.text(
        150, 55,
        safeText(
            (peoplePage && peoplePage.title) ||
            t("notebook.peopleTitle", {}, "人物")
        ),
        {
            fontFamily: "serif",
            fontSize: "36px",
            color: "#5a2f0a",
            fontStyle: "bold"
        }
    ).setOrigin(0, 0).setScrollFactor(0).setDepth(3002);

    //--------------------------------
    // 人物列表：左右两列布局
    //--------------------------------

    const colCount = 2;
    const startX   = 120;
    const startY   = 150;
    const colW     = 360;
    const rowH     = 120;
    const isEnglish = currentLanguage === "en";

    safeArray(items).forEach((it, i) => {
        if (!it) return;

        const col = i % colCount;
        const row = Math.floor(i / colCount);
        const x   = startX + col * colW;
        const y   = startY + row * rowH;

        //--------------------------------
        // 头像
        //--------------------------------

        const portraitKey = "portrait_" + safeText(it.portrait);
        const hasPortrait =
            it.portrait && scene.textures.exists(portraitKey);

        if (hasPortrait) {

            const portrait = scene.add.image(
                x, y,
                portraitKey
            ).setOrigin(0, 0.5)
             .setScrollFactor(0)
             .setDepth(3002);

            // 等比缩放到最大 64×80
            const src = portrait.texture.getSourceImage();
            const s   = Math.min(64 / src.width, 80 / src.height, 1);
            portrait.setScale(s);

            // 未解锁 → 暗色剪影
            if (!it.unlocked) {
                portrait.setAlpha(0.25);
            }

            notebookTexts.push(portrait);

        } else {

            // 占位框
            const box = scene.add.rectangle(
                x + 32, y, 64, 80, 0x7a4a1a, 0.15
            ).setOrigin(0.5).setScrollFactor(0).setDepth(3002);
            box.setStrokeStyle(2, 0x5a2f0a, 0.6);
            notebookTexts.push(box);

        }

        //--------------------------------
        // 未解锁 → 不显示姓名和介绍
        //--------------------------------

        if (!it.unlocked) return;

        //--------------------------------
        // 姓名
        //--------------------------------

        const nameY = isEnglish ? y - 28 : y - 18;
        const nameText = scene.add.text(
            x + 80, nameY,
            safeText(
                it.name ||
                t("notebook.missingPersonName", {}, "???")
            ),
            {
                fontFamily: "serif",
                fontSize: "20px",
                color: "#3a1f0a",
                fontStyle: "bold"
            }
        ).setOrigin(0, isEnglish ? 0 : 0.5)
         .setScrollFactor(0).setDepth(3002);
        notebookTexts.push(nameText);

        //--------------------------------
        // 介绍
        // unlocked=false → ？？？
        //--------------------------------

        const descStr = it.unlocked
            ? prepareNotebookBodyText(it.text, 18)
            : "？？？";
        const legacyBodyY = y + 12;
        const bodyY = isEnglish
            ? Math.max(
                legacyBodyY + NOTEBOOK_EN_LAYOUT.peopleBodyOffsetY,
                nameY + nameText.displayHeight +
                    NOTEBOOK_EN_LAYOUT.peopleNameBodySpacing
            )
            : legacyBodyY;
        const bodyStyle = {
            fontFamily: "serif",
            fontSize: isEnglish
                ? NOTEBOOK_EN_LAYOUT.peopleBodyFontSize
                : "14px",
            color: it.unlocked ? "#5a2f0a" : "#a07a5a",
            lineSpacing: isEnglish
                ? NOTEBOOK_EN_LAYOUT.peopleBodyLineSpacing
                : 4
        };

        if (isEnglish) {
            bodyStyle.wordWrap = getEnglishNotebookWordWrap(
                col === 0
                    ? NOTEBOOK_EN_LAYOUT.peopleBodyWrapWidthLeft
                    : NOTEBOOK_EN_LAYOUT.peopleBodyWrapWidthRight
            );
        }

        const descText = scene.add.text(
            x + 80, bodyY,
            safeText(descStr),
            bodyStyle
        ).setOrigin(0, isEnglish ? 0 : 0.5)
         .setScrollFactor(0).setDepth(3002);
        notebookTexts.push(descText);

    });

}

//--------------------------------
// 渲染 しおり目录页
// 仅显示已解锁碎片的 ✓ タイトル列表
// 两列两页布局：左列1～10、右列11～20、每页最多20条
//--------------------------------

function renderFragmentsListPage(scene) {

    const unlocked = getUnlockedFragments();
    const unlockedCount = safeArray(unlocked).length;

    //--------------------------------
    // 子页合法化
    //--------------------------------

    const subPageCount =
        Math.max(1, Math.ceil(unlockedCount / FRAGMENT_ITEMS_PER_PAGE));

    if (fragmentListSubPage < 0) fragmentListSubPage = 0;
    if (fragmentListSubPage >= subPageCount) {
        fragmentListSubPage = subPageCount - 1;
    }

    //--------------------------------
    // 页面标题：しおり
    //--------------------------------

    notebookTitleText = scene.add.text(
        NOTEBOOK_LIST_START_X, 55,
        safeText(t("notebook.bookmarksTitle", {}, "しおり")),
        {
            fontFamily: "serif",
            fontSize: "36px",
            color: "#5a2f0a",
            fontStyle: "bold"
        }
    ).setOrigin(0, 0).setScrollFactor(0).setDepth(3002);

    //--------------------------------
    // 右上角子页码：1 / 2
    //--------------------------------

    const subPageIndicator = scene.add.text(
        820, 75,
        safeText(t(
            "notebook.pageIndicator",
            {
                current: fragmentListSubPage + 1,
                total: subPageCount
            },
            (fragmentListSubPage + 1) + " / " + subPageCount
        )),
        {
            fontSize: "16px",
            color: "#ffffff"
        }
    ).setOrigin(0.5, 0).setScrollFactor(0).setDepth(3002);
    notebookTexts.push(subPageIndicator);

    //--------------------------------
    // 无碎片时显示提示
    //--------------------------------

    if (unlockedCount === 0) {

        const empty = scene.add.text(
            NOTEBOOK_LIST_START_X, NOTEBOOK_LIST_START_Y + 5,
            safeText(t(
                "notebook.noRecords",
                {},
                "まだ記録がありません"
            )),
            {
                fontFamily: "serif",
                fontSize: "18px",
                color: "#a07a5a"
            }
        ).setOrigin(0, 0).setScrollFactor(0).setDepth(3002);
        notebookTexts.push(empty);
        return;

    }

    //--------------------------------
    // 列表：✓ タイトル（两列两页）
    // 左列 1～10、右列 11～20
    //--------------------------------

    const startIndex =
        fragmentListSubPage * FRAGMENT_ITEMS_PER_PAGE;

    const visibleFragments =
        unlocked.slice(startIndex, startIndex + FRAGMENT_ITEMS_PER_PAGE);

    safeArray(visibleFragments).forEach((f, localIndex) => {
        if (!f) return;

        const col = Math.floor(localIndex / FRAGMENT_COLUMN_SIZE);
        const row = localIndex % FRAGMENT_COLUMN_SIZE;

        const x = col === 0
            ? FRAGMENT_COL_LEFT_X
            : FRAGMENT_COL_RIGHT_X;

        const y = FRAGMENT_LIST_START_Y + row * FRAGMENT_LIST_SPACING;

        const itemText = scene.add.text(
            x, y,
            safeText(t(
                "notebook.fragmentListItem",
                { title: safeText(f.title || f.id) },
                "✓ " + safeText(f.title || f.id)
            )),
            {
                fontFamily: "serif",
                fontSize: "22px",
                color: "#3a1f0a",
                fontStyle: "bold"
            }
        ).setOrigin(0, 0).setScrollFactor(0).setDepth(3002);
        notebookTexts.push(itemText);

    });

}

//--------------------------------
// 渲染单个 fragment 页
// 左页放图片，右页放文字内容
// 如果 JSON 中缺少某个字段，则隐藏该字段，不显示空白
//--------------------------------

function renderFragmentPage(scene, fragment) {

    if (!scene || !fragment) return;

    //--------------------------------
    // 安全兜底：所有 fragment 字段先提取
    // 防止 null / undefined 导致 .length 等崩溃
    //--------------------------------
    const safeTitle    = safeText(fragment && (fragment.title || fragment.id));
    const fragmentText = safeText(fragment && fragment.text);
    const safeMemo     = safeText(fragment && fragment.memo);
    const safeQuote    = safeText(fragment && fragment.quote);
    const safeSpeaker  = safeText(fragment && fragment.speaker);
    const safeLocation = safeText(fragment && fragment.location);
    const safeDate     = safeText(fragment && fragment.date);
    const safeType     = safeText((fragment && fragment.type) || "investigation");
    const languageLayout =
        UI_LAYOUT_BY_LANGUAGE[currentLanguage] ||
        UI_LAYOUT_BY_LANGUAGE.ja;
    const isEnglish = currentLanguage === "en";

    //--------------------------------
    // 左页：图片
    // 仅使用 image（实际照片）
    // x = 275, y = 300
    // 最大 300×260，等比缩放
    //--------------------------------

    const imageName = safeText(fragment && fragment.image).trim();
    const imgKey = imageName
        ? "notebook_" + imageName.replace(/\.[^.]+$/, "")
        : null;

    const useKey = imgKey && scene.textures.exists(imgKey)
        ? imgKey
        : null;

    if (useKey) {

        const img = scene.add.image(
            275, 300,
            useKey
        ).setOrigin(0.5).setScrollFactor(0).setDepth(3002);

        // 等比缩放到最大 300×260
        const src   = img.texture.getSourceImage();
        const scale = Math.min(300 / src.width, 260 / src.height, 1);
        img.setScale(scale);

        notebookTexts.push(img);

    } else {

        // 没有图片 → 根据 type 显示对应缺失提示
        const noMediaText =
            safeType === "video"
                ? t("investigation.missingVideo", {}, "動画なし")
                : safeType === "audio"
                    ? t("investigation.missingAudio", {}, "音声なし")
                    : t("investigation.missingPhoto", {}, "写真なし");

        const noImg = scene.add.text(
            275, 300,
            safeText(noMediaText),
            {
                fontFamily: "serif",
                fontSize: "18px",
                color: "#a07a5a"
            }
        ).setOrigin(0.5).setScrollFactor(0).setDepth(3002);
        notebookTexts.push(noImg);

    }

    //--------------------------------
    // 右页：文字内容
    //--------------------------------

    const rightX = 520;
    let cursorY  = 150 + (
        isEnglish
            ? NOTEBOOK_EN_LAYOUT.investigationTitleOffsetY
            : 0
    );

    //--------------------------------
    // 标题
    // x = 520, y = 150, fontSize = 30
    //--------------------------------

    const titleText = scene.add.text(
        rightX, cursorY,
        safeText(safeTitle),
        {
            fontFamily: "serif",
            fontSize: "30px",
            color: "#3a1f0a",
            fontStyle: "bold"
        }
    ).setOrigin(0, 0).setScrollFactor(0).setDepth(3002);
    notebookTexts.push(titleText);

    cursorY = isEnglish
        ? titleText.y + titleText.displayHeight +
            NOTEBOOK_EN_LAYOUT.investigationTitleBodySpacing
        : 210 + languageLayout.notebookBodyOffsetY;

    //--------------------------------
    // 正文
    // x = 520, y = 210, fontSize = 22, wordWrap width = 320
    //--------------------------------

    if (fragmentText) {

        const wrappedText =
            prepareNotebookBodyText(fragmentText, 13);

        const textObj = scene.add.text(
            rightX, cursorY,
            safeText(wrappedText),
            {
                fontFamily: "serif",
                fontSize: isEnglish
                    ? NOTEBOOK_EN_LAYOUT.investigationBodyFontSize
                    : "22px",
                color: "#3a1f0a",
                wordWrap: isEnglish
                    ? getEnglishNotebookWordWrap(
                        NOTEBOOK_EN_LAYOUT.investigationBodyWrapWidth
                    )
                    : { width: 320 },
                lineSpacing: isEnglish
                    ? NOTEBOOK_EN_LAYOUT.investigationBodyLineSpacing
                    : languageLayout.notebookBodyLineSpacing
            }
        ).setOrigin(0, 0).setScrollFactor(0).setDepth(3002);
        notebookTexts.push(textObj);

        cursorY += textObj.height + 20;

    }

    //--------------------------------
    // メモ（调查备注）
    // 如果 memo 为空则隐藏
    //--------------------------------

    if (safeMemo) {

        const wrappedMemo =
            prepareNotebookBodyText(safeMemo, 13);

        const memoText = scene.add.text(
            rightX, cursorY,
            safeText(wrappedMemo),
            {
                fontFamily: "serif",
                fontSize: "18px",
                color: "#6a4f2a",
                fontStyle: "italic",
                wordWrap: isEnglish
                    ? getEnglishNotebookWordWrap(
                        NOTEBOOK_EN_LAYOUT.investigationBodyWrapWidth
                    )
                    : { width: 320 },
                lineSpacing: isEnglish
                    ? NOTEBOOK_EN_LAYOUT.investigationBodyLineSpacing
                    : 4
            }
        ).setOrigin(0, 0).setScrollFactor(0).setDepth(3002);
        notebookTexts.push(memoText);

        cursorY += memoText.height + 12;

    }

    //--------------------------------
    // 采访引用 + 说话者
    // 如果 quote 为空则整段隐藏
    //--------------------------------

    if (safeQuote) {

        const wrappedQuote =
            prepareNotebookBodyText(t(
                "notebook.quote",
                { quote: safeQuote },
                "「" + safeQuote + "」"
            ), 13);

        const quoteText = scene.add.text(
            rightX, cursorY,
            safeText(wrappedQuote),
            {
                fontFamily: "serif",
                fontSize: "18px",
                color: "#5a3f1a",
                fontStyle: "italic",
                wordWrap: isEnglish
                    ? getEnglishNotebookWordWrap(
                        NOTEBOOK_EN_LAYOUT.investigationBodyWrapWidth
                    )
                    : { width: 320 },
                lineSpacing: isEnglish
                    ? NOTEBOOK_EN_LAYOUT.investigationBodyLineSpacing
                    : 4
            }
        ).setOrigin(0, 0).setScrollFactor(0).setDepth(3002);
        notebookTexts.push(quoteText);

        cursorY += quoteText.height + 8;

        if (safeSpeaker) {

            const speakerText = scene.add.text(
                rightX + 320, cursorY,
                safeText(t(
                    "notebook.speaker",
                    { speaker: safeSpeaker },
                    "— " + safeSpeaker
                )),
                {
                    fontFamily: "serif",
                    fontSize: "14px",
                    color: "#7a5a3a"
                }
            ).setOrigin(1, 0).setScrollFactor(0).setDepth(3002);
            notebookTexts.push(speakerText);

            cursorY += 25;

        }

    }

    //--------------------------------
    // 地点
    // 如果 location 为空则隐藏
    //--------------------------------

    if (safeLocation) {

        const wrappedLoc =
            prepareNotebookBodyText(t(
                "notebook.location",
                { location: safeLocation },
                "場所：" + safeLocation
            ), 13);

        const locText = scene.add.text(
            rightX, cursorY,
            safeText(wrappedLoc),
            {
                fontFamily: "serif",
                fontSize: "16px",
                color: "#5a2f0a"
            }
        ).setOrigin(0, 0).setScrollFactor(0).setDepth(3002);
        notebookTexts.push(locText);

        cursorY += locText.height + 10;

    }

    //--------------------------------
    // 日期
    // 如果 date 为空则隐藏
    //--------------------------------

    if (safeDate) {

        const dateText = scene.add.text(
            rightX, cursorY,
            safeText(t(
                "notebook.date",
                { date: safeDate },
                "日付：" + safeDate
            )),
            {
                fontFamily: "serif",
                fontSize: "16px",
                color: "#5a2f0a"
            }
        ).setOrigin(0, 0).setScrollFactor(0).setDepth(3002);
        notebookTexts.push(dateText);

    }

}

function unlockFragment(fragmentId) {

    if (!fragmentId) return false;

    const f = safeArray(fragments).find(x => x && x.id === fragmentId);
    if (!f) {

        console.warn(
            "[Notebook] unlockFragment: 未找到 fragment id =",
            fragmentId
        );
        return false;

    }

    if (f.unlocked) {
        // 已解锁，返回 false 表示重复调查
        return false;
    }

    f.unlocked = true;

    //--------------------------------
    // 剧情触发器：检查 story.json 的 investigationTriggers
    //--------------------------------

    checkStoryTriggers(fragmentId);
    checkEndingInvestigationComplete(currentScene());

    // 同步人物页中引用了该 fragment 的 item（保留人物系统逻辑）
    safeArray(notebookPages).forEach(page => {
        safeArray(page && page.items).forEach(it => {
            if (!it) return;
            if (it.fragmentRef === fragmentId) {
                it.unlocked = true;
            }
        });
    });

    // 笔记本打开中 → 立即刷新（不论当前在哪一页）
    if (isNotebookOpen) {
        renderNotebookPage(currentScene());
    }

    //--------------------------------
    // 碎片解锁后更新线索
    //--------------------------------

    updateStoryHint(currentScene());

    return true;

}

//--------------------------------
// 调查提示：右上角弹出通知
//  - fragments.png 图标（1.5x）+ 文字
//  - playSound=true 时播放 hint.mp3
//  - 淡入 → 保持 → 淡出 → destroy
//  - 可选 durations: { fadeIn, hold, fadeOut } 自定义时间
//--------------------------------

function showInvestigationNotice(scene, message, playSound, durations) {

    if (!scene) return;

    const safeMessage = safeText(message);

    //--------------------------------
    // 销毁已有提示（防止叠加）
    //--------------------------------

    if (investigationNoticeContainer) {
        investigationNoticeContainer.destroy(true);
        investigationNoticeContainer = null;
    }

    //--------------------------------
    // 创建容器（固定在屏幕右上角）
    //--------------------------------

    investigationNoticeContainer = scene.add.container(900, 50);
    investigationNoticeContainer.setScrollFactor(0);
    investigationNoticeContainer.setDepth(5000);
    investigationNoticeContainer.setAlpha(0);

    //--------------------------------
    // 图标（放大 1.6 倍）
    //--------------------------------

    const icon = scene.add.image(0, 0, "fragment_notice");
    icon.setOrigin(0.5, 0.5);
    icon.setScale(1.6);

    //--------------------------------
    // 文字（12px，居中偏上于图标上方）
    //--------------------------------

    const txt = scene.add.text(0, -15, safeText(safeMessage), {
        fontFamily: "Noto Sans JP, sans-serif",
        fontSize: "12px",
        color: "#381f0e",
        fontStyle: "bold"
    });
    txt.setOrigin(0.5, 0.5);

    investigationNoticeContainer.add([icon, txt]);

    const noticeContainer = investigationNoticeContainer;

    //--------------------------------
    // 播放提示音效（仅首次解锁）
    //--------------------------------

    if (playSound && scene.cache.audio.exists("hint")) {
        scene.sound.play("hint", { volume: seVolume });
    }

    //--------------------------------
    // Tutorial Phase 2: 首次调查成功 → 显示 F 键确认提示（只出现一次）
    //--------------------------------

    if (playSound && !tutorialNotebookShown) {
        tutorialNotebookShown = true;
        showTutorialNotebookHint(scene);
    }

    //--------------------------------
    // 淡入（默认 200ms，可自定义）
    //--------------------------------

    const fadeInMs  = (durations && durations.fadeIn)  || 200;
    const holdMs    = (durations && durations.hold)    || 1500;
    const fadeOutMs = (durations && durations.fadeOut) || 400;

    console.log("[SOURCE CHECK]", {
        functionName: "showInvestigationNotice",
        relevantObject: noticeContainer,
        value: noticeContainer,
        type: typeof noticeContainer,
        isArray: Array.isArray(noticeContainer),
        destroyed: noticeContainer?.active === false
    });

    if (!noticeContainer || noticeContainer.active === false) return;

    scene.tweens.add({
        targets: noticeContainer,
        alpha: 1,
        duration: fadeInMs,
        ease: "Power2"
    });

    //--------------------------------
    // 保持 holdMs 后淡出（fadeOutMs）并销毁
    //--------------------------------

    scene.time.delayedCall(holdMs, () => {
        console.log("[SOURCE CHECK]", {
            functionName: "showInvestigationNotice",
            relevantObject: noticeContainer,
            value: noticeContainer,
            type: typeof noticeContainer,
            isArray: Array.isArray(noticeContainer),
            destroyed: noticeContainer?.active === false
        });

        if (!noticeContainer || noticeContainer.active === false) return;

        scene.tweens.add({
            targets: noticeContainer,
            alpha: 0,
            duration: fadeOutMs,
            ease: "Power2",
            onComplete: () => {
                if (noticeContainer && noticeContainer.active !== false) {
                    noticeContainer.destroy(true);
                }
                if (investigationNoticeContainer === noticeContainer) {
                    investigationNoticeContainer = null;
                }
            }
        });
    });

}

//--------------------------------
// 已认识 NPC 系统
// markNpcAsMet — 对话结束后标记 NPC 已认识
// hasMetNpc    — 检查玩家是否已认识该 NPC
// hasAvailableNewDialog — 检查 NPC 是否有满足条件且未播放的新节点
//--------------------------------

function markNpcAsMet(npcId) {
    if (!npcId || npcId === "npc6") return;
    metNpcIds.add(npcId);
    console.log("[Met NPCs]", Array.from(metNpcIds));
}

function hasMetNpc(npcId) {
    return metNpcIds.has(npcId);
}

function getNpcId(npc) {
    if (!npc || !npc.dialogKey) return null;
    const match = npc.dialogKey.match(/dialog_(npc[1-5])$/);
    return match ? match[1] : null;
}

function hasAvailableNewDialog(npcId) {

    if (!npcId || npcId === "npc6" || !hasMetNpc(npcId)) return false;

    const dialogKey = "dialog_" + npcId;
    const scene = currentScene();
    if (!scene || !scene.cache.json.exists(dialogKey)) return false;

    const dialogData = scene.cache.json.get(dialogKey);
    if (!dialogData || !Array.isArray(dialogData.dialogGroups)) return false;

    for (let i = 0; i < dialogData.dialogGroups.length; i++) {
        const group = dialogData.dialogGroups[i];
        if (!group) continue;

        const role = getDialogGroupRole(group);
        if (role === "first_meeting") continue;
        if (role !== "story" && group.askable !== true) continue;

        // requirements 满足
        if (!evaluateRequirements(group.requirements)) continue;

        if (group.once !== true || group.played === true) continue;

        // 找到至少一个可用的新节点
        return true;
    }

    return false;
}

//--------------------------------
// 自由探索完成检测
// 当第一环必需调查全部完成且事件未触发时
// 直接进入 Stage2，并引导玩家前往社区中心
//--------------------------------

function checkFreeExplorationComplete(scene) {

    if (triggeredStoryEvents.has("free_exploration_complete")) return;
    if (storyStage !== 1) return;

    const required = ["field", "weeding", "potato_sorting", "water_surface"];
    const allInvestigated = required.every(fragmentId => {
        const fragment = safeArray(fragments).find(
            item => item && item.id === fragmentId
        );
        return !!(fragment && fragment.unlocked);
    });
    if (!allInvestigated) return;

    triggeredStoryEvents.add("free_exploration_complete");

    const previousStage = storyStage;
    storyStage = 2;

    console.log("[Story Stage Changed By Exploration]", {
        eventId: "free_exploration_complete",
        previousStage,
        nextStage: storyStage
    });

    updateStoryHint(scene);

}

//--------------------------------
// Stage5 终幕调查
//--------------------------------

function getEndingAvailableFragmentIds() {
    if (
        storyData &&
        Array.isArray(storyData.endingAvailableFragments)
    ) {
        return storyData.endingAvailableFragments.filter(Boolean);
    }

    // 向后兼容旧数据
    return storyData && Array.isArray(storyData.endingFragments)
        ? storyData.endingFragments.filter(Boolean)
        : [];
}

function getEndingRequiredFragmentIds() {
    if (
        storyData &&
        Array.isArray(storyData.endingRequiredFragments)
    ) {
        return storyData.endingRequiredFragments.filter(Boolean);
    }

    // 向后兼容旧数据
    return storyData && Array.isArray(storyData.endingFragments)
        ? storyData.endingFragments.filter(Boolean)
        : [];
}

function isEndingFragment(fragmentId) {
    return getEndingAvailableFragmentIds().includes(fragmentId);
}

function areEndingFragmentsComplete() {
    const endingFragmentIds = getEndingRequiredFragmentIds();
    if (endingFragmentIds.length === 0) return false;
    return endingFragmentIds.every(fragmentId => {
        const fragment = safeArray(fragments).find(
            item => item && item.id === fragmentId
        );
        return !!(fragment && fragment.unlocked);
    });
}

function getEndingFragmentStatus() {
    return getEndingRequiredFragmentIds().map(fragmentId => {
        const fragment = safeArray(fragments).find(
            item => item && item.id === fragmentId
        );

        return {
            id: fragmentId,
            exists: !!fragment,
            unlocked: !!(fragment && fragment.unlocked)
        };
    });
}

function checkEndingInvestigationComplete(scene) {
    if (storyStage !== 5) return false;

    const complete = areEndingFragmentsComplete();
    console.log("[Ending Fragment Status]", {
        storyStage,
        fragments: getEndingFragmentStatus(),
        complete
    });

    if (!complete) return false;
    if (!triggeredStoryEvents.has("ending_investigation_complete")) {
        triggeredStoryEvents.add("ending_investigation_complete");
        console.log("[Ending Investigation Complete]");
    }
    updateStoryHint(scene);
    return true;
}

//--------------------------------
// 启动自由探索完成后的内心独白
//--------------------------------

function startFreeExplorationMonologue(scene) {

    if (!scene || !scene.active) return;

    const monologueLines = [
        {
            speaker: "machi",
            text: t(
                "monologue.freeExplorationHungry",
                {},
                "いろいろ歩いたら、少しお腹が空いてきた。"
            )
        },
        {
            speaker: "machi",
            text: t(
                "monologue.freeExplorationAskIshizu",
                {},
                "石津さんに、この辺りで食べられるものを聞いてみよう。"
            )
        }
    ];

    isDialogOpen = true;
    isMonologuePlaying = true;
    currentDialogIndex = 0;

    const savedNpc = currentNpc;
    currentNpc = {
        x: player ? player.x : 0,
        y: player ? player.y : 0,
        dialogKey: null,
        dialogLines: monologueLines,
        personId: null
    };

    currentDialogGroup = null;

    dialogBox.setVisible(true);
    dialogText.setVisible(true);
    portraitImage.setVisible(false);

    setBGMVolume(scene, menuBgmLevel(0.20), 300);
    showDialogLine(scene);
    updateStoryHint(scene);

    player.setVelocity(0);
    player.anims.stop();

}

//--------------------------------
// 调查线索系统（屏幕正上方当前线索）
//  createStoryHintUI  — 创建固定 UI（文字 + 背景）
//  updateStoryHint    — 根据当前状态选择最高优先级线索
//  setStoryHint       — 设置临时线索（dialogGroup.setStoryHint）
//  clearStoryHint     — 清除临时线索
//--------------------------------

//--------------------------------
// 创建线索 UI（文字 + 半透明背景）
//--------------------------------

function createStoryHintUI(scene) {

    if (!scene) return;

    //--------------------------------
    // 文字（无背景）
    //--------------------------------

    storyHintText = scene.add.text(
        480, 24,
        "",
        {
            fontFamily: "Noto Sans JP, sans-serif",
            fontSize: "10px",
            color: "#ffffff",
            fontStyle: "bold",
            stroke: "#381f0e",
            strokeThickness: 4,
            align: "center",
            wordWrap: { width: 700 }
        }
    );
    storyHintText.setOrigin(0.5, 0);
    storyHintText.setScrollFactor(0);
    storyHintText.setDepth(4900);
    storyHintText.setVisible(false);

}

//--------------------------------
// 更新线索：选择当前最优先线索并显示
//  优先级：NPC新对话(200) > 临时线索 > 主线调查(100~)
//--------------------------------

function updateStoryHint(scene) {

    if (!scene) scene = currentScene();
    if (!storyHintText) {
        createStoryHintUI(scene);
        if (!storyHintText) return;
    }

    //--------------------------------
    // 隐藏条件：Notebook/对话/调查/Warp/序幕中
    //--------------------------------

    if (
        isNotebookOpen ||
        isDialogOpen ||
        isNpcMenuOpen ||
        isInvestigationOpen ||
        isWarping ||
        isProloguePlaying
    ) {
        storyHintText.setVisible(false);
        return;
    }

    //--------------------------------
    // 1. NPC 新对话线索（priority 200）
    //--------------------------------

    if (npcNewTalkIds.size > 0) {

        const firstNpcId = npcNewTalkIds.values().next().value;
        const displayName = NPC_DISPLAY_NAMES[firstNpcId] || firstNpcId;
        const hintText = t(
            "storyHints.npcWantsToTalk",
            { name: displayName },
            displayName + "が何か話したそうだ"
        );

        currentStoryHintId = "npc_talk_" + firstNpcId;
        storyHintText.setText(safeText(hintText));
        storyHintText.setVisible(true);
        return;
    }

    //--------------------------------
    // 2. 临时线索（dialogGroup.setStoryHint）
    //    检查对应的调查目标是否已完成，已完成则清除
    //--------------------------------

    if (manualStoryHint) {

        //--------------------------------
        // 如果临时线索关联的调查点已完成，清除
        //--------------------------------

        if (manualStoryHint.clearOnInvestigated) {
            const fid = manualStoryHint.clearOnInvestigated;
            const f = safeArray(fragments).find(x => x && x.id === fid);
            if (f && f.unlocked) {
                manualStoryHint = null;
            }
        }

        if (manualStoryHint) {
            currentStoryHintId = manualStoryHint.id;
            storyHintText.setText(safeText(manualStoryHint.text));
            storyHintText.setVisible(true);
            return;
        }
    }

    //--------------------------------
    // 3. 数据驱动调查线索（story_hints.json）
    //    过滤 requirements 满足的 → 取 priority 最高
    //--------------------------------

    let bestHint = null;
    let bestPriority = -1;

    safeArray(storyHintsData).forEach(hint => {
        if (!hint || !hint.id) return;
        if (!evaluateRequirements(hint.requirements)) return;
        const p = hint.priority || 0;
        if (p > bestPriority) {
            bestPriority = p;
            bestHint = hint;
        }
    });

    if (bestHint) {
        currentStoryHintId = bestHint.id;
        storyHintText.setText(safeText(bestHint.text));
        storyHintText.setVisible(true);
    } else {
        //--------------------------------
        // 无有效线索：隐藏
        //--------------------------------
        currentStoryHintId = null;
        storyHintText.setVisible(false);
    }

}

//--------------------------------
// 设置临时线索（dialogGroup.setStoryHint）
//--------------------------------

function setStoryHint(scene, hintId, text, clearOnInvestigated) {

    manualStoryHint = {
        id: hintId,
        text: text,
        clearOnInvestigated: clearOnInvestigated || null
    };

    updateStoryHint(scene);

}

//--------------------------------
// 清除临时线索
//--------------------------------

function clearStoryHint(scene) {

    manualStoryHint = null;
    updateStoryHint(scene);

}

//--------------------------------
// NPC 对话通知系统
// 调查完成后通知玩家某 NPC 有新对白
//--------------------------------

//--------------------------------
// 触发 NPC 通知：根据 story_events.json 映射
// fragmentId → notifyNpcIds → 逐条通知
//--------------------------------

function triggerNpcNotifications(scene, fragmentId) {

    if (!storyEventsData || !Array.isArray(storyEventsData.events)) return;

    for (let i = 0; i < storyEventsData.events.length; i++) {

        const evt = storyEventsData.events[i];
        if (!evt || evt.fragmentId !== fragmentId) continue;

        //--------------------------------
        // 防重复：同一个事件只通知一次
        //--------------------------------

        const eventId = fragmentId + "_notify";
        if (notifiedStoryEvents.has(eventId)) continue;
        notifiedStoryEvents.add(eventId);

        //--------------------------------
        // 逐个 NPC 加入通知队列
        // 条件：已认识 + 有可用新对话 + 非 npc6
        // 未认识的 NPC 不显示提示，但不删除其新对话节点
        //--------------------------------

        if (Array.isArray(evt.notifyNpcIds)) {
            evt.notifyNpcIds.forEach(npcId => {
                if (npcId === "npc6") return;
                if (!hasMetNpc(npcId)) return;
                if (!hasAvailableNewDialog(npcId)) return;

                queueNpcTalkNotification(scene, npcId, eventId);
                npcNewTalkIds.add(npcId);
            });
        }

        if (fragmentId === "okawa") {
            const okawa = safeArray(fragments).find(
                f => f && f.id === "okawa"
            );
            console.log("[NPC4 OKAWA CHECK]", {
                storyStage,
                okawaUnlocked: !!(okawa && okawa.unlocked),
                npc4Met: hasMetNpc("npc4"),
                npc4HasAvailableDialog: hasAvailableNewDialog("npc4"),
                npcNewTalkIds: Array.from(npcNewTalkIds)
            });
        }

        break;
    }

    //--------------------------------
    // 不在此处调用 updateStoryHint
    // 「XXが何か話したそうだ」线索在调查完毕后
    // 由 closeInvestigation 中的 updateStoryHint 显示
    //--------------------------------

}

//--------------------------------
// 将 NPC 通知加入队列
//--------------------------------

function queueNpcTalkNotification(scene, npcId, eventId) {

    const displayName = NPC_DISPLAY_NAMES[npcId] || npcId;
    const message = t(
        "storyHints.npcWantsToTalk",
        { name: displayName },
        displayName + "が何か話したそうだ"
    );

    pendingNpcTalkNotifications.push({
        message: message,
        npcId: npcId,
        eventId: eventId
    });

}

//--------------------------------
// 逐条显示 NPC 通知（每次调用显示一条）
// 每条显示约 1.8 秒后自动消失，然后显示下一条
//--------------------------------

function showNextNpcTalkNotification(scene) {

    if (!scene || pendingNpcTalkNotifications.length === 0) return;

    const notification = pendingNpcTalkNotifications.shift();
    if (!notification) return;

    //--------------------------------
    // 复用现有提示 UI 风格
    // NPC 想说话提示：7 秒（淡入 300ms + 保持 6100ms + 淡出 600ms）
    //--------------------------------

    showInvestigationNotice(scene, notification.message, false, {
        fadeIn:  300,
        hold:    6100,
        fadeOut: 600
    });

    //--------------------------------
    // 7 秒后显示下一条（如果有）
    //--------------------------------

    if (pendingNpcTalkNotifications.length > 0) {
        scene.time.delayedCall(7000, () => {
            showNextNpcTalkNotification(scene);
        });
    }

}

//--------------------------------
// Tutorial Phase 2: 「← Fキーで確認」
//  Notebook 图标右侧，5 秒淡入淡出，只出现一次
//--------------------------------

function showTutorialNotebookHint(scene) {

    if (!scene) return;

    const txt = scene.add.text(
        60, 24,
        safeText(t(
            "tutorial.confirmNotebook",
            {},
            "← Fキーで確認"
        )),
        {
            fontFamily: "Noto Sans JP, sans-serif",
            fontSize: "18px",
            color: "#ffffff",
            fontStyle: "bold",
            stroke: "#000000",
            strokeThickness: 4
        }
    )
    .setOrigin(0, 0.5)
    .setScrollFactor(0)
    .setDepth(3002)
    .setAlpha(0);

    //--------------------------------
    // 淡入（300ms）→ 5 秒后淡出（500ms）→ destroy
    //--------------------------------

    scene.tweens.add({
        targets: txt,
        alpha: 1,
        duration: 300,
        ease: "Power2"
    });

    scene.time.delayedCall(5000, () => {
        scene.tweens.add({
            targets: txt,
            alpha: 0,
            duration: 500,
            ease: "Power2",
            onComplete: () => {
                txt.destroy();
            }
        });
    });

}

//--------------------------------
// Tutorial Phase 3: 「← → ページ移動」
//  Notebook 顶部居中，5 秒淡入淡出，只出现一次
//--------------------------------

function showTutorialPageHint(scene) {

    if (!scene) return;

    const txt = scene.add.text(
        480, 60 + NOTEBOOK_TUTORIAL_HINT_OFFSET_Y,
        safeText(t(
            "tutorial.moveNotebookPage",
            {},
            "← →  ページ移動"
        )),
        {
            fontFamily: "Noto Sans JP, sans-serif",
            fontSize: "18px",
            color: "#ffffff",
            fontStyle: "bold",
            stroke: "#000000",
            strokeThickness: 4
        }
    )
    .setOrigin(0.5, 0.5)
    .setScrollFactor(0)
    .setDepth(3002)
    .setAlpha(0);

    //--------------------------------
    // 淡入（300ms）→ 5 秒后淡出（500ms）→ destroy
    //--------------------------------

    scene.tweens.add({
        targets: txt,
        alpha: 1,
        duration: 300,
        ease: "Power2"
    });

    scene.time.delayedCall(5000, () => {
        scene.tweens.add({
            targets: txt,
            alpha: 0,
            duration: 500,
            ease: "Power2",
            onComplete: () => {
                txt.destroy();
            }
        });
    });

}

//--------------------------------
// 解锁人物（NPC 第一次对话时调用）
// personId 对应 notebook.json pages[].items[].id
// 优先取 Tiled "person" 属性，没有则回退到 "dialog" 属性
//--------------------------------

function unlockPerson(personId, scene) {

    if (!personId) return false;

    //--------------------------------
    // 找到 id === "people" 的页面
    //--------------------------------

    const peoplePage =
        safeArray(notebookPages).find(p => p && p.id === "people");

    if (!peoplePage || !Array.isArray(peoplePage.items)) {
        console.warn(
            "[Notebook] unlockPerson: 未找到 people 页面"
        );
        return false;
    }

    //--------------------------------
    // 在 people 页 items 中找 id 匹配的 item
    //--------------------------------

    const item =
        safeArray(peoplePage.items).find(it => it && it.id === personId);

    if (!item) {
        console.warn(
            "[Notebook] unlockPerson: 未找到 person id =",
            personId
        );
        return false;
    }

    //--------------------------------
    // 已解锁 → 跳过（确保只第一次对话执行）
    //--------------------------------

    if (item.unlocked) {
        return true;
    }

    item.unlocked = true;

    //--------------------------------
    // 笔记本打开中 → 立即刷新
    //--------------------------------

    if (isNotebookOpen && scene) {
        renderNotebookPage(scene);
    }

    return true;

}

// 辅助：取得当前 scene（用于 unlockFragment 在 update 外被调用时）
function currentScene() {
    // player 在场景创建时由 create() 注入到全局，
    // player.scene 是当前 scene 实例
    return player ? player.scene : null;
}

//--------------------------------
// Ending System
//--------------------------------

function hideGameplayUI(scene) {
    if (!scene) return;

    if (player) {
        player.setVelocity(0);
        player.anims.stop();
        player.setVisible(false);
    }
    if (npcGroup) {
        safeArray(npcGroup.getChildren()).forEach(npc => npc.setVisible(false));
    }

    isNotebookOpen = false;
    isDialogOpen = false;
    isNpcMenuOpen = false;
    isInvestigationOpen = false;
    hideDialogContinuePrompt(scene);
    destroyDialogContinuePrompt(scene, authorEndingContinuePrompt);
    authorEndingContinuePrompt = null;

    const uiObjects = [
        notebookClosedIcon, notebookOpenImage, tutorialFKeyHint,
        storyHintText, interactPrompt, dialogBox, dialogText,
        dialogNameText, dialogNameBackground, portraitImage,
        invOverlay, invImage, invVideo, invTitle, invText
    ];
    safeArray(uiObjects).forEach(object => {
        if (object && object.setVisible) object.setVisible(false);
    });
    safeArray(notebookTexts).forEach(object => {
        if (object && object.setVisible) object.setVisible(false);
    });
    safeArray(moveTutorialTexts).forEach(object => {
        if (object && object.setVisible) object.setVisible(false);
    });
    if (investigationNoticeContainer) {
        investigationNoticeContainer.destroy(true);
        investigationNoticeContainer = null;
    }
    closeNpcMenu(scene, false);
    scene.physics.pause();
}

function showEndingCG(scene) {
    if (!scene || isEndingPlaying) return;

    isEndingPlaying = true;
    hideGameplayUI(scene);
    setBGMVolume(scene, 0, 600);

    scene.cameras.main.fadeOut(600, 0, 0, 0);
    scene.cameras.main.once("camerafadeoutcomplete", () => {
        scene.cameras.main.resetFX();
        endingCGImage = scene.add.image(480, 320, "ending_cg")
            .setOrigin(0.5)
            .setScrollFactor(0)
            .setDepth(10000)
            .setDisplaySize(960, 640);

        const configuredDuration = Number(
            storyData && storyData.endingCG && storyData.endingCG.duration
        );
        const duration = Math.max(5000,
            Number.isFinite(configuredDuration) ? configuredDuration : 5000);
        scene.time.delayedCall(duration, () => scene.playEndingNarration());
    });
}

function showEndingNarration(scene) {
    if (!scene || endingNarrationOverlay) return;

    endingNarrationOverlay = scene.add.text(480, 550, "", {
        fontFamily: "Noto Sans JP, sans-serif",
        fontSize: "28px",
        color: "#ffffff",
        align: "center",
        wordWrap: { width: 760 }
    }).setOrigin(0.5).setScrollFactor(0).setDepth(10010);

    endingNarrationLines = [
        t(
            "ending.narrationWaterMemory",
            {},
            "針江の水は、幾千の風景を熬り、一筋の記憶とした。\n（针江的流水，将万千风景熬成回忆。）"
        ),
        t(
            "ending.narrationFallenPetals",
            {},
            "花びらは土に還り、根を養い、来る年にはまた新たな花を咲かせる。\n（落英入土，滋养根系，来年还会开出新的花。）"
        ),
        t(
            "ending.narrationRiversReturn",
            {},
            "百川海に入り、逝く者は斯くの如し。\nされど、なお雲を積みて雨となり、山川に還る。\n（百川入海，逝者如斯，仍能积云成雨，回反山川。）"
        ),
        t(
            "ending.narrationTwelveDegreeWater",
            {},
            "あの十二度の水は、冷たさの中に温もりを隠し、\n（那十二度的水，在冰冷中藏着温热，）"
        ),
        t(
            "ending.narrationTravelers",
            {},
            "去りゆく者の背中を押し、帰り来る者の喉を潤す。\n（推着远行人的背，润着归来人的喉。）"
        ),
        t(
            "ending.narrationWaterKeepsAsking",
            {},
            "村は空になろうとも、水は問い続ける——\n（纵使村庄成空，水仍会反复叩问——）"
        ),
        t(
            "ending.narrationWhereToReturn",
            {},
            "「お前は、どこで生き、どこに還りたいのか。」\n（“你，要在哪里活着，又想回到哪里去。”）"
        ),
        t(
            "ending.narrationEternalHome",
            {},
            "水音が絶えぬ限り、この地は永遠に、誰かの故郷であり続ける。\n（只要水声未绝，这片土地，便永远是某个人的归处。）"
        )
    ];
    endingNarrationIndex = 0;
    isEndingNarrationPlaying = true;
    advanceEndingNarration(scene);
}

function advanceEndingNarration(scene) {
    if (
        !scene ||
        !isEndingNarrationPlaying ||
        isEndingNarrationTransitioning
    ) return;

    isEndingNarrationTransitioning = true;
    destroyDialogContinuePrompt(scene, endingNarrationContinuePrompt);
    endingNarrationContinuePrompt = null;
    scene.tweens.killTweensOf(endingNarrationOverlay);

    if (endingNarrationIndex > 0) {
        scene.tweens.add({
            targets: endingNarrationOverlay,
            alpha: 0,
            duration: ENDING_NARRATION_FADE_OUT,
            ease: "Linear",
            onComplete: () => showNextEndingNarrationLine(scene)
        });
        return;
    }

    showNextEndingNarrationLine(scene);
}

function showNextEndingNarrationLine(scene) {
    if (!scene || !isEndingNarrationPlaying) return;

    if (endingNarrationIndex >= endingNarrationLines.length) {
        isEndingNarrationPlaying = false;
        isEndingNarrationTransitioning = false;
        finishGame(scene);
        return;
    }

    const index = endingNarrationIndex;
    const text = safeText(endingNarrationLines[endingNarrationIndex++]);

    console.log("[ENDING NARRATION LINE]", {
        index,
        text
    });

    endingNarrationOverlay.setText(text).setAlpha(0);
    scene.tweens.add({
        targets: endingNarrationOverlay,
        alpha: 1,
        duration: ENDING_NARRATION_FADE_IN,
        ease: "Linear",
        onComplete: () => {
            isEndingNarrationTransitioning = false;
            endingNarrationContinuePrompt = createDialogContinuePrompt(
                scene,
                10020,
                { x: 978, y: 592 }
            );
        }
    });
}

function finishGame(scene) {
    if (!scene) return;
    if (!endingNarrationOverlay) {
        endingNarrationOverlay = scene.add.text(480, 320, "", {
            fontFamily: "Noto Sans JP, sans-serif",
            fontSize: "28px",
            color: "#ffffff",
            align: "center"
        }).setOrigin(0.5).setScrollFactor(0).setDepth(10010);
    }

    endingNarrationOverlay
        .setAlpha(1)
        .setText(t(
            "ending.investigationComplete",
            {},
            "------ 針江、調査完了 ------"
        ));
    scene.time.delayedCall(2000, () => {
        endingNarrationOverlay.setText(t(
            "ending.thanksForPlaying",
            {},
            "Thanks for playing."
        ));
        scene.time.delayedCall(3000, () => {
            showAuthorEndingPrompt(scene);
        });
    });
}

function showAuthorEndingPrompt(scene) {
    if (!scene || isAuthorEndingPromptVisible || isAuthorEndingPlaying) return;

    isAuthorEndingPromptVisible = true;
    authorEndingPrompt = scene.add.text(
        480,
        600,
        t(
            "ending.authorCommentPrompt",
            {},
            "E：作者コメントへ"
        ),
        {
        fontFamily: "Noto Sans JP, sans-serif",
        fontSize: "20px",
        color: "#ffffff"
        }
    ).setOrigin(0.5).setScrollFactor(0).setDepth(10020);
}

function startAuthorEnding(scene) {
    if (!scene || isAuthorEndingPlaying) return;

    isAuthorEndingPromptVisible = false;
    isAuthorEndingPlaying = true;
    if (authorEndingPrompt) {
        authorEndingPrompt.destroy();
        authorEndingPrompt = null;
    }
    if (endingNarrationOverlay) endingNarrationOverlay.setVisible(false);

    const data = scene.cache.json.get("endingAuthorData");
    authorDialogLines = Array.isArray(data) && data.length > 0
        ? safeArray(data)
        : [{
            speaker: "ziqi",
            text: t(
                "ending.authorCommentFallback",
                {},
                "作者コメントはまだ準備中です。"
            )
        }];
    authorDialogIndex = 0;

    authorEndingOverlay = scene.add.rectangle(
        480, 320, 960, 640, 0x000000, 1
    ).setScrollFactor(0).setDepth(10100);

    if (scene.textures.exists("author_ziqi")) {
        scene.textures.get("author_ziqi").setFilter(
            Phaser.Textures.FilterMode.LINEAR
        );
        authorEndingPortrait = scene.add.image(480, 535, "author_ziqi")
            .setOrigin(0.5, 1)
            .setScrollFactor(0)
            .setDepth(10110)
            .setAlpha(0);
        const sourceHeight = authorEndingPortrait.height || 480;
        authorEndingPortrait.setScale(480 / sourceHeight);
        scene.tweens.add({
            targets: authorEndingPortrait,
            alpha: 1,
            duration: 1800,
            ease: "Linear"
        });
    }

    authorEndingDialogBox = scene.add.rectangle(
        480, 560, 900, 120, 0x000000, 0.82
    ).setScrollFactor(0).setDepth(10120);
    authorEndingDialogText = scene.add.text(160, 520, "", {
        fontFamily: "Noto Sans JP, sans-serif",
        fontSize: "24px",
        color: "#ffffff",
        wordWrap: { width: 760 }
    }).setScrollFactor(0).setDepth(10122);
    authorEndingNameBackground = scene.add.rectangle(
        170, 478, 180, 34, 0x381f0e, 0.85
    ).setScrollFactor(0).setDepth(10121);
    authorEndingNameText = scene.add.text(170, 470, AUTHOR_DISPLAY_NAME, {
        fontFamily: "Noto Sans JP, sans-serif",
        fontSize: "22px",
        color: "#ffffff",
        fontStyle: "bold",
        stroke: "#381f0e",
        strokeThickness: 4,
        align: "center"
    }).setOrigin(0.5, 0).setScrollFactor(0).setDepth(10122);
    authorEndingContinuePrompt =
        createDialogContinuePrompt(
            scene,
            10123,
            authorEndingDialogText
        );

    showAuthorEndingLine();
}

function showAuthorEndingLine() {
    if (!authorEndingDialogText) return;
    const line = authorDialogLines[authorDialogIndex];
    authorEndingDialogText.setText(safeText(line && line.text));
    if (authorEndingNameText) {
        authorEndingNameText.setText(AUTHOR_DISPLAY_NAME);
    }
}

function advanceAuthorEnding(scene) {
    if (!scene || !isAuthorEndingPlaying) return;

    authorDialogIndex++;
    if (authorDialogIndex < authorDialogLines.length) {
        showAuthorEndingLine();
        return;
    }

    isAuthorEndingPlaying = false;
    destroyDialogContinuePrompt(scene, authorEndingContinuePrompt);
    authorEndingContinuePrompt = null;
    safeArray([
        authorEndingPortrait,
        authorEndingDialogBox,
        authorEndingDialogText,
        authorEndingNameBackground,
        authorEndingNameText
    ]).forEach(object => {
        if (object && object.destroy) object.destroy();
    });
    authorEndingPortrait = null;
    authorEndingDialogBox = null;
    authorEndingDialogText = null;
    authorEndingNameBackground = null;
    authorEndingNameText = null;

    scene.add.text(480, 320, SPECIAL_THANKS_TEXT, {
        fontFamily: "Noto Sans JP, sans-serif",
        fontSize: "28px",
        color: "#ffffff",
        align: "center",
        lineSpacing: 10
    }).setOrigin(0.5).setScrollFactor(0).setDepth(10130);
}

//--------------------------------
// Warp: 切换地图
//  x, y 是目标地图的原始坐标（未缩放），
//  需要乘以目标地图的 mapScale
//--------------------------------

function warpToMap(scene, targetMap, x, y) {

    if (isWarping) return;

    if (!MAPS[targetMap]) {

        console.error(
            "[Warp] 未知地图:",
            targetMap
        );

        return;

    }

    // 目标地图的缩放比
    const targetScale =
        (MAPS[targetMap] && MAPS[targetMap].mapScale) || 1;

    const finalX = x * targetScale;
    const finalY = y * targetScale;

    isWarping = true;

    interactPrompt.setVisible(false);

    //--------------------------------
    // 隐藏调查线索 UI（Warp 过程中）
    //--------------------------------

    if (storyHintText) storyHintText.setVisible(false);

    if (fieldSound && fieldSound.isPlaying) {
        fieldSound.stop();
    }

    // 切换地图时停止所有环境音
    safeArray(Object.values(ambientSounds)).forEach(sound => {
        if (sound && sound.isPlaying) {
            sound.stop();
        }
    });

    // 切换地图时停止正在播放的视频同步音频
    if (invAudio) {
        invAudio.stop();
        invAudio.destroy();
        invAudio = null;
    }

    // 切换地图时销毁正在播放的视频对象
    if (invVideo) {
        invVideo.stop();
        invVideo.destroy();
        invVideo = null;
    }

    // 关闭调查展示 UI
    isInvestigationOpen = false;
    if (invOverlay) invOverlay.setVisible(false);
    if (invImage) invImage.setVisible(false);
    if (invTitle) invTitle.setVisible(false);
    if (invText) invText.setVisible(false);

    //--------------------------------
    // BGM 混音：Warp 切换中 → 0.20
    //--------------------------------

    setBGMVolume(scene, menuBgmLevel(0.20), 200);

    //--------------------------------
    // 淡出 → restart → 淡入
    //--------------------------------

    scene.cameras.main.fadeOut(
        300, 0, 0, 0
    );

    scene.cameras.main.once(
        "camerafadeoutcomplete",
        () => {

            scene.scene.restart({
                mapKey: targetMap,
                startX: finalX,
                startY: finalY
            });

        }
    );

}

//--------------------------------
// 移动引导（Move Tutorial）
//  createMoveTutorial         — 创建 ↑ ← ↓ → 箭头围绕玩家
//  updateMoveTutorialPosition — 每帧跟随玩家位置
//  hideMoveTutorial           — 首次移动后 1000ms 淡出并销毁
//--------------------------------

function createMoveTutorial(scene) {

    if (!scene || !player) return;

    //--------------------------------
    // 清理已有箭头
    //--------------------------------

    safeArray(moveTutorialTexts).forEach(t => t.destroy());
    moveTutorialTexts = [];

    const style = {
        fontFamily: "Noto Sans JP, sans-serif",
        fontSize: "28px",
        color: "#ffffff",
        fontStyle: "bold",
        stroke: "#381f0e",
        strokeThickness: 4
    };

    //--------------------------------
    // 四个方向箭头（围绕玩家，世界坐标）
    //  上: player.x,      player.y - 48
    //  左: player.x - 48, player.y
    //  下: player.x,      player.y + 48
    //  右: player.x + 48, player.y
    //--------------------------------

    const arrows = [
        { text: t("tutorial.moveUp", {}, "\u2191"), dx:   0, dy: -48 },  // ↑
        { text: t("tutorial.moveLeft", {}, "\u2190"), dx: -48, dy:   0 },  // ←
        { text: t("tutorial.moveDown", {}, "\u2193"), dx:   0, dy:  48 },  // ↓
        { text: t("tutorial.moveRight", {}, "\u2192"), dx:  48, dy:   0 }   // →
    ];

    safeArray(arrows).forEach(a => {
        const txt = scene.add.text(
            player.x + a.dx,
            player.y + a.dy,
            safeText(a.text),
            style
        )
        .setOrigin(0.5, 0.5)
        .setDepth(5000)
        .setAlpha(1);

        moveTutorialTexts.push(txt);
    });
}

//--------------------------------
// 移动引导：更新箭头位置（跟随玩家）
//--------------------------------

function updateMoveTutorialPosition() {

    if (!player || safeArray(moveTutorialTexts).length === 0) return;

    const offsets = [
        { dx:   0, dy: -48 },  // ↑
        { dx: -48, dy:   0 },  // ←
        { dx:   0, dy:  48 },  // ↓
        { dx:  48, dy:   0 }   // →
    ];

    for (let i = 0; i < safeArray(moveTutorialTexts).length; i++) {
        const t = moveTutorialTexts[i];
        const o = offsets[i];
        if (t && o) {
            t.setPosition(
                player.x + o.dx,
                player.y + o.dy
            );
        }
    }

}

//--------------------------------
// 移动引导：淡出并销毁（首次移动后触发）
//  alpha 1 → 0, 持续 1000ms, 然后 destroy
//--------------------------------

function hideMoveTutorial(scene) {

    if (!scene) return;

    tutorialMoveDone = true;

    safeArray(moveTutorialTexts).forEach(t => {
        scene.tweens.add({
            targets: t,
            alpha: 0,
            duration: 1000,
            ease: "Power2",
            onComplete: () => {
                t.destroy();
            }
        });
    });

    //--------------------------------
    // 淡出完成后清空池
    //--------------------------------

    scene.time.delayedCall(1100, () => {
        moveTutorialTexts = [];
    });

}

//--------------------------------
// BGM 停止函数（供未来 Ending / CG 使用）
//  停止 Intro + Loop，标记已结束
//--------------------------------

function stopBGM() {

    if (bgmIntro && bgmIntro.isPlaying) {
        bgmIntro.stop();
    }

    if (bgmLoop && bgmLoop.isPlaying) {
        bgmLoop.stop();
    }

    bgmStarted = false;

}

//--------------------------------
// BGM 动态混音：平滑改变 BGM 音量
//  - 同时调整 bgmLoop 和 bgmIntro
//  - 停止旧的 bgmVolumeTween 防止堆叠
//  - 更新 currentBgmVolume 记录当前目标值
//--------------------------------

function setBGMVolume(scene, targetVolume, duration) {

    if (!scene) return;

    if (duration === undefined) duration = 300;

    //--------------------------------
    // 停止旧的 tween（防止堆叠）
    //--------------------------------

    if (bgmVolumeTween) {
        bgmVolumeTween.stop();
        bgmVolumeTween = null;
    }

    currentBgmVolume = targetVolume;

    //--------------------------------
    // 收集需要调整的目标
    //--------------------------------

    const targets = [];

    if (bgmLoop && bgmLoop.isPlaying) {
        targets.push(bgmLoop);
    }

    if (bgmIntro && bgmIntro.isPlaying) {
        targets.push(bgmIntro);
    }

    if (safeArray(targets).length === 0) return;

    //--------------------------------
    // 创建新的 tween
    //--------------------------------

    bgmVolumeTween = scene.tweens.add({
        targets: targets,
        volume: targetVolume,
        duration: duration,
        ease: "Power2",
        onComplete: () => {
            bgmVolumeTween = null;
        }
    });

}

//--------------------------------
// BGM 淡出并停止（供未来 Ending / 最终CG 使用）
//  音量从当前值淡出到 0，完成后 stop
//--------------------------------

function fadeOutBGM(scene, duration) {

    if (!scene) return;

    if (duration === undefined) duration = 1500;

    //--------------------------------
    // 停止旧的音量 tween
    //--------------------------------

    if (bgmVolumeTween) {
        bgmVolumeTween.stop();
        bgmVolumeTween = null;
    }

    const targets = [];

    if (bgmIntro && bgmIntro.isPlaying) {
        targets.push(bgmIntro);
    }

    if (bgmLoop && bgmLoop.isPlaying) {
        targets.push(bgmLoop);
    }

    if (safeArray(targets).length === 0) return;

    currentBgmVolume = 0;

    scene.tweens.add({
        targets: targets,
        volume: 0,
        duration: duration,
        ease: "Power2",
        onComplete: () => {

            if (bgmIntro && bgmIntro.isPlaying) {
                bgmIntro.stop();
            }

            if (bgmLoop && bgmLoop.isPlaying) {
                bgmLoop.stop();
            }

            bgmStarted = false;
            bgmVolumeTween = null;
        }
    });

}

function debugFunctionEntry(functionName, context) {
    if (functionName === "updateSoundAreas") {
        if (!debugFunctionEntry.lastSoundLogAt) {
            debugFunctionEntry.lastSoundLogAt = 0;
        }
        const now = Date.now();
        if (now - debugFunctionEntry.lastSoundLogAt < 1000) {
            return;
        }
        debugFunctionEntry.lastSoundLogAt = now;
    }

    console.log("[FUNCTION ENTER] " + JSON.stringify(getRuntimeDebugContext({
        functionName: functionName,
        fragmentId: context && context.fragmentId,
        pageId: context && context.pageId,
        mediaKey: context && context.mediaKey,
        title: context && context.title,
        text: context && context.text
    })));
}

function debugWrapFunction(functionName, fn, contextFactory) {
    return function () {
        const context = contextFactory
            ? contextFactory.apply(this, arguments)
            : {};

        debugFunctionEntry(functionName, context);

        try {
            return fn.apply(this, arguments);
        } catch (error) {
            console.error("[FUNCTION ERROR]", functionName, error, error && error.stack);
            throw error;
        }
    };
}

function getFragmentDebugMediaKey(fragment) {
    if (!fragment) return "";
    return safeText(
        getFragmentMediaKey(fragment) ||
        fragment.image ||
        fragment.video ||
        fragment.audio
    );
}

function installFunctionDebugWrappers() {
    startDialog = debugWrapFunction(
        "startDialog",
        startDialog,
        function () {
            return {
                fragmentId: currentNpc && currentNpc.fragmentId,
                pageId: currentNpc && currentNpc.dialogKey,
                title: currentNpc && currentNpc.personId,
                text: currentNpc && currentNpc.dialogKey
            };
        }
    );

    showDialogLine = debugWrapFunction(
        "showDialogLine",
        showDialogLine,
        function () {
            const dialogLines = currentNpc ? safeArray(currentNpc.dialogLines) : [];
            const line = dialogLines[currentDialogIndex] || {};
            return {
                pageId: currentDialogIndex,
                title: line.speaker,
                text: line.text
            };
        }
    );

    handleInvestigation = debugWrapFunction(
        "handleInvestigation",
        handleInvestigation,
        function (scene, inv) {
            const fragmentId = inv && inv.fragmentId;
            const fragment = safeArray(fragments).find(f => f && f.id === fragmentId);
            return {
                fragmentId: fragmentId,
                mediaKey: getFragmentDebugMediaKey(fragment),
                title: fragment ? fragment.title : inv && (inv.invTitle || inv.invName),
                text: fragment ? fragment.text : inv && inv.invText
            };
        }
    );

    playVideoAudio = debugWrapFunction(
        "playVideoAudio",
        playVideoAudio,
        function (scene, mediaKey) {
            return {
                mediaKey: mediaKey
            };
        }
    );

    closeInvestigation = debugWrapFunction(
        "closeInvestigation",
        closeInvestigation,
        function () {
            return {
                mediaKey: invVideo && invVideo.key,
                title: invTitle && invTitle.text,
                text: invText && invText.text
            };
        }
    );

    openNotebook = debugWrapFunction(
        "openNotebook",
        openNotebook,
        function () {
            return {
                pageId: notebookPageIndex
            };
        }
    );

    renderNotebookPage = debugWrapFunction(
        "renderNotebookPage",
        renderNotebookPage,
        function () {
            return {
                pageId: notebookPageIndex
            };
        }
    );

    renderPeoplePage = debugWrapFunction(
        "renderPeoplePage",
        renderPeoplePage,
        function () {
            const peoplePage = safeArray(notebookPages).find(p => p && p.id === "people");
            return {
                pageId: "people",
                title: peoplePage && peoplePage.title
            };
        }
    );

    renderFragmentsListPage = debugWrapFunction(
        "renderFragmentsListPage",
        renderFragmentsListPage,
        function () {
            return {
                pageId: "fragments",
                title: "しおり"
            };
        }
    );

    renderFragmentPage = debugWrapFunction(
        "renderFragmentPage",
        renderFragmentPage,
        function (scene, fragment) {
            return {
                fragmentId: fragment && fragment.id,
                pageId: notebookPageIndex,
                mediaKey: getFragmentDebugMediaKey(fragment),
                title: fragment && fragment.title,
                text: fragment && fragment.text
            };
        }
    );

    updateSoundAreas = debugWrapFunction(
        "updateSoundAreas",
        updateSoundAreas,
        function () {
            return {
                mediaKey: safeArray(Object.keys(ambientSounds)).join(",")
            };
        }
    );
}

installFunctionDebugWrappers();

new Phaser.Game(config);
