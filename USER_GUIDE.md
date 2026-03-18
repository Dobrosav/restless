# Restless API Client - User Guide

Welcome to **Restless**, a modern and fast desktop application for testing and managing API requests. This guide explains all the features available in the application to help you seamlessly integrate it into your development workflow.

---

## 1. Workspace & Organization

Restless works directly on your file system, reading and writing files as plain JSON. 

* **Open Workspace:** Click on the `Workspace:` area in the top left header to open any folder on your computer as your root workspace. 
* **Collections:** In the left-hand sidebar, you can create **Collections** (which are essentially folders) to organize your API requests per project or sub-service.
* **Saving Requests:** When you create or update an API request, it's saved as a standard `.json` file inside its respective collection folder.

## 2. Tabbed Interface

Just like your modern web browser, Restless allows you to keep multiple API requests open simultaneously.

* **Open in Tab:** Clicking an existing request from your sidebar will open it in a tab.
* **Create New Tab:** Click the **`+ New`** button above the sidebar to create a fresh, blank request in a new tab.
* **Context Menu:** Right-click on any open tab to reveal quick actions:
  * **Close Tab:** Closes the selected tab.
  * **Close Other Tabs:** Keeps your chosen tab open and closes the rest.
  * **Close All Tabs:** Clears the entire workspace canvas.

## 3. Environment Variables (Collection-Scoped)

Environments allow you to define re-usable variables (like base URLs, API tokens, etc.) that can be quickly swapped out.

In Restless, **environments are scoped to Collections**. This means a collection like "E-Commerce API" can have "Staging" and "Production" environments, completely separate from your "Auth Service API" collection environments.

* **Managing Environments:** Click the 🔧 **Environments** button in the top menu. (You must have a tab open that belongs to a specific collection for this to activate).
* **Creating an Environment:** Open the dropdown, click `+`, name your environment (e.g., `Local`), and save.
* **Adding Variables:** Select your environment, click **Edit**, and add Key-Value pairs. You can toggle them on/off using the checkbox next to each variable.
* **Using Variables:** In your request URL, headers, or body, use the syntax `{{variable_name}}`. Restless will automatically inject the active environment's value when sending the request.

## 4. API Request Builder

The central Request Panel provides a detailed interface to craft your API calls.

* **Method & URL:** Select from standard HTTP verbs (`GET`, `POST`, `PUT`, `PATCH`, `DELETE`) and type your endpoint URL.
* **Params Tab:** Add URL Query parameters. You can cleanly toggle query variables on/off without deleting them.
* **Headers Tab:** Add customized HTTP Headers (e.g., `Content-Type`, `Accept`). 
* **Auth Tab:** Set up authorization, such as `Bearer Token` or `Basic Auth`.
* **Body Tab:** Write your request payload (JSON, Plain Text, etc.) leveraging the integrated code editor.
* **Scripts Tab:** Attach logic that runs immediately before or after the request executes.

## 5. Response Panel

After hitting "Send", the Response Panel (on the right) populates with the server's output.

* **Metrics:** Instantly view the HTTP Status code, Response Time (ms), and Response Size.
* **Tabs:**
  * **Body:** Inspect the response output in the built-in JSON text viewer.
  * **Headers:** See exactly what headers the server returned.
  * **Cookies:** View any `set-cookie` instructions issued by the server.
* **Actions:**
  * **📋 Copy:** Instantly copy the full response body to your clipboard.
  * **✕ Clear:** Reset the response panel back to a blank state.

## 6. Built-in Git Integration

Since all your collections and requests are just files on your computer, Restless integrates directly with standard Git Version Control so you can sync and share APIs with your team.

* **Git Panel:** Click 'Git' in the top header to open the Git side-panel.
* **Auto-Staging:** When you make changes (`Create`, `Update`, `Delete` actions), Restless attempts to automatically stage these changes for you.
* **Commit:** Type a message and hit "Commit" to save the revision locally.
* **Push/Pull:** Synchronize directly with your remote repository (e.g., GitHub, GitLab).
* **Configure Git:** Click the ⚙️ gear icon in the top right corner to set your Git `User Name` and `User Email`.
