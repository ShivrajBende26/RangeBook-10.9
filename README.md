# RangeBook 10.9 website

Run `npm install` once and `npm start` to preview the site through Express. The
pages remain viewable without a database; event features and contact form
submissions return an explicit configuration error until PostgreSQL is connected.
If port 3000 is already occupied by an older server process, use the VS Code
task **Start RangeBook 10.9 - Updated Assets** and open
<http://localhost:3001>.
To use the dedicated Pug preview task, run **Start RangeBook 10.9 - Pug**
and open <http://localhost:3002>.
For the HTML homepage preview, run **Start RangeBook 10.9 - HTML Overview**
and open <http://localhost:3003>. The homepage source is `public/index.html`;
save and reload the page to see edits.

## Server structure

The Express application follows MVC responsibilities: `models/` handles
PostgreSQL event data, `controllers/` handles API and page requests,
`routes/` maps API and page URLs, and `views/` contains the Pug templates for
the secondary pages. The editable homepage overview is `public/index.html`;
its navigation links to the Pug-rendered pages. Feed synchronization lives in
`services/`, shared access checks in `middleware/`, and input validation in
`utils/`. `server.js`
loads configuration, initializes the database, and starts the web server.
Public assets follow the `public/css/`, `public/js/`, and `public/img/` layout
and are served as static files by Express.

## Enable the event service with local PostgreSQL

The marketing pages and assets run without a database. PostgreSQL is required
for contact enquiries, live event listings, event submissions, and admin review.
The app creates its tables and indexes automatically after it connects.

1. Install PostgreSQL for Windows and make sure its service is running on port
   `5432`.
2. In pgAdmin, connect to the server with a PostgreSQL administrator account
   (usually `postgres`), open the Query Tool for the `postgres` database, and
   create a dedicated app login and its owned database:
   ```sql
   CREATE ROLE shooters_app LOGIN PASSWORD 'replace-with-a-strong-password';
   CREATE DATABASE shooters_pocket_diary OWNER shooters_app;
   ```
   `CREATE DATABASE` requires a superuser or a role with the `CREATEDB`
   privilege. If you see `permission denied to create database`, the current
   pgAdmin connection is not an administrator; reconnect using the account
   created during PostgreSQL installation, or ask your database administrator
   to run the SQL above. Do not grant `CREATEDB` to an application login.
3. Copy `.env.example` to `.env`. Set `DATABASE_URL` to
   `postgresql://shooters_app:URL_ENCODED_PASSWORD@localhost:5432/shooters_pocket_diary`,
   replacing the placeholder with the app login password. Keep `.env` private;
   it is ignored by Git. URL-encode special characters in the password.
4. Generate a separate, private admin key with
   `node -e "console.log(require('node:crypto').randomBytes(32).toString('hex'))"`
   and put it in `ADMIN_API_KEY` in `.env`. Do not reuse the database password.
5. Start the server with `npm start`. If PostgreSQL is not installed or the
   connection settings are wrong, the marketing pages can still be viewed, but
   database-backed API requests return a clear `503` response.

Keep `EVENT_FEEDS` as `[]` until you have public iCalendar (`.ics`) feeds.
When available, configure each feed as an item with `name`, `url`, `sourceUrl`,
and optional `eventType` (`competition`, `training`, or `news`). Optional
`city`, `district`, and `state` fields provide region defaults when an
iCalendar entry does not include them. `url` is fetched only by the server;
`sourceUrl` is the public organizer page shown to visitors.

The public pages show upcoming approved competitions, training sessions, and
news/official notices from `GET /api/events`. The endpoint accepts optional
`state`, `district`, `city`, and `eventType` filters. Pages refresh event data
every 15 minutes. Organizers can submit events or notices through the homepage
form; submissions stay private until the source is checked and approved at
`/event-admin.html`. Enter the server-side admin key there. Never put that key
in HTML, JavaScript, or a public feed URL.

The Contact page form saves the visitor's name, email, and message to the
`contact_submissions` table in PostgreSQL; it does not open Gmail or send email.
To export enquiries, open `/event-admin.html`, enter the `ADMIN_API_KEY`, then
choose **Download enquiries for Excel**. This downloads a UTF-8 CSV that opens
in Excel. The export is protected by the admin key and is generated on demand;
it does not automatically sync with a workbook. Keep enquiry exports private.

Configured iCalendar feeds sync on server startup and every six hours while
the service is running. The current NRAI notice and results pages are linked
directly because no documented machine-readable feed was confirmed. State,
district, and club events need their own public feeds or verified submissions;
the system does not claim complete nationwide coverage without those sources.

## Official shooting event sources researched

Checked on 2026-11-12:

- NRAI notices and circulars: <https://www.thenrai.in/Archieves.aspx>
- NRAI published results: <https://www.thenrai.in/Results.aspx>
- NRAI organization and affiliated-unit information: <https://www.thenrai.in/about_us.aspx?link=3>
- NRAI public disclosure, including affiliated-unit and national/zonal calendar annexures: <https://www.thenrai.in/about_us.aspx?link=6>
- ISSF international calendar: <https://www.issf-sports.org/calendar>
- ISSF competitions and results: <https://www.issf-sports.org/competitions>

NRAI states that it has 53 affiliated State Associations and Units and that
competitions take place at national, state, district, and club levels. Its
notices and results pages are paginated HTML, while its public disclosure
references downloadable annexures for affiliated units and national/zonal
calendars. The ISSF calendar publishes dated international fixtures and
competition-detail links. No documented public iCalendar or event API was
identified on these pages, so they are currently linked as authoritative
sources rather than automatically imported. State, district, and club coverage
requires verified feeds or submissions from the relevant organizers.
The NRAI introduction page also names ranges in Delhi, Pune, and
Thiruvananthapuram, plus Patiala for shotgun events, as having capacity for
international competitions; this does not confirm current course availability.

## Deploy on Render

Create a PostgreSQL database and a Node web service in Render. Connect the
service to the database in the same region and configure `DATABASE_URL` with
the database's internal connection string, `ADMIN_API_KEY` with a separate
private key, `EVENT_FEEDS` as `[]` until official feeds are available, and
`NODE_ENV` as `production`. Use `npm ci` as the build command, `npm start` as
the start command, and `/api/health` as the health-check path. Let Render supply
the `PORT`. Use an always-on service if six-hour feed synchronization must run
continuously. Render plan availability and charges depend on the options
selected; no resources are provisioned by this project.
