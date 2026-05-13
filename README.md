# KnowledgeBase

## Knowledge Within Reach

A multi-tenant organizational knowledge board built on the MERN stack. Enables employees to submit, search, and bookmark company-specific process guides and policies, managed through a hierarchical approval workflow.

- --

## Core Features

* **Multi-Tenant Architecture:** Isolated organizational environments governed by `companyId` scoping and email domain verification.
* **Role-Based Access Control (RBAC):** Distinct permission tiers for Employees, Managers, and Admins.
* **Approval Workflow:** State-driven content lifecycle management (Draft, Pending, Approved, Rejected) with manager feedback integration.
* **Asset Management:** Integrated Cloudinary pipeline for user avatar processing and automated cascading cleanup.
* **Contextual Discovery:** MongoDB `$text` indexing for high-relevancy search across organizational documentation.

- --

## Technical Stack

| Domain | Technology |
| :--- | :--- |
| **Frontend** | React, Vite, React Router DOM, TinyMCE, Lucide React |
| **Backend** | Node.js, Express, Mongoose, JSON Web Tokens (JWT), bcryptjs |
| **Database** | MongoDB |
| **Services** | Cloudinary (Image Hosting) |

- --

## Environment Configuration

    Create a `.env` file in the `server` directory with the following variables:

    ```env
    PORT=5000
    MONGO_URI=your_mongodb_connection_string
    JWT_SECRET=your_jwt_secret_key
    FRONTEND_URL=http://localhost:5173
    CLIENT_URL=http://localhost:5173

    # Cloudinary Configuration
    CLOUDINARY_CLOUD_NAME=your_cloud_name
    CLOUDINARY_API_KEY=your_api_key
    CLOUDINARY_API_SECRET=your_api_secret
    ```

## Installation & Execution

    1. Install Dependencies (Root, Client, and Server):

      ``` bash
      npm run install-all
      ```
    2. Initialize Development Servers (Concurrent execution):

        ```bash
        npm run dev
        ```

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
