const converterElements = {};

const converterState = {
  output: "",
  toastTimer: 0,
};

document.addEventListener("DOMContentLoaded", initConverterPage);

function initConverterPage() {
  cacheConverterElements();
  bindConverterEvents();
  updateConverterOutput("");
}

function cacheConverterElements() {
  converterElements.form = document.querySelector("#converterForm");
  converterElements.sessionInput = document.querySelector("#sessionInput");
  converterElements.sessionFileInput = document.querySelector("#sessionFileInput");
  converterElements.sessionFileName = document.querySelector("#sessionFileName");
  converterElements.clearButton = document.querySelector("#clearConverterButton");
  converterElements.output = document.querySelector("#convertedOutput");
  converterElements.copyButton = document.querySelector("#copyConvertedButton");
  converterElements.downloadButton = document.querySelector("#downloadConvertedButton");
  converterElements.status = document.querySelector("#converterStatus");
  converterElements.toast = document.querySelector("#toast");
  converterElements.toastMessage = document.querySelector("#toastMessage");
}

function bindConverterEvents() {
  converterElements.form.addEventListener("submit", handleConverterSubmit);
  converterElements.sessionInput.addEventListener("input", () => {
    converterElements.sessionFileName.textContent = "";
  });
  converterElements.sessionFileInput.addEventListener("change", handleSessionFileChange);
  converterElements.clearButton.addEventListener("click", clearConverter);
  converterElements.copyButton.addEventListener("click", copyConvertedOutput);
  converterElements.downloadButton.addEventListener("click", downloadConvertedOutput);
}

function handleConverterSubmit(event) {
  event.preventDefault();
  convertCurrentInput();
}

async function handleSessionFileChange(event) {
  const [file] = event.target.files;
  if (!file) {
    return;
  }

  try {
    converterElements.sessionInput.value = await file.text();
    converterElements.sessionFileName.textContent = file.name;
    convertCurrentInput();
  } catch (error) {
    console.error(error);
    showConverterToast("读取文件失败，请重试。");
  } finally {
    event.target.value = "";
  }
}

function convertCurrentInput() {
  try {
    const output = window.SessionConverter.formatCodexTokenFile(converterElements.sessionInput.value);
    updateConverterOutput(output);
    converterElements.status.textContent = "转换完成";
    showConverterToast("已转换为 Codex JSON。");
  } catch (error) {
    updateConverterOutput("");
    converterElements.status.textContent = error.message;
    showConverterToast(error.message);
  }
}

function updateConverterOutput(output) {
  converterState.output = output;
  converterElements.output.textContent = output;
  converterElements.copyButton.disabled = !output;
  converterElements.downloadButton.disabled = !output;

  if (!output) {
    converterElements.status.textContent = "等待转换";
  }
}

function clearConverter() {
  converterElements.sessionInput.value = "";
  converterElements.sessionFileName.textContent = "";
  updateConverterOutput("");
  converterElements.sessionInput.focus();
}

async function copyConvertedOutput() {
  if (!converterState.output) {
    return;
  }

  try {
    await navigator.clipboard.writeText(converterState.output);
    showConverterToast("已复制 JSON。");
  } catch (error) {
    console.error(error);
    showConverterToast("复制失败，请手动选择内容。");
  }
}

function downloadConvertedOutput() {
  if (!converterState.output) {
    return;
  }

  const blob = new Blob([converterState.output], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = "kk.json";
  document.body.append(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
  showConverterToast("JSON 文件已下载。");
}

function showConverterToast(message) {
  window.clearTimeout(converterState.toastTimer);
  converterElements.toastMessage.textContent = message;
  converterElements.toast.classList.add("is-visible");
  converterState.toastTimer = window.setTimeout(() => {
    converterElements.toast.classList.remove("is-visible");
  }, 2400);
}
