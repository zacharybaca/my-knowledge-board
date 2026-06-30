/**
 * seedArticles.js
 *
 * Generates placeholder knowledge-base articles in MongoDB.
 *
 * Usage:
 *   node -r dotenv/config scripts/seedArticles.js [options]
 *
 * Options:
 *   --count=<n>           Number of articles to create (default: 30)
 *   --status=<s>          Force a single status: Draft | Pending | Approved | Rejected
 *                         (default: randomly distributed)
 *   --company-id=<id>     Target a specific Company ObjectId (default: first Active company in DB)
 *   --author-id=<id>      Target a specific User ObjectId as author (default: first Admin/Manager in target company)
 *   --clear               Delete all existing articles for the target company before seeding
 *
 * Examples:
 *   node -r dotenv/config scripts/seedArticles.js
 *   node -r dotenv/config scripts/seedArticles.js --count=50 --status=Approved
 *   node -r dotenv/config scripts/seedArticles.js --company-id=6650abc... --author-id=6650def...
 */

import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';
import Article from '../models/Article.js';
import User from '../models/User.js';
import Company from '../models/Company.js';

// ---------------------------------------------------------------------------
// CLI argument parsing
// ---------------------------------------------------------------------------
const args = Object.fromEntries(
  process.argv.slice(2).map((a) => {
    const [k, v] = a.replace(/^--/, '').split('=');
    return [k, v ?? true];
  }),
);

const COUNT = parseInt(args['count'] ?? '30', 10);
const FORCED_STATUS = args['status'] ?? null;
const CLEAR = args['clear'] === true || args['clear'] === 'true';
const GIVEN_COMPANY_ID = args['company-id'] ?? null;
const GIVEN_AUTHOR_ID = args['author-id'] ?? null;

// ---------------------------------------------------------------------------
// Placeholder content data
// ---------------------------------------------------------------------------
const DEPARTMENTS = [
  'Customer Service',
  'Tech Support',
  'Human Resources',
  'Sales',
  'Marketing',
  'Engineering',
  'Product',
  'Finance',
  'Legal',
  'Operations',
  'Other',
];

const STATUSES = ['Draft', 'Pending', 'Approved', 'Rejected'];

const ARTICLES_BY_DEPARTMENT = {
  'Customer Service': [
    {
      title: 'How to Handle an Escalated Customer Complaint',
      summary:
        'A step-by-step guide for de-escalating difficult customer interactions and reaching a satisfactory resolution.',
      content: `<h2>Overview</h2>
<p>Escalated complaints require a calm, empathetic approach. This guide walks you through the standard procedure for handling customers who have already spoken with a first-tier representative and remain unsatisfied.</p>
<h2>Step 1 – Acknowledge the Frustration</h2>
<p>Begin by validating the customer's feelings. Use phrases like <em>"I completely understand why this is frustrating"</em> rather than justifying past actions.</p>
<h2>Step 2 – Review the History</h2>
<p>Before proposing a resolution, review all prior notes in the CRM. Never ask the customer to repeat information they have already provided.</p>
<h2>Step 3 – Offer a Concrete Resolution</h2>
<p>Provide a specific fix, timeline, or compensation where policy allows. Vague commitments increase distrust.</p>
<h2>Step 4 – Follow Up</h2>
<p>Send a follow-up email within 24 hours confirming the resolution and any next steps.</p>`,
      tags: ['escalation', 'complaints', 'CRM', 'customer satisfaction'],
    },
    {
      title: 'Refund and Return Policy – Quick Reference',
      summary:
        'Concise reference card covering refund eligibility windows, exceptions, and processing steps.',
      content: `<h2>Eligibility</h2>
<ul>
  <li>Physical products: 30-day return window from delivery date.</li>
  <li>Digital products: Non-refundable after download unless defective.</li>
  <li>Subscription services: Pro-rated refund within 7 days of billing cycle start.</li>
</ul>
<h2>Processing Steps</h2>
<ol>
  <li>Verify purchase in the CRM and confirm the refund window has not expired.</li>
  <li>Issue the refund via the original payment method in the billing portal.</li>
  <li>Notify the customer by email with a confirmation number and expected timeline (3–5 business days).</li>
</ol>
<h2>Exceptions</h2>
<p>Clearance items, customized products, and gift cards are non-refundable. Escalate edge cases to your manager.</p>`,
      tags: ['refunds', 'returns', 'policy', 'billing'],
    },
    {
      title: 'Using the Support Ticketing System',
      summary: 'How to create, categorize, and close support tickets efficiently.',
      content: `<h2>Creating a Ticket</h2>
<p>Open the ticketing dashboard and click <strong>New Ticket</strong>. Fill in the customer name, contact details, issue category, and a concise description. Attach screenshots or logs where applicable.</p>
<h2>Priority Levels</h2>
<table>
  <thead><tr><th>Priority</th><th>Response SLA</th></tr></thead>
  <tbody>
    <tr><td>P1 – Critical</td><td>1 hour</td></tr>
    <tr><td>P2 – High</td><td>4 hours</td></tr>
    <tr><td>P3 – Normal</td><td>1 business day</td></tr>
    <tr><td>P4 – Low</td><td>3 business days</td></tr>
  </tbody>
</table>
<h2>Closing a Ticket</h2>
<p>Before closing, confirm with the customer that the issue is resolved. Add a resolution note, tag the root cause category, and close the ticket. Auto-surveys are sent 24 hours after closure.</p>`,
      tags: ['ticketing', 'SLA', 'support workflow'],
    },
  ],
  'Tech Support': [
    {
      title: 'Diagnosing Network Connectivity Issues',
      summary:
        'Systematic troubleshooting workflow for diagnosing and resolving end-user network problems.',
      content: `<h2>Initial Triage</h2>
<p>Before diving into technical steps, determine the scope: Is the issue limited to one device, one location, or company-wide? Scope narrows your root-cause hypothesis significantly.</p>
<h2>Step 1 – Verify Physical Layer</h2>
<p>Confirm cables are seated, port LEDs are active, and Wi-Fi is enabled. Restart the NIC via Device Manager if needed.</p>
<h2>Step 2 – Test IP Configuration</h2>
<p>Run <code>ipconfig /all</code> (Windows) or <code>ip addr</code> (Linux/macOS). Confirm the device has a valid IP in the correct subnet. If it shows 169.254.x.x, the DHCP server is unreachable.</p>
<h2>Step 3 – Ping the Gateway</h2>
<p>Ping the default gateway. Failure here indicates a local network issue; success with failure beyond suggests a routing or ISP issue.</p>
<h2>Step 4 – DNS Check</h2>
<p>Run <code>nslookup google.com</code>. If name resolution fails, switch to a public DNS server (8.8.8.8) temporarily to isolate the problem.</p>
<h2>Escalation</h2>
<p>If steps 1–4 do not resolve the issue, escalate to the network team with your diagnostic findings.</p>`,
      tags: ['networking', 'troubleshooting', 'DNS', 'DHCP', 'connectivity'],
    },
    {
      title: 'Password Reset Procedure for Active Directory Users',
      summary:
        'How to securely reset an AD user password and communicate credentials without exposing them.',
      content: `<h2>Pre-Requisites</h2>
<p>You must have the <strong>Help Desk Operator</strong> role in Active Directory Users and Computers (ADUC) to perform this action.</p>
<h2>Steps</h2>
<ol>
  <li>Open <strong>ADUC</strong> and search for the user account.</li>
  <li>Right-click the account and select <strong>Reset Password</strong>.</li>
  <li>Generate a temporary password using the approved password manager's generator (minimum 16 chars, mixed case, numbers, symbols).</li>
  <li>Check <strong>User must change password at next logon</strong>.</li>
  <li>Deliver the temporary password via a secure, out-of-band channel (phone call or encrypted chat — never plain email).</li>
</ol>
<h2>Security Notes</h2>
<p>Never write passwords in ticket comments. Log only that a reset was performed and the delivery method used.</p>`,
      tags: ['Active Directory', 'password reset', 'security', 'IT'],
    },
    {
      title: 'Setting Up a New Employee Workstation',
      summary:
        'Checklist and instructions for provisioning a new hire workstation from unboxing to first login.',
      content: `<h2>Hardware Checklist</h2>
<ul>
  <li>Laptop or desktop unpacked and inspected for damage</li>
  <li>Power adapter connected; battery above 20% before imaging</li>
  <li>Network cable attached to imaging VLAN port</li>
</ul>
<h2>Imaging</h2>
<p>Boot the device from the PXE server by pressing F12 on startup. Select the latest approved image from the menu. The process takes approximately 25 minutes.</p>
<h2>Post-Image Configuration</h2>
<ol>
  <li>Join the device to the domain using IT service account credentials.</li>
  <li>Run <code>gpupdate /force</code> to apply group policies.</li>
  <li>Install role-specific software via the Software Center.</li>
  <li>Run Windows Update until no critical patches remain.</li>
</ol>
<h2>Handoff</h2>
<p>Log the asset tag, serial number, and assigned user in the IT asset management system. Send the new hire a welcome email with login instructions.</p>`,
      tags: ['onboarding', 'workstation', 'provisioning', 'imaging'],
    },
  ],
  'Human Resources': [
    {
      title: 'Employee Onboarding Checklist',
      summary:
        'Complete checklist for HR coordinators to ensure a smooth first day and first week for new hires.',
      content: `<h2>Before Day 1</h2>
<ul>
  <li>Send welcome email with start date, dress code, parking, and point of contact</li>
  <li>Provision system access and equipment in coordination with IT</li>
  <li>Prepare new hire paperwork packet (I-9, W-4, direct deposit, benefits enrollment)</li>
  <li>Schedule orientation sessions for the first week</li>
</ul>
<h2>Day 1</h2>
<ul>
  <li>Greet new hire at reception and provide building access card</li>
  <li>Complete all required paperwork</li>
  <li>Conduct office/facility tour</li>
  <li>Introduce to team and direct manager</li>
  <li>Review company policies and code of conduct</li>
</ul>
<h2>Week 1</h2>
<ul>
  <li>Assign an onboarding buddy</li>
  <li>Schedule 30-60-90 day check-in meetings</li>
  <li>Confirm all system access is functioning</li>
  <li>Verify benefits enrollment deadline has been communicated</li>
</ul>`,
      tags: ['onboarding', 'new hire', 'checklist', 'HR'],
    },
    {
      title: 'Performance Improvement Plan (PIP) Guide',
      summary:
        'Guidelines for managers and HR on when and how to initiate a Performance Improvement Plan.',
      content: `<h2>Purpose</h2>
<p>A PIP is a structured, documented plan intended to give an employee a clear and fair opportunity to meet defined performance standards. It should never be used punitively.</p>
<h2>When to Use a PIP</h2>
<ul>
  <li>Consistent failure to meet measurable performance targets after coaching</li>
  <li>Repeated behavioral issues documented over at least 60 days</li>
  <li>Never as a surprise — issues must be discussed informally first</li>
</ul>
<h2>PIP Structure</h2>
<ol>
  <li><strong>Objective Summary:</strong> Describe the specific deficiency with concrete examples.</li>
  <li><strong>Goals:</strong> List 2–4 SMART goals to be achieved within the PIP period (typically 30–90 days).</li>
  <li><strong>Support Provided:</strong> Detail training, mentoring, or resources the company will provide.</li>
  <li><strong>Check-In Schedule:</strong> Bi-weekly documented meetings to review progress.</li>
  <li><strong>Consequences:</strong> Clearly state that failure to meet goals may result in termination.</li>
</ol>
<h2>Documentation</h2>
<p>All PIP documents must be signed by the employee, the manager, and an HR representative. Store originals in the employee's personnel file.</p>`,
      tags: ['PIP', 'performance management', 'HR', 'documentation'],
    },
    {
      title: 'Paid Time Off Policy',
      summary:
        'Summary of PTO accrual, request procedures, carryover rules, and payout upon separation.',
      content: `<h2>Accrual Rates</h2>
<table>
  <thead><tr><th>Years of Service</th><th>PTO Accrual (per pay period)</th></tr></thead>
  <tbody>
    <tr><td>0–2 years</td><td>3.08 hours</td></tr>
    <tr><td>2–5 years</td><td>4.62 hours</td></tr>
    <tr><td>5+ years</td><td>6.15 hours</td></tr>
  </tbody>
</table>
<h2>Requesting Time Off</h2>
<p>Submit PTO requests in the HR portal at least 5 business days in advance for planned absences. Urgent requests should be communicated directly to your manager as early as possible.</p>
<h2>Carryover</h2>
<p>Employees may carry over a maximum of 40 hours (one week) of unused PTO into the next calendar year. Unused hours above this cap are forfeited on December 31.</p>
<h2>Separation Payout</h2>
<p>Accrued, unused PTO up to the carryover cap will be paid out upon voluntary resignation or company-initiated separation in good standing.</p>`,
      tags: ['PTO', 'time off', 'leave policy', 'benefits'],
    },
  ],
  Sales: [
    {
      title: 'Sales Discovery Call Best Practices',
      summary:
        'How to run an effective discovery call that uncovers genuine pain points and advances the deal.',
      content: `<h2>Preparation</h2>
<p>Research the prospect's company, recent news, and LinkedIn profiles of attendees before the call. Prepare 3–5 open-ended questions tailored to their industry.</p>
<h2>Call Structure</h2>
<ol>
  <li><strong>Introduction (5 min):</strong> Set an agenda, confirm time available, and establish a collaborative tone.</li>
  <li><strong>Situation Questions (10 min):</strong> Understand the current state — tools in use, team size, workflows.</li>
  <li><strong>Problem Questions (10 min):</strong> Identify pain points and the business impact of not solving them.</li>
  <li><strong>Implication Questions (5 min):</strong> Explore downstream effects of the problem to build urgency.</li>
  <li><strong>Next Steps (5 min):</strong> Always end with a clear, agreed-upon next action and date.</li>
</ol>
<h2>Do's and Don'ts</h2>
<ul>
  <li>✅ Listen more than you talk (aim for 60/40 prospect/rep ratio).</li>
  <li>✅ Take notes in the CRM during the call.</li>
  <li>❌ Don't pitch too early — wait until you fully understand the need.</li>
  <li>❌ Don't let the call end without a concrete next step.</li>
</ul>`,
      tags: ['discovery', 'sales process', 'SPIN', 'CRM'],
    },
    {
      title: 'Competitive Battlecard: Key Differentiators',
      summary:
        'Quick-reference guide on how to position our product against top competitors in live deals.',
      content: `<h2>Why Prospects Choose Us Over Competitor A</h2>
<ul>
  <li><strong>Ease of Use:</strong> Our onboarding takes 2 days vs. their 2-week implementation.</li>
  <li><strong>Pricing Transparency:</strong> Flat-rate pricing with no hidden seat fees.</li>
  <li><strong>Customer Support:</strong> 24/7 live support vs. their email-only tier.</li>
</ul>
<h2>Why Prospects Choose Us Over Competitor B</h2>
<ul>
  <li><strong>Integrations:</strong> 150+ native integrations vs. their 40.</li>
  <li><strong>Scalability:</strong> No performance degradation reported above 10,000 users.</li>
  <li><strong>Data Residency:</strong> We offer EU data residency; they do not.</li>
</ul>
<h2>Common Objections and Responses</h2>
<p><strong>Objection:</strong> "Competitor A is cheaper."<br/>
<strong>Response:</strong> "Their base price is lower, but once you add the modules for [feature X] and [feature Y] that come standard with us, the total cost is comparable — and you get a better support experience."</p>`,
      tags: ['competitive intelligence', 'battlecard', 'objection handling'],
    },
    {
      title: 'CRM Hygiene Standards',
      summary:
        'Required fields, update cadence, and data quality standards for maintaining a clean CRM.',
      content: `<h2>Required Fields on Every Contact</h2>
<ul>
  <li>First Name, Last Name, Business Email</li>
  <li>Company Name and Account Owner</li>
  <li>Lead Source and Deal Stage</li>
  <li>Next Activity Date</li>
</ul>
<h2>Update Cadence</h2>
<p>Log all customer-facing interactions (calls, emails, meetings) within 24 hours. Update deal stage immediately after a stage-advancing event.</p>
<h2>Data Quality Rules</h2>
<ul>
  <li>No personal email addresses on company accounts.</li>
  <li>Use standardized company names — search before creating to avoid duplicates.</li>
  <li>Opportunities without activity for 30 days will be flagged for review by RevOps.</li>
</ul>`,
      tags: ['CRM', 'data quality', 'sales operations'],
    },
  ],
  Marketing: [
    {
      title: 'Content Calendar Management',
      summary:
        'How to plan, schedule, and maintain the quarterly content calendar across all channels.',
      content: `<h2>Calendar Structure</h2>
<p>The content calendar lives in the shared project management tool and is organized by channel (blog, social, email, paid) and mapped to campaign themes for the quarter.</p>
<h2>Planning Process</h2>
<ol>
  <li>Quarterly kickoff: Align with product and sales on themes and key dates.</li>
  <li>Draft the calendar at least 4 weeks ahead, filling all slots for the upcoming month.</li>
  <li>Assign owners and due dates for copy, design, and approvals.</li>
</ol>
<h2>Approval Workflow</h2>
<p>All content requires review from a Marketing Manager before publication. Legal review is required for any content making product claims or referencing competitors.</p>
<h2>Publishing Standards</h2>
<ul>
  <li>Blog posts: Published Tuesday–Thursday, 9–11 AM local audience time.</li>
  <li>Social: At least 3 posts per week per active channel.</li>
  <li>Email: No more than 2 marketing emails per week to any segment.</li>
</ul>`,
      tags: ['content calendar', 'planning', 'editorial', 'social media'],
    },
    {
      title: 'Brand Voice and Tone Guidelines',
      summary:
        'How to write and communicate in a way that reflects our brand identity across all channels.',
      content: `<h2>Our Brand Personality</h2>
<p>We are <strong>knowledgeable but approachable</strong>, <strong>direct but not cold</strong>, and <strong>confident but never arrogant</strong>. Every piece of content should feel like it was written by a helpful expert, not a corporate press release.</p>
<h2>Tone by Channel</h2>
<table>
  <thead><tr><th>Channel</th><th>Tone</th></tr></thead>
  <tbody>
    <tr><td>Website / Blog</td><td>Informative, warm, authoritative</td></tr>
    <tr><td>Social Media</td><td>Conversational, witty, human</td></tr>
    <tr><td>Email</td><td>Direct, helpful, low-pressure</td></tr>
    <tr><td>Support Docs</td><td>Clear, concise, neutral</td></tr>
  </tbody>
</table>
<h2>What to Avoid</h2>
<ul>
  <li>Jargon without explanation</li>
  <li>Passive voice — prefer active constructions</li>
  <li>Exclamation marks in formal content</li>
  <li>Superlatives without evidence ("best-in-class," "world-class")</li>
</ul>`,
      tags: ['brand voice', 'tone', 'writing guidelines', 'style guide'],
    },
    {
      title: 'Launching a Paid Ad Campaign – Checklist',
      summary:
        'Pre-launch checklist for search and social paid campaigns to catch common mistakes before going live.',
      content: `<h2>Before You Launch</h2>
<ul>
  <li>Campaign objective is defined and matches the funnel stage (awareness, consideration, conversion).</li>
  <li>Target audiences are finalized and segmented correctly.</li>
  <li>Budget is approved and flight dates are set.</li>
  <li>UTM parameters are added to all destination URLs.</li>
  <li>Conversion tracking is verified in Google Tag Manager / Meta Pixel.</li>
  <li>Ad copy and creatives are approved by Marketing Manager and Legal (if applicable).</li>
  <li>Landing page has been QA'd on mobile and desktop.</li>
</ul>
<h2>First 48 Hours</h2>
<p>Monitor delivery, CTR, and CPC daily. Flag any ad sets with below-average delivery to the channel manager immediately.</p>
<h2>Reporting</h2>
<p>Weekly performance reports are due every Monday by 10 AM for active campaigns. Use the standard reporting template in the shared drive.</p>`,
      tags: ['paid ads', 'PPC', 'campaign management', 'UTM', 'Google Ads'],
    },
  ],
  Engineering: [
    {
      title: 'Git Branching and PR Workflow',
      summary:
        'The standard branching strategy and pull request process used by the engineering team.',
      content: `<h2>Branch Naming</h2>
<p>Branches should follow the pattern: <code>&lt;type&gt;/&lt;short-description&gt;</code></p>
<ul>
  <li><code>feature/user-auth-refresh</code></li>
  <li><code>fix/null-pointer-login</code></li>
  <li><code>chore/update-dependencies</code></li>
  <li><code>docs/api-endpoints</code></li>
</ul>
<h2>Commit Messages</h2>
<p>Follow the Conventional Commits specification: <code>&lt;type&gt;(scope): &lt;short summary&gt;</code><br/>
Example: <code>feat(auth): add JWT refresh token support</code></p>
<h2>Pull Request Requirements</h2>
<ul>
  <li>All CI checks must pass before requesting review.</li>
  <li>At least one approval from a team member is required before merging.</li>
  <li>PRs should be kept small — under 400 lines of diff is strongly preferred.</li>
  <li>Include a description of <em>why</em> the change was made, not just what.</li>
</ul>
<h2>Merge Strategy</h2>
<p>Squash and merge is preferred for feature branches. Merge commits are used only for long-lived integration branches.</p>`,
      tags: ['git', 'branching', 'pull request', 'code review', 'workflow'],
    },
    {
      title: 'API Design Standards',
      summary:
        'Conventions for designing consistent, predictable RESTful APIs across all services.',
      content: `<h2>URL Conventions</h2>
<ul>
  <li>Use nouns, not verbs: <code>/api/users</code> not <code>/api/getUsers</code></li>
  <li>Plural resource names: <code>/articles</code> not <code>/article</code></li>
  <li>Kebab-case for multi-word paths: <code>/session-logs</code></li>
  <li>Nest sub-resources where appropriate: <code>/articles/:id/comments</code></li>
</ul>
<h2>HTTP Methods</h2>
<table>
  <thead><tr><th>Action</th><th>Method</th></tr></thead>
  <tbody>
    <tr><td>List resources</td><td>GET</td></tr>
    <tr><td>Get single resource</td><td>GET /:id</td></tr>
    <tr><td>Create resource</td><td>POST</td></tr>
    <tr><td>Full update</td><td>PUT /:id</td></tr>
    <tr><td>Partial update</td><td>PATCH /:id</td></tr>
    <tr><td>Delete</td><td>DELETE /:id</td></tr>
  </tbody>
</table>
<h2>Response Format</h2>
<p>All responses return JSON. Success responses include the resource data directly. Error responses include a top-level <code>message</code> field.</p>
<h2>Pagination</h2>
<p>List endpoints must support <code>page</code> and <code>limit</code> query parameters. The response envelope should include <code>total</code>, <code>page</code>, and <code>pages</code> fields.</p>`,
      tags: ['API', 'REST', 'design standards', 'conventions'],
    },
    {
      title: 'Incident Response Runbook',
      summary:
        'How to detect, communicate, and resolve production incidents with minimal customer impact.',
      content: `<h2>Severity Levels</h2>
<table>
  <thead><tr><th>Level</th><th>Definition</th><th>Response Time</th></tr></thead>
  <tbody>
    <tr><td>SEV-1</td><td>Complete outage or data loss</td><td>Immediate (24/7)</td></tr>
    <tr><td>SEV-2</td><td>Degraded performance affecting majority of users</td><td>30 min (business hours)</td></tr>
    <tr><td>SEV-3</td><td>Minor feature unavailable; workaround exists</td><td>4 hours</td></tr>
  </tbody>
</table>
<h2>Response Steps</h2>
<ol>
  <li><strong>Declare:</strong> Open an incident channel in Slack and assign an Incident Commander.</li>
  <li><strong>Communicate:</strong> Post an initial status update within 15 minutes of detection.</li>
  <li><strong>Diagnose:</strong> Check dashboards, logs, and recent deployments for root cause.</li>
  <li><strong>Mitigate:</strong> Roll back or patch to restore service as quickly as possible.</li>
  <li><strong>Resolve:</strong> Confirm resolution, update status page, and close the incident channel.</li>
  <li><strong>Post-Mortem:</strong> Complete a blameless post-mortem within 5 business days.</li>
</ol>`,
      tags: ['incident response', 'runbook', 'outage', 'SRE', 'on-call'],
    },
  ],
  Product: [
    {
      title: 'Writing a Product Requirements Document (PRD)',
      summary:
        'Template and guidance for writing clear, actionable PRDs that engineering can build from.',
      content: `<h2>PRD Structure</h2>
<h3>1. Problem Statement</h3>
<p>Describe the user problem being solved. Include data or qualitative evidence. Avoid describing the solution here.</p>
<h3>2. Goals and Success Metrics</h3>
<p>Define 2–4 measurable outcomes (e.g., "Reduce time-to-first-value from 5 days to 1 day"). Link to OKRs where applicable.</p>
<h3>3. Scope</h3>
<p>List what is explicitly in scope and out of scope for this release. Out-of-scope items often become future backlog items.</p>
<h3>4. User Stories</h3>
<p>Format: <em>As a [user type], I want to [action] so that [benefit].</em></p>
<h3>5. Acceptance Criteria</h3>
<p>Per user story, define the conditions that must be true for the story to be considered complete (Given/When/Then format).</p>
<h3>6. Open Questions</h3>
<p>List decisions still to be made and who is responsible for resolving them.</p>`,
      tags: ['PRD', 'product requirements', 'documentation', 'user stories'],
    },
    {
      title: 'Roadmap Prioritization Framework',
      summary:
        'How the product team uses RICE scoring to prioritize the roadmap objectively.',
      content: `<h2>RICE Scoring</h2>
<p>RICE = (Reach × Impact × Confidence) / Effort</p>
<table>
  <thead><tr><th>Factor</th><th>Definition</th><th>Scale</th></tr></thead>
  <tbody>
    <tr><td>Reach</td><td>Number of users affected per quarter</td><td>Number</td></tr>
    <tr><td>Impact</td><td>Effect on goal per user touched</td><td>3/2/1/0.5/0.25</td></tr>
    <tr><td>Confidence</td><td>How sure we are of estimates</td><td>100%/80%/50%</td></tr>
    <tr><td>Effort</td><td>Person-months required</td><td>Number</td></tr>
  </tbody>
</table>
<h2>Process</h2>
<ol>
  <li>PMs score all candidate items before the quarterly planning meeting.</li>
  <li>Scores are reviewed and challenged by the product team collectively.</li>
  <li>Top-scored items are slotted into the roadmap, subject to capacity.</li>
  <li>Scores are documented and archived with the roadmap for future reference.</li>
</ol>`,
      tags: ['RICE', 'prioritization', 'roadmap', 'product management'],
    },
    {
      title: 'Beta Program Management',
      summary:
        'How to recruit, manage, and extract value from beta users before a general release.',
      content: `<h2>Recruiting Beta Users</h2>
<p>Target power users who have opted in to early access communications. Aim for a cohort of 20–50 users representing diverse company sizes and use cases.</p>
<h2>Beta Program Structure</h2>
<ol>
  <li><strong>Kick-off:</strong> Onboarding call to explain the feature, set expectations, and establish a feedback channel (Slack or email).</li>
  <li><strong>Active Phase (2–4 weeks):</strong> Bi-weekly check-ins, usage monitoring, and rapid iteration on blockers.</li>
  <li><strong>Close-out:</strong> Exit survey, public case study opportunity offer, and personal thank-you.</li>
</ol>
<h2>Feedback Collection</h2>
<p>Use a structured feedback template covering: (1) task completion, (2) ease of use (1–5), (3) most valuable feature, and (4) biggest pain point. Aggregate quantitative data in the product analytics dashboard.</p>`,
      tags: ['beta', 'user research', 'product launch', 'feedback'],
    },
  ],
  Finance: [
    {
      title: 'Expense Reimbursement Policy',
      summary:
        'Eligible expenses, required documentation, submission deadlines, and reimbursement timelines.',
      content: `<h2>Eligible Expenses</h2>
<ul>
  <li>Business travel: flights, hotels, ground transportation (up to policy limits)</li>
  <li>Client meals (up to $75/person with prior manager approval)</li>
  <li>Home office equipment (pre-approval required above $200)</li>
  <li>Professional development: courses, books, conferences (pre-approval required)</li>
</ul>
<h2>Required Documentation</h2>
<p>All expenses require original itemized receipts. Credit card statements alone are not accepted. For meals, include the names and business purpose of attendees.</p>
<h2>Submission Process</h2>
<ol>
  <li>Submit expenses in the expense management tool within 30 days of incurring the expense.</li>
  <li>Attach receipts and include a brief business purpose description for each line item.</li>
  <li>Your manager approves; Finance reviews and approves within 5 business days.</li>
</ol>
<h2>Reimbursement</h2>
<p>Approved expenses are reimbursed via direct deposit on the next standard payroll cycle after Finance approval.</p>`,
      tags: ['expenses', 'reimbursement', 'travel policy', 'finance'],
    },
    {
      title: 'Budget Request Process',
      summary:
        'How to submit, justify, and track approval of budget requests outside the annual cycle.',
      content: `<h2>When to Submit an Out-of-Cycle Request</h2>
<p>Submit an out-of-cycle budget request when an unplanned business need arises that cannot wait for the next annual planning cycle and exceeds $5,000.</p>
<h2>Required Information</h2>
<ul>
  <li>Business justification and expected ROI or cost avoidance</li>
  <li>Requested amount and target account code</li>
  <li>Vendor quotes or estimates (minimum 2 for amounts over $10,000)</li>
  <li>Desired timeline / urgency rationale</li>
</ul>
<h2>Approval Thresholds</h2>
<table>
  <thead><tr><th>Amount</th><th>Approver</th></tr></thead>
  <tbody>
    <tr><td>$5,000–$24,999</td><td>Department VP</td></tr>
    <tr><td>$25,000–$99,999</td><td>CFO</td></tr>
    <tr><td>$100,000+</td><td>CFO + CEO</td></tr>
  </tbody>
</table>`,
      tags: ['budget', 'approval', 'finance', 'procurement'],
    },
  ],
  Legal: [
    {
      title: 'Contract Review Request Process',
      summary:
        'How to submit contracts to Legal for review and what to expect during the review cycle.',
      content: `<h2>When to Involve Legal</h2>
<p>Any third-party contract, addendum, or SOW must be reviewed by Legal before signature. Never sign on behalf of the company without Legal sign-off.</p>
<h2>Submission Process</h2>
<ol>
  <li>Upload the contract to the Legal intake portal.</li>
  <li>Complete the intake form: contract type, counterparty, business owner, desired signing date, and a brief description of the business purpose.</li>
  <li>Flag any time-sensitive deadlines in the "Urgency" field.</li>
</ol>
<h2>Review SLAs</h2>
<table>
  <thead><tr><th>Contract Type</th><th>Standard SLA</th></tr></thead>
  <tbody>
    <tr><td>NDA (standard template)</td><td>2 business days</td></tr>
    <tr><td>SaaS vendor agreement</td><td>5 business days</td></tr>
    <tr><td>Enterprise customer contract</td><td>10 business days</td></tr>
    <tr><td>Complex / custom terms</td><td>To be scoped individually</td></tr>
  </tbody>
</table>
<h2>Redlines and Negotiation</h2>
<p>Legal will return a redlined version for internal review before sending to the counterparty. Do not share redlines externally without Legal approval.</p>`,
      tags: ['contracts', 'legal review', 'NDA', 'compliance'],
    },
    {
      title: 'Data Privacy and GDPR Compliance Overview',
      summary:
        'Internal guide to understanding our data privacy obligations and how to handle personal data responsibly.',
      content: `<h2>What is Personal Data?</h2>
<p>Any information that can identify a natural person, directly or indirectly — including names, email addresses, IP addresses, and behavioral data.</p>
<h2>Key GDPR Principles</h2>
<ul>
  <li><strong>Lawfulness:</strong> We must have a valid legal basis for each processing activity (consent, contract, legitimate interest, etc.).</li>
  <li><strong>Purpose Limitation:</strong> Data collected for one purpose cannot be repurposed without a new legal basis.</li>
  <li><strong>Data Minimization:</strong> Collect only what is strictly necessary.</li>
  <li><strong>Accuracy:</strong> Keep personal data up to date.</li>
  <li><strong>Storage Limitation:</strong> Don't retain data longer than necessary.</li>
  <li><strong>Integrity and Confidentiality:</strong> Protect data against unauthorized access and breaches.</li>
</ul>
<h2>Your Responsibilities</h2>
<p>If you receive a data subject access request (DSAR) or become aware of a potential data breach, notify the Legal/Privacy team within 24 hours. Do not respond to DSARs directly.</p>`,
      tags: ['GDPR', 'data privacy', 'compliance', 'personal data'],
    },
  ],
  Operations: [
    {
      title: 'Vendor Onboarding Procedure',
      summary:
        'Steps required to add a new vendor to the approved vendor list and set up payment terms.',
      content: `<h2>New Vendor Request</h2>
<p>All new vendor relationships must go through the formal onboarding process before any goods or services are delivered. Working with an unapproved vendor is a policy violation.</p>
<h2>Required Documentation</h2>
<ul>
  <li>Completed vendor application form</li>
  <li>W-9 (domestic) or W-8BEN (foreign vendors)</li>
  <li>Certificate of Insurance (minimum $1M general liability)</li>
  <li>Signed vendor code of conduct</li>
  <li>Legal-reviewed and executed contract</li>
</ul>
<h2>Approval Workflow</h2>
<ol>
  <li>Requesting department submits all documents to Procurement.</li>
  <li>Procurement reviews for completeness and compliance.</li>
  <li>Finance adds vendor to the accounts payable system.</li>
  <li>Requesting department is notified when the vendor is approved.</li>
</ol>
<h2>Payment Terms</h2>
<p>Standard payment terms are Net 30 unless negotiated otherwise and approved by Finance. Document any deviations in the contract.</p>`,
      tags: ['vendor management', 'procurement', 'onboarding', 'AP'],
    },
    {
      title: 'Business Continuity Plan Overview',
      summary:
        'Summary of our business continuity and disaster recovery plans for key operational risks.',
      content: `<h2>Purpose</h2>
<p>The Business Continuity Plan (BCP) ensures critical operations can continue or be rapidly restored following a disruptive event such as a natural disaster, cyberattack, or facility outage.</p>
<h2>Risk Categories Covered</h2>
<ul>
  <li>IT system failures and cybersecurity incidents</li>
  <li>Facility inaccessibility (fire, flooding, evacuation)</li>
  <li>Key personnel unavailability</li>
  <li>Supply chain disruption</li>
</ul>
<h2>Critical Recovery Objectives</h2>
<p><strong>RTO (Recovery Time Objective):</strong> Core systems restored within 4 hours.<br/>
<strong>RPO (Recovery Point Objective):</strong> No more than 1 hour of data loss.</p>
<h2>Testing</h2>
<p>The BCP is tested twice per year via tabletop exercises. Results and action items are reviewed by the Operations leadership team and updated accordingly.</p>`,
      tags: ['BCP', 'disaster recovery', 'continuity', 'risk management'],
    },
  ],
  Other: [
    {
      title: 'Company Communication Guidelines',
      summary:
        'Expectations for professional communication across internal and external channels.',
      content: `<h2>Email</h2>
<ul>
  <li>Use a clear, specific subject line.</li>
  <li>Respond to internal emails within one business day.</li>
  <li>Use CC sparingly — include only those who must be aware.</li>
  <li>Avoid sending emails outside business hours unless urgent.</li>
</ul>
<h2>Instant Messaging (Slack / Teams)</h2>
<ul>
  <li>Use the appropriate channel — don't post announcements in team channels.</li>
  <li>Respect Do Not Disturb hours.</li>
  <li>For complex topics, prefer a quick call over a long thread.</li>
</ul>
<h2>Meetings</h2>
<ul>
  <li>Every meeting needs an agenda sent at least 24 hours in advance.</li>
  <li>Start and end on time.</li>
  <li>Send meeting notes with action items within 24 hours of the meeting.</li>
</ul>`,
      tags: ['communication', 'email etiquette', 'meetings', 'Slack'],
    },
    {
      title: 'Workplace Safety and Emergency Procedures',
      summary:
        'Essential safety information every employee should know, including evacuation routes and emergency contacts.',
      content: `<h2>Emergency Contacts</h2>
<ul>
  <li>Emergency Services: 911</li>
  <li>Building Security: extension 5555</li>
  <li>Facilities Manager: extension 5100</li>
</ul>
<h2>Evacuation Procedure</h2>
<ol>
  <li>Upon hearing the fire alarm, immediately stop work and leave via the nearest marked exit.</li>
  <li>Do not use elevators.</li>
  <li>Proceed to the designated assembly point (parking lot B).</li>
  <li>Do not re-enter the building until cleared by emergency personnel.</li>
  <li>Account for all team members and report headcount to your floor warden.</li>
</ol>
<h2>Reporting Safety Concerns</h2>
<p>Report any unsafe conditions or near-misses to Facilities using the safety concern form in the employee portal. All reports are investigated within 2 business days.</p>`,
      tags: ['safety', 'emergency procedures', 'evacuation', 'facilities'],
    },
  ],
};

// Flatten all articles into a single pool with their department
const ARTICLE_POOL = Object.entries(ARTICLES_BY_DEPARTMENT).flatMap(
  ([dept, articles]) => articles.map((a) => ({ ...a, department: [dept] })),
);

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
function pick(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

function pickStatus() {
  if (FORCED_STATUS) return FORCED_STATUS;
  // Weighted distribution: Approved 50%, Pending 25%, Draft 15%, Rejected 10%
  const rand = Math.random();
  if (rand < 0.5) return 'Approved';
  if (rand < 0.75) return 'Pending';
  if (rand < 0.9) return 'Draft';
  return 'Rejected';
}

function randomPastDate(daysBack = 180) {
  const ms = Date.now() - Math.random() * daysBack * 24 * 60 * 60 * 1000;
  return new Date(ms);
}

// ---------------------------------------------------------------------------
// Seed logic
// ---------------------------------------------------------------------------
async function getOrCreateSeedCompany() {
  if (GIVEN_COMPANY_ID) {
    const company = await Company.findById(GIVEN_COMPANY_ID);
    if (!company) throw new Error(`Company not found: ${GIVEN_COMPANY_ID}`);
    console.log(`✅ Using existing company: "${company.name}"`);
    return company;
  }

  // Prefer an existing active company so seeded articles are visible to
  // real users already in the database.
  const activeCompany = await Company.findOne({ status: 'Active', isActive: true });
  if (activeCompany) {
    console.log(`✅ Using existing active company: "${activeCompany.name}" (${activeCompany._id})`);
    return activeCompany;
  }

  // Fall back to the isolated seed company only when no real company exists yet.
  const existing = await Company.findOne({ emailDomain: 'seedcorp.example' });
  if (existing) {
    console.log(`✅ Seed company already exists: "${existing.name}"`);
    return existing;
  }

  const company = await Company.create({
    name: 'Seed Corp (Placeholder)',
    emailDomain: 'seedcorp.example',
    status: 'Active',
    isActive: true,
  });
  console.log(`✅ Created seed company: "${company.name}" (${company._id})`);
  return company;
}

async function getOrCreateSeedAuthor(companyId) {
  if (GIVEN_AUTHOR_ID) {
    const user = await User.findById(GIVEN_AUTHOR_ID);
    if (!user) throw new Error(`User not found: ${GIVEN_AUTHOR_ID}`);
    console.log(`✅ Using existing author: "${user.firstName} ${user.lastName}"`);
    return user;
  }

  // Prefer an existing Admin/Manager in the chosen company so articles are
  // owned by a real user and pass all company-access checks.
  const existingUser = await User.findOne({
    companyId: companyId,
    role: { $in: ['Admin', 'Manager'] },
  });
  if (existingUser) {
    console.log(`✅ Using existing company user: "${existingUser.firstName} ${existingUser.lastName}" (${existingUser._id})`);
    return existingUser;
  }

  // Fall back to the dedicated seed author for isolated/empty databases.
  const existing = await User.findOne({ email: 'seed.author@seedcorp.example' });
  if (existing) {
    console.log(`✅ Seed author already exists: "${existing.firstName} ${existing.lastName}"`);
    return existing;
  }

  const salt = await bcrypt.genSalt(10);
  const hashedPassword = await bcrypt.hash('SeedPassword123!', salt);

  const user = await User.create({
    firstName: 'Seed',
    lastName: 'Author',
    email: 'seed.author@seedcorp.example',
    password: hashedPassword,
    department: 'Other',
    role: ['Admin'],
    companyId: [companyId],
    isVerified: true,
  });
  console.log(`✅ Created seed author: "${user.firstName} ${user.lastName}" (${user._id})`);
  return user;
}

async function seed() {
  const mongoUri = process.env.MONGO_URI;
  if (!mongoUri) {
    console.error('❌ MONGO_URI is not set. Make sure you run with: node -r dotenv/config scripts/seedArticles.js');
    process.exit(1);
  }

  console.log('🔌 Connecting to MongoDB…');
  await mongoose.connect(mongoUri);
  console.log('✅ Connected.\n');

  const company = await getOrCreateSeedCompany();
  const author = await getOrCreateSeedAuthor(company._id);

  if (CLEAR) {
    const { deletedCount } = await Article.deleteMany({ companyId: company._id });
    console.log(`🗑️  Cleared ${deletedCount} existing articles for company "${company.name}".`);
  }

  console.log(`\n📝 Generating ${COUNT} placeholder articles…\n`);

  // Cycle through pool to avoid repetition when COUNT > pool size
  const articles = [];
  for (let i = 0; i < COUNT; i++) {
    const template = ARTICLE_POOL[i % ARTICLE_POOL.length];
    const status = pickStatus();
    const createdAt = randomPastDate(365);

    const articleData = {
      companyId: company._id,
      authorId: author._id,
      title: COUNT > ARTICLE_POOL.length ? `${template.title} (${Math.floor(i / ARTICLE_POOL.length) + 1})` : template.title,
      content: template.content,
      summary: template.summary,
      tags: template.tags,
      department: template.department,
      status,
      createdAt,
      updatedAt: createdAt,
      expiresAt: new Date(createdAt.getTime() + 180 * 24 * 60 * 60 * 1000),
      lastReviewedAt: createdAt,
      ...(status === 'Approved' && { approverId: author._id }),
      ...(status === 'Rejected' && {
        approverId: author._id,
        rejectionReason: 'Content requires further review and clarification before approval.',
      }),
    };

    articles.push(articleData);
  }

  const inserted = await Article.insertMany(articles);
  console.log(`✅ Successfully inserted ${inserted.length} articles.\n`);

  // Summary breakdown
  const statusCounts = inserted.reduce((acc, a) => {
    acc[a.status] = (acc[a.status] ?? 0) + 1;
    return acc;
  }, {});
  console.log('📊 Status breakdown:');
  Object.entries(statusCounts).forEach(([s, n]) => console.log(`   ${s}: ${n}`));

  console.log(`\n🏢 Company ID : ${company._id}`);
  console.log(`👤 Author ID  : ${author._id}`);
  console.log('\n✅ Seeding complete.');

  await mongoose.disconnect();
}

seed().catch((err) => {
  console.error('❌ Seeding failed:', err.message);
  process.exit(1);
});
