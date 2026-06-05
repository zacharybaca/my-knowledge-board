
# MyKnowledgeBoard

<p align="center">
  <img src="client/public/logo.svg" alt="MyKnowledgeBoard Logo" width="200" />
</p>

> **Knowledge. Within Reach.**

A multi-tenant organizational knowledge board built on the MERN stack. Enables employees to submit, search, and bookmark company-specific process guides and policies, managed through a hierarchical approval workflow.

## Core Features

- **Multi-Tenant Architecture:** Isolated organizational environments governed by `companyId` scoping and email domain verification.
- **Role-Based Access Control (RBAC):** Distinct permission tiers for Employees, Managers, and Admins.
- **Approval Workflow:** State-driven content lifecycle management (Draft, Pending, Approved, Rejected) with manager feedback integration.
- **Asset Management:** Integrated Cloudinary pipeline for user avatar processing and automated cascading cleanup.
- **Contextual Discovery:** MongoDB `$text` indexing for high-relevancy search across organizational documentation.
- **MyKnowledge Assistant:** An AI chatbot that will answer a user's questions regarding a company's workplace policies or procedures.

- --

## Technical Stack

| Domain       | Technology                                                                                |
| :----------- | :-----------------------------------------------------------------------------------------|
| **Frontend** | React, Vite, React Router DOM, TinyMCE, Lucide React, Web Sockets, UUID                   |
| **Backend**  | Node.js, Express, Mongoose, JSON Web Tokens (JWT), Bcryptjs, Leo-Profanity, Web Sockets   |
| **Database** | MongoDB                                                                                   |
| **Services** | Cloudinary (Image Hosting)                                                                |

- --

## Environment Configuration

    Create a `.env` file in the `server` directory with the following variables:

        # Cloudinary Configuration
        CLOUDINARY_CLOUD_NAME=your_cloud_name
        CLOUDINARY_KEY=your_api_key
        CLOUDINARY_SECRET=your_api_secret
        CLOUDINARY_URL=your_cloudinary_url

        # Server Configuration
        JWT_SECRET=your_jwt_secret_key
        MONGO_URI=your_mongodb_connection_string
        FRONTEND_URL=http://localhost:5173
        NODE_ENV=development
        CLIENT_URL=http://localhost:5173
        PORT=5000

        # Send Grid Configuration
        EMAIL_USERNAME=your_sendgrid_username
        EMAIL_PASSWORD=your_sendgrid_password
        FROM_NAME=your_email_from_name
        FROM_EMAIL=your_email_from_email
        SENDGRID_API_KEY=your_sendgrid_api_key

        # Stripe Configuration
        STRIPE_SECRET_KEY=your_stripe_secret_key
        STRIPE_WEBHOOK_SECRET=your_stripe_webhook_secret

        # Gemini Configuration
        GEMINI_API_KEY=your_gemini_api_key

    Create a `.env` file in the `client` directory with the following variables:

        # Client Configuration
        VITE_API_URL=http://localhost:5000

        # Tiny MCE Configuration
        VITE_TINYMCE_API_KEY=your_tinymce_api_key

        # Stripe Configuration
        VITE_STRIPE_PUBLISHABLE_KEY=your_stripe_publishable_key

## Installation & Execution

    1. Install Dependencies (Root, Client, and Server):

        npm run install-all

    2. Initialize Development Servers (Concurrent execution):

        npm run dev

        *   Frontend: `http://localhost:5173`
        *   Backend: `http://localhost:5000`
    - --

## System Architecture

### Database Models

        * *1. User Model**
        | Field | Type | Constraints | Description |
        | :--- | :--- | :--- | :--- |
        | `companyId` | ObjectId | required, ref: 'Company' | Maps user to specific tenant |
        | `firstName` | String | required | User's given name |
        | `lastName` | String | required | User's family name |
        | `email` | String | required, unique | Auth and domain verification |
        | `password` | String | required | Hashed via bcrypt pre-save |
        | `role` | String | enum: ['Employee', 'Manager', 'Admin'] | Defines RBAC permissions |
        | `managerId` | ObjectId | default: null, ref: 'User' | Hierarchical reporting structure |
        | `avatar` | String | optional | Cloudinary secure URL |
        | `avatarPublicId` | String | default: "" | Cloudinary asset ID for cleanup |
        | `favoriteArticles` | [ObjectId] | ref: 'Article' | Array of bookmarked articles |
        | `isAdmin` | Boolean | default: false | System-level admin override |
        | `resetPasswordToken`| String | optional | Hashed token for password recovery |
        | `resetPasswordExpire`| Date | optional | Token validity window |

        * *2. Company Model**
        | Field | Type | Constraints | Description |
        | :--- | :--- | :--- | :--- |
        | `name` | String | required, unique, trim | Display name of the organization |
        | `emailDomain` | String | required, unique, lowercase | RegEx validated domain |
        | `isActive` | Boolean | default: true | Soft-disable toggle for tenant |
        | `createdBy` | ObjectId | ref: 'User' | User who registered the workspace |

        * *3. Article Model**
        | Field | Type | Constraints | Description |
        | :--- | :--- | :--- | :--- |
        | `companyId` | ObjectId | required, ref: 'Company' | Scopes article to tenant |
        | `authorId` | ObjectId | required, ref: 'User' | Article creator |
        | `title` | String | required, text index | Article heading |
        | `content` | String | required, text index | HTML/Markdown payload |
        | `tags` | [String] | text index | Categorization terms |
        | `status` | String | enum: ['Draft', 'Pending', 'Approved', 'Rejected'] | Content lifecycle state |
        | `approverId` | ObjectId | default: null, ref: 'User' | Manager executing final review |
        | `rejectionReason` | String | default: null | Feedback payload for rejected status |
        | `viewCount` | Number | default: 0 | Increments on GET request |

        - --

### API Routes

        * *Authentication Routes (`/api/auth`)**
        | Method | Endpoint | Controller | Access |
        | :--- | :--- | :--- | :--- |
        | `POST` | `/register` | `registerUser` | Public |
        | `POST` | `/login` | `loginUser` | Public |
        | `POST` | `/logout` | `logoutUser` | Public |
        | `POST` | `/forgotpassword` | `forgotPassword` | Public |

        * *Company Routes (`/api/companies`)**
        | Method | Endpoint | Controller | Access |
        | :--- | :--- | :--- | :--- |
        | `GET` | `/` | `getCompanies` | Public |
        | `POST` | `/register` | `registerCompany` | Public |

        * *User Routes (`/api/users`)**
        | Method | Endpoint | Controller | Access |
        | :--- | :--- | :--- | :--- |
        | `GET` | `/profile` | `getUserProfile` | Private |
        | `PUT` | `/profile` | `updateUserProfile` | Private |
        | `DELETE` | `/profile` | `deleteUser` | Private |
        | `GET` | `/directory` | `getCompanyDirectory` | Private |
        | `GET` | `/managers` | `getCompanyManagers` | Private |
        | `PATCH` | `/favorites/:articleId` | `toggleFavoriteArticle` | Private |

        * *Article Routes (`/api/articles`)**
        | Method | Endpoint | Controller | Access |
        | :--- | :--- | :--- | :--- |
        | `POST` | `/` | `createArticle` | Private |
        | `GET` | `/` | `getArticles` | Private |
        | `GET` | `/:id` | `getArticleById` | Private |
        | `PUT` | `/:id` | `updateArticle` | Private (Author) |
        | `PATCH` | `/:id/status` | `approveRejectArticle` | Private (Manager) |
        | `GET` | `/my-articles` | `getUserArticles` | Private |
        | `GET` | `/pending` | `getPendingArticles` | Private (Manager) |

## Frontend Architecture

The client application is built with React and Vite, utilizing a feature-based directory structure for modularity and scalability.

### Directory Hierarchy - Client and Server

    .
    |-- README.md
    |-- client
    |   |-- eslint.config.js
    |   |-- index.html
    |   |-- package-lock.json
    |   |-- package.json
    |   |-- public
    |   |   |-- _redirects
    |   |   |-- favicon.svg
    |   |   `-- logo.svg
    |   |-- src
    |   |   |-- App.css
    |   |   |-- App.jsx
    |   |   |-- components
    |   |   |   |-- Admin
                    |-- WorkspaceManagement
                        |-- WorkspaceManagement.jsx
                        `-- workspace-management.css
    |   |   |   |   |-- SessionLogs.jsx
    |   |   |   |   `-- session-logs.css
    |   |   |   |-- Article
    |   |   |   |   |-- ApprovalQueue
    |   |   |   |   |   |-- ApprovalQueue.jsx
    |   |   |   |   |   `-- approval-queue.css
    |   |   |   |   |-- ArticleCard
    |   |   |   |   |   |-- ArticleCard.jsx
    |   |   |   |   |   `-- article-card.css
    |   |   |   |   |-- ArticleEditor
    |   |   |   |   |   |-- ArticleEditor.jsx
    |   |   |   |   |   `-- article-editor.css
    |   |   |   |   |-- ArticleFeedback
    |   |   |   |   |   |-- ArticleFeedback.jsx
    |   |   |   |   |   `-- article-feedback.css
    |   |   |   |   |-- ArticleReview
    |   |   |   |   |   |-- ArticleReview.jsx
    |   |   |   |   |   `-- article-review.css
    |   |   |   |   |-- ArticleView
    |   |   |   |   |   |-- ArticleView.jsx
    |   |   |   |   |   `-- article-view.css
    |   |   |   |   |-- PinButton
    |   |   |   |   |   |-- PinButton.jsx
    |   |   |   |   |   `-- pin-button.css
    |   |   |   |   `-- TopArticles
    |   |   |   |       |-- TopArticles.jsx
    |   |   |   |       `-- top-articles.css
    |   |   |   |-- Auth
    |   |   |   |   |-- CreateElevatedUser
    |   |   |   |   |   `-- CreateElevatedUser.jsx
    |   |   |   |   |-- Login
    |   |   |   |   |   `-- Login.jsx
    |   |   |   |   |-- ProfileSettings
    |   |   |   |   |   `-- ProfileSettings.jsx
    |   |   |   |   |-- Register
    |   |   |   |   |   `-- Register.jsx
    |   |   |   |   |-- VerifyWorkspace
    |   |   |   |   |   `-- VerifyWorkspace.jsx
    |   |   |   |   `-- auth-forms.css
    |   |   |   |-- Chatbot
    |   |   |   |   |-- Chatbot.jsx
    |   |   |   |   `-- chatbot.css
    |   |   |   |-- Company
    |   |   |   |   |-- CompanyList
    |   |   |   |   |   |-- CompanyList.jsx
    |   |   |   |   |   `-- company-list.css
    |   |   |   |   `-- CompanyRegistration
    |   |   |   |       `-- CompanyRegistration.jsx
    |   |   |   |-- Dashboards
    |   |   |   |   |-- EmployeeDashboard
    |   |   |   |   |   `-- EmployeeDashboard.jsx
    |   |   |   |   |-- ManagerDashboard
    |   |   |   |   |   `-- ManagerDashboard.jsx
    |   |   |   |   |-- ReviewQueue
    |   |   |   |   |   |-- ReviewQueue.jsx
    |   |   |   |   |   `-- review-queue.css
    |   |   |   |   `-- dashboards.css
    |   |   |   |-- Layout
    |   |   |   |   |-- Footer
    |   |   |   |   |   |-- Footer.jsx
    |   |   |   |   |   `-- footer.css
    |   |   |   |   |-- Header
    |   |   |   |   |   |-- Header.jsx
    |   |   |   |   |   `-- header.css
    |   |   |   |   |-- NavBar
    |   |   |   |   |   |-- Logo.jsx
    |   |   |   |   |   |-- NavBar.jsx
    |   |   |   |   |   `-- nav-bar.css
    |   |   |   |   |-- SideBar
    |   |   |   |   |   |-- SideBar.jsx
    |   |   |   |   |   `-- side-bar.css
    |   |   |   |   `-- Toast
    |   |   |   |       |-- Toast.jsx
    |   |   |   |       `-- toast.css
    |   |   |   |-- Notifications
    |   |   |   |   |-- NotificationBell.jsx
    |   |   |   |   `-- notifications.css
    |   |   |   |-- Pages
    |   |   |   |   |-- Home.jsx
    |   |   |   |   `-- home.css
    |   |   |   |-- Search
    |   |   |   |   |-- SearchBar
    |   |   |   |   |   |-- SearchBar.jsx
    |   |   |   |   |   `-- search-bar.css
    |   |   |   |   |-- SearchResults
    |   |   |   |   |   |-- SearchResults.jsx
    |   |   |   |   |   `-- search-results.css
    |   |   |   |   `-- TagFilter
    |   |   |   |       |-- TagFilter.jsx
    |   |   |   |       `-- tag-filter.css
    |   |   |   |-- UserManagement
    |   |   |   |   |-- UserManagement.jsx
    |   |   |   |   `-- user-management.css
    |   |   |   |-- Utility
    |   |   |   |   |-- AdminRoute
    |   |   |   |   |   `-- AdminRoute.jsx
    |   |   |   |   `-- ProtectedRoute
    |   |   |   |       `-- ProtectedRoute.jsx
    |   |   |   `-- Widgets
    |   |   |       |-- BandwidthWidget
    |   |   |       |   `-- BandwidthWidget.jsx
    |   |   |       |-- FirstStatementWidget
    |   |   |       |   `-- FirstStatementWidget.jsx
    |   |   |       |-- ProrationWidget
    |   |   |       |   `-- ProrationWidget.jsx
    |   |   |       |-- TroubleshootingWidget
    |   |   |       |   `-- TroubleshootingWidget.jsx
    |   |   |       `-- widgets.css
    |   |   |-- contexts
    |   |   |   |-- AppProvider.jsx
    |   |   |   |-- Auth
    |   |   |   |   |-- AuthContext.jsx
    |   |   |   |   `-- AuthProvider.jsx
    |   |   |   |-- Companies
    |   |   |   |   |-- CompanyContext.jsx
    |   |   |   |   `-- CompanyProvider.jsx
    |   |   |   |-- Fetcher
    |   |   |   |   |-- FetcherContext.jsx
    |   |   |   |   `-- FetcherProvider.jsx
    |   |   |   `-- Socket
    |   |   |       |-- SocketContext.jsx
    |   |   |       `-- SocketProvider.jsx
    |   |   |-- hooks
    |   |   |   |-- useAuth.js
    |   |   |   |-- useCompany.js
    |   |   |   |-- useFetcher.js
    |   |   |   `-- useSocket.js
    |   |   |-- index.css
    |   |   `-- main.jsx
    |   `-- vite.config.js
    |-- jsconfig.json
    |-- package-lock.json
    |-- package.json
    `-- server
        |-- app.js
        |-- controllers
        |   |-- aiController.js
        |   |-- articleController.js
        |   |-- authController.js
        |   |-- chatController.js
        |   |-- companyController.js
        |   |-- notificationController.js
        |   |-- sessionController.js
        |   `-- userController.js
        |-- middleware
        |   |-- authMiddleware.js
        |   |-- cloudinary.js
        |   |-- errorHandler.js
        |   `-- moderationMiddleware.js
        |-- models
        |   |-- Article.js
        |   |-- Company.js
        |   |-- Notification.js
        |   |-- SessionLog.js
        |   `-- User.js
        |-- package-lock.json
        |-- package.json
        |-- routes
        |   |-- aiRoutes.js
        |   |-- articleRoutes.js
        |   |-- authRoutes.js
        |   |-- chatRoutes.js
        |   |-- companyRoutes.js
        |   |-- notificationRoutes.js
        |   |-- sessionRoutes.js
        |   `-- userRoutes.js
        |-- server.js
        `-- utils
            |-- generateToken.js
            `-- sendEmail.js

### Component Breakdown

- Article: Manages the core knowledge base content lifecycle. Includes the editor interface, standardized card displays, detailed viewing, and the manager-specific approval queue interface.
- Auth: Handles system access and onboarding. Includes standard login, employee registration, and the secure workspace verification flow.
- Company: Interfaces for the multi-tenant architecture. Displays active participating organizations and handles the creation of new tenant workspaces.
- Dashboards: Role-specific landing areas providing contextual data and actions based on whether the authenticated user is an Employee or a Manager.
- Layout: The persistent UI shell. Contains navigation bars, footers, sidebars, and the global notification system (Toast).
- Pages: Top-level route views, such as the public-facing Home page.
- Search: Components interfacing with the backend MongoDB text-indexing to provide high-relevancy document discovery and tag-based filtering.
- Utility: Higher-order components and wrappers, primarily used for Role-Based Access Control (RBAC) to restrict access to protected and admin-only routes.

### State Management & Data Fetching

- Contexts (AppProvider.jsx): Global state is segmented by domain (Auth, Companies, Fetcher) and nested hierarchically within a primary provider to ensure correct dependency resolution (e.g., Company state relying on Auth state).
- Custom Hooks:
  - useAuth: Exposes login, logout, and current user data.
  - useCompany: Exposes current tenant data.
  - useFetcher: A centralized utility for executing API requests with intercepted credentials and error handling.

### System Integration Requirements

#### Environment Variables

The frontend requires the following variable in the client-side .env file to communicate with the Express backend:

    VITE_API_URL=http://localhost:5000

The backend requires a .env file in the server directory with the following variables:

    PORT=5000
    MONGO_URI=your_mongodb_connection_string
    JWT_SECRET=your_jwt_secret_key
    FRONTEND_URL=http://localhost:5173
    CLIENT_URL=http://localhost:5173

    # Email Provider Configuration (e.g., SendGrid)
    SENDGRID_API_KEY=your_api_key
    FROM_NAME="KnowledgeBase Support"
    FROM_EMAIL=no-reply@yourverifieddomain.com

    # Cloudinary Configuration
    CLOUDINARY_CLOUD_NAME=your_cloud_name
    CLOUDINARY_API_KEY=your_api_key
    CLOUDINARY_API_SECRET=your_api_secret
