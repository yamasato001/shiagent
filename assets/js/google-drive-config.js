// Google Drive picker / upload settings (Google Cloud console > APIs & Services).
// - clientId: OAuth 2.0 client ID of type "Web application". Its authorised
//   JavaScript origins must list https://shiagent.com (and local preview origins).
// - apiKey: API key restricted to the Google Picker API and to this site's referrers.
// - appId: the Cloud project number. Picker needs it so that files chosen with
//   the drive.file scope become readable by this app.
// The Drive buttons stay hidden until clientId and apiKey are filled in.
export const GOOGLE_DRIVE = Object.freeze({
  clientId: "25156832127-dicu1b32244dkpfp2vek9o4e1ptd8dnp.apps.googleusercontent.com",
  apiKey: "AIzaSyBnPqZCFXsqEnw8WHTOK1Xkrz1e4naETtc",
  appId: "25156832127",
});
