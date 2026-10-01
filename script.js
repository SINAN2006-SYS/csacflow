/* =========================================================
   CSAC TASK MANAGEMENT SYSTEM
   COMPLETE JAVASCRIPT
========================================================= */

"use strict";


/* =========================================================
    SUPABASE
========================================================= */

const supabaseClient = window.supabase.createClient(
     window.SUPABASE_URL,
     window.SUPABASE_ANON_KEY
);

let users = [];



/* =========================================================
   APPLICATION STATE
========================================================= */

let currentUser = null;

let tasks = [];

let activities = [];

let deleteTaskId = null;

let toastTimer = null;


/* =========================================================
   DOM REFERENCES
========================================================= */

const $ = (selector) =>
    document.querySelector(selector);

const $$ = (selector) =>
    document.querySelectorAll(selector);


/* =========================================================
   INITIALIZATION
========================================================= */

document.addEventListener(
    "DOMContentLoaded",
    initializeApp
);


async function initializeApp() {

    setupLogin();

    setupNavigation();

    setupTaskControls();

    setupModalControls();

    setupDeleteControls();

    setupGlobalKeyboard();

    await restoreSession();

}


/* =========================================================
   STORAGE
========================================================= */

async function loadStorage() {

    const [profilesResult, tasksResult, activityResult] =
        await Promise.all([
            supabaseClient.from("profiles").select("*").order("name"),
            supabaseClient.from("tasks").select("*").order("updated_at", { ascending: false }),
            supabaseClient.from("activity").select("*").order("created_at", { ascending: false }).limit(100)
        ]);

    const failedQuery = [profilesResult, tasksResult, activityResult]
        .find(result => result.error);

    if (failedQuery) {
        throw failedQuery.error;
    }

    users = profilesResult.data.map(profile => ({
        id: profile.id,
        email: profile.email,
        name: profile.name,
        role: profile.role,
        position: profile.position,
        team: profile.team
    }));

    tasks = tasksResult.data.map(mapTaskFromDatabase);

    activities = activityResult.data.map(activity => ({
        id: activity.id,
        message: activity.message,
        time: activity.created_at
    }));

}


function mapTaskFromDatabase(task) {

    return {
        id: task.id,
        title: task.title,
        description: task.description || "",
        assigneeId: task.assignee_id,
        team: task.team,
        priority: task.priority,
        dueDate: task.due_date || "",
        progress: task.progress,
        status: task.status,
        createdBy: task.created_by,
        createdAt: task.created_at,
        updatedAt: task.updated_at
    };

}


/* =========================================================
   LOGIN
========================================================= */

function setupLogin() {

    const loginForm =
        $("#loginForm");

    loginForm.addEventListener(
        "submit",
        handleLogin
    );


    $("#togglePassword")
        .addEventListener(
            "click",
            togglePassword
        );

}


async function handleLogin(event) {

    event.preventDefault();

    const email =
        $("#loginId")
            .value
            .trim()
            .toLowerCase();

    const password =
        $("#loginPassword")
            .value;

    const { data, error } =
        await supabaseClient.auth.signInWithPassword({
            email,
            password
        });


    if (error || !data.user) {

        $("#loginError").textContent =
            error?.message || "Incorrect email or password.";

        return;

    }


    try {

        await loadCurrentUser(data.user);
        await loadStorage();

    } catch (loadError) {

        $("#loginError").textContent =
            loadError.message;

        await supabaseClient.auth.signOut();

        return;

    }


    $("#loginError").textContent = "";


    addActivity(
        `${currentUser.name} logged into the system.`
    );


    showApplication();

}


async function restoreSession() {

    const { data } =
        await supabaseClient.auth.getSession();


    if (!data.session) {

        showLogin();

        return;

    }


    try {

        await loadCurrentUser(data.session.user);
        await loadStorage();
        showApplication();

    } catch (error) {

        console.error("Session loading error:", error);
        await supabaseClient.auth.signOut();
        showLogin();

    }

}


async function loadCurrentUser(authUser) {

    const { data, error } =
        await supabaseClient
            .from("profiles")
            .select("*")
            .eq("id", authUser.id)
            .single();

    if (error) {
        throw new Error("Your profile could not be loaded.");
    }

    currentUser = {
        id: data.id,
        email: data.email || authUser.email,
        name: data.name,
        role: data.role,
        position: data.position,
        team: data.team
    };

}


function showLogin() {

    $("#loginScreen")
        .classList.remove("hidden");

    $("#app")
        .classList.add("hidden");

}


function showApplication() {

    $("#loginScreen")
        .classList.add("hidden");

    $("#app")
        .classList.remove("hidden");


    updateUserInterface();

    renderDashboard();

    renderTasks();

    renderMembers();

    renderActivities();

}


/* =========================================================
   LOGOUT
========================================================= */

$("#logoutBtn")
    ?.addEventListener(
        "click",
        logout
    );


async function logout() {

    if (currentUser) {

        addActivity(
            `${currentUser.name} logged out.`
        );

    }


    currentUser = null;


    await supabaseClient.auth.signOut();


    showLogin();


    $("#loginId").value = "";

    $("#loginPassword").value = "";

}


/* =========================================================
   USER INTERFACE
========================================================= */

function updateUserInterface() {

    if (!currentUser) return;


    $("#sidebarName").textContent =
        currentUser.name;

    $("#sidebarRole").textContent =
        `${currentUser.position}`;


    $("#welcomeName").textContent =
        currentUser.name;


    $("#sidebarAvatar").textContent =
        getInitials(
            currentUser.name
        );


    $("#currentDate").textContent =
        new Date().toLocaleDateString(
            "en-IN",
            {
                weekday: "long",
                day: "numeric",
                month: "long",
                year: "numeric"
            }
        );


    populateTeamFilter();

}


/* =========================================================
   NAVIGATION
========================================================= */

function setupNavigation() {

    $$(".nav-item")
        .forEach(button => {

            button.addEventListener(
                "click",
                () => {

                    showSection(
                        button.dataset.section
                    );

                }
            );

        });


    $$("[data-section-link]")
        .forEach(button => {

            button.addEventListener(
                "click",
                () => {

                    showSection(
                        button.dataset.sectionLink
                    );

                }
            );

        });

}


function showSection(section) {

    $$(".nav-item")
        .forEach(button => {

            button.classList.toggle(
                "active",
                button.dataset.section === section
            );

        });


    $$(".page-section")
        .forEach(page => {

            page.classList.remove(
                "active-section"
            );

        });


    const target =
        document.getElementById(
            `${section}Section`
        );


    if (target) {

        target.classList.add(
            "active-section"
        );

    }


    const titles = {

        dashboard: [
            "Dashboard",
            "Manage your team's work efficiently."
        ],

        tasks: [
            "Tasks",
            "Create, assign and track work."
        ],

        members: [
            "Members",
            "View members available to you."
        ],

        activity: [
            "Activity",
            "Review recent system actions."
        ]

    };


    if (titles[section]) {

        $("#pageTitle").textContent =
            titles[section][0];

        $("#pageSubtitle").textContent =
            titles[section][1];

    }


    if (section === "dashboard") {

        renderDashboard();

    }

    if (section === "tasks") {

        renderTasks();

    }

    if (section === "members") {

        renderMembers();

    }

    if (section === "activity") {

        renderActivities();

    }

}


/* =========================================================
   ACCESS CONTROL
========================================================= */

function isAdmin() {

    return (
        currentUser &&
        currentUser.role === "Admin"
    );

}


function isHead() {

    return (
        currentUser &&
        currentUser.role === "Head"
    );

}


/*
    ADMIN:
    Can assign to everybody.

    HEAD:
    Can assign only to their own team.

    MEMBER:
    Cannot assign tasks.
*/

function canCreateTask() {

    return (
        currentUser &&
        (
            currentUser.role === "Admin" ||
            currentUser.role === "Head"
        )
    );

}


function canAssignTo(user) {

    if (!currentUser) return false;

    if (isAdmin()) {

        return true;

    }


    if (isHead()) {

        return (
            user.team === currentUser.team &&
            (
                user.role === "Member" ||
                user.id === currentUser.id
            )
        );

    }


    return false;

}


function canEditTask(task) {

    if (!currentUser) return false;


    if (isAdmin()) {

        return true;

    }


    if (isHead()) {

        return task.team === currentUser.team;

    }


    return task.assigneeId === currentUser.id;

}


function canDeleteTask(task) {

    if (!currentUser) return false;


    if (isAdmin()) {

        return true;

    }


    if (isHead()) {

        return task.team === currentUser.team;

    }


    return false;

}


function canViewTask(task) {

    if (!currentUser) return false;


    if (isAdmin()) {

        return true;

    }


    if (isHead()) {

        return task.team === currentUser.team;

    }


    return task.assigneeId === currentUser.id;

}


/* =========================================================
   TASK CONTROLS
========================================================= */

function setupTaskControls() {

    $("#openAddTaskBtn")
        .addEventListener(
            "click",
            openAddTaskModal
        );


    $("#taskSearch")
        .addEventListener(
            "input",
            renderTasks
        );


    $("#teamFilter")
        .addEventListener(
            "change",
            renderTasks
        );


    $("#statusFilter")
        .addEventListener(
            "change",
            renderTasks
        );


    $("#priorityFilter")
        .addEventListener(
            "change",
            renderTasks
        );


    $("#taskAssignee")
        .addEventListener(
            "change",
            updateSelectedTeam
        );


    $("#taskProgress")
        .addEventListener(
            "input",
            updateProgressLabel
        );

}


/* =========================================================
   MODAL
========================================================= */

function setupModalControls() {

    $("#closeModalBtn")
        .addEventListener(
            "click",
            closeTaskModal
        );


    $("#cancelTaskBtn")
        .addEventListener(
            "click",
            closeTaskModal
        );


    $("#taskModal")
        .addEventListener(
            "click",
            event => {

                if (
                    event.target ===
                    $("#taskModal")
                ) {

                    closeTaskModal();

                }

            }
        );


    $("#taskForm")
        .addEventListener(
            "submit",
            saveTask
        );

}


function openAddTaskModal() {

    if (!canCreateTask()) {

        showToast(
            "You do not have permission to assign tasks.",
            "error"
        );

        return;

    }


    $("#taskModalTitle").textContent =
        "Add New Task";


    $("#saveTaskBtn").textContent =
        "Add Task";


    $("#editingTaskId").value = "";

    $("#taskTitle").value = "";

    $("#taskDescription").value = "";

    $("#taskPriority").value =
        "medium";

    $("#taskDueDate").value = "";

    $("#taskProgress").value =
        "0";

    $("#progressValue").textContent =
        "0%";


    populateAssigneeSelect();


    $("#taskModal")
        .classList.remove("hidden");


    setTimeout(
        () => $("#taskTitle").focus(),
        50
    );

}


function openEditTaskModal(taskId) {

    const task =
        tasks.find(
            item => item.id === taskId
        );


    if (!task) return;


    if (!canEditTask(task)) {

        showToast(
            "You do not have permission to edit this task.",
            "error"
        );

        return;

    }


    $("#taskModalTitle").textContent =
        "Edit Task";


    $("#saveTaskBtn").textContent =
        "Save Changes";


    $("#editingTaskId").value =
        task.id;


    $("#taskTitle").value =
        task.title;


    $("#taskDescription").value =
        task.description || "";


    $("#taskPriority").value =
        task.priority;


    $("#taskDueDate").value =
        task.dueDate || "";


    $("#taskProgress").value =
        task.progress;


    $("#progressValue").textContent =
        `${task.progress}%`;


    populateAssigneeSelect(
        task.assigneeId
    );


    $("#taskAssignee").value =
        task.assigneeId;


    updateSelectedTeam();


    $("#taskModal")
        .classList.remove("hidden");


    setTimeout(
        () => $("#taskTitle").focus(),
        50
    );

}


function closeTaskModal() {

    $("#taskModal")
        .classList.add("hidden");

}


/* =========================================================
   ASSIGNEE SELECT
========================================================= */

function populateAssigneeSelect(
    selectedId = ""
) {

    const select =
        $("#taskAssignee");


    select.innerHTML = "";


    const available =
        users.filter(
            user => canAssignTo(user)
        );


    if (
        available.length === 0
    ) {

        const option =
            document.createElement("option");

        option.value = "";

        option.textContent =
            "No members available";

        select.appendChild(option);

        return;

    }


    available.forEach(user => {

        const option =
            document.createElement("option");

        option.value =
            user.id;

        option.textContent =
            `${user.name} — ${user.team}`;

        if (
            user.id === selectedId
        ) {

            option.selected = true;

        }

        select.appendChild(option);

    });


    updateSelectedTeam();

}


function updateSelectedTeam() {

    const selectedId =
        $("#taskAssignee").value;


    const user =
        users.find(
            item => item.id === selectedId
        );


    $("#taskTeam").value =
        user ? user.team : "";

}


/* =========================================================
   SAVE TASK
========================================================= */

async function saveTask(event) {

    event.preventDefault();


    if (!canCreateTask()) {

        showToast(
            "You do not have permission to create tasks.",
            "error"
        );

        return;

    }


    const title =
        $("#taskTitle")
            .value
            .trim();


    const description =
        $("#taskDescription")
            .value
            .trim();


    const assigneeId =
        $("#taskAssignee")
            .value;


    const priority =
        $("#taskPriority")
            .value;


    const dueDate =
        $("#taskDueDate")
            .value;


    const progress =
        Number(
            $("#taskProgress")
                .value
        );


    const assignee =
        users.find(
            user =>
                user.id === assigneeId
        );


    if (!title) {

        showToast(
            "Please enter a task title.",
            "error"
        );

        return;

    }


    if (!assignee) {

        showToast(
            "Please select a valid member.",
            "error"
        );

        return;

    }


    if (!canAssignTo(assignee)) {

        showToast(
            "You cannot assign work to this person.",
            "error"
        );

        return;

    }


    const editingId =
        $("#editingTaskId").value;


    if (editingId) {

        await updateExistingTask(
            editingId,
            {
                title,
                description,
                assigneeId,
                team: assignee.team,
                priority,
                dueDate,
                progress
            }
        );

    } else {

        await createNewTask({

            title,

            description,

            assigneeId,

            team: assignee.team,

            priority,

            dueDate,

            progress

        });

    }


    closeTaskModal();

    renderAll();

}


/* =========================================================
   CREATE TASK
========================================================= */

async function createNewTask(data) {

    const { data: insertedTask, error } =
        await supabaseClient
            .from("tasks")
            .insert({
                title: data.title,
                description: data.description,
                assignee_id: data.assigneeId,
                team: data.team,
                priority: data.priority,
                due_date: data.dueDate || null,
                progress: data.progress,
                status: getStatusFromProgress(data.progress),
                created_by: currentUser.id
            })
            .select()
            .single();

    if (error) {
        showToast(error.message, "error");
        return;
    }

    const task = mapTaskFromDatabase(insertedTask);


    tasks.unshift(task);


    addActivity(
        `${currentUser.name} assigned "${task.title}" to ${getUserName(task.assigneeId)}.`
    );


    showToast(
        "Task added successfully.",
        "success"
    );

}


/* =========================================================
   UPDATE TASK
========================================================= */

async function updateExistingTask(
    taskId,
    changes
) {

    const task =
        tasks.find(
            item => item.id === taskId
        );


    if (!task) return;


    const oldAssignee =
        task.assigneeId;


    const { data: updatedTask, error } =
        await supabaseClient
            .from("tasks")
            .update({
                title: changes.title,
                description: changes.description,
                assignee_id: changes.assigneeId,
                team: changes.team,
                priority: changes.priority,
                due_date: changes.dueDate || null,
                progress: changes.progress,
                status: getStatusFromProgress(changes.progress)
            })
            .eq("id", taskId)
            .select()
            .single();

    if (error) {
        showToast(error.message, "error");
        return;
    }

    Object.assign(task, mapTaskFromDatabase(updatedTask));


    addActivity(
        `${currentUser.name} updated "${task.title}".`
    );


    if (
        oldAssignee !==
        task.assigneeId
    ) {

        addActivity(
            `"${task.title}" was reassigned to ${getUserName(task.assigneeId)}.`
        );

    }


    showToast(
        "Task updated successfully.",
        "success"
    );

}


/* =========================================================
   DELETE
========================================================= */

function setupDeleteControls() {

    $("#cancelDeleteBtn")
        .addEventListener(
            "click",
            closeDeleteModal
        );


    $("#confirmDeleteBtn")
        .addEventListener(
            "click",
            confirmDelete
        );


    $("#deleteModal")
        .addEventListener(
            "click",
            event => {

                if (
                    event.target ===
                    $("#deleteModal")
                ) {

                    closeDeleteModal();

                }

            }
        );

}


function openDeleteModal(taskId) {

    const task =
        tasks.find(
            item => item.id === taskId
        );


    if (!task) return;


    if (!canDeleteTask(task)) {

        showToast(
            "You do not have permission to delete this task.",
            "error"
        );

        return;

    }


    deleteTaskId = taskId;


    $("#deleteModal")
        .classList.remove("hidden");

}


function closeDeleteModal() {

    deleteTaskId = null;

    $("#deleteModal")
        .classList.add("hidden");

}


async function confirmDelete() {

    if (!deleteTaskId) {

        closeDeleteModal();

        return;

    }


    const task =
        tasks.find(
            item =>
                item.id === deleteTaskId
        );


    if (!task) {

        closeDeleteModal();

        return;

    }


    if (!canDeleteTask(task)) {

        showToast(
            "You do not have permission to delete this task.",
            "error"
        );

        closeDeleteModal();

        return;

    }


    const { error } =
        await supabaseClient
            .from("tasks")
            .delete()
            .eq("id", deleteTaskId);

    if (error) {
        showToast(error.message, "error");
        closeDeleteModal();
        return;
    }

    tasks = tasks.filter(
        item => item.id !== deleteTaskId
    );


    addActivity(
        `${currentUser.name} deleted "${task.title}".`
    );


    closeDeleteModal();

    renderAll();


    showToast(
        "Task deleted.",
        "success"
    );

}


/* =========================================================
   TASK STATUS
========================================================= */

function getStatusFromProgress(
    progress
) {

    if (progress >= 100) {

        return "completed";

    }


    if (progress > 0) {

        return "in-progress";

    }


    return "pending";

}


function updateProgressLabel() {

    const value =
        $("#taskProgress").value;


    $("#progressValue").textContent =
        `${value}%`;

}


/* =========================================================
   TASK RENDERING
========================================================= */

function renderTasks() {

    if (!currentUser) return;


    const board =
        $("#taskBoard");


    const visibleTasks =
        getVisibleTasks();


    const statuses = [

        {
            id: "pending",
            title: "Pending"
        },

        {
            id: "in-progress",
            title: "In Progress"
        },

        {
            id: "completed",
            title: "Completed"
        }

    ];


    board.innerHTML = "";


    statuses.forEach(
        status => {

            const column =
                document.createElement("div");

            column.className =
                "task-column";


            const columnTasks =
                visibleTasks.filter(
                    task =>
                        task.status ===
                        status.id
                );


            column.innerHTML = `

                <div class="task-column-header">

                    <div class="task-column-title">

                        <span>
                            ${status.title}
                        </span>

                        <span class="task-column-count">
                            ${columnTasks.length}
                        </span>

                    </div>

                </div>

                <div class="task-column-list"></div>

            `;


            const list =
                column.querySelector(
                    ".task-column-list"
                );


            if (
                columnTasks.length === 0
            ) {

                list.innerHTML = `

                    <div class="empty-state">

                        <strong>
                            No tasks
                        </strong>

                        Nothing here yet.

                    </div>

                `;

            } else {

                columnTasks.forEach(
                    task => {

                        list.appendChild(
                            createTaskCard(task)
                        );

                    }
                );

            }


            board.appendChild(column);

        }
    );

}


function getVisibleTasks() {

    let result =
        tasks.filter(
            task =>
                canViewTask(task)
        );


    const search =
        $("#taskSearch")
            ?.value
            .trim()
            .toLowerCase();


    const team =
        $("#teamFilter")
            ?.value || "all";


    const status =
        $("#statusFilter")
            ?.value || "all";


    const priority =
        $("#priorityFilter")
            ?.value || "all";


    if (search) {

        result =
            result.filter(
                task =>
                    task.title
                        .toLowerCase()
                        .includes(search) ||

                    task.description
                        .toLowerCase()
                        .includes(search) ||

                    getUserName(
                        task.assigneeId
                    )
                        .toLowerCase()
                        .includes(search)
            );

    }


    if (team !== "all") {

        result =
            result.filter(
                task =>
                    task.team === team
            );

    }


    if (status !== "all") {

        result =
            result.filter(
                task =>
                    task.status === status
            );

    }


    if (priority !== "all") {

        result =
            result.filter(
                task =>
                    task.priority === priority
            );

    }


    return result;

}


/* =========================================================
   TASK CARD
========================================================= */

function createTaskCard(task) {

    const card =
        document.createElement("article");


    card.className =
        "task-card";


    const assignee =
        users.find(
            user =>
                user.id ===
                task.assigneeId
        );


    const editAllowed =
        canEditTask(task);


    const deleteAllowed =
        canDeleteTask(task);


    const dueDate =
        task.dueDate
            ? formatDate(task.dueDate)
            : "No due date";


    card.innerHTML = `

        <div class="task-card-top">

            <span
                class="priority priority-${task.priority}"
            >
                ${capitalize(task.priority)}
            </span>

        </div>


        <h4>
            ${escapeHTML(task.title)}
        </h4>


        ${
            task.description
                ? `
                    <p class="task-description">
                        ${escapeHTML(
                            task.description
                        )}
                    </p>
                `
                : ""
        }


        <div class="task-meta">

            <span class="task-meta-item">
                ${escapeHTML(task.team)}
            </span>

            <span class="task-meta-item">
                Due: ${escapeHTML(dueDate)}
            </span>

        </div>


        <div class="task-progress">

            <div class="task-progress-header">

                <span>
                    Progress
                </span>

                <strong>
                    ${task.progress}%
                </strong>

            </div>

            <div class="task-progress-bar">

                <div
                    class="task-progress-fill"
                    style="width:${task.progress}%"
                ></div>

            </div>

        </div>


        <div class="task-assignee">

            <div class="small-avatar">
                ${
                    assignee
                        ? getInitials(
                            assignee.name
                        )
                        : "?"
                }
            </div>

            <div>

                <div class="assignee-name">
                    ${
                        assignee
                            ? escapeHTML(
                                assignee.name
                            )
                            : "Unknown"
                    }
                </div>

                <div class="assignee-team">
                    ${escapeHTML(task.team)}
                </div>

            </div>


            <div class="task-actions">

                ${
                    editAllowed
                        ? `
                            <button
                                class="icon-btn"
                                type="button"
                                title="Edit task"
                                data-edit-task="${task.id}"
                            >
                                ✎
                            </button>
                        `
                        : ""
                }


                ${
                    deleteAllowed
                        ? `
                            <button
                                class="icon-btn delete"
                                type="button"
                                title="Delete task"
                                data-delete-task="${task.id}"
                            >
                                ×
                            </button>
                        `
                        : ""
                }

            </div>

        </div>

    `;


    const editButton =
        card.querySelector(
            "[data-edit-task]"
        );


    if (editButton) {

        editButton.addEventListener(
            "click",
            () =>
                openEditTaskModal(
                    task.id
                )
        );

    }


    const deleteButton =
        card.querySelector(
            "[data-delete-task]"
        );


    if (deleteButton) {

        deleteButton.addEventListener(
            "click",
            () =>
                openDeleteModal(
                    task.id
                )
        );

    }


    return card;

}


/* =========================================================
   DASHBOARD
========================================================= */

function renderDashboard() {

    if (!currentUser) return;


    const visibleTasks =
        tasks.filter(
            task =>
                canViewTask(task)
        );


    const total =
        visibleTasks.length;


    const pending =
        visibleTasks.filter(
            task =>
                task.status ===
                "pending"
        ).length;


    const progress =
        visibleTasks.filter(
            task =>
                task.status ===
                "in-progress"
        ).length;


    const completed =
        visibleTasks.filter(
            task =>
                task.status ===
                "completed"
        ).length;


    $("#statTotal").textContent =
        total;

    $("#statPending").textContent =
        pending;

    $("#statProgress").textContent =
        progress;

    $("#statCompleted").textContent =
        completed;


    const overall =
        total === 0
            ? 0
            : Math.round(
                visibleTasks.reduce(
                    (
                        sum,
                        task
                    ) =>
                        sum +
                        Number(
                            task.progress
                        ),
                    0
                ) / total
            );


    $("#overallProgressText")
        .textContent =
        `${overall}%`;


    $("#overallProgressBar")
        .style.width =
        `${overall}%`;


    renderMyWorkSummary(
        visibleTasks
    );


    renderRecentTasks(
        visibleTasks
    );

}


function renderMyWorkSummary(
    visibleTasks
) {

    const container =
        $("#myWorkSummary");


    const myTasks =
        visibleTasks.filter(
            task =>
                task.assigneeId ===
                currentUser.id
        );


    const categories = [

        {
            label: "Pending",
            status: "pending"
        },

        {
            label: "In Progress",
            status: "in-progress"
        },

        {
            label: "Completed",
            status: "completed"
        }

    ];


    if (myTasks.length === 0) {

        container.innerHTML = `

            <div class="empty-state">

                <strong>
                    No assigned tasks
                </strong>

                Your work will appear here.

            </div>

        `;

        return;

    }


    container.innerHTML = "";


    categories.forEach(
        category => {

            const count =
                myTasks.filter(
                    task =>
                        task.status ===
                        category.status
                ).length;


            const percent =
                Math.round(
                    (
                        count /
                        myTasks.length
                    ) * 100
                );


            const row =
                document.createElement(
                    "div"
                );


            row.className =
                "my-work-row";


            row.innerHTML = `

                <span class="my-work-label">
                    ${category.label}
                </span>

                <div class="mini-progress">

                    <div
                        class="mini-progress-fill"
                        style="width:${percent}%"
                    ></div>

                </div>

                <span class="my-work-count">
                    ${count}
                </span>

            `;


            container.appendChild(row);

        }
    );

}


function renderRecentTasks(
    visibleTasks
) {

    const container =
        $("#recentTasks");


    const recent =
        [...visibleTasks]
            .sort(
                (
                    a,
                    b
                ) =>
                    new Date(
                        b.updatedAt
                    ) -
                    new Date(
                        a.updatedAt
                    )
            )
            .slice(0, 6);


    if (recent.length === 0) {

        container.innerHTML = `

            <div class="empty-state">

                <strong>
                    No tasks yet
                </strong>

                Add your first task.

            </div>

        `;

        return;

    }


    container.innerHTML = "";


    recent.forEach(task => {

        const row =
            document.createElement(
                "div"
            );


        row.className =
            "recent-task-row";


        row.innerHTML = `

            <div class="recent-task-info">

                <strong>
                    ${escapeHTML(task.title)}
                </strong>

                <span>
                    ${escapeHTML(task.team)}
                    •
                    ${escapeHTML(
                        getUserName(
                            task.assigneeId
                        )
                    )}
                </span>

            </div>


            <span
                class="status-pill status-${task.status}"
            >
                ${formatStatus(task.status)}
            </span>

        `;


        container.appendChild(row);

    });

}


/* =========================================================
   MEMBERS
========================================================= */

function renderMembers() {

    if (!currentUser) return;


    const container =
        $("#membersGrid");


    let members =
        users.filter(
            user => {

                if (isAdmin()) {

                    return true;

                }


                if (isHead()) {

                    return (
                        user.team ===
                        currentUser.team
                    );

                }


                return (
                    user.id ===
                    currentUser.id
                );

            }
        );


    container.innerHTML = "";


    members.forEach(user => {

        const card =
            document.createElement(
                "article"
            );


        card.className =
            "member-card";


        const roleClass =
            user.role === "Admin"
                ? "admin"
                : user.role === "Head"
                    ? "head"
                    : "";


        card.innerHTML = `

            <div class="member-header">

                <div class="member-avatar">
                    ${getInitials(user.name)}
                </div>

                <div>

                    <h3>
                        ${escapeHTML(user.name)}
                    </h3>

                    <p>
                        ${escapeHTML(user.position)}
                    </p>

                </div>

            </div>


            <div class="member-tags">

                <span class="tag ${roleClass}">
                    ${escapeHTML(user.role)}
                </span>

                <span class="tag">
                    ${escapeHTML(user.team)}
                </span>

            </div>

        `;


        container.appendChild(card);

    });

}


/* =========================================================
   TEAM FILTER
========================================================= */

function populateTeamFilter() {

    const select =
        $("#teamFilter");


    if (!select) return;


    const currentValue =
        select.value || "all";


    select.innerHTML = `

        <option value="all">
            All Teams
        </option>

    `;


    const teams =
        [...new Set(
            users.map(
                user =>
                    user.team
            )
        )];


    teams.forEach(team => {

        if (
            !isAdmin() &&
            currentUser &&
            team !== currentUser.team
        ) {

            return;

        }


        const option =
            document.createElement(
                "option"
            );


        option.value =
            team;


        option.textContent =
            team;


        select.appendChild(option);

    });


    if (
        [...select.options]
            .some(
                option =>
                    option.value ===
                    currentValue
            )
    ) {

        select.value =
            currentValue;

    }

}


/* =========================================================
   ACTIVITY
========================================================= */

async function addActivity(message) {

    const { data, error } =
        await supabaseClient
            .from("activity")
            .insert({
                message,
                user_id: currentUser?.id || null,
                team: currentUser?.team || ""
            })
            .select()
            .single();

    if (error) {
        console.error("Activity save error:", error);
        return;
    }

    activities.unshift({
        id: data.id,
        message: data.message,
        time: data.created_at
    });


    activities =
        activities.slice(
            0,
            100
        );


}


function renderActivities() {

    const container =
        $("#activityList");


    if (
        !activities.length
    ) {

        container.innerHTML = `

            <div class="empty-state">

                <strong>
                    No activity yet
                </strong>

                System activity will appear here.

            </div>

        `;

        return;

    }


    container.innerHTML = "";


    activities
        .slice(0, 50)
        .forEach(activity => {

            const item =
                document.createElement(
                    "div"
                );


            item.className =
                "activity-item";


            item.innerHTML = `

                <div class="activity-dot">
                    •
                </div>

                <div class="activity-text">

                    <p>
                        ${escapeHTML(
                            activity.message
                        )}
                    </p>

                    <span class="activity-time">
                        ${formatDateTime(
                            activity.time
                        )}
                    </span>

                </div>

            `;


            container.appendChild(item);

        });

}


/* =========================================================
   RENDER EVERYTHING
========================================================= */

function renderAll() {

    updateUserInterface();

    renderDashboard();

    renderTasks();

    renderMembers();

    renderActivities();

}


/* =========================================================
   KEYBOARD
========================================================= */

function setupGlobalKeyboard() {

    document.addEventListener(
        "keydown",
        event => {

            if (
                event.key ===
                "Escape"
            ) {

                closeTaskModal();

                closeDeleteModal();

            }

        }
    );

}


/* =========================================================
   PASSWORD
========================================================= */

function togglePassword() {

    const input =
        $("#loginPassword");


    const button =
        $("#togglePassword");


    if (
        input.type ===
        "password"
    ) {

        input.type =
            "text";

        button.textContent =
            "🙈";

    } else {

        input.type =
            "password";

        button.textContent =
            "👁";

    }

}


/* =========================================================
   TOAST
========================================================= */

function showToast(
    message,
    type = "success"
) {

    const toast =
        $("#toast");


    $("#toastMessage")
        .textContent =
        message;


    toast.className =
        `toast show ${type}`;


    clearTimeout(
        toastTimer
    );


    toastTimer =
        setTimeout(
            () => {

                toast.className =
                    "toast";

            },
            2800
        );

}


/* =========================================================
   UTILITIES
========================================================= */

function getUserName(id) {

    const user =
        users.find(
            item =>
                item.id === id
        );


    return user
        ? user.name
        : "Unknown";

}


function getInitials(name) {

    if (!name) return "?";


    return name
        .split(" ")
        .filter(Boolean)
        .slice(0, 2)
        .map(
            word =>
                word[0]
                    .toUpperCase()
        )
        .join("");

}


function capitalize(text) {

    if (!text) return "";

    return (
        text.charAt(0)
            .toUpperCase() +
        text.slice(1)
    );

}


function formatStatus(status) {

    const map = {

        pending: "Pending",

        "in-progress":
            "In Progress",

        completed:
            "Completed"

    };


    return map[status] ||
        status;

}


function formatDate(date) {

    if (!date) return "";

    return new Date(
        date + "T00:00:00"
    ).toLocaleDateString(
        "en-IN",
        {
            day: "2-digit",
            month: "short",
            year: "numeric"
        }
    );

}


function formatDateTime(
    date
) {

    return new Date(
        date
    ).toLocaleString(
        "en-IN",
        {
            day: "2-digit",
            month: "short",
            year: "numeric",
            hour: "2-digit",
            minute: "2-digit"
        }
    );

}


/*
    Prevent HTML injection when displaying
    user-entered task titles/descriptions.
*/

function escapeHTML(value) {

    return String(value)
        .replace(
            /&/g,
            "&amp;"
        )
        .replace(
            /</g,
            "&lt;"
        )
        .replace(
            />/g,
            "&gt;"
        )
        .replace(
            /"/g,
            "&quot;"
        )
        .replace(
            /'/g,
            "&#039;"
        );
tell 
}