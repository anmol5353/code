# Dropdeck

A browser-based batch uploader for moving large folders into Google Drive.

## Setup

1. In Google Cloud, enable the Google Drive API and create an OAuth 2.0 **Web application** client.
2. Add `http://localhost:5173` to the client's allowed JavaScript origins.
3. Install Node.js, then run:

```powershell
npm install
npm run dev
```

4. Open the local URL, paste the OAuth client ID, and connect Google Drive.

The app uploads directly from the browser using resumable Drive uploads. Choose a batch size to control how many files are processed at once. Google credentials are kept in memory and are not sent to a server.
