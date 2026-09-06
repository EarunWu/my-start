const DATA_VERSION = 4;
const MAX_SITES_PER_GROUP = 15;
const MAX_BACKGROUND_IMAGE_BYTES = 3 * 1024 * 1024;
const STORAGE_KEY = "my-start-config-v1";
const NAVIGATION_PRESET_ID = "personal-a-v1";
const ASSET_DB_NAME = "my-start-assets-v1";
const ASSET_STORE_NAME = "assets";
const BACKGROUND_ASSET_KEY = "background-image";
const ICON_CACHE_PREFIX = "site-icon:";
const ICON_CACHE_TTL_MS = 30 * 24 * 60 * 60 * 1000;
const FAVICON_SERVICE_TEMPLATE = "https://www.google.com/s2/favicons?domain={domain}&sz=64";
const BACKGROUND_TYPES = new Set(["white", "black", "image"]);
const DEFAULT_BACKGROUND_SETTINGS = {
  type: "white",
  image: "",
  imageKey: "",
};

const SEARCH_ENGINES = [
  {
    id: "google",
    name: "Google",
    mark: "G",
    icon: "https://www.google.com/favicon.ico",
    searchUrlTemplate: "https://www.google.com/search?q={query}",
    imageSearch: {
      urlTemplate: "https://lens.google.com/uploadbyurl?url={url}",
      uploadUrl: "https://lens.google.com/v3/upload",
      uploadField: "encoded_image",
      directFileUpload: true,
      label: "Google Lens",
    },
  },
  {
    id: "bing",
    name: "Bing",
    mark: "B",
    icon: "https://www.bing.com/favicon.ico",
    searchUrlTemplate: "https://www.bing.com/search?q={query}",
    imageSearch: {
      urlTemplate:
        "https://www.bing.com/images/search?view=detailv2&iss=SBI&form=SBIIRP&q=imgurl:{url}&mediaurl={url}&vsimg={url}",
      landingUrl: "https://www.bing.com/images?FORM=vissbi",
      label: "Bing Visual Search",
    },
  },
  {
    id: "baidu",
    name: "Baidu",
    mark: "百",
    icon: "https://www.baidu.com/favicon.ico",
    searchUrlTemplate: "https://www.baidu.com/s?wd={query}",
    imageSearch: {
      landingUrl: "https://graph.baidu.com/pcpage/index?tpl_from=pc",
      label: "百度识图",
    },
  },
  {
    id: "grok",
    name: "Grok",
    mark: "G",
    icon: "https://upload.wikimedia.org/wikipedia/commons/f/f9/Grok-icon.svg",
    searchUrlTemplate: "https://grok.com/?q={query}",
    opensConversation: true,
    imageSearch: {
      landingUrl: "https://grok.com/",
      label: "Grok",
      unsupportedMessage: "Grok 暂不支持从起始页直接拖图创建对话，请在 Grok 页面上传图片。",
    },
  },
  {
    id: "chatgpt",
    name: "ChatGPT",
    mark: "C",
    icon: "https://chatgpt.com/favicon.ico",
    searchUrlTemplate: "https://chatgpt.com/?hints=search&q={query}",
    opensConversation: true,
    imageSearch: {
      landingUrl: "https://chatgpt.com/",
      label: "ChatGPT",
      unsupportedMessage: "ChatGPT 暂不支持从起始页直接拖图创建对话，请在 ChatGPT 页面上传图片。",
    },
  },
];

function createId(prefix) {
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

function nowIso() {
  return new Date().toISOString();
}

function createDefaultData() {
  const groups = [
    { id: "group-a", name: "A" },
    { id: "group-dev", name: "开发" },
    { id: "group-ai", name: "AI" },
    { id: "group-study", name: "学习" },
    { id: "group-tools", name: "工具" },
    { id: "group-fun", name: "娱乐" },
    { id: "group-temp", name: "临时" },
  ];

  const site = (groupId, id, name, url, icon = "") => ({
    id: `site-${id}`,
    groupId,
    name,
    url,
    icon: icon || getFaviconUrl(url),
  });

  const sites = [
    site("group-a", "github", "GitHub", "https://github.com", "https://github.com/favicon.ico"),
    site("group-a", "linuxdo", "Linux.do", "https://linux.do"),
    site("group-a", "zhihu", "知乎", "https://www.zhihu.com"),
    site("group-a", "gemini", "Gemini", "https://gemini.google.com"),
    site("group-a", "chatgpt", "ChatGPT", "https://chatgpt.com", "https://chatgpt.com/favicon.ico"),
    site("group-a", "bilibili", "哔哩哔哩", "https://www.bilibili.com"),
    site("group-a", "x", "推特", "https://x.com"),
    site("group-a", "youtube", "YouTube", "https://www.youtube.com", "https://www.youtube.com/favicon.ico"),

    site("group-dev", "mdn", "MDN", "https://developer.mozilla.org"),
    site("group-dev", "stackoverflow", "Stack Overflow", "https://stackoverflow.com"),
    site("group-dev", "vercel", "Vercel", "https://vercel.com", "https://vercel.com/favicon.ico"),
    site("group-dev", "cloudflare", "Cloudflare", "https://dash.cloudflare.com"),
    site("group-dev", "npm", "npm", "https://www.npmjs.com"),
    site("group-dev", "docker", "Docker Hub", "https://hub.docker.com"),
    site("group-dev", "gitlab", "GitLab", "https://gitlab.com"),
    site("group-dev", "regex101", "Regex101", "https://regex101.com"),

    site("group-ai", "claude", "Claude", "https://claude.ai", "https://claude.ai/favicon.ico"),
    site("group-ai", "perplexity", "Perplexity", "https://www.perplexity.ai"),
    site("group-ai", "poe", "Poe", "https://poe.com"),
    site("group-ai", "huggingface", "Hugging Face", "https://huggingface.co"),
    site("group-ai", "openrouter", "OpenRouter", "https://openrouter.ai"),
    site("group-ai", "grok", "Grok", "https://grok.com"),
    site("group-ai", "replicate", "Replicate", "https://replicate.com"),

    site("group-study", "wikipedia", "Wikipedia", "https://www.wikipedia.org"),
    site("group-study", "leetcode", "LeetCode", "https://leetcode.cn"),
    site("group-study", "runoob", "菜鸟教程", "https://www.runoob.com"),
    site("group-study", "coursera", "Coursera", "https://www.coursera.org"),
    site("group-study", "edx", "edX", "https://www.edx.org"),
    site("group-study", "khan", "Khan Academy", "https://www.khanacademy.org"),
    site("group-study", "duolingo", "Duolingo", "https://www.duolingo.com"),

    site("group-tools", "gmail", "Gmail", "https://mail.google.com", "https://mail.google.com/favicon.ico"),
    site("group-tools", "drive", "Drive", "https://drive.google.com", "https://ssl.gstatic.com/images/branding/product/1x/drive_2020q4_32dp.png"),
    site("group-tools", "docs", "Docs", "https://docs.google.com", "https://ssl.gstatic.com/docs/documents/images/kix-favicon7.ico"),
    site("group-tools", "calendar", "Calendar", "https://calendar.google.com", "https://calendar.google.com/googlecalendar/images/favicons_2020q4/calendar_31.ico"),
    site("group-tools", "notion", "Notion", "https://www.notion.so", "https://www.notion.so/images/favicon.ico"),
    site("group-tools", "figma", "Figma", "https://www.figma.com", "https://static.figma.com/app/icon/1/favicon.png"),
    site("group-tools", "translate", "Google 翻译", "https://translate.google.com"),
    site("group-tools", "deepl", "DeepL", "https://www.deepl.com/translator"),
    site("group-tools", "tinypng", "TinyPNG", "https://tinypng.com"),

    site("group-fun", "steam", "Steam", "https://store.steampowered.com"),
    site("group-fun", "spotify", "Spotify", "https://open.spotify.com"),
    site("group-fun", "twitch", "Twitch", "https://www.twitch.tv"),
    site("group-fun", "netflix", "Netflix", "https://www.netflix.com"),
    site("group-fun", "douban", "豆瓣", "https://www.douban.com"),
    site("group-fun", "xiaohongshu", "小红书", "https://www.xiaohongshu.com"),
    site("group-fun", "netease-music", "网易云音乐", "https://music.163.com"),

    site("group-temp", "google", "Google", "https://www.google.com", "https://www.google.com/favicon.ico"),
    site("group-temp", "bing", "Bing", "https://www.bing.com", "https://www.bing.com/favicon.ico"),
    site("group-temp", "baidu", "百度", "https://www.baidu.com", "https://www.baidu.com/favicon.ico"),
    site("group-temp", "weibo", "微博", "https://weibo.com"),
    site("group-temp", "taobao", "淘宝", "https://www.taobao.com"),
    site("group-temp", "jd", "京东", "https://www.jd.com"),
  ];

  return {
    version: DATA_VERSION,
    groups,
    sites,
    widgets: [],
    settings: {
      searchEngineId: "google",
      searchEngineName: "Google",
      searchUrlTemplate: "https://www.google.com/search?q={query}",
      background: { ...DEFAULT_BACKGROUND_SETTINGS },
      navigationPresetId: NAVIGATION_PRESET_ID,
    },
    updatedAt: nowIso(),
  };
}

function cloneData(data) {
  return JSON.parse(JSON.stringify(data));
}

function normalizeText(value) {
  return String(value ?? "").trim();
}

function normalizeUrl(value) {
  const raw = normalizeText(value);
  if (!raw) {
    return "";
  }
  if (/^(https?:)?\/\//i.test(raw) || /^(mailto|tel):/i.test(raw)) {
    return raw;
  }
  return `https://${raw}`;
}

function limitSitesPerGroup(sites) {
  const counts = new Map();
  return sites.filter((site) => {
    const count = counts.get(site.groupId) || 0;
    if (count >= MAX_SITES_PER_GROUP) {
      return false;
    }
    counts.set(site.groupId, count + 1);
    return true;
  });
}

function normalizeData(input) {
  const fallback = createDefaultData();
  const source = input && typeof input === "object" ? input : fallback;

  const groups = Array.isArray(source.groups)
    ? source.groups
        .map((group) => ({
          id: normalizeText(group.id) || createId("group"),
          name: normalizeText(group.name),
        }))
        .filter((group) => group.name)
    : fallback.groups;

  const normalizedGroups = groups.length ? groups : fallback.groups;
  const groupIds = new Set(normalizedGroups.map((group) => group.id));

  const normalizedSites = Array.isArray(source.sites)
    ? source.sites
        .map((site) => ({
          id: normalizeText(site.id) || createId("site"),
          groupId: groupIds.has(site.groupId) ? site.groupId : normalizedGroups[0].id,
          name: normalizeText(site.name),
          url: normalizeUrl(site.url),
          icon: normalizeText(site.icon),
        }))
        .filter((site) => site.name && site.url)
    : fallback.sites;

  return {
    version: DATA_VERSION,
    groups: normalizedGroups,
    sites: limitSitesPerGroup(normalizedSites),
    widgets: globalThis.WidgetKit?.normalize(source.widgets) || [],
    settings: normalizeSettings(source.settings, fallback.settings),
    updatedAt: normalizeText(source.updatedAt) || nowIso(),
  };
}

function normalizeSettings(sourceSettings, fallbackSettings) {
  const rawSettings = sourceSettings && typeof sourceSettings === "object" ? sourceSettings : {};
  const engine =
    SEARCH_ENGINES.find((item) => item.id === rawSettings.searchEngineId) ||
    SEARCH_ENGINES.find((item) => item.name === rawSettings.searchEngineName) ||
    SEARCH_ENGINES.find((item) => item.searchUrlTemplate === rawSettings.searchUrlTemplate) ||
    SEARCH_ENGINES[0];
  const background = normalizeBackgroundSettings(
    rawSettings.background || {
      type: rawSettings.backgroundType,
      image: rawSettings.backgroundImage,
    },
  );

  return {
    ...fallbackSettings,
    ...rawSettings,
    searchEngineId: engine.id,
    searchEngineName: engine.name,
    searchUrlTemplate: engine.searchUrlTemplate,
    background,
  };
}

function normalizeBackgroundSettings(sourceBackground) {
  const rawBackground =
    sourceBackground && typeof sourceBackground === "object" ? sourceBackground : {};
  const type = BACKGROUND_TYPES.has(rawBackground.type) ? rawBackground.type : "white";
  const image = normalizeText(rawBackground.image);
  const imageKey = normalizeText(rawBackground.imageKey) || (image ? BACKGROUND_ASSET_KEY : "");

  if (type === "image") {
    return image || imageKey ? { type, image, imageKey } : { ...DEFAULT_BACKGROUND_SETTINGS };
  }

  return {
    type,
    image: "",
    imageKey: "",
  };
}

function openAssetDb() {
  return new Promise((resolve, reject) => {
    if (!("indexedDB" in window)) {
      reject(new Error("IndexedDB is not available."));
      return;
    }

    const request = window.indexedDB.open(ASSET_DB_NAME, 1);

    request.addEventListener("upgradeneeded", () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(ASSET_STORE_NAME)) {
        db.createObjectStore(ASSET_STORE_NAME);
      }
    });

    request.addEventListener("success", () => resolve(request.result));
    request.addEventListener("error", () => reject(request.error));
  });
}

function withAssetStore(mode, callback) {
  return openAssetDb().then(
    (db) =>
      new Promise((resolve, reject) => {
        const transaction = db.transaction(ASSET_STORE_NAME, mode);
        const store = transaction.objectStore(ASSET_STORE_NAME);
        const request = callback(store);

        request.addEventListener("success", () => resolve(request.result));
        request.addEventListener("error", () => reject(request.error));
        transaction.addEventListener("complete", () => db.close());
        transaction.addEventListener("abort", () => {
          db.close();
          reject(transaction.error);
        });
      }),
  );
}

const backgroundAssetStorage = {
  async load(key = BACKGROUND_ASSET_KEY) {
    return (await withAssetStore("readonly", (store) => store.get(key))) || "";
  },

  async save(image, key = BACKGROUND_ASSET_KEY) {
    await withAssetStore("readwrite", (store) => store.put(image, key));
    return key;
  },

  async remove(key = BACKGROUND_ASSET_KEY) {
    await withAssetStore("readwrite", (store) => store.delete(key));
  },
};

function createIconCacheKey(iconUrl) {
  return `${ICON_CACHE_PREFIX}${encodeURIComponent(iconUrl)}`;
}

function normalizeIconCacheEntry(entry, iconUrl) {
  if (!entry || typeof entry !== "object") {
    return null;
  }

  if (entry.sourceUrl !== iconUrl || !entry.dataUrl || !entry.fetchedAt) {
    return null;
  }

  return entry;
}

function readBlobAsDataUrl(blob) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.addEventListener("load", () => resolve(String(reader.result || "")));
    reader.addEventListener("error", () => reject(reader.error));
    reader.readAsDataURL(blob);
  });
}

async function fetchIconAsDataUrl(iconUrl) {
  const response = await fetch(iconUrl);
  if (!response.ok) {
    throw new Error(`Icon request failed: ${response.status}`);
  }

  const contentType = response.headers.get("content-type") || "";
  if (contentType && !contentType.toLowerCase().startsWith("image/")) {
    throw new Error("Icon response is not an image.");
  }

  const blob = await response.blob();
  if (blob.type && !blob.type.toLowerCase().startsWith("image/")) {
    throw new Error("Icon blob is not an image.");
  }

  return readBlobAsDataUrl(blob);
}

function canCacheIcon(iconUrl, pageUrl = globalThis.location?.href) {
  try {
    const page = new URL(pageUrl), icon = new URL(iconUrl, page);
    return /^https?:$/.test(page.protocol) && icon.origin === page.origin;
  } catch {
    return false;
  }
}

const siteIconCacheStorage = {
  async load(iconUrl) {
    if (!iconUrl) {
      return null;
    }

    const entry = await withAssetStore("readonly", (store) => store.get(createIconCacheKey(iconUrl)));
    return normalizeIconCacheEntry(entry, iconUrl);
  },

  async save(iconUrl, dataUrl) {
    const entry = {
      sourceUrl: iconUrl,
      dataUrl,
      fetchedAt: Date.now(),
    };
    await withAssetStore("readwrite", (store) => store.put(entry, createIconCacheKey(iconUrl)));
    return entry;
  },

  isFresh(entry) {
    return Boolean(entry && Date.now() - Number(entry.fetchedAt) < ICON_CACHE_TTL_MS);
  },

  async refresh(iconUrl) {
    // Cross-origin icons render in <img>; reading their bytes requires CORS permission.
    // Let the browser HTTP cache handle those images and keep existing local entries usable.
    if (!canCacheIcon(iconUrl)) return null;
    const dataUrl = await fetchIconAsDataUrl(iconUrl);
    return this.save(iconUrl, dataUrl);
  },
};

async function persistBackgroundAsset(data) {
  const nextData = cloneData(data);
  const background = normalizeBackgroundSettings(nextData.settings.background);

  if (background.type === "image") {
    if (background.image) {
      background.imageKey = await backgroundAssetStorage.save(background.image);
      background.image = "";
    }

    nextData.settings.background = normalizeBackgroundSettings(background);
    return nextData;
  }

  await backgroundAssetStorage.remove().catch((error) => {
    console.warn("Failed to remove saved background image.", error);
  });
  nextData.settings.background = background;
  return nextData;
}

function shouldApplyNavigationPresetMigration(source) {
  if (!source || typeof source !== "object") {
    return false;
  }

  const sourceVersion = Number(source.version || 0);
  const sourcePresetId = normalizeText(source.settings?.navigationPresetId);
  return sourceVersion < 3 && sourcePresetId !== NAVIGATION_PRESET_ID;
}

function applyNavigationPresetMigration(source) {
  const preset = createDefaultData();
  const sourceSettings =
    source && typeof source === "object" && source.settings && typeof source.settings === "object"
      ? source.settings
      : {};

  return {
    ...source,
    version: DATA_VERSION,
    groups: preset.groups,
    sites: preset.sites,
    settings: {
      ...normalizeSettings(sourceSettings, preset.settings),
      navigationPresetId: NAVIGATION_PRESET_ID,
    },
    updatedAt: nowIso(),
  };
}

const localStorageAdapter = {
  async load() {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      return createDefaultData();
    }

    let normalized;
    try {
      const source = JSON.parse(raw);
      normalized = normalizeData(
        shouldApplyNavigationPresetMigration(source) ? applyNavigationPresetMigration(source) : source,
      );
    } catch (error) {
      console.warn("Failed to parse saved start page data.", error);
      return createDefaultData();
    }

    try {
      const persisted = await persistBackgroundAsset(normalized);
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(persisted));
      return persisted;
    } catch (error) {
      console.warn("Failed to migrate saved background image.", error);
      return normalized;
    }
  },

  async save(data) {
    const normalized = await persistBackgroundAsset(
      normalizeData({
        ...data,
        updatedAt: nowIso(),
      }),
    );
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(normalized));
    return normalized;
  },

  async export() {
    const data = cloneData(await this.load());
    const background = normalizeBackgroundSettings(data.settings.background);

    if (background.type === "image" && !background.image && background.imageKey) {
      background.image = await backgroundAssetStorage.load(background.imageKey);
    }

    data.settings.background = background;
    return JSON.stringify(data, null, 2);
  },

  async import(data) {
    return this.save(
      normalizeData({
        ...data,
        updatedAt: nowIso(),
      }),
    );
  },
};

const storage = localStorageAdapter;

const state = {
  data: null,
  activeGroupId: "",
  query: "",
  isEditing: false,
  pendingUndo: null,
  toastTimer: 0,
  toastAction: null,
  backgroundDraft: null,
  backgroundObjectUrl: "",
  backgroundSignature: "",
  backgroundLoadToken: 0,
  formattedJson: "",
  draggedSiteId: "",
  didDragSite: false,
  dragOverSiteId: "",
  dragInsertAfter: false,
  suppressSiteClick: false,
};

const elements = {};
let widgetController = null;

document.addEventListener("DOMContentLoaded", init);

async function init() {
  cacheElements();
  bindEvents();
  updateHeaderDate();
  window.setInterval(updateHeaderDate, 60000);
  state.data = await storage.load();
  widgetController = globalThis.WidgetKit?.create({
    getData: () => state.data,
    saveWidgets: async (widgets) => {
      const next = cloneData(state.data);
      next.widgets = widgets;
      await saveData(next);
    },
    notify: showToast,
  });
  state.activeGroupId = state.data.groups[0]?.id || "";
  render();
  focusSearchInput();
}

function focusSearchInput() {
  window.requestAnimationFrame(() => {
    elements.searchInput.focus({ preventScroll: true });
  });
}

function updateHeaderDate() {
  const date = document.querySelector("#headerDate");
  if (!date) return;
  const now = new Date();
  date.dateTime = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
  date.textContent = new Intl.DateTimeFormat("zh-CN", { month: "long", day: "numeric", weekday: "long" }).format(now);
}

function cacheElements() {
  elements.backgroundButton = document.querySelector("#backgroundButton");
  elements.editModeButton = document.querySelector("#editModeButton");
  elements.editToolbar = document.querySelector("#editToolbar");
  elements.doneEditButton = document.querySelector("#doneEditButton");
  elements.importConfigInput = document.querySelector("#importConfigInput");
  elements.exportConfigButton = document.querySelector("#exportConfigButton");
  elements.searchForm = document.querySelector("#searchForm");
  elements.searchBox = document.querySelector("#searchBox");
  elements.searchEngineButton = document.querySelector("#searchEngineButton");
  elements.searchEngineIcon = document.querySelector("#searchEngineIcon");
  elements.searchEngineMenu = document.querySelector("#searchEngineMenu");
  elements.searchInput = document.querySelector("#searchInput");
  elements.searchWheelTrigger = document.querySelector("#searchWheelTrigger");
  elements.searchSubmitButton = document.querySelector("#searchSubmitButton");
  elements.searchEngineWheel = document.querySelector("#searchEngineWheel");
  elements.searchWheelOptions = document.querySelector("#searchWheelOptions");
  elements.jsonPanel = document.querySelector("#jsonPanel");
  elements.jsonOutput = document.querySelector("#jsonOutput");
  elements.copyJsonButton = document.querySelector("#copyJsonButton");
  elements.groupTabs = document.querySelector("#groupTabs");
  elements.siteSection = document.querySelector("#siteSection");
  elements.siteGrid = document.querySelector("#siteGrid");
  elements.emptyState = document.querySelector("#emptyState");
  elements.modalBackdrop = document.querySelector("#modalBackdrop");
  elements.editModal = document.querySelector("#editModal");
  elements.modalTitle = document.querySelector("#modalTitle");
  elements.closeModalButton = document.querySelector("#closeModalButton");
  elements.groupForm = document.querySelector("#groupForm");
  elements.groupIdInput = document.querySelector("#groupIdInput");
  elements.groupNameInput = document.querySelector("#groupNameInput");
  elements.deleteGroupButton = document.querySelector("#deleteGroupButton");
  elements.siteForm = document.querySelector("#siteForm");
  elements.siteIdInput = document.querySelector("#siteIdInput");
  elements.siteGroupInput = document.querySelector("#siteGroupInput");
  elements.siteNameInput = document.querySelector("#siteNameInput");
  elements.siteUrlInput = document.querySelector("#siteUrlInput");
  elements.siteIconInput = document.querySelector("#siteIconInput");
  elements.fetchSiteIconButton = document.querySelector("#fetchSiteIconButton");
  elements.backgroundForm = document.querySelector("#backgroundForm");
  elements.backgroundChoiceButtons = Array.from(document.querySelectorAll("[data-background-choice]"));
  elements.backgroundPreview = document.querySelector("#backgroundPreview");
  elements.backgroundPreviewText = document.querySelector("#backgroundPreviewText");
  elements.backgroundImageInput = document.querySelector("#backgroundImageInput");
  elements.uploadBackgroundImageButton = document.querySelector("#uploadBackgroundImageButton");
  elements.clearBackgroundImageButton = document.querySelector("#clearBackgroundImageButton");
  elements.toast = document.querySelector("#toast");
  elements.toastMessage = document.querySelector("#toastMessage");
  elements.toastAction = document.querySelector("#toastAction");
}

function bindEvents() {
  elements.backgroundButton.addEventListener("click", openBackgroundModal);
  elements.editModeButton.addEventListener("click", () => setEditMode(!state.isEditing));
  elements.doneEditButton.addEventListener("click", () => setEditMode(false));
  elements.exportConfigButton.addEventListener("click", handleExport);
  elements.importConfigInput.addEventListener("change", handleImport);
  elements.searchForm.addEventListener("submit", handleSearchSubmit);
  elements.searchEngineButton.addEventListener("click", toggleSearchEngineMenu);
  bindSearchWheelEvents();
  elements.searchBox.addEventListener("dragenter", handleSearchDragEnter);
  elements.searchBox.addEventListener("dragover", handleSearchDragOver);
  elements.searchBox.addEventListener("dragleave", handleSearchDragLeave);
  elements.searchBox.addEventListener("drop", handleSearchDrop);
  elements.siteGrid.addEventListener("dragenter", handleSiteGridDragEnter);
  elements.siteGrid.addEventListener("dragover", handleSiteGridDragOver);
  elements.siteGrid.addEventListener("dragleave", handleSiteGridDragLeave);
  elements.siteGrid.addEventListener("drop", handleSiteGridDrop);

  elements.searchInput.addEventListener("input", handleSearchInput);
  elements.copyJsonButton.addEventListener("click", copyFormattedJson);

  elements.closeModalButton.addEventListener("click", closeModal);
  elements.modalBackdrop.addEventListener("click", closeModal);
  elements.groupForm.addEventListener("submit", handleGroupSubmit);
  elements.deleteGroupButton.addEventListener("click", handleDeleteGroup);
  elements.siteForm.addEventListener("submit", handleSiteSubmit);
  elements.fetchSiteIconButton.addEventListener("click", handleFetchSiteIcon);
  elements.backgroundForm.addEventListener("submit", handleBackgroundSubmit);
  elements.backgroundImageInput.addEventListener("change", handleBackgroundImageChange);
  elements.uploadBackgroundImageButton.addEventListener("click", () =>
    elements.backgroundImageInput.click(),
  );
  elements.clearBackgroundImageButton.addEventListener("click", handleClearBackgroundImage);
  elements.backgroundChoiceButtons.forEach((button) => {
    button.addEventListener("click", () => selectBackgroundChoice(button.dataset.backgroundChoice));
  });
  elements.toastAction.addEventListener("click", () => {
    if (typeof state.toastAction === "function") {
      state.toastAction();
    }
  });

  document.addEventListener("keydown", (event) => {
    if (event.defaultPrevented || widgetController?.isInteracting()) return;
    if (event.key === "/" && !event.ctrlKey && !event.metaKey && !event.altKey && elements.editModal.hidden &&
        !event.target.closest("input, textarea, select, [contenteditable='true']")) {
      event.preventDefault();
      focusSearchInput();
      return;
    }
    if (event.key !== "Escape") {
      return;
    }
    if (!elements.searchEngineWheel.hidden) {
      event.preventDefault();
      closeSearchWheel(true);
      return;
    }
    if (!elements.editModal.hidden) {
      closeModal();
      return;
    }
    if (state.isEditing) {
      setEditMode(false);
    }
  });

  document.addEventListener("click", (event) => {
    if (!elements.searchBox.contains(event.target)) {
      closeSearchEngineMenu();
    }
  });
}

function render() {
  if (!state.data) {
    return;
  }
  ensureActiveGroup();
  applyBackground();
  renderEditMode();
  renderSearchEngine();
  renderJsonPanel();
  renderGroups();
  renderSites();
  widgetController?.render(state.isEditing);
}

function ensureActiveGroup() {
  const exists = state.data.groups.some((group) => group.id === state.activeGroupId);
  if (!exists) {
    state.activeGroupId = state.data.groups[0]?.id || "";
  }
}

function getBackgroundSettings() {
  return normalizeBackgroundSettings(state.data?.settings?.background || DEFAULT_BACKGROUND_SETTINGS);
}

function toCssUrl(value) {
  return `url(${JSON.stringify(value)})`;
}

function getBackgroundSignature(background) {
  if (background.type !== "image") {
    return background.type;
  }

  if (background.imageKey) {
    return `image:key:${background.imageKey}`;
  }

  if (background.image) {
    return `image:inline:${background.image.length}:${background.image.slice(0, 48)}:${background.image.slice(-48)}`;
  }

  return "image:empty";
}

function clearBodyBackgroundImage() {
  document.body.style.removeProperty("--custom-background-image");
  if (state.backgroundObjectUrl) {
    URL.revokeObjectURL(state.backgroundObjectUrl);
    state.backgroundObjectUrl = "";
  }
}

function setBodyBackgroundImageUrl(imageUrl) {
  document.body.style.setProperty("--custom-background-image", toCssUrl(imageUrl));
  if (state.backgroundObjectUrl && state.backgroundObjectUrl !== imageUrl) {
    URL.revokeObjectURL(state.backgroundObjectUrl);
  }
  state.backgroundObjectUrl = imageUrl.startsWith("blob:") ? imageUrl : "";
}

async function createBackgroundObjectUrl(image) {
  if (image instanceof Blob) {
    return URL.createObjectURL(image);
  }

  const source = normalizeText(image);
  if (!source) {
    return "";
  }

  if (!source.startsWith("data:")) {
    return source;
  }

  const response = await fetch(source);
  const blob = await response.blob();
  return URL.createObjectURL(blob);
}

function applyBackground() {
  const background = getBackgroundSettings();
  const signature = getBackgroundSignature(background);
  document.body.dataset.background = background.type;

  if (signature === state.backgroundSignature) {
    return;
  }

  state.backgroundSignature = signature;
  state.backgroundLoadToken += 1;
  const loadToken = state.backgroundLoadToken;

  if (background.type !== "image") {
    clearBodyBackgroundImage();
    return;
  }

  if (background.image) {
    createBackgroundObjectUrl(background.image)
      .then((imageUrl) => {
        if (loadToken === state.backgroundLoadToken && state.backgroundSignature === signature && imageUrl) {
          setBodyBackgroundImageUrl(imageUrl);
        } else if (imageUrl.startsWith("blob:")) {
          URL.revokeObjectURL(imageUrl);
        }
      })
      .catch((error) => {
        console.warn("Failed to prepare background image.", error);
        clearBodyBackgroundImage();
      });
    return;
  }

  if (!background.imageKey) {
    clearBodyBackgroundImage();
    return;
  }

  const imageKey = background.imageKey;
  backgroundAssetStorage
    .load(imageKey)
    .then((image) => {
      const latestBackground = getBackgroundSettings();
      if (
        loadToken !== state.backgroundLoadToken ||
        state.backgroundSignature !== signature ||
        latestBackground.type !== "image" ||
        latestBackground.imageKey !== imageKey
      ) {
        return;
      }

      if (image) {
        return createBackgroundObjectUrl(image).then((imageUrl) => {
          if (loadToken === state.backgroundLoadToken && state.backgroundSignature === signature && imageUrl) {
            setBodyBackgroundImageUrl(imageUrl);
          } else if (imageUrl.startsWith("blob:")) {
            URL.revokeObjectURL(imageUrl);
          }
        });
      } else {
        clearBodyBackgroundImage();
      }
    })
    .catch((error) => {
      console.warn("Failed to load saved background image.", error);
      clearBodyBackgroundImage();
    });
}

function renderEditMode() {
  document.body.classList.toggle("is-editing", state.isEditing);
  elements.editModeButton.classList.toggle("is-active", state.isEditing);
  elements.editModeButton.setAttribute("aria-label", state.isEditing ? "退出编辑模式" : "进入编辑模式");
  elements.editToolbar.hidden = !state.isEditing;
}

function setEditMode(isEditing) {
  state.isEditing = isEditing;
  if (!isEditing) {
    closeModal();
    resetSiteDragState();
  }
  render();
}

function resetSiteDragState() {
  state.draggedSiteId = "";
  state.didDragSite = false;
  state.dragOverSiteId = "";
  state.dragInsertAfter = false;
  state.suppressSiteClick = false;
  elements.siteGrid?.classList.remove("is-link-dragover");
}

function getCurrentSearchEngine() {
  return (
    SEARCH_ENGINES.find((engine) => engine.id === state.data.settings.searchEngineId) ||
    SEARCH_ENGINES.find((engine) => engine.name === state.data.settings.searchEngineName) ||
    SEARCH_ENGINES[0]
  );
}

function renderSearchEngine() {
  const currentEngine = getCurrentSearchEngine();
  elements.searchEngineIcon.src = currentEngine.icon;
  elements.searchEngineIcon.alt = currentEngine.name;
  elements.searchEngineButton.title = `当前搜索引擎：${currentEngine.name}`;
  renderSearchEngineMenu(currentEngine.id);
  renderSearchWheel(currentEngine.id);
}

let searchWheelTimer = 0;
let searchWheelCloseTimer = 0;

function bindSearchWheelEvents() {
  elements.searchWheelTrigger.addEventListener("pointerenter", (event) => {
    if (event.pointerType === "touch") return;
    window.clearTimeout(searchWheelTimer);
    window.clearTimeout(searchWheelCloseTimer);
    elements.searchEngineWheel.classList.remove("is-closing");
    searchWheelTimer = window.setTimeout(openSearchWheel, 140);
  });
  elements.searchWheelTrigger.addEventListener("pointerleave", () => {
    window.clearTimeout(searchWheelTimer);
    searchWheelTimer = window.setTimeout(() => {
      if (!elements.searchEngineWheel.contains(document.activeElement)) closeSearchWheel(false, true);
    }, 300);
  });
  elements.searchWheelTrigger.addEventListener("focusout", (event) => {
    if (!elements.searchWheelTrigger.contains(event.relatedTarget)) closeSearchWheel();
  });
  elements.searchSubmitButton.addEventListener("click", (event) => {
    if (event.pointerType === "touch" && elements.searchEngineWheel.hidden) {
      event.preventDefault();
      openSearchWheel();
    } else {
      closeSearchWheel();
    }
  });
  elements.searchSubmitButton.addEventListener("keydown", (event) => {
    if (["ArrowDown", "ArrowRight", "ArrowUp"].includes(event.key)) {
      event.preventDefault();
      openSearchWheel();
      const active = elements.searchWheelOptions.querySelector('[aria-pressed="true"]');
      (active || elements.searchWheelOptions.querySelector("button"))?.focus();
    }
  });
  elements.searchEngineWheel.addEventListener("keydown", (event) => {
    const buttons = [...elements.searchWheelOptions.querySelectorAll("button")];
    const current = buttons.indexOf(document.activeElement);
    if (current < 0) return;
    const step = { ArrowRight: 1, ArrowDown: 1, ArrowLeft: -1, ArrowUp: -1 }[event.key];
    if (step) {
      event.preventDefault();
      buttons[(current + step + buttons.length) % buttons.length].focus();
    } else if (event.key === "Home" || event.key === "End") {
      event.preventDefault();
      buttons[event.key === "Home" ? 0 : buttons.length - 1].focus();
    }
  });
  document.addEventListener("pointerdown", (event) => {
    if (!elements.searchWheelTrigger.contains(event.target)) closeSearchWheel();
  });
  window.addEventListener("resize", () => closeSearchWheel());
  window.addEventListener("blur", () => closeSearchWheel());
}

function openSearchWheel() {
  window.clearTimeout(searchWheelTimer);
  window.clearTimeout(searchWheelCloseTimer);
  elements.searchEngineWheel.classList.remove("is-closing");
  if (!state.data || !elements.editModal.hidden || !elements.searchEngineWheel.hidden) return;
  closeSearchEngineMenu();
  // On narrow screens, make room inside the search bar so the button stays at the wheel's center.
  const trigger = elements.searchSubmitButton.getBoundingClientRect();
  const overflow = Math.max(0, trigger.x + trigger.width / 2 + 164 - document.documentElement.clientWidth);
  elements.searchBox.style.setProperty("--wheel-room", `${overflow}px`);
  elements.searchEngineWheel.hidden = false;
  elements.searchSubmitButton.setAttribute("aria-expanded", "true");
}

function closeSearchWheel(restoreFocus = false, animate = false) {
  window.clearTimeout(searchWheelTimer);
  window.clearTimeout(searchWheelCloseTimer);
  if (animate && !elements.searchEngineWheel.hidden) {
    elements.searchEngineWheel.classList.add("is-closing");
    searchWheelCloseTimer = window.setTimeout(() => closeSearchWheel(restoreFocus), 120);
    return;
  }
  elements.searchEngineWheel.classList.remove("is-closing");
  elements.searchEngineWheel.hidden = true;
  elements.searchSubmitButton.setAttribute("aria-expanded", "false");
  elements.searchBox.style.removeProperty("--wheel-room");
  if (restoreFocus) elements.searchSubmitButton.focus();
}

function getSearchWheelSectorPath(index, count) {
  const start = -Math.PI / 2 + (index / count) * Math.PI + 0.014;
  const end = -Math.PI / 2 + ((index + 1) / count) * Math.PI - 0.014;
  const outerRadius = 150;
  const innerRadius = 49;
  const outerTrim = Math.min(12 / outerRadius, (end - start) / 4);
  const innerTrim = Math.min(7 / innerRadius, (end - start) / 4);
  const point = (radius, angle) => `${(Math.cos(angle) * radius).toFixed(3)} ${(152 + Math.sin(angle) * radius).toFixed(3)}`;
  // Round all four corners in the shared visual and hit-test path.
  return [
    `M ${point(outerRadius, start + outerTrim)}`,
    `A ${outerRadius} ${outerRadius} 0 0 1 ${point(outerRadius, end - outerTrim)}`,
    `Q ${point(outerRadius, end)} ${point(outerRadius * (1 - outerTrim), end)}`,
    `L ${point(innerRadius * (1 + innerTrim), end)}`,
    `Q ${point(innerRadius, end)} ${point(innerRadius, end - innerTrim)}`,
    `A ${innerRadius} ${innerRadius} 0 0 0 ${point(innerRadius, start + innerTrim)}`,
    `Q ${point(innerRadius, start)} ${point(innerRadius * (1 + innerTrim), start)}`,
    `L ${point(outerRadius * (1 - outerTrim), start)}`,
    `Q ${point(outerRadius, start)} ${point(outerRadius, start + outerTrim)}`,
    "Z",
  ].join(" ");
}

function renderSearchWheel(activeEngineId) {
  elements.searchWheelOptions.replaceChildren();
  SEARCH_ENGINES.forEach((engine, index) => {
    // Five sectors across the right half-circle, centered on the search button.
    const angle = -Math.PI / 2 + ((index + 0.5) / SEARCH_ENGINES.length) * Math.PI;
    const button = document.createElement("button");
    button.type = "button";
    button.className = "search-wheel-option";
    button.dataset.engineId = engine.id;
    button.style.setProperty("--wheel-x", `${Math.cos(angle) * 103}px`);
    button.style.setProperty("--wheel-y", `${Math.sin(angle) * 103}px`);
    button.style.setProperty("--wheel-delay", `${index * 80}ms`);
    const sectorPath = getSearchWheelSectorPath(index, SEARCH_ENGINES.length);
    button.style.clipPath = `path("${sectorPath}")`;
    button.setAttribute("aria-label", `使用 ${engine.name} 搜索`);
    button.setAttribute("aria-pressed", String(engine.id === activeEngineId));
    const sector = document.createElementNS("http://www.w3.org/2000/svg", "svg");
    sector.setAttribute("viewBox", "0 0 152 304");
    sector.setAttribute("aria-hidden", "true");
    sector.classList.add("search-wheel-sector");
    const path = document.createElementNS("http://www.w3.org/2000/svg", "path");
    path.setAttribute("d", sectorPath);
    sector.append(path);
    const content = document.createElement("span");
    content.className = "search-wheel-option-content";
    const mark = document.createElement("span");
    mark.className = "search-wheel-icon";
    mark.textContent = engine.mark;
    const image = document.createElement("img");
    image.alt = "";
    image.hidden = true;
    image.addEventListener("load", () => {
      mark.replaceChildren(image);
      image.hidden = false;
    });
    image.addEventListener("error", () => { mark.textContent = engine.mark; });
    mark.append(image);
    image.src = engine.icon;
    const label = document.createElement("span");
    label.className = "search-wheel-label";
    label.textContent = engine.name;
    content.append(mark, label);
    button.append(sector, content);
    button.addEventListener("click", () => selectSearchEngine(engine.id, { search: true }));
    elements.searchWheelOptions.append(button);
  });
}

function renderSearchEngineMenu(activeEngineId) {
  elements.searchEngineMenu.replaceChildren();

  SEARCH_ENGINES.forEach((engine) => {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "search-engine-option";
    button.dataset.engineId = engine.id;
    if (engine.id === activeEngineId) {
      button.classList.add("is-active");
    }

    const mark = document.createElement("span");
    mark.className = "search-engine-option-mark";

    const icon = document.createElement("img");
    icon.src = engine.icon;
    icon.alt = "";
    icon.loading = "lazy";
    icon.addEventListener("error", () => {
      icon.remove();
      mark.textContent = engine.mark;
    });
    mark.append(icon);

    const name = document.createElement("span");
    name.textContent = engine.name;

    button.append(mark, name);
    button.addEventListener("click", () => selectSearchEngine(engine.id));
    elements.searchEngineMenu.append(button);
  });
}

function parseJsonPreview(value) {
  const text = value.trim();
  if (!text || !/^[{[]/.test(text)) {
    return "";
  }

  try {
    const parsed = JSON.parse(text);
    return JSON.stringify(parsed, null, 2);
  } catch {
    return "";
  }
}

function handleSearchInput() {
  const formattedJson = parseJsonPreview(elements.searchInput.value);
  state.formattedJson = formattedJson;
  state.query = formattedJson ? "" : elements.searchInput.value.trim();
  renderJsonPanel();
  renderSites();
}

function renderJsonPanel() {
  if (!state.formattedJson) {
    elements.jsonPanel.hidden = true;
    elements.jsonOutput.textContent = "";
    elements.siteSection.classList.remove("is-json-active");
    return;
  }

  elements.jsonPanel.hidden = false;
  elements.jsonOutput.textContent = state.formattedJson;
  elements.siteSection.classList.add("is-json-active");
}

async function copyFormattedJson() {
  if (!state.formattedJson) {
    return;
  }

  try {
    await navigator.clipboard.writeText(state.formattedJson);
    showToast("已复制格式化 JSON。");
  } catch (error) {
    console.error(error);
    showToast("复制失败，请手动选择内容。");
  }
}

function toggleSearchEngineMenu(event) {
  event.stopPropagation();
  closeSearchWheel();
  const willOpen = elements.searchEngineMenu.hidden;
  elements.searchEngineMenu.hidden = !willOpen;
  elements.searchEngineButton.setAttribute("aria-expanded", String(willOpen));
}

function closeSearchEngineMenu() {
  elements.searchEngineMenu.hidden = true;
  elements.searchEngineButton.setAttribute("aria-expanded", "false");
}

async function selectSearchEngine(engineId, { search = false } = {}) {
  const engine = SEARCH_ENGINES.find((item) => item.id === engineId);
  if (!engine) {
    return;
  }

  const nextData = cloneData(state.data);
  nextData.settings.searchEngineId = engine.id;
  nextData.settings.searchEngineName = engine.name;
  nextData.settings.searchUrlTemplate = engine.searchUrlTemplate;
  const query = elements.searchInput.value.trim();
  closeSearchEngineMenu();
  closeSearchWheel();
  try {
    await saveData(nextData);
  } catch (error) {
    console.error(error);
    showToast("搜索引擎保存失败，请重试。");
    return;
  }
  if (search && query) {
    window.location.href = buildSearchUrl(engine, query);
    return;
  }
  elements.searchInput.focus();
  showToast(`已切换到 ${engine.name}。`);
}

function renderGroups() {
  elements.groupTabs.replaceChildren();

  state.data.groups.forEach((group) => {
    const wrap = document.createElement("span");
    wrap.className = "group-tab-wrap";

    const button = document.createElement("button");
    button.type = "button";
    button.className = "group-tab";
    button.textContent = group.name;
    button.setAttribute("aria-pressed", String(group.id === state.activeGroupId));

    if (group.id === state.activeGroupId) {
      button.classList.add("is-active");
    }

    button.addEventListener("click", () => {
      state.activeGroupId = group.id;
      state.query = "";
      state.formattedJson = "";
      elements.searchInput.value = "";
      render();
    });

    wrap.append(button);

    if (state.isEditing) {
      const editButton = document.createElement("button");
      editButton.type = "button";
      editButton.className = "group-edit-button";
      editButton.setAttribute("aria-label", `编辑分组 ${group.name}`);
      editButton.innerHTML = '<svg aria-hidden="true" viewBox="0 0 24 24"><path d="M12 20h9"></path><path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4Z"></path></svg>';
      editButton.addEventListener("click", (event) => {
        event.stopPropagation();
        openGroupModal(group);
      });
      wrap.append(editButton);
    }

    elements.groupTabs.append(wrap);
  });

  if (state.isEditing) {
    const addButton = document.createElement("button");
    addButton.type = "button";
    addButton.className = "group-add-button";
    addButton.textContent = "+";
    addButton.setAttribute("aria-label", "新增分组");
    addButton.addEventListener("click", () => openGroupModal(null));
    elements.groupTabs.append(addButton);
  }
}

function getGroupName(groupId) {
  return state.data.groups.find((group) => group.id === groupId)?.name || "未分组";
}

function countSitesInGroup(data, groupId, excludeSiteId = "") {
  return data.sites.filter((site) => site.groupId === groupId && site.id !== excludeSiteId).length;
}

function getVisibleSites() {
  const query = state.query.toLowerCase();
  if (!query) {
    return state.data.sites.filter((site) => site.groupId === state.activeGroupId);
  }

  return state.data.sites
    .filter((site) => {
      const haystack = `${site.name} ${site.url} ${getGroupName(site.groupId)}`.toLowerCase();
      return haystack.includes(query);
    })
    .slice(0, MAX_SITES_PER_GROUP);
}

function shouldShowAddSiteCard() {
  return (
    state.isEditing &&
    !state.query &&
    !state.formattedJson &&
    state.activeGroupId &&
    countSitesInGroup(state.data, state.activeGroupId) < MAX_SITES_PER_GROUP
  );
}

function canSortSites() {
  return state.isEditing && !state.query && !state.formattedJson && Boolean(state.activeGroupId);
}

function renderSites() {
  const count = document.querySelector("#siteCount");
  if (count) count.textContent = `${getVisibleSites().length}`;
  if (state.formattedJson) {
    elements.siteGrid.hidden = true;
    elements.emptyState.hidden = true;
    elements.siteGrid.replaceChildren();
    return;
  }

  elements.siteGrid.hidden = false;
  elements.siteGrid.replaceChildren();
  const sites = getVisibleSites();

  sites.forEach((site) => {
    elements.siteGrid.append(createSiteCard(site));
  });

  if (shouldShowAddSiteCard()) {
    elements.siteGrid.append(createAddSiteCard());
  }

  if (sites.length || shouldShowAddSiteCard()) {
    elements.emptyState.hidden = true;
    return;
  }

  elements.emptyState.hidden = false;
  if (state.query) {
    elements.emptyState.textContent = state.isEditing
      ? "没有找到匹配网站。"
      : `没有找到匹配网站，按 Enter 使用 ${state.data.settings.searchEngineName} 搜索。`;
    return;
  }

  elements.emptyState.textContent = "这个分组还没有网页，进入编辑模式后点击 + 添加。";
}

function isInternalSiteDrag() {
  return Boolean(state.draggedSiteId);
}

function clearSiteDropIndicators() {
  elements.siteGrid
    .querySelectorAll(".is-drag-over-before, .is-drag-over-after")
    .forEach((card) => {
      card.classList.remove("is-drag-over-before", "is-drag-over-after");
    });
}

function getDragInsertAfter(event, targetCard) {
  const rect = targetCard.getBoundingClientRect();
  return event.clientX > rect.left + rect.width / 2;
}

function updateSiteDropIndicator(targetCard, insertAfter) {
  clearSiteDropIndicators();
  if (!targetCard || targetCard.dataset.siteId === state.draggedSiteId) {
    state.dragOverSiteId = "";
    state.dragInsertAfter = false;
    return;
  }

  state.dragOverSiteId = targetCard.dataset.siteId || "";
  state.dragInsertAfter = insertAfter;
  targetCard.classList.add(insertAfter ? "is-drag-over-after" : "is-drag-over-before");
}

async function reorderCurrentGroupSites(draggedSiteId, targetSiteId = "", insertAfter = true) {
  if (!canSortSites() || !draggedSiteId) {
    return false;
  }

  const currentGroupSites = state.data.sites.filter((site) => site.groupId === state.activeGroupId);
  const draggedSite = currentGroupSites.find((site) => site.id === draggedSiteId);
  if (!draggedSite || draggedSite.id === targetSiteId) {
    return false;
  }

  const reorderedGroupSites = currentGroupSites.filter((site) => site.id !== draggedSiteId);
  let insertIndex = reorderedGroupSites.length;

  if (targetSiteId) {
    const targetIndex = reorderedGroupSites.findIndex((site) => site.id === targetSiteId);
    if (targetIndex < 0) {
      return false;
    }
    insertIndex = targetIndex + (insertAfter ? 1 : 0);
  }

  reorderedGroupSites.splice(insertIndex, 0, draggedSite);

  if (currentGroupSites.every((site, index) => site.id === reorderedGroupSites[index]?.id)) {
    return false;
  }

  const nextData = cloneData(state.data);
  const reorderedQueue = reorderedGroupSites.map((site) => cloneData(site));
  nextData.sites = nextData.sites.map((site) => {
    if (site.groupId !== state.activeGroupId) {
      return site;
    }
    return reorderedQueue.shift();
  });

  await saveData(nextData);
  return true;
}

function handleSiteGridDragEnter(event) {
  if (!state.isEditing) {
    return;
  }

  if (isInternalSiteDrag()) {
    event.preventDefault();
    elements.siteGrid.classList.remove("is-link-dragover");
    return;
  }

  event.preventDefault();
  elements.siteGrid.classList.add("is-link-dragover");
}

function handleSiteGridDragOver(event) {
  if (!state.isEditing) {
    return;
  }

  event.preventDefault();
  if (isInternalSiteDrag()) {
    if (event.dataTransfer) {
      event.dataTransfer.dropEffect = "move";
    }
    elements.siteGrid.classList.remove("is-link-dragover");
    return;
  }

  if (event.dataTransfer) {
    event.dataTransfer.dropEffect = "copy";
  }
  elements.siteGrid.classList.add("is-link-dragover");
}

function handleSiteGridDragLeave(event) {
  if (elements.siteGrid.contains(event.relatedTarget)) {
    return;
  }
  elements.siteGrid.classList.remove("is-link-dragover");
  if (isInternalSiteDrag()) {
    clearSiteDropIndicators();
  }
}

async function handleSiteGridDrop(event) {
  if (!state.isEditing) {
    return;
  }

  if (isInternalSiteDrag()) {
    event.preventDefault();
    elements.siteGrid.classList.remove("is-link-dragover");
    clearSiteDropIndicators();
    const draggedSiteId = state.draggedSiteId;
    await reorderCurrentGroupSites(draggedSiteId);
    finishSiteCardDrag();
    return;
  }

  const url = getDroppedBookmarkUrl(event.dataTransfer);
  if (!url) {
    event.preventDefault();
    elements.siteGrid.classList.remove("is-link-dragover");
    showToast("没有识别到网页链接。");
    return;
  }

  event.preventDefault();
  elements.siteGrid.classList.remove("is-link-dragover");
  await addDroppedBookmark(url, event.dataTransfer);
}

function getDroppedBookmarkUrl(dataTransfer) {
  if (!dataTransfer) {
    return "";
  }

  const edgeUrl = dataTransfer.getData("text/x-ms-url").split("\n")[0]?.trim();
  if (isHttpUrl(edgeUrl)) {
    return normalizeUrl(edgeUrl);
  }

  const firefoxUrl = dataTransfer.getData("text/x-moz-url").split("\n")[0]?.trim();
  if (isHttpUrl(firefoxUrl)) {
    return normalizeUrl(firefoxUrl);
  }

  const uriList = dataTransfer.getData("text/uri-list");
  const uri = uriList
    .split("\n")
    .map((line) => line.trim())
    .find((line) => line && !line.startsWith("#"));

  if (isHttpUrl(uri)) {
    return normalizeUrl(uri);
  }

  const plainText = dataTransfer.getData("text/plain").trim();
  if (isHttpUrl(plainText)) {
    return normalizeUrl(plainText);
  }

  const html = dataTransfer.getData("text/html");
  if (html) {
    const doc = new DOMParser().parseFromString(html, "text/html");
    const link = doc.querySelector("a[href]");
    const href = link?.getAttribute("href") || "";
    if (isHttpUrl(href)) {
      return normalizeUrl(href);
    }
  }

  return "";
}

async function addDroppedBookmark(url, dataTransfer) {
  if (!state.activeGroupId) {
    showToast("请先创建一个分组。");
    return;
  }

  if (countSitesInGroup(state.data, state.activeGroupId) >= MAX_SITES_PER_GROUP) {
    showToast(`每个分组最多 ${MAX_SITES_PER_GROUP} 个网站。`);
    return;
  }

  if (state.data.sites.some((site) => normalizeUrl(site.url) === url)) {
    showToast("这个网页已经在导航里了。");
    return;
  }

  const nextData = cloneData(state.data);
  const title = getDroppedBookmarkTitle(url, dataTransfer);
  const icon = getFaviconUrl(url);

  nextData.sites.push({
    id: createId("site"),
    groupId: state.activeGroupId,
    name: title,
    url,
    icon,
  });

  await saveData(nextData);
  showToast(`已添加「${title}」。`);
}

function getDroppedBookmarkTitle(url, dataTransfer) {
  const edgeTitle = dataTransfer.getData("text/x-ms-url").split("\n")[1]?.trim();
  if (edgeTitle) {
    return edgeTitle.slice(0, 32);
  }

  const firefoxTitle = dataTransfer.getData("text/x-moz-url").split("\n")[1]?.trim();
  if (firefoxTitle) {
    return firefoxTitle.slice(0, 32);
  }

  const html = dataTransfer.getData("text/html");
  if (html) {
    const doc = new DOMParser().parseFromString(html, "text/html");
    const linkText = doc.querySelector("a[href]")?.textContent?.trim();
    if (linkText) {
      return linkText.slice(0, 32);
    }
  }

  try {
    const parsed = new URL(url);
    return parsed.hostname.replace(/^www\./, "").slice(0, 32);
  } catch {
    return "新网页";
  }
}

function getFaviconUrl(url) {
  try {
    const domain = new URL(url).hostname;
    if (!domain) {
      return "";
    }
    return FAVICON_SERVICE_TEMPLATE.replace("{domain}", encodeURIComponent(domain));
  } catch {
    return "";
  }
}

function createSiteCard(site) {
  const card = state.isEditing ? document.createElement("div") : document.createElement("a");
  card.className = "site-card";
  card.title = site.url;

  if (state.isEditing) {
    card.classList.add("is-wiggling");
    card.setAttribute("role", "button");
    card.setAttribute("tabindex", "0");
    card.setAttribute("aria-label", `编辑 ${site.name}`);
    card.dataset.siteId = site.id;
    if (canSortSites()) {
      card.draggable = true;
      card.addEventListener("dragstart", (event) => handleSiteCardDragStart(event, site.id));
      card.addEventListener("dragover", (event) => handleSiteCardDragOver(event, card));
      card.addEventListener("dragleave", (event) => handleSiteCardDragLeave(event, card));
      card.addEventListener("drop", (event) => handleSiteCardDrop(event, card));
      card.addEventListener("dragend", handleSiteCardDragEnd);
    }
    card.addEventListener("click", (event) => {
      if (state.suppressSiteClick) {
        event.preventDefault();
        return;
      }
      openSiteModal(site, site.groupId);
    });
    card.addEventListener("keydown", (event) => {
      if (event.key === "Enter" || event.key === " ") {
        event.preventDefault();
        openSiteModal(site, site.groupId);
      }
    });
  } else {
    card.href = site.url;
    card.target = "_blank";
    card.rel = "noopener noreferrer";
  }

  if (state.isEditing) {
    const deleteButton = document.createElement("button");
    deleteButton.type = "button";
    deleteButton.className = "site-delete-button";
    deleteButton.draggable = false;
    deleteButton.textContent = "×";
    deleteButton.setAttribute("aria-label", `删除 ${site.name}`);
    deleteButton.addEventListener("click", (event) => {
      event.stopPropagation();
      deleteSiteWithUndo(site.id);
    });
    deleteButton.addEventListener("dragstart", (event) => {
      event.preventDefault();
      event.stopPropagation();
    });
    card.append(deleteButton);
  }

  const icon = document.createElement("span");
  icon.className = "site-icon";
  populateSiteIcon(icon, site);

  const name = document.createElement("span");
  name.className = "site-name";
  name.textContent = site.name;

  card.append(icon, name);

  if (state.query) {
    const meta = document.createElement("span");
    meta.className = "site-meta";
    meta.textContent = getGroupName(site.groupId);
    card.append(meta);
  }

  return card;
}

function createAddSiteCard() {
  const button = document.createElement("button");
  button.type = "button";
  button.className = "site-card add-site-card";
  button.setAttribute("aria-label", "新增网页");

  const plus = document.createElement("span");
  plus.className = "plus-mark";
  plus.textContent = "+";

  const label = document.createElement("span");
  label.className = "site-name";
  label.textContent = "新增网页";

  button.append(plus, label);
  button.addEventListener("click", () => openSiteModal(null, state.activeGroupId));
  return button;
}

function handleSiteCardDragStart(event, siteId) {
  if (!canSortSites()) {
    event.preventDefault();
    return;
  }

  state.draggedSiteId = siteId;
  state.didDragSite = true;
  state.suppressSiteClick = true;
  state.dragOverSiteId = "";
  state.dragInsertAfter = false;

  event.currentTarget.classList.add("is-dragging");
  elements.siteGrid.classList.remove("is-link-dragover");

  if (event.dataTransfer) {
    event.dataTransfer.effectAllowed = "move";
    event.dataTransfer.setData("application/x-my-start-site-id", siteId);
    event.dataTransfer.setData("text/plain", siteId);
  }
}

function handleSiteCardDragOver(event, card) {
  if (!isInternalSiteDrag()) {
    return;
  }

  event.preventDefault();
  event.stopPropagation();
  if (event.dataTransfer) {
    event.dataTransfer.dropEffect = "move";
  }

  updateSiteDropIndicator(card, getDragInsertAfter(event, card));
}

function handleSiteCardDragLeave(event, card) {
  if (!isInternalSiteDrag() || card.contains(event.relatedTarget)) {
    return;
  }

  card.classList.remove("is-drag-over-before", "is-drag-over-after");
}

async function handleSiteCardDrop(event, card) {
  if (!isInternalSiteDrag()) {
    return;
  }

  event.preventDefault();
  event.stopPropagation();
  const draggedSiteId = state.draggedSiteId;
  const targetSiteId = card.dataset.siteId || "";
  const insertAfter = getDragInsertAfter(event, card);
  clearSiteDropIndicators();
  await reorderCurrentGroupSites(draggedSiteId, targetSiteId, insertAfter);
  finishSiteCardDrag();
}

function handleSiteCardDragEnd() {
  finishSiteCardDrag();
}

function finishSiteCardDrag() {
  state.draggedSiteId = "";
  state.dragOverSiteId = "";
  state.dragInsertAfter = false;
  elements.siteGrid.classList.remove("is-link-dragover");
  clearSiteDropIndicators();
  elements.siteGrid.querySelectorAll(".is-dragging").forEach((card) => {
    card.classList.remove("is-dragging");
  });

  window.setTimeout(() => {
    state.didDragSite = false;
    state.suppressSiteClick = false;
  }, 120);
}

function populateSiteIcon(container, site) {
  const fallback = document.createElement("span");
  fallback.textContent = site.name.slice(0, 1).toUpperCase();
  const renderToken = createId("icon-render");
  container.dataset.iconRenderToken = renderToken;

  function isCurrentRender() {
    return container.isConnected && container.dataset.iconRenderToken === renderToken;
  }

  function showFallback() {
    if (!isCurrentRender()) {
      return;
    }
    image?.remove();
    if (!container.contains(fallback)) {
      container.append(fallback);
    }
  }

  function setImageSource(source) {
    if (!isCurrentRender() || !source) {
      return;
    }
    if (!container.contains(fallback)) container.append(fallback);
    image.hidden = true;
    if (!container.contains(image)) {
      container.append(image);
    }
    image.src = source;
  }

  if (!site.icon) {
    container.append(fallback);
    return;
  }

  const image = document.createElement("img");
  image.alt = "";
  // Hidden lazy images may never load, so fetch these small navigation icons immediately.
  image.loading = "eager";
  image.hidden = true;
  image.addEventListener("load", () => {
    if (!isCurrentRender()) return;
    fallback.remove();
    image.hidden = false;
  });
  image.addEventListener("error", showFallback);
  // The card is still detached here; connectivity guards are only for async cache updates.
  container.append(fallback, image);
  image.src = site.icon;

  siteIconCacheStorage
    .load(site.icon)
    .then((entry) => {
      if (!isCurrentRender()) {
        return null;
      }

      if (entry?.dataUrl) {
        setImageSource(entry.dataUrl);
      }

      if (siteIconCacheStorage.isFresh(entry)) {
        return null;
      }

      return siteIconCacheStorage.refresh(site.icon);
    })
    .then((entry) => {
      if (entry?.dataUrl) {
        setImageSource(entry.dataUrl);
      }
    })
    .catch(() => {
      if (image.src !== site.icon && !container.contains(image)) {
        setImageSource(site.icon);
      }
    });
}

function handleSearchSubmit(event) {
  event.preventDefault();
  if (state.formattedJson) {
    showToast("JSON 已格式化。");
    return;
  }

  const query = state.query.trim();
  if (!query) {
    elements.searchInput.focus();
    return;
  }

  if (state.isEditing) {
    showToast("编辑模式下点击网站图标进行编辑。");
    return;
  }

  const currentEngine = getCurrentSearchEngine();
  if (currentEngine.opensConversation) {
    window.location.href = buildSearchUrl(currentEngine, query);
    if (currentEngine.opensConversationMessage) {
      showToast(currentEngine.opensConversationMessage);
    }
    return;
  }

  const matches = getVisibleSites();
  if (matches.length === 1) {
    window.location.href = matches[0].url;
    return;
  }

  if (matches.length === 0) {
    window.location.href = buildSearchUrl(currentEngine, query);
    return;
  }

  showToast(`找到 ${matches.length} 个匹配网站，点击卡片打开。`);
}

function buildSearchUrl(engine, query) {
  return engine.searchUrlTemplate.replace("{query}", encodeURIComponent(query));
}

function handleSearchDragEnter(event) {
  if (!isPotentialImageDrag(event.dataTransfer)) {
    return;
  }
  event.preventDefault();
  elements.searchBox.classList.add("is-image-dragover");
}

function handleSearchDragOver(event) {
  if (!isPotentialImageDrag(event.dataTransfer)) {
    return;
  }
  event.preventDefault();
  event.dataTransfer.dropEffect = "copy";
  elements.searchBox.classList.add("is-image-dragover");
}

function handleSearchDragLeave(event) {
  if (elements.searchBox.contains(event.relatedTarget)) {
    return;
  }
  elements.searchBox.classList.remove("is-image-dragover");
}

function handleSearchDrop(event) {
  if (!isPotentialImageDrag(event.dataTransfer)) {
    return;
  }

  event.preventDefault();
  elements.searchBox.classList.remove("is-image-dragover");

  const imageFile = getDroppedImageFile(event.dataTransfer);
  if (imageFile) {
    submitImageFileSearch(imageFile, getCurrentSearchEngine());
    return;
  }

  const imageUrl = getDroppedImageUrl(event.dataTransfer);
  if (imageUrl) {
    openImageUrlSearch(imageUrl, getCurrentSearchEngine());
    return;
  }

  showToast("请拖入图片文件或网页图片。");
}

function isPotentialImageDrag(dataTransfer) {
  if (!dataTransfer) {
    return false;
  }

  const types = Array.from(dataTransfer.types || []);
  if (types.includes("Files") || types.includes("text/uri-list") || types.includes("text/html")) {
    return true;
  }

  return Array.from(dataTransfer.items || []).some((item) => item.type.startsWith("image/"));
}

function getDroppedImageFile(dataTransfer) {
  return Array.from(dataTransfer.files || []).find((file) => file.type.startsWith("image/")) || null;
}

function getDroppedImageUrl(dataTransfer) {
  const html = dataTransfer.getData("text/html");
  if (html) {
    const doc = new DOMParser().parseFromString(html, "text/html");
    const image = doc.querySelector("img[src]");
    const src = image?.getAttribute("src") || "";
    if (isHttpUrl(src)) {
      return src;
    }
  }

  const uriList = dataTransfer.getData("text/uri-list");
  const uri = uriList
    .split("\n")
    .map((line) => line.trim())
    .find((line) => line && !line.startsWith("#"));

  if (isHttpUrl(uri)) {
    return uri;
  }

  const plainText = dataTransfer.getData("text/plain").trim();
  if (isHttpUrl(plainText)) {
    return plainText;
  }

  return "";
}

function isHttpUrl(value) {
  try {
    const url = new URL(value);
    return url.protocol === "http:" || url.protocol === "https:";
  } catch {
    return false;
  }
}

function openImageUrlSearch(imageUrl, engine) {
  const imageSearch = engine.imageSearch || {};
  if (imageSearch.urlTemplate) {
    const encodedUrl = encodeURIComponent(imageUrl);
    const targetUrl = imageSearch.urlTemplate.replaceAll("{url}", encodedUrl);
    window.open(targetUrl, "_blank", "noopener,noreferrer");
    showToast(`已用 ${imageSearch.label || engine.name} 打开图片搜索。`);
    return;
  }

  if (imageSearch.landingUrl) {
    window.open(imageSearch.landingUrl, "_blank", "noopener,noreferrer");
    showToast(`已打开 ${imageSearch.label || engine.name}，请在页面中粘贴图片链接。`);
    return;
  }

  showToast(imageSearch.unsupportedMessage || `${engine.name} 暂不支持以图搜图。`);
}

function submitImageFileSearch(file, engine) {
  const imageSearch = engine.imageSearch || {};
  if (!imageSearch.directFileUpload || !imageSearch.uploadUrl || !imageSearch.uploadField) {
    if (imageSearch.landingUrl) {
      window.open(imageSearch.landingUrl, "_blank", "noopener,noreferrer");
      showToast(`已打开 ${imageSearch.label || engine.name}，请在页面中重新拖入或上传图片。`);
      return;
    }

    showToast(imageSearch.unsupportedMessage || `${engine.name} 暂不支持本地图片搜索。`);
    return;
  }

  try {
    const form = document.createElement("form");
    form.action = imageSearch.uploadUrl;
    form.method = "POST";
    form.enctype = "multipart/form-data";
    form.target = "_blank";
    form.hidden = true;

    const fileInput = document.createElement("input");
    fileInput.type = "file";
    fileInput.name = imageSearch.uploadField;

    const transfer = new DataTransfer();
    transfer.items.add(file);
    fileInput.files = transfer.files;

    const filenameInput = document.createElement("input");
    filenameInput.type = "hidden";
    filenameInput.name = "filename";
    filenameInput.value = file.name || "image";

    form.append(fileInput, filenameInput);
    document.body.append(form);
    form.submit();
    form.remove();
    showToast(`已将图片发送到 ${imageSearch.label || engine.name}。`);
  } catch (error) {
    console.error(error);
    showToast("浏览器不允许直接提交此图片，请拖入网页图片试试。");
  }
}

function openModal() {
  closeSearchWheel();
  elements.modalBackdrop.hidden = false;
  elements.editModal.hidden = false;
  elements.editModal.setAttribute("aria-hidden", "false");
}

function closeModal() {
  elements.modalBackdrop.hidden = true;
  elements.editModal.hidden = true;
  elements.editModal.setAttribute("aria-hidden", "true");
  state.backgroundDraft = null;
}

function openGroupModal(group) {
  elements.modalTitle.textContent = group ? "编辑分组" : "新增分组";
  elements.groupForm.hidden = false;
  elements.siteForm.hidden = true;
  elements.backgroundForm.hidden = true;
  elements.groupIdInput.value = group?.id || "";
  elements.groupNameInput.value = group?.name || "";
  elements.deleteGroupButton.hidden = !group;
  openModal();
  elements.groupNameInput.focus();
}

function openSiteModal(site, groupId) {
  elements.modalTitle.textContent = site ? "编辑网页" : "新增网页";
  elements.groupForm.hidden = true;
  elements.siteForm.hidden = false;
  elements.backgroundForm.hidden = true;
  renderSiteGroupOptions(site?.groupId || groupId || state.activeGroupId);
  elements.siteIdInput.value = site?.id || "";
  elements.siteNameInput.value = site?.name || "";
  elements.siteUrlInput.value = site?.url || "";
  elements.siteIconInput.value = site?.icon || "";
  openModal();
  elements.siteNameInput.focus();
}

async function openBackgroundModal() {
  elements.modalTitle.textContent = "设置背景";
  elements.groupForm.hidden = true;
  elements.siteForm.hidden = true;
  elements.backgroundForm.hidden = false;
  state.backgroundDraft = { ...getBackgroundSettings() };

  if (state.backgroundDraft.type === "image" && !state.backgroundDraft.image && state.backgroundDraft.imageKey) {
    state.backgroundDraft.image = await backgroundAssetStorage.load(state.backgroundDraft.imageKey).catch((error) => {
      console.warn("Failed to load background image for preview.", error);
      return "";
    });
  }

  renderBackgroundChoices();
  openModal();
  elements.backgroundChoiceButtons[0]?.focus();
}

function renderBackgroundChoices() {
  const draft = state.backgroundDraft || getBackgroundSettings();
  const previewType = draft.type === "image" && !draft.image ? "white" : draft.type;

  elements.backgroundChoiceButtons.forEach((button) => {
    const isActive = button.dataset.backgroundChoice === draft.type;
    button.classList.toggle("is-active", isActive);
    button.setAttribute("aria-checked", String(isActive));
  });

  elements.backgroundPreview.dataset.preview = previewType;
  elements.backgroundPreview.style.backgroundImage =
    draft.type === "image" && draft.image ? toCssUrl(draft.image) : "";

  if (draft.type === "black") {
    elements.backgroundPreviewText.textContent = "黑色背景";
  } else if (draft.type === "image") {
    elements.backgroundPreviewText.textContent = draft.image ? "自定义图片" : "未选择图片";
  } else {
    elements.backgroundPreviewText.textContent = "白色背景";
  }

  elements.uploadBackgroundImageButton.textContent = draft.image ? "更换图片" : "选择图片";
  elements.clearBackgroundImageButton.hidden = !draft.image;
}

function selectBackgroundChoice(type) {
  if (!BACKGROUND_TYPES.has(type)) {
    return;
  }

  if (!state.backgroundDraft) {
    state.backgroundDraft = { ...getBackgroundSettings() };
  }

  state.backgroundDraft.type = type;
  if (type !== "image") {
    state.backgroundDraft.image = "";
  } else if (!state.backgroundDraft.image) {
    elements.backgroundImageInput.click();
  }

  renderBackgroundChoices();
}

function renderSiteGroupOptions(selectedGroupId) {
  elements.siteGroupInput.replaceChildren();
  state.data.groups.forEach((group) => {
    const option = document.createElement("option");
    option.value = group.id;
    option.textContent = group.name;
    elements.siteGroupInput.append(option);
  });
  elements.siteGroupInput.value = selectedGroupId || state.data.groups[0]?.id || "";
}

async function handleGroupSubmit(event) {
  event.preventDefault();
  const name = elements.groupNameInput.value.trim();
  if (!name) {
    showToast("请输入分组名称。");
    return;
  }

  const nextData = cloneData(state.data);
  const groupId = elements.groupIdInput.value;

  if (groupId) {
    const group = nextData.groups.find((item) => item.id === groupId);
    if (group) {
      group.name = name;
    }
  } else {
    const newGroup = { id: createId("group"), name };
    nextData.groups.push(newGroup);
    state.activeGroupId = newGroup.id;
  }

  await saveData(nextData);
  closeModal();
  showToast("分组已保存。");
}

async function handleDeleteGroup() {
  const groupId = elements.groupIdInput.value;
  const group = state.data.groups.find((item) => item.id === groupId);
  if (!group) {
    return;
  }

  if (state.data.groups.length <= 1) {
    showToast("至少保留一个分组。");
    return;
  }

  const confirmed = window.confirm(`删除「${group.name}」会同时删除其中的网站。继续吗？`);
  if (!confirmed) {
    return;
  }

  const nextData = cloneData(state.data);
  nextData.groups = nextData.groups.filter((item) => item.id !== groupId);
  nextData.sites = nextData.sites.filter((site) => site.groupId !== groupId);

  if (state.activeGroupId === groupId) {
    state.activeGroupId = nextData.groups[0].id;
  }

  await saveData(nextData);
  closeModal();
  showToast("分组已删除。");
}

async function handleSiteSubmit(event) {
  event.preventDefault();
  const groupId = elements.siteGroupInput.value;
  const name = elements.siteNameInput.value.trim();
  const url = normalizeUrl(elements.siteUrlInput.value);
  const icon = elements.siteIconInput.value.trim();

  if (!groupId || !name || !url) {
    showToast("请填写网页名称和链接。");
    return;
  }

  const nextData = cloneData(state.data);
  const siteId = elements.siteIdInput.value;

  if (countSitesInGroup(nextData, groupId, siteId) >= MAX_SITES_PER_GROUP) {
    showToast(`每个分组最多 ${MAX_SITES_PER_GROUP} 个网站。`);
    return;
  }

  if (siteId) {
    const site = nextData.sites.find((item) => item.id === siteId);
    if (site) {
      site.groupId = groupId;
      site.name = name;
      site.url = url;
      site.icon = icon;
    }
  } else {
    nextData.sites.push({
      id: createId("site"),
      groupId,
      name,
      url,
      icon,
    });
    state.activeGroupId = groupId;
  }

  await saveData(nextData);
  closeModal();
  showToast("网页已保存。");
}

function handleFetchSiteIcon() {
  const url = normalizeUrl(elements.siteUrlInput.value);
  const icon = getFaviconUrl(url);

  if (!icon) {
    showToast("请先填写有效的网页链接。");
    elements.siteUrlInput.focus();
    return;
  }

  elements.siteIconInput.value = icon;
  showToast("已获取图标链接。");
  elements.siteIconInput.focus();
}

async function handleBackgroundSubmit(event) {
  event.preventDefault();
  const background = normalizeBackgroundSettings(state.backgroundDraft || getBackgroundSettings());

  if (state.backgroundDraft?.type === "image" && !state.backgroundDraft.image) {
    showToast("请先选择一张背景图片。");
    return;
  }

  const nextData = cloneData(state.data);
  nextData.settings.background = background;

  try {
    await saveData(nextData);
    closeModal();
    showToast("背景已保存。");
  } catch (error) {
    console.error(error);
    showToast("背景保存失败，浏览器可能拒绝了本地存储。");
  }
}

async function handleBackgroundImageChange(event) {
  const [file] = event.target.files;
  if (!file) {
    return;
  }

  try {
    if (!file.type.startsWith("image/")) {
      showToast("请选择图片文件。");
      return;
    }

    if (file.size > MAX_BACKGROUND_IMAGE_BYTES) {
      showToast("图片过大，请选择 3MB 以内的图片。");
      return;
    }

    const image = await readFileAsDataUrl(file);
    state.backgroundDraft = {
      type: "image",
      image,
    };
    renderBackgroundChoices();
  } catch (error) {
    console.error(error);
    showToast("读取图片失败，请换一张图片试试。");
  } finally {
    event.target.value = "";
  }
}

function handleClearBackgroundImage() {
  state.backgroundDraft = { ...DEFAULT_BACKGROUND_SETTINGS };
  renderBackgroundChoices();
}

function readFileAsDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.addEventListener("load", () => resolve(String(reader.result || "")));
    reader.addEventListener("error", () => reject(reader.error));
    reader.readAsDataURL(file);
  });
}

async function deleteSiteWithUndo(siteId) {
  const index = state.data.sites.findIndex((site) => site.id === siteId);
  if (index < 0) {
    return;
  }

  const site = cloneData(state.data.sites[index]);
  const nextData = cloneData(state.data);
  nextData.sites.splice(index, 1);
  state.pendingUndo = { site, index };

  await saveData(nextData);
  showToast(`已删除「${site.name}」。`, "撤销", undoLastDelete);
}

async function undoLastDelete() {
  if (!state.pendingUndo) {
    return;
  }

  const { site, index } = state.pendingUndo;
  const nextData = cloneData(state.data);
  const groupExists = nextData.groups.some((group) => group.id === site.groupId);

  if (!groupExists) {
    state.pendingUndo = null;
    showToast("原分组不存在，无法撤销。");
    return;
  }

  if (nextData.sites.some((item) => item.id === site.id)) {
    state.pendingUndo = null;
    showToast("网页已存在，无需撤销。");
    return;
  }

  if (countSitesInGroup(nextData, site.groupId) >= MAX_SITES_PER_GROUP) {
    state.pendingUndo = null;
    showToast(`该分组已满，无法撤销。`);
    return;
  }

  nextData.sites.splice(Math.min(index, nextData.sites.length), 0, site);
  state.activeGroupId = site.groupId;
  state.pendingUndo = null;
  hideToast();
  await saveData(nextData);
  showToast("已撤销删除。");
}

async function saveData(nextData) {
  state.data = await storage.save(nextData);
  ensureActiveGroup();
  render();
}

async function handleExport() {
  const json = await storage.export();
  const blob = new Blob([json], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `my-start-${new Date().toISOString().slice(0, 10)}.json`;
  document.body.append(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
  showToast("配置已导出。");
}

async function handleImport(event) {
  const [file] = event.target.files;
  if (!file) {
    return;
  }

  try {
    const text = await file.text();
    const imported = JSON.parse(text);
    state.data = await storage.import(imported);
    state.activeGroupId = state.data.groups[0]?.id || "";
    state.query = "";
    state.formattedJson = "";
    state.pendingUndo = null;
    elements.searchInput.value = "";
    closeModal();
    render();
    showToast("配置已导入。");
  } catch (error) {
    console.error(error);
    showToast("导入失败，请检查 JSON 文件。");
  } finally {
    event.target.value = "";
  }
}

function showToast(message, actionLabel = "", action = null) {
  window.clearTimeout(state.toastTimer);
  elements.toastMessage.textContent = message;
  state.toastAction = action;

  if (actionLabel && typeof action === "function") {
    elements.toastAction.hidden = false;
    elements.toastAction.textContent = actionLabel;
  } else {
    elements.toastAction.hidden = true;
    elements.toastAction.textContent = "";
  }

  elements.toast.classList.add("is-visible");
  state.toastTimer = window.setTimeout(() => {
    hideToast();
  }, action ? 5200 : 2400);
}

function hideToast() {
  window.clearTimeout(state.toastTimer);
  elements.toast.classList.remove("is-visible");
  elements.toastAction.hidden = true;
  elements.toastAction.textContent = "";
  state.toastAction = null;
}
