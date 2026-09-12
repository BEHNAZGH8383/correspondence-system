const apiUrl = "/api";
const savedTokenKey = "correspondence_token";

// وضعیت فعلی برنامه را اینجا نگه می‌داریم.
const appState = {
    token: localStorage.getItem(savedTokenKey),
    user: null,
    selectedLetter: null,
};

const dom = {
    loginView: document.getElementById("loginView"),
    appView: document.getElementById("appView"),
    loginForm: document.getElementById("loginForm"),
    registerForm: document.getElementById("registerForm"),
    authSwitch: document.getElementById("authSwitchButton"),
    authHint: document.getElementById("authHint"),
    demoUsers: document.getElementById("demoUsers"),
    loginMessage: document.getElementById("loginMessage"),
    currentUserName: document.getElementById("currentUserName"),
    logoutButton: document.getElementById("logoutButton"),
    letterForm: document.getElementById("letterForm"),
    receiverId: document.getElementById("receiverId"),
    composeMessage: document.getElementById("composeMessage"),
    inboxList: document.getElementById("inboxList"),
    sentList: document.getElementById("sentList"),
    dialog: document.getElementById("letterDialog"),
    dialogDirection: document.getElementById("dialogDirection"),
    dialogSubject: document.getElementById("dialogSubject"),
    dialogMeta: document.getElementById("dialogMeta"),
    dialogBody: document.getElementById("dialogBody"),
    downloadButton: document.getElementById("downloadButton"),
};

function setMessage(box, text = "", type = "") {
    box.textContent = text;
    box.className = `message ${type}`.trim();
}

async function apiRequest(path, options = {}) {
    const headers = new Headers(options.headers || {});

    if (appState.token) {
        headers.set("Authorization", `Bearer ${appState.token}`);
    }

    if (options.body && !(options.body instanceof FormData)) {
        headers.set("Content-Type", "application/json");
    }

    const response = await fetch(`${apiUrl}${path}`, { ...options, headers });

    if (response.status === 401 && path !== "/auth/login") {
        doLogout();
        throw new Error("نشست شما پایان یافته است.");
    }

    if (!response.ok) {
        let errorText = "در انجام درخواست مشکلی پیش آمد.";
        try {
            const result = await response.json();
            if (typeof result.detail === "string") errorText = result.detail;
        } catch (_) {
            errorText = "پاسخ سرور قابل خواندن نیست.";
        }
        throw new Error(errorText);
    }

    const type = response.headers.get("content-type") || "";
    return type.includes("application/json") ? response.json() : response;
}

function showRegisterForm() {
    setMessage(dom.loginMessage);
    dom.loginForm.classList.add("hidden");
    dom.registerForm.classList.remove("hidden");
    dom.demoUsers.classList.add("hidden");
    dom.authHint.textContent = "اطلاعات زیر را وارد کنید تا حساب جدید ساخته شود.";
    dom.authSwitch.textContent = "بازگشت به ورود";
}

function showLoginForm() {
    setMessage(dom.loginMessage);
    dom.registerForm.classList.add("hidden");
    dom.loginForm.classList.remove("hidden");
    dom.demoUsers.classList.remove("hidden");
    dom.authHint.textContent = "برای ورود، نام کاربری و رمز عبور خود را وارد کنید.";
    dom.authSwitch.textContent = "ثبت نام کاربر جدید";
}

async function createAccount(event) {
    event.preventDefault();
    setMessage(dom.loginMessage, "در حال ساخت حساب...");

    const form = new FormData(dom.registerForm);
    const password = form.get("password");
    const repeatedPassword = form.get("password_confirm");

    if (password !== repeatedPassword) {
        setMessage(dom.loginMessage, "رمز عبور و تکرار آن یکسان نیست.", "error");
        return;
    }

    try {
        const result = await apiRequest("/auth/register", {
            method: "POST",
            body: JSON.stringify({
                username: form.get("username"),
                full_name: form.get("full_name"),
                password,
            }),
        });

        appState.token = result.access_token;
        appState.user = result.user;
        localStorage.setItem(savedTokenKey, appState.token);
        dom.registerForm.reset();
        await enterDashboard();
    } catch (error) {
        setMessage(dom.loginMessage, error.message, "error");
    }
}

async function signIn(event) {
    event.preventDefault();
    setMessage(dom.loginMessage, "در حال ورود...");
    const form = new FormData(dom.loginForm);

    try {
        const result = await apiRequest("/auth/login", {
            method: "POST",
            body: JSON.stringify({ username: form.get("username"), password: form.get("password") }),
        });

        appState.token = result.access_token;
        appState.user = result.user;
        localStorage.setItem(savedTokenKey, appState.token);
        await enterDashboard();
    } catch (error) {
        setMessage(dom.loginMessage, error.message, "error");
    }
}

function doLogout() {
    appState.token = null;
    appState.user = null;
    appState.selectedLetter = null;
    localStorage.removeItem(savedTokenKey);
    dom.appView.classList.add("hidden");
    dom.loginView.classList.remove("hidden");
    dom.loginForm.reset();
    showLoginForm();
}

async function enterDashboard() {
    if (!appState.user) appState.user = await apiRequest("/auth/me");

    dom.currentUserName.textContent = appState.user.full_name;
    dom.loginView.classList.add("hidden");
    dom.appView.classList.remove("hidden");
    setMessage(dom.loginMessage);

    await loadPeople();
    await loadLetters("inbox");
}

async function loadPeople() {
    const people = await apiRequest("/users");
    dom.receiverId.replaceChildren();

    const emptyOption = document.createElement("option");
    emptyOption.value = "";
    emptyOption.textContent = "یک گیرنده انتخاب کنید";
    emptyOption.disabled = true;
    emptyOption.selected = true;
    dom.receiverId.appendChild(emptyOption);

    people.forEach((person) => {
        const option = document.createElement("option");
        option.value = person.id;
        option.textContent = `${person.full_name} (${person.username})`;
        dom.receiverId.appendChild(option);
    });
}

function showDate(value) {
    return new Intl.DateTimeFormat("fa-IR", { dateStyle: "medium", timeStyle: "short" }).format(new Date(value));
}

function buildLetterRow(letter, boxType) {
    const row = document.createElement("button");
    row.type = "button";
    row.className = "letter-item";
    if (boxType === "inbox" && !letter.is_read) row.classList.add("unread");

    const main = document.createElement("span");
    main.className = "letter-main";
    const title = document.createElement("strong");
    title.textContent = letter.subject;
    const otherPerson = boxType === "inbox" ? letter.sender.full_name : letter.receiver.full_name;
    const direction = boxType === "inbox" ? "از" : "به";
    const person = document.createElement("span");
    person.textContent = `${direction}: ${otherPerson}`;
    main.append(title, person);

    const preview = document.createElement("span");
    preview.className = "letter-preview";
    preview.textContent = letter.body.length > 90 ? `${letter.body.slice(0, 90)}...` : letter.body;

    const date = document.createElement("span");
    date.className = "letter-date";
    date.textContent = showDate(letter.created_at);

    row.append(main, preview, date);
    row.addEventListener("click", () => openLetter(letter.id, boxType));
    return row;
}

async function loadLetters(boxType) {
    const list = boxType === "inbox" ? dom.inboxList : dom.sentList;
    list.innerHTML = '<p class="empty">در حال دریافت نامه‌ها...</p>';

    try {
        const letters = await apiRequest(`/letters/${boxType}`);
        list.replaceChildren();

        if (!letters.length) {
            const empty = document.createElement("p");
            empty.className = "empty";
            empty.textContent = boxType === "inbox" ? "نامه دریافتی وجود ندارد." : "نامه ارسالی وجود ندارد.";
            list.appendChild(empty);
            return;
        }

        letters.forEach((letter) => list.appendChild(buildLetterRow(letter, boxType)));
    } catch (error) {
        list.innerHTML = `<p class="empty"></p>`;
        list.querySelector(".empty").textContent = error.message;
    }
}

async function submitLetter(event) {
    event.preventDefault();
    setMessage(dom.composeMessage, "در حال ارسال...");

    try {
        const form = new FormData(dom.letterForm);
        const result = await apiRequest("/letters", { method: "POST", body: form });
        dom.letterForm.reset();
        setMessage(dom.composeMessage, `نامه «${result.subject}» ارسال شد.`, "success");
        await loadPeople();
        await loadLetters("sent");
    } catch (error) {
        setMessage(dom.composeMessage, error.message, "error");
    }
}

async function openLetter(letterId, boxType) {
    try {
        const letter = await apiRequest(`/letters/${letterId}`);
        appState.selectedLetter = letter;
        dom.dialogDirection.textContent = boxType === "inbox" ? "نامه دریافتی" : "نامه ارسال‌شده";
        dom.dialogSubject.textContent = letter.subject;
        dom.dialogMeta.textContent = `فرستنده: ${letter.sender.full_name} | گیرنده: ${letter.receiver.full_name} | ${showDate(letter.created_at)}`;
        dom.dialogBody.textContent = letter.body;
        dom.downloadButton.classList.toggle("hidden", !letter.has_attachment);
        dom.downloadButton.textContent = letter.has_attachment ? `دانلود ${letter.attachment_name}` : "";
        dom.dialog.showModal();
        if (boxType === "inbox") await loadLetters("inbox");
    } catch (error) {
        window.alert(error.message);
    }
}

async function getAttachment() {
    if (!appState.selectedLetter) return;

    try {
        const response = await apiRequest(`/letters/${appState.selectedLetter.id}/attachment`);
        const fileBlob = await response.blob();
        const tempUrl = URL.createObjectURL(fileBlob);
        const link = document.createElement("a");
        link.href = tempUrl;
        link.download = appState.selectedLetter.attachment_name || "attachment";
        document.body.appendChild(link);
        link.click();
        link.remove();
        URL.revokeObjectURL(tempUrl);
    } catch (error) {
        window.alert(error.message);
    }
}

function switchPanel(viewName) {
    document.querySelectorAll(".tab").forEach((tab) => tab.classList.toggle("active", tab.dataset.view === viewName));

    ["inbox", "sent", "compose"].forEach((panelName) => {
        document.getElementById(`${panelName}Panel`).classList.toggle("hidden", panelName !== viewName);
    });

    if (viewName === "inbox" || viewName === "sent") loadLetters(viewName);
}

dom.loginForm.addEventListener("submit", signIn);
dom.registerForm.addEventListener("submit", createAccount);
dom.authSwitch.addEventListener("click", () => {
    if (dom.registerForm.classList.contains("hidden")) showRegisterForm();
    else showLoginForm();
});
dom.logoutButton.addEventListener("click", doLogout);
dom.letterForm.addEventListener("submit", submitLetter);
dom.downloadButton.addEventListener("click", getAttachment);
document.getElementById("closeDialogButton").addEventListener("click", () => dom.dialog.close());

document.querySelectorAll(".tab").forEach((tab) => tab.addEventListener("click", () => switchPanel(tab.dataset.view)));
document.querySelectorAll("[data-refresh]").forEach((button) => button.addEventListener("click", () => loadLetters(button.dataset.refresh)));

async function startApp() {
    if (!appState.token) return;
    try {
        await enterDashboard();
    } catch (_) {
        doLogout();
    }
}

startApp();
